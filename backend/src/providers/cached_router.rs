use crate::cache::{keys::CacheKey, CacheManager};
use crate::models::*;
use crate::providers::{GovToolsEnrichment, GovToolsProvider, Router};
use crate::services::metadata_validation::{MetadataValidator, VerifierConfig};
use crate::utils::drep_id::decode_drep_id_to_hex;
use futures::future::join_all;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tracing::debug;

const CARDANO_EPOCH_DURATION_SECONDS: u64 = 432_000;

pub struct CachedProviderRouter {
    router: Arc<dyn Router + Send + Sync>,
    cache: Arc<CacheManager>,
    govtools: Option<Arc<GovToolsProvider>>,
    metadata_validator: Arc<MetadataValidator>,
}

impl CachedProviderRouter {
    pub fn new(
        router: impl Router + Send + Sync + 'static,
        cache: CacheManager,
        govtools: Option<GovToolsProvider>,
        verifier: Option<VerifierConfig>,
    ) -> Self {
        let cache = Arc::new(cache);
        let metadata_validator = Arc::new(MetadataValidator::new(cache.clone(), verifier));
        Self {
            router: Arc::new(router),
            cache,
            govtools: govtools.map(Arc::new),
            metadata_validator,
        }
    }
}

impl Clone for CachedProviderRouter {
    fn clone(&self) -> Self {
        Self {
            router: Arc::clone(&self.router),
            cache: Arc::clone(&self.cache),
            govtools: self.govtools.as_ref().map(|g| Arc::clone(g)),
            metadata_validator: Arc::clone(&self.metadata_validator),
        }
    }
}

impl CachedProviderRouter {
    pub async fn get_dreps_page(&self, query: &DRepsQuery) -> Result<DRepsPage, anyhow::Error> {
        let mut normalized = query.clone().with_defaults();
        // Default behavior: include active and inactive, exclude retired (unless caller specifies statuses)
        if self.govtools.is_some() && normalized.normalized_statuses().is_empty() {
            normalized.statuses = vec!["active".to_string(), "inactive".to_string()];
        }
        let cache_key = CacheKey::DRepsPage {
            page: normalized.normalized_page(),
            count: normalized.count,
            filters: normalized.cache_descriptor(),
        };

        // Check cache first
        if let Some(cached) = self.cache.get::<DRepsPage>(&cache_key).await {
            debug!(
                "Cache hit for DReps page {}:{}",
                normalized.normalized_page(),
                normalized.count
            );
            return Ok(cached);
        }

        // Cache miss - fetch from provider
        debug!(
            "Cache miss for DReps page {}:{}, fetching from provider",
            normalized.normalized_page(),
            normalized.count
        );
        let mut used_fallback = false;
        let mut result = if let Some(provider) = &self.govtools {
            match provider.list_dreps(&normalized).await {
                Ok(page_result) => {
                    if page_result.dreps.is_empty() && !normalized.has_filters() {
                        used_fallback = true;
                        self.router.get_dreps_page(&normalized).await?
                    } else {
                        page_result
                    }
                }
                Err(error) => {
                    tracing::debug!(
                        "GovTools list failed for page {}:{} with filters {:?}: {}",
                        normalized.normalized_page(),
                        normalized.count,
                        normalized.cache_descriptor(),
                        error
                    );
                    used_fallback = true;
                    self.router.get_dreps_page(&normalized).await?
                }
            }
        } else {
            used_fallback = true;
            self.router.get_dreps_page(&normalized).await?
        };

        if used_fallback && self.govtools.is_some() && !result.dreps.is_empty() {
            let futures = result.dreps.into_iter().map(|drep| self.enrich_drep(drep));
            let enriched = join_all(futures).await;
            result.dreps = enriched;
        }

        // Store in cache
        self.cache.set(&cache_key, &result).await;
        Ok(result)
    }

