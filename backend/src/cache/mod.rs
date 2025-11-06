pub mod keys;

use crate::cache::keys::CacheKey;
use moka::future::Cache;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tracing::debug;

use std::sync::atomic::{AtomicU64, Ordering};

pub struct CacheManager {
    cache: Arc<Cache<String, Vec<u8>>>,
    enabled: bool,
    hits: AtomicU64,
    misses: AtomicU64,
}

impl CacheManager {
    pub fn new(enabled: bool, max_entries: usize) -> Self {
        let cache = Arc::new(
            Cache::builder()
                .max_capacity(max_entries as u64)
                .time_to_live(Duration::from_secs(600)) // Max TTL - individual entries use their own TTLs
                .time_to_idle(Duration::from_secs(300))
                .build(),
        );

        Self {
            cache,
            enabled,
            hits: AtomicU64::new(0),
            misses: AtomicU64::new(0),
        }
    }

    pub async fn get<T>(&self, key: &CacheKey) -> Option<T>
    where
        T: for<'de> Deserialize<'de>,
    {
        if !self.enabled {
            return None;
        }

        let cache_key = key.to_string();
        match self.cache.get(&cache_key).await {
            Some(bytes) => match serde_json::from_slice::<T>(&bytes) {
                Ok(value) => {
                    self.hits.fetch_add(1, Ordering::Relaxed);
                    debug!("Cache hit: {}", cache_key);
                    Some(value)
                }
                Err(e) => {
                    self.misses.fetch_add(1, Ordering::Relaxed);
                    tracing::warn!("Failed to deserialize cache entry {}: {}", cache_key, e);
                    None
                }
            },
            None => {
                self.misses.fetch_add(1, Ordering::Relaxed);
                debug!("Cache miss: {}", cache_key);
                None
            }
        }
    }

    pub async fn set<T>(&self, key: &CacheKey, value: &T)
    where
        T: Serialize,
    {
        if !self.enabled {
            return;
        }

        let cache_key = key.to_string();
        let ttl = key.ttl_seconds();

        match serde_json::to_vec(value) {
            Ok(bytes) => {
                self.cache.insert(cache_key.clone(), bytes).await;
                debug!("Cached: {} (TTL: {}s)", cache_key, ttl);
            }
            Err(e) => {
                tracing::warn!("Failed to serialize cache entry {}: {}", cache_key, e);
            }
        }
    }

    #[allow(dead_code)]
    pub async fn invalidate(&self, key: &CacheKey) {
        if !self.enabled {
            return;
        }

        let cache_key = key.to_string();
        self.cache.invalidate(&cache_key).await;
        debug!("Cache invalidated: {}", cache_key);
    }

    #[allow(dead_code)]
    pub async fn clear(&self) {
        if !self.enabled {
            return;
        }

        self.cache.invalidate_all();
        debug!("Cache cleared");
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn entry_count(&self) -> usize {
        self.cache.weighted_size() as usize
    }

    pub fn hit_count(&self) -> u64 {
        self.hits.load(Ordering::Relaxed)
    }

    pub fn miss_count(&self) -> u64 {
        self.misses.load(Ordering::Relaxed)
    }

    pub fn hit_rate(&self) -> f64 {
        let hits = self.hit_count();
        let misses = self.miss_count();
        let total = hits + misses;
        if total == 0 {
            0.0
        } else {
            (hits as f64) / (total as f64) * 100.0
        }
    }
}
