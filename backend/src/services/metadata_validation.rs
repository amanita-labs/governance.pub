use crate::cache::{keys::CacheKey, CacheManager};
use crate::models::{CheckOutcome, GovernanceAction, MetadataCheckResult};
use anyhow::{anyhow, Context};
use blake2b_simd::Params;
use hex::encode as hex_encode;
use reqwest::Client;
use std::sync::Arc;
use std::time::Duration;
use tracing::debug;

const DEFAULT_MAX_BYTES: usize = 5 * 1024 * 1024; // 5 MB safety limit
const DEFAULT_TIMEOUT_SECS: u64 = 10;
const DEFAULT_IPFS_GATEWAY: &str = "https://ipfs.io/ipfs/";

#[derive(Clone)]
pub struct MetadataValidator {
    client: Client,
    cache: Arc<CacheManager>,
    max_bytes: usize,
    ipfs_gateway: String,
}

impl MetadataValidator {
    pub fn new(cache: Arc<CacheManager>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(DEFAULT_TIMEOUT_SECS))
            .user_agent("govtwool-backend/metadata-validator")
            .build()
            .expect("Failed to build reqwest client");

        Self {
            client,
            cache,
            max_bytes: DEFAULT_MAX_BYTES,
            ipfs_gateway: DEFAULT_IPFS_GATEWAY.to_string(),
        }
    }

    pub async fn attach_checks(&self, mut action: GovernanceAction) -> GovernanceAction {
        if action.metadata_checks.is_some() {
            return action;
        }

        let result = self.validate(&action).await;
        action.metadata_checks = Some(result);
        action
    }

    async fn validate(&self, action: &GovernanceAction) -> MetadataCheckResult {
        if action.meta_url.is_none() && action.meta_hash.is_none() {
            return MetadataCheckResult::no_metadata(action.meta_is_valid);
        }

        let cache_key = CacheKey::ActionMetadataValidation {
            action_id: action.action_id.clone(),
            meta_hash: action.meta_hash.clone(),
        };

        if let Some(cached) = self.cache.get::<MetadataCheckResult>(&cache_key).await {
            return cached;
        }

        let result = self.compute_validation(action).await;
        self.cache.set(&cache_key, &result).await;
        result
    }

    async fn compute_validation(&self, action: &GovernanceAction) -> MetadataCheckResult {
        let mut result = MetadataCheckResult::default_with_koios(action.meta_is_valid);

        let ipfs_outcome = self.evaluate_ipfs(action.meta_url.as_deref());
        result.ipfs = ipfs_outcome.clone();

        let hash_outcome = self
            .evaluate_hash(action.meta_url.as_deref(), action.meta_hash.as_deref())
            .await;
        result.hash = hash_outcome.0;

        if let Some(resolved) = hash_outcome.1 {
            result.resolved_url = Some(resolved.url.clone());
            if let Some(bytes) = resolved.bytes_read {
                result
                    .notes
                    .push(format!("Fetched {} bytes for hash validation", bytes));
            }
        }

        if let Some(ipfs_msg) = ipfs_outcome.message.clone() {
            result.notes.push(ipfs_msg);
        }

        if let Some(false) = action.meta_is_valid {
            result
                .notes
                .push("Koios flagged metadata anchor as invalid (meta_is_valid=false)".to_string());
        }

        result
    }

    fn evaluate_ipfs(&self, meta_url: Option<&str>) -> CheckOutcome {
        match meta_url {
            None => CheckOutcome::unknown("No metadata URL provided"),
            Some(url) if url.trim().is_empty() => {
                CheckOutcome::unknown("Metadata URL is empty or whitespace")
            }
            Some(url) if url.starts_with("ipfs://") => {
                CheckOutcome::pass("Metadata hosted on IPFS")
            }
            Some(url) => CheckOutcome::fail(&format!(
                "Metadata URI does not use ipfs:// scheme ({}).",
                url
            )),
        }
    }

    async fn evaluate_hash(
        &self,
        meta_url: Option<&str>,
        meta_hash: Option<&str>,
    ) -> (CheckOutcome, Option<FetchedMetadata>) {
        let Some(url) = meta_url else {
            return (
                CheckOutcome::unknown("No metadata URL available for hashing"),
                None,
            );
        };

        let Some(hash_hex) = meta_hash else {
            return (
                CheckOutcome::unknown("On-chain metadata hash missing; cannot validate"),
                None,
            );
        };

        match self.fetch_and_hash(url.trim(), hash_hex.trim()).await {
            Ok(fetched) => {
                if fetched.hash_matches {
                    (
                        CheckOutcome::pass("Metadata hash matches on-chain anchor"),
                        Some(fetched),
                    )
                } else {
                    (
                        CheckOutcome::fail(
                            "Hash mismatch between fetched metadata and on-chain anchor",
                        ),
                        Some(fetched),
                    )
                }
            }
            Err(error) => (
                CheckOutcome::fail(&format!("Failed to validate metadata hash: {}", error)),
                None,
            ),
        }
    }

    async fn fetch_and_hash(
        &self,
        meta_url: &str,
        expected_hash_hex: &str,
    ) -> Result<FetchedMetadata, anyhow::Error> {
        let expected_clean = expected_hash_hex.trim_start_matches("0x");
        if expected_clean.len() != 64 || !expected_clean.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(anyhow!(
                "Expected metadata hash is not a valid blake2b-256 hex string"
            ));
        }

        let resolved_url = self.resolve_url(meta_url)?;
        let response = self
            .client
            .get(&resolved_url)
            .header("Accept", "application/json, text/plain;q=0.9, */*;q=0.1")
            .send()
            .await
            .with_context(|| format!("Request failed for {}", resolved_url))?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "HTTP {} while fetching {}",
                response.status(),
                resolved_url
            ));
        }

        let bytes = response
            .bytes()
            .await
            .with_context(|| format!("Failed reading body from {}", resolved_url))?;

        if bytes.len() > self.max_bytes {
            return Err(anyhow!(
                "Metadata exceeds configured limit ({} bytes > {} bytes)",
                bytes.len(),
                self.max_bytes
            ));
        }

        let mut params = Params::new();
        params.hash_length(32);
        let hash = params.hash(bytes.as_ref());
        let computed_hex = hex_encode(hash.as_bytes());

        let normalized_expected = expected_clean.to_lowercase();
        let hash_matches = computed_hex == normalized_expected;

        Ok(FetchedMetadata {
            url: resolved_url,
            bytes_read: Some(bytes.len()),
            computed_hash: computed_hex,
            expected_hash: normalized_expected,
            hash_matches,
        })
    }

    fn resolve_url(&self, url: &str) -> Result<String, anyhow::Error> {
        if url.starts_with("ipfs://") {
            let content_id = url.trim_start_matches("ipfs://");
            if content_id.is_empty() {
                return Err(anyhow!("ipfs:// URI missing content identifier"));
            }
            Ok(format!("{}{}", self.ipfs_gateway, content_id))
        } else if url.starts_with("http://") || url.starts_with("https://") {
            Ok(url.to_string())
        } else {
            Err(anyhow!(
                "Unsupported metadata URI scheme (expected ipfs:// or https://): {}",
                url
            ))
        }
    }
}

struct FetchedMetadata {
    url: String,
    bytes_read: Option<usize>,
    computed_hash: String,
    expected_hash: String,
    hash_matches: bool,
}

impl Drop for FetchedMetadata {
    fn drop(&mut self) {
        if !self.hash_matches {
            debug!(
                "Metadata hash mismatch: expected {}, computed {} (URL: {})",
                self.expected_hash, self.computed_hash, self.url
            );
        }
    }
}