    pub async fn get_drep_stats(&self) -> Result<DRepStats, anyhow::Error> {
        let cache_key = CacheKey::DRepStats;

        if let Some(cached) = self.cache.get::<DRepStats>(&cache_key).await {
            debug!("Cache hit for DRep stats");
            return Ok(cached);
        }

        debug!("Cache miss for DRep stats, aggregating metrics");

        let active_count = self.router.get_total_active_dreps().await?;
        let mut total_count: u64 = 0;
        let mut reported_total: Option<u64> = None;
        let mut total_voting_power: u128 = 0;
        let mut top_candidate: Option<(String, Option<String>, u128)> = None;

        let mut page = 1u32;
        const PAGE_SIZE: u32 = 200;
        const MAX_PAGES: u32 = 50;

        loop {
            let query = DRepsQuery {
                page,
                count: PAGE_SIZE,
                statuses: Vec::new(),
                search: None,
                sort: Some("VotingPower".to_string()),
                direction: Some("Descending".to_string()),
                enrich: false,
            }
            .with_defaults();

            let page_result = match self.fetch_stats_page(&query).await {
                Ok(result) => result,
                Err(error) => {
                    tracing::debug!("Failed to fetch DRep stats page {}: {}", page, error);
                    break;
                }
            };

            if reported_total.is_none() {
                reported_total = page_result.total;
            }

            if page_result.dreps.is_empty() {
                break;
            }

            for drep in &page_result.dreps {
                total_count = total_count.saturating_add(1);

                if let Some(power) = Self::extract_voting_power(drep) {
                    total_voting_power = total_voting_power.saturating_add(power);

                    match &top_candidate {
                        Some((_, _, current_power)) if &power <= current_power => {}
                        _ => {
                            let name = drep
                                .given_name
                                .clone()
                                .or_else(|| {
                                    drep.metadata.as_ref().and_then(|meta| {
                                        meta.extra
                                            .get("name")
                                            .and_then(|value| value.as_str().map(|s| s.to_string()))
                                    })
                                })
                                .or_else(|| drep.view.clone());
                            top_candidate = Some((drep.drep_id.clone(), name, power));
                        }
                    }
                }
            }

            if !page_result.has_more || page >= MAX_PAGES {
                break;
            }

            page = page.saturating_add(1);
        }

        let total_count = reported_total.unwrap_or(total_count);
        let total_voting_power = if total_voting_power > 0 {
            Some(total_voting_power.to_string())
        } else {
            None
        };

        let top_drep = top_candidate.map(|(id, name, power)| DRepLeader {
            drep_id: id,
            name,
            voting_power: Some(power.to_string()),
        });

        let stats = DRepStats {
            active_dreps_count: active_count,
            total_dreps_count: Some(total_count),
            total_voting_power,
            top_drep,
        };

        self.cache.set(&cache_key, &stats).await;
        Ok(stats)
    }

    pub async fn get_drep(&self, id: &str) -> Result<Option<DRep>, anyhow::Error> {
        let cache_key = CacheKey::DRep { id: id.to_string() };

        // Check cache first
        if let Some(cached) = self.cache.get::<DRep>(&cache_key).await {
            debug!("Cache hit for DRep {}", id);
            return Ok(Some(cached));
        }

        // Cache miss - fetch from provider
        debug!("Cache miss for DRep {}, fetching from provider", id);
        match self.router.get_drep(id).await? {
            Some(drep) => {
                let enriched = self.enrich_drep(drep).await;
                // Store in cache
                self.cache.set(&cache_key, &enriched).await;
                Ok(Some(enriched))
            }
            None => Ok(None),
        }
    }

    pub async fn get_drep_delegators(&self, id: &str) -> Result<Vec<DRepDelegator>, anyhow::Error> {
        let cache_key = CacheKey::DRepDelegators { id: id.to_string() };

        // Check cache first
        if let Some(cached) = self.cache.get::<Vec<DRepDelegator>>(&cache_key).await {
            debug!("Cache hit for DRep delegators {}", id);
            return Ok(cached);
        }

        // Cache miss - fetch from provider
        debug!(
            "Cache miss for DRep delegators {}, fetching from provider",
            id
        );
        let result = self.router.get_drep_delegators(id).await?;

        // Store in cache
        self.cache.set(&cache_key, &result).await;
        Ok(result)
    }

    pub async fn get_drep_voting_history(
        &self,
        id: &str,
    ) -> Result<Vec<DRepVotingHistory>, anyhow::Error> {
        let cache_key = CacheKey::DRepVotingHistory { id: id.to_string() };

        // Check cache first
        if let Some(cached) = self.cache.get::<Vec<DRepVotingHistory>>(&cache_key).await {
            debug!("Cache hit for DRep voting history {}", id);
            return Ok(cached);
        }

        // Cache miss - fetch from provider
        debug!(
            "Cache miss for DRep voting history {}, fetching from provider",
            id
        );
        let result = self.router.get_drep_voting_history(id).await?;

        // Store in cache
        self.cache.set(&cache_key, &result).await;
        Ok(result)
    }

