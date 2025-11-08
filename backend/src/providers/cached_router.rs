use crate::cache::{keys::CacheKey, CacheManager};
use crate::models::*;
use crate::providers::{GovToolsEnrichment, GovToolsProvider, ProviderRouter};
use crate::utils::drep_id::decode_drep_id_to_hex;
use futures::future::join_all;
use std::sync::Arc;
use tracing::debug;

#[derive(Clone)]
pub struct CachedProviderRouter {
    router: Arc<ProviderRouter>,
    cache: Arc<CacheManager>,
    govtools: Option<Arc<GovToolsProvider>>,
}

impl CachedProviderRouter {
    pub fn new(
        router: ProviderRouter,
        cache: CacheManager,
        govtools: Option<GovToolsProvider>,
    ) -> Self {
        Self {
            router: Arc::new(router),
            cache: Arc::new(cache),
            govtools: govtools.map(Arc::new),
        }
    }

    pub async fn get_dreps_page(&self, page: u32, count: u32) -> Result<DRepsPage, anyhow::Error> {
        let cache_key = CacheKey::DRepsPage { page, count };

        // Check cache first
        if let Some(cached) = self.cache.get::<DRepsPage>(&cache_key).await {
            debug!("Cache hit for DReps page {}:{}", page, count);
            return Ok(cached);
        }

        // Cache miss - fetch from provider
        debug!(
            "Cache miss for DReps page {}:{}, fetching from provider",
            page, count
        );
        let mut result = self.router.get_dreps_page(page, count).await?;

        if self.govtools.is_some() && !result.dreps.is_empty() {
            let futures = result.dreps.into_iter().map(|drep| self.enrich_drep(drep));
            let enriched = join_all(futures).await;
            result.dreps = enriched;
        }

        // Store in cache
        self.cache.set(&cache_key, &result).await;
        Ok(result)
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
        if let Some(cached) = self.cache.get::<ActionsPage>(&cache_key).await {
            debug!("Cache hit for actions page {}:{}", page, count);
            return Ok(cached);
        }

        // Cache miss - fetch from provider
        debug!(
            "Cache miss for actions page {}:{}, fetching from provider",
            page, count
        );
        let result = self.router.get_governance_actions_page(page, count).await?;

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
        if let Some(cached) = self.cache.get::<GovernanceAction>(&cache_key).await {
            debug!("Cache hit for action {}", id);
            return Ok(Some(cached));
        }

        // Cache miss - fetch from provider
        debug!("Cache miss for action {}, fetching from provider", id);
        match self.router.get_governance_action(id).await? {
            Some(action) => {
                // Store in cache
                self.cache.set(&cache_key, &action).await;
                Ok(Some(action))
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

    pub async fn get_total_active_dreps(&self) -> Result<Option<u32>, anyhow::Error> {
        let cache_key = CacheKey::DRepStats;

        // Check cache first
        if let Some(cached) = self.cache.get::<u32>(&cache_key).await {
            debug!("Cache hit for DRep stats");
            return Ok(Some(cached));
        }

        // Cache miss - fetch from provider
        debug!("Cache miss for DRep stats, fetching from provider");
        match self.router.get_total_active_dreps().await? {
            Some(count) => {
                // Store in cache
                self.cache.set(&cache_key, &count).await;
                Ok(Some(count))
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
}

#[derive(Debug, Clone)]
pub struct CacheStats {
    pub enabled: bool,
    pub entries: usize,
    pub hits: u64,
    pub misses: u64,
    pub hit_rate: f64,
}
