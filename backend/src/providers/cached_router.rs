use crate::cache::{CacheManager, keys::CacheKey};
use crate::providers::ProviderRouter;
use crate::models::*;
use std::sync::Arc;
use tracing::debug;

#[derive(Clone)]
pub struct CachedProviderRouter {
    router: Arc<ProviderRouter>,
    cache: Arc<CacheManager>,
}

impl CachedProviderRouter {
    pub fn new(router: ProviderRouter, cache: CacheManager) -> Self {
        Self {
            router: Arc::new(router),
            cache: Arc::new(cache),
        }
    }

    pub async fn get_dreps_page(
        &self,
        page: u32,
        count: u32,
    ) -> Result<DRepsPage, anyhow::Error> {
        let cache_key = CacheKey::DRepsPage { page, count };

        // Check cache first
        if let Some(cached) = self.cache.get::<DRepsPage>(&cache_key).await {
            debug!("Cache hit for DReps page {}:{}", page, count);
            return Ok(cached);
        }

        // Cache miss - fetch from provider
        debug!("Cache miss for DReps page {}:{}, fetching from provider", page, count);
        let result = self.router.get_dreps_page(page, count).await?;

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
                // Store in cache
                self.cache.set(&cache_key, &drep).await;
                Ok(Some(drep))
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
        debug!("Cache miss for DRep delegators {}, fetching from provider", id);
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
        debug!("Cache miss for DRep voting history {}, fetching from provider", id);
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
        debug!("Cache miss for actions page {}:{}, fetching from provider", page, count);
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

    pub async fn get_drep_metadata(&self, id: &str) -> Result<Option<serde_json::Value>, anyhow::Error> {
        let cache_key = CacheKey::DRepMetadata { id: id.to_string() };

        // Check cache first
        if let Some(cached) = self.cache.get::<serde_json::Value>(&cache_key).await {
            debug!("Cache hit for DRep metadata {}", id);
            return Ok(Some(cached));
        }

        // Cache miss - fetch from provider
        debug!("Cache miss for DRep metadata {}, fetching from provider", id);
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
}

#[derive(Debug, Clone)]
pub struct CacheStats {
    pub enabled: bool,
    pub entries: usize,
    pub hits: u64,
    pub misses: u64,
    pub hit_rate: f64,
}