    pub async fn get_governance_actions_page(
        &self,
        page: u32,
        count: u32,
    ) -> Result<ActionsPage, anyhow::Error> {
        let cache_key = CacheKey::ActionsPage { page, count };

        // Check cache first
        if let Some(mut cached) = self.cache.get::<ActionsPage>(&cache_key).await {
            debug!("Cache hit for actions page {}:{}", page, count);
            cached.actions = self.with_metadata_checks_for_list(cached.actions).await;
            self.cache.set(&cache_key, &cached).await;
            return Ok(cached);
        }

        // Cache miss - fetch from provider
        debug!(
            "Cache miss for actions page {}:{}, fetching from provider",
            page, count
        );
        let mut result = self.router.get_governance_actions_page(page, count).await?;
        result.actions = self.with_metadata_checks_for_list(result.actions).await;

        // Store in cache
        self.cache.set(&cache_key, &result).await;
        Ok(result)
    }

    pub async fn get_governance_action(
        &self,
        id: &str,
    ) -> Result<Option<GovernanceAction>, anyhow::Error> {
        let cache_key = CacheKey::Action { id: id.to_string() };

        // Check cache first
        if let Some(mut cached) = self.cache.get::<GovernanceAction>(&cache_key).await {
            debug!("Cache hit for action {}", id);
            cached = self.metadata_validator.attach_checks(cached).await;
            cached = self.enrich_action_with_epoch_times(cached).await;
            self.cache.set(&cache_key, &cached).await;
            return Ok(Some(cached));
        }

        // Cache miss - fetch from provider
        debug!("Cache miss for action {}, fetching from provider", id);
        match self.router.get_governance_action(id).await? {
            Some(action) => {
                let enriched = self.metadata_validator.attach_checks(action).await;
                let enriched = self.enrich_action_with_epoch_times(enriched).await;
                // Store in cache
                self.cache.set(&cache_key, &enriched).await;
                Ok(Some(enriched))
            }
            None => Ok(None),
        }
    }

    pub async fn get_action_voting_results(
        &self,
        id: &str,
    ) -> Result<ActionVotingBreakdown, anyhow::Error> {
        let cache_key = CacheKey::ActionVotes { id: id.to_string() };

        // Check cache first
        if let Some(cached) = self.cache.get::<ActionVotingBreakdown>(&cache_key).await {
            debug!("Cache hit for action votes {}", id);
            return Ok(cached);
        }

        // Cache miss - fetch from provider
        debug!("Cache miss for action votes {}, fetching from provider", id);
        let result = self.router.get_action_voting_results(id).await?;

        // Store in cache
        self.cache.set(&cache_key, &result).await;
        Ok(result)
    }

    pub async fn get_action_voter_participation(
        &self,
        id: &str,
    ) -> Result<ActionVoterParticipation, anyhow::Error> {
        let cache_key = CacheKey::ActionParticipation {
            id: id.to_string(),
        };

        if let Some(cached) = self
            .cache
            .get::<ActionVoterParticipation>(&cache_key)
            .await
        {
            debug!("Cache hit for action participation {}", id);
            return Ok(cached);
        }

        let action = match self.get_governance_action(id).await? {
            Some(action) => action,
            None => {
                return Err(anyhow::anyhow!(
                    "Governance action {} not found for participation lookup",
                    id
                ))
            }
        };

        let vote_records = self.router.get_action_vote_records(&action).await?;

        let mut drep_page = 1u32;
        let mut drep_participants: Vec<DRepParticipation> = Vec::new();
        let mut drep_lookup: HashMap<String, usize> = HashMap::new();
        const MAX_DREP_PAGES: u32 = 50;
        const PAGE_SIZE: u32 = 100;

        while drep_page <= MAX_DREP_PAGES {
            let query = DRepsQuery {
                page: drep_page,
                count: PAGE_SIZE,
                statuses: Vec::new(),
                search: None,
                sort: None,
                direction: None,
                enrich: false,
            }
            .with_defaults();

            let page_result = self.get_dreps_page(&query).await?;
            if page_result.dreps.is_empty() {
                break;
            }

            for drep in page_result.dreps {
                let index = drep_participants.len();

                let participant = DRepParticipation {
                    drep_id: drep.drep_id.clone(),
                    given_name: drep.given_name.clone(),
                    view: drep.view.clone(),
                    hex: drep.hex.clone(),
                    has_profile: drep.has_profile,
                    has_voted: false,
                    vote: None,
                    voting_power: None,
                    tx_hash: None,
                    cert_index: None,
                    block_time: None,
                };

                let mut insert_keys = Vec::new();
                insert_keys.push(drep.drep_id.to_ascii_lowercase());
                if let Some(view) = &drep.view {
                    insert_keys.push(view.to_ascii_lowercase());
                }
                if let Some(hex) = &drep.hex {
                    insert_keys.push(hex.to_ascii_lowercase());
                }
                if let Some(hash) = &drep.drep_hash {
                    insert_keys.push(hash.to_ascii_lowercase());
                }
                if let Ok(converted_hex) = decode_drep_id_to_hex(&drep.drep_id) {
                    insert_keys.push(converted_hex.to_ascii_lowercase());
                }

                drep_participants.push(participant);
                for key in insert_keys {
                    drep_lookup.insert(key, index);
                }
            }

            if !page_result.has_more {
                break;
            }
            drep_page = drep_page.saturating_add(1);
        }

        let mut pool_page = 1u32;
        let mut stake_pool_participants: Vec<StakePoolParticipation> = Vec::new();
        let mut pool_lookup: HashMap<String, usize> = HashMap::new();
        const MAX_POOL_PAGES: u32 = 80;

        while pool_page <= MAX_POOL_PAGES {
            let pools_page = match self
                .router
                .get_stake_pools_page(pool_page, PAGE_SIZE)
                .await
            {
                Ok(page) => page,
                Err(error) => {
                    tracing::debug!(
                        "Failed to fetch stake pool page {} for participation: {}",
                        pool_page,
                        error
                    );
                    break;
                }
            };

            if pools_page.pools.is_empty() {
                break;
            }

            for pool in pools_page.pools {
                let index = stake_pool_participants.len();
                let participant = StakePoolParticipation {
                    pool_id: pool.pool_id.clone(),
                    ticker: pool.ticker.clone(),
                    name: pool.name.clone(),
                    description: pool.description.clone(),
                    homepage: pool.homepage.clone(),
                    has_voted: false,
                    vote: None,
                    voting_power: None,
                    tx_hash: None,
                    cert_index: None,
                    block_time: None,
                };

                stake_pool_participants.push(participant);
                pool_lookup.insert(pool.pool_id.to_ascii_lowercase(), index);
                if let Some(hex) = pool.hex {
                    pool_lookup.insert(hex.to_ascii_lowercase(), index);
                }
            }

            if !pools_page.has_more {
                break;
            }

            pool_page = pool_page.saturating_add(1);
        }

        let committee_members = self
            .router
            .get_committee_members()
            .await
            .unwrap_or_default();

        let mut committee_participants: Vec<CommitteeParticipation> = Vec::new();
        let mut committee_lookup: HashMap<String, usize> = HashMap::new();

        for member in committee_members {
            let index = committee_participants.len();
            let participant = CommitteeParticipation {
                identifier: member.identifier.clone(),
                role: member.role.clone(),
                hot_key: member.hot_key.clone(),
                cold_key: member.cold_key.clone(),
                expiry_epoch: member.expiry_epoch,
                has_voted: false,
                vote: None,
                voting_power: None,
                tx_hash: None,
                cert_index: None,
                block_time: None,
            };

            let mut keys = Vec::new();
            keys.push(member.identifier.to_ascii_lowercase());
            if let Some(hot) = member.hot_key {
                keys.push(hot.to_ascii_lowercase());
            }
            if let Some(cold) = member.cold_key {
                keys.push(cold.to_ascii_lowercase());
            }

            committee_participants.push(participant);
            for key in keys {
                committee_lookup.insert(key, index);
            }
        }

        fn ensure_drep_participant(
            identifier: &str,
            participants: &mut Vec<DRepParticipation>,
            lookup: &mut HashMap<String, usize>,
        ) -> usize {
            let key = identifier.to_ascii_lowercase();
            if let Some(index) = lookup.get(&key) {
                return *index;
            }

            let index = participants.len();
            participants.push(DRepParticipation {
                drep_id: identifier.to_string(),
                given_name: None,
                view: None,
                hex: None,
                has_profile: None,
                has_voted: false,
                vote: None,
                voting_power: None,
                tx_hash: None,
                cert_index: None,
                block_time: None,
            });
            lookup.insert(key, index);
            index
        }

        fn ensure_pool_participant(
            identifier: &str,
            participants: &mut Vec<StakePoolParticipation>,
            lookup: &mut HashMap<String, usize>,
        ) -> usize {
            let key = identifier.to_ascii_lowercase();
            if let Some(index) = lookup.get(&key) {
                return *index;
            }

            let index = participants.len();
            participants.push(StakePoolParticipation {
                pool_id: identifier.to_string(),
                ticker: None,
                name: None,
                description: None,
                homepage: None,
                has_voted: false,
                vote: None,
                voting_power: None,
                tx_hash: None,
                cert_index: None,
                block_time: None,
            });
            lookup.insert(key, index);
            index
        }

        fn ensure_committee_participant(
            identifier: &str,
            participants: &mut Vec<CommitteeParticipation>,
            lookup: &mut HashMap<String, usize>,
        ) -> usize {
            let key = identifier.to_ascii_lowercase();
            if let Some(index) = lookup.get(&key) {
                return *index;
            }

            let index = participants.len();
            participants.push(CommitteeParticipation {
                identifier: identifier.to_string(),
                role: None,
                hot_key: None,
                cold_key: None,
                expiry_epoch: None,
                has_voted: false,
                vote: None,
                voting_power: None,
                tx_hash: None,
                cert_index: None,
                block_time: None,
            });
            lookup.insert(key, index);
            index
        }

        for record in &vote_records {
            match record.voter_type.as_str() {
                "drep" => {
                    let idx = ensure_drep_participant(
                        &record.voter_identifier,
                        &mut drep_participants,
                        &mut drep_lookup,
                    );

                    if let Some(participant) = drep_participants.get_mut(idx) {
                        participant.has_voted = true;
                        participant.vote = record.vote.clone();
                        participant.voting_power = record.voting_power.clone();
                        participant.tx_hash = record.tx_hash.clone();
                        participant.cert_index = record.cert_index;
                        participant.block_time = record.block_time;
                    }
                }
                "spo" | "stake_pool" | "pool" => {
                    let idx = ensure_pool_participant(
                        &record.voter_identifier,
                        &mut stake_pool_participants,
                        &mut pool_lookup,
                    );

                    if let Some(participant) = stake_pool_participants.get_mut(idx) {
                        participant.has_voted = true;
                        participant.vote = record.vote.clone();
                        participant.voting_power = record.voting_power.clone();
                        participant.tx_hash = record.tx_hash.clone();
                        participant.cert_index = record.cert_index;
                        participant.block_time = record.block_time;
                    }
                }
                "cc" | "committee" | "constitutional" => {
                    let idx = ensure_committee_participant(
                        &record.voter_identifier,
                        &mut committee_participants,
                        &mut committee_lookup,
                    );

                    if let Some(participant) = committee_participants.get_mut(idx) {
                        participant.has_voted = true;
                        participant.vote = record.vote.clone();
                        participant.voting_power = record.voting_power.clone();
                        participant.tx_hash = record.tx_hash.clone();
                        participant.cert_index = record.cert_index;
                        participant.block_time = record.block_time;
                    }
                }
                _ => {}
            }
        }

        drep_participants.sort_by(|a, b| {
            let a_key = a
                .given_name
                .as_ref()
                .map(|s| s.to_ascii_lowercase())
                .unwrap_or_else(|| a.drep_id.to_ascii_lowercase());
            let b_key = b
                .given_name
                .as_ref()
                .map(|s| s.to_ascii_lowercase())
                .unwrap_or_else(|| b.drep_id.to_ascii_lowercase());
            a_key.cmp(&b_key)
        });

        stake_pool_participants.sort_by(|a, b| {
            let a_key = a
                .ticker
                .as_ref()
                .map(|s| s.to_ascii_lowercase())
                .unwrap_or_else(|| a.pool_id.to_ascii_lowercase());
            let b_key = b
                .ticker
                .as_ref()
                .map(|s| s.to_ascii_lowercase())
                .unwrap_or_else(|| b.pool_id.to_ascii_lowercase());
            a_key.cmp(&b_key)
        });

        committee_participants.sort_by(|a, b| a.identifier.cmp(&b.identifier));

        let drep_voted = drep_participants.iter().filter(|p| p.has_voted).count();
        let stake_pool_voted = stake_pool_participants
            .iter()
            .filter(|p| p.has_voted)
            .count();
        let committee_voted = committee_participants
            .iter()
            .filter(|p| p.has_voted)
            .count();

        let participation = ActionVoterParticipation {
            dreps: ParticipationGroup {
                summary: calculate_summary(&drep_participants, drep_voted),
                participants: drep_participants,
            },
            stake_pools: ParticipationGroup {
                summary: calculate_summary(&stake_pool_participants, stake_pool_voted),
                participants: stake_pool_participants,
            },
            committee: ParticipationGroup {
                summary: calculate_summary(&committee_participants, committee_voted),
                participants: committee_participants,
            },
        };

        self.cache.set(&cache_key, &participation).await;

        Ok(participation)
    }

    async fn enrich_action_with_epoch_times(
        &self,
        mut action: GovernanceAction,
    ) -> GovernanceAction {
        let mut epochs_to_fetch: HashSet<u32> = HashSet::new();

        if let Some(epoch) = action.proposed_epoch {
            if action.proposed_epoch_start_time.is_none() {
                epochs_to_fetch.insert(epoch);
            }
        }
        if let Some(epoch) = action.voting_epoch {
            if action.voting_epoch_start_time.is_none() {
                epochs_to_fetch.insert(epoch);
            }
        }
        if let Some(epoch) = action.ratification_epoch.or(action.ratified_epoch) {
            if action.ratification_epoch_start_time.is_none() {
                epochs_to_fetch.insert(epoch);
            }
        }
        if let Some(epoch) = action.enactment_epoch {
            if action.enactment_epoch_start_time.is_none() {
                epochs_to_fetch.insert(epoch);
            }
        }
        if let Some(epoch) = action.expiry_epoch {
            if action.expiry_epoch_start_time.is_none() {
                epochs_to_fetch.insert(epoch);
            }
        }
        if let Some(epoch) = action.expiration {
            if action.expiration_epoch_start_time.is_none() {
                epochs_to_fetch.insert(epoch);
            }
        }
        if let Some(epoch) = action.dropped_epoch {
            if action.dropped_epoch_start_time.is_none() {
                epochs_to_fetch.insert(epoch);
            }
        }

        if epochs_to_fetch.is_empty() {
            return action;
        }

        let mut known_times = Self::collect_known_epoch_times(&action);
        let epoch_list: Vec<u32> = epochs_to_fetch.into_iter().collect();
        let futures = epoch_list
            .iter()
            .map(|epoch| self.get_epoch_start_time_cached(*epoch));
        let results = join_all(futures).await;

        let mut epoch_time_map: HashMap<u32, Option<u64>> = HashMap::new();
        for (epoch, time) in epoch_list.into_iter().zip(results.into_iter()) {
            if let Some(value) = time {
                known_times.insert(epoch, value);
            } else {
                tracing::debug!("Epoch {} start time not available", epoch);
            }
            epoch_time_map.insert(epoch, time);
        }

        let mut apply_epoch_time = |epoch: Option<u32>, field: &mut Option<u64>| {
            if let Some(epoch) = epoch {
                if let Some(existing) = *field {
                    known_times.insert(epoch, existing);
                } else {
                    let resolved = epoch_time_map
                        .get(&epoch)
                        .copied()
                        .flatten()
                        .or_else(|| Self::infer_epoch_start_time(epoch, &known_times));
                    if let Some(time) = resolved {
                        *field = Some(time);
                        known_times.insert(epoch, time);
                    }
                }
            }
        };

        apply_epoch_time(action.proposed_epoch, &mut action.proposed_epoch_start_time);
        apply_epoch_time(action.voting_epoch, &mut action.voting_epoch_start_time);
        apply_epoch_time(
            action.ratification_epoch.or(action.ratified_epoch),
            &mut action.ratification_epoch_start_time,
        );
        apply_epoch_time(
            action.enactment_epoch,
            &mut action.enactment_epoch_start_time,
        );
        apply_epoch_time(action.expiry_epoch, &mut action.expiry_epoch_start_time);
        apply_epoch_time(action.expiration, &mut action.expiration_epoch_start_time);
        apply_epoch_time(action.dropped_epoch, &mut action.dropped_epoch_start_time);

        action
    }

    async fn get_epoch_start_time_cached(&self, epoch: u32) -> Option<u64> {
        let cache_key = CacheKey::EpochStartTime { epoch };

        if let Some(cached) = self.cache.get::<Option<u64>>(&cache_key).await {
            return cached;
        }

        let start_time = match self.router.get_epoch_start_time(epoch).await {
            Ok(value) => value,
            Err(error) => {
                tracing::debug!("Error fetching epoch {} start time: {}", epoch, error);
                None
            }
        };

        self.cache.set(&cache_key, &start_time).await;
        start_time
    }

    fn collect_known_epoch_times(action: &GovernanceAction) -> HashMap<u32, u64> {
        let mut known = HashMap::new();

        if let (Some(epoch), Some(ts)) = (action.proposed_epoch, action.proposed_epoch_start_time) {
            known.insert(epoch, ts);
        }
        if let (Some(epoch), Some(ts)) = (action.voting_epoch, action.voting_epoch_start_time) {
            known.insert(epoch, ts);
        }
        if let (Some(epoch), Some(ts)) = (
            action.ratification_epoch.or(action.ratified_epoch),
            action.ratification_epoch_start_time,
        ) {
            known.insert(epoch, ts);
        }
        if let (Some(epoch), Some(ts)) = (action.enactment_epoch, action.enactment_epoch_start_time)
        {
            known.insert(epoch, ts);
        }
        if let (Some(epoch), Some(ts)) = (action.expiry_epoch, action.expiry_epoch_start_time) {
            known.insert(epoch, ts);
        }
        if let (Some(epoch), Some(ts)) = (action.expiration, action.expiration_epoch_start_time) {
            known.insert(epoch, ts);
        }
        if let (Some(epoch), Some(ts)) = (action.dropped_epoch, action.dropped_epoch_start_time) {
            known.insert(epoch, ts);
        }

        known
    }

    fn infer_epoch_start_time(epoch: u32, known: &HashMap<u32, u64>) -> Option<u64> {
        if let Some(time) = known.get(&epoch) {
            return Some(*time);
        }

        let mut best: Option<(u64, u64)> = None;

        for (&known_epoch, &known_time) in known.iter() {
            let delta_epochs = if epoch >= known_epoch {
                (epoch - known_epoch) as u64
            } else {
                (known_epoch - epoch) as u64
            };

            let Some(offset_seconds) = delta_epochs.checked_mul(CARDANO_EPOCH_DURATION_SECONDS)
            else {
                continue;
            };

            let candidate = if epoch >= known_epoch {
                known_time.checked_add(offset_seconds)
            } else {
                known_time.checked_sub(offset_seconds)
            };

            if let Some(candidate_time) = candidate {
                match best {
                    Some((best_delta, _)) if delta_epochs >= best_delta => {}
                    _ => best = Some((delta_epochs, candidate_time)),
                }
            }
        }

        best.map(|(_, time)| time)
    }

    pub async fn get_drep_metadata(
        &self,
        id: &str,
    ) -> Result<Option<serde_json::Value>, anyhow::Error> {
        let cache_key = CacheKey::DRepMetadata { id: id.to_string() };

        // Check cache first
        if let Some(cached) = self.cache.get::<serde_json::Value>(&cache_key).await {
            debug!("Cache hit for DRep metadata {}", id);
            return Ok(Some(cached));
        }

        // Cache miss - fetch from provider
        debug!(
            "Cache miss for DRep metadata {}, fetching from provider",
            id
        );
        match self.router.get_drep_metadata(id).await? {
            Some(metadata) => {
                // Store in cache
                self.cache.set(&cache_key, &metadata).await;
                Ok(Some(metadata))
            }
            None => Ok(None),
        }
    }

    pub async fn get_stake_delegation(
        &self,
        stake_address: &str,
    ) -> Result<Option<StakeDelegation>, anyhow::Error> {
        let cache_key = CacheKey::StakeDelegation {
            stake_address: stake_address.to_string(),
        };

        // Check cache first
        if let Some(cached) = self.cache.get::<StakeDelegation>(&cache_key).await {
            debug!("Cache hit for stake delegation {}", stake_address);
            return Ok(Some(cached));
        }

        // Cache miss - fetch from provider
        debug!(
            "Cache miss for stake delegation {}, fetching from provider",
            stake_address
        );
        match self.router.get_stake_delegation(stake_address).await? {
            Some(delegation) => {
                // Store in cache
                self.cache.set(&cache_key, &delegation).await;
                Ok(Some(delegation))
            }
            None => Ok(None),
        }
    }

    pub async fn health_check(&self) -> Result<bool, anyhow::Error> {
        self.router.health_check().await
    }

    pub async fn cache_stats(&self) -> CacheStats {
        CacheStats {
            enabled: self.cache.is_enabled(),
            entries: self.cache.entry_count(),
            hits: self.cache.hit_count(),
            misses: self.cache.miss_count(),
            hit_rate: self.cache.hit_rate(),
        }
    }

    async fn enrich_drep(&self, mut drep: DRep) -> DRep {
        let Some(provider) = &self.govtools else {
            return drep;
        };

        let Some(hex_id) = Self::extract_hex_id(&drep) else {
            return drep;
        };

        match provider.get_drep_profile(&hex_id).await {
            Ok(Some(enrichment)) => {
                let GovToolsEnrichment {
                    given_name,
                    objectives,
                    motivations,
                    qualifications,
                    votes_last_year,
                    identity_references,
                    link_references,
                    image_url,
                    image_hash,
                    latest_registration_date,
                    latest_tx_hash,
                    deposit,
                    metadata_error,
                    payment_address,
                    is_script_based,
                    ..
                } = enrichment;

                let mut has_profile_data = false;

                if drep.given_name.is_none() {
                    drep.given_name = given_name.clone();
                }
                if drep.objectives.is_none() {
                    drep.objectives = objectives.clone();
                }
                if drep.motivations.is_none() {
                    drep.motivations = motivations.clone();
                }
                if drep.qualifications.is_none() {
                    drep.qualifications = qualifications.clone();
                }
                if drep.image_url.is_none() {
                    drep.image_url = image_url.clone();
                }
                if drep.image_hash.is_none() {
                    drep.image_hash = image_hash.clone();
                }
                if drep.latest_registration_date.is_none() {
                    drep.latest_registration_date = latest_registration_date.clone();
                }
                if drep.latest_tx_hash.is_none() {
                    drep.latest_tx_hash = latest_tx_hash.clone();
                }
                if drep.deposit.is_none() {
                    drep.deposit = deposit;
                }
                if drep.metadata_error.is_none() {
                    drep.metadata_error = metadata_error;
                }
                if drep.payment_address.is_none() {
                    drep.payment_address = payment_address;
                }
                if drep.is_script_based.is_none() {
                    drep.is_script_based = is_script_based;
                }
                if drep.votes_last_year.is_none() {
                    drep.votes_last_year = votes_last_year;
                }

                if let Some(name) = &drep.given_name {
                    if !name.is_empty() {
                        has_profile_data = true;
                    }
                }
                if let Some(text) = &drep.objectives {
                    if !text.is_empty() {
                        has_profile_data = true;
                    }
                }
                if let Some(text) = &drep.motivations {
                    if !text.is_empty() {
                        has_profile_data = true;
                    }
                }
                if let Some(url) = &drep.image_url {
                    if !url.is_empty() {
                        has_profile_data = true;
                    }
                }

                if !identity_references.is_empty() {
                    has_profile_data = true;
                    match &mut drep.identity_references {
                        Some(existing) => existing.extend(identity_references.into_iter()),
                        None => drep.identity_references = Some(identity_references),
                    }
                }

                if !link_references.is_empty() {
                    match &mut drep.link_references {
                        Some(existing) => existing.extend(link_references.into_iter()),
                        None => drep.link_references = Some(link_references),
                    }
                }

                if has_profile_data {
                    drep.has_profile = Some(true);
                }
            }
            Ok(None) => {}
            Err(error) => {
                tracing::debug!("GovTools enrichment failed for {}: {}", hex_id, error);
            }
        }

        drep
    }

    async fn fetch_stats_page(&self, query: &DRepsQuery) -> Result<DRepsPage, anyhow::Error> {
        if let Some(provider) = &self.govtools {
            match provider.list_dreps(query).await {
                Ok(result) => return Ok(result),
                Err(error) => {
                    tracing::debug!(
                        "GovTools list failed for stats page {}: {}",
                        query.normalized_page(),
                        error
                    );
                }
            }
        }

        self.router.get_dreps_page(query).await
    }

    fn extract_voting_power(drep: &DRep) -> Option<u128> {
        let candidates = [
            drep.amount.as_deref(),
            drep.voting_power_active.as_deref(),
            drep.voting_power.as_deref(),
        ];

        for candidate in candidates {
            if let Some(value) = candidate {
                if let Ok(parsed) = value.parse::<u128>() {
                    return Some(parsed);
                }
            }
        }

        None
    }

    fn extract_hex_id(drep: &DRep) -> Option<String> {
        if let Some(hex) = &drep.hex {
            if !hex.is_empty() {
                return Some(hex.clone());
            }
        }

        let candidates = [Some(&drep.drep_id), drep.view.as_ref()];

        for candidate in candidates.into_iter().flatten() {
            if let Ok(hex) = decode_drep_id_to_hex(candidate) {
                return Some(hex);
            }
        }

        None
    }

    async fn with_metadata_checks_for_list(
        &self,
        actions: Vec<GovernanceAction>,
    ) -> Vec<GovernanceAction> {
        let futures = actions
            .into_iter()
            .map(|action| self.metadata_validator.attach_checks(action));
        join_all(futures).await
    }
}

#[derive(Debug, Clone)]
pub struct CacheStats {
    pub enabled: bool,
    pub entries: usize,
    pub hits: u64,
    pub misses: u64,
    pub hit_rate: f64,
}
