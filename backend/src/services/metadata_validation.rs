use crate::cache::{keys::CacheKey, CacheManager};
use crate::models::{CheckOutcome, CheckStatus, GovernanceAction, MetadataCheckResult};
use anyhow::{anyhow, Context};
use blake2b_simd::Params;
use hex::encode as hex_encode;
use reqwest::{Client, StatusCode};
use serde::Deserialize;
use std::sync::Arc;
use std::time::Duration;
use tracing::debug;

const DEFAULT_MAX_BYTES: usize = 5 * 1024 * 1024; // 5 MB safety limit
const DEFAULT_TIMEOUT_SECS: u64 = 10;
const DEFAULT_IPFS_GATEWAY: &str = "https://ipfs.io/ipfs/";

#[derive(Clone, Debug)]
pub struct VerifierConfig {
    pub enabled: bool,
    pub endpoint: String,
}

#[derive(Clone)]
pub struct MetadataValidator {
    client: Client,
    cache: Arc<CacheManager>,
    max_bytes: usize,
    ipfs_gateway: String,
    verifier: Option<VerifierConfig>,
}

impl MetadataValidator {
    pub fn new(cache: Arc<CacheManager>, verifier: Option<VerifierConfig>) -> Self {
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
            verifier,
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

        let verifier_enabled = self
            .verifier
            .as_ref()
            .map(|config| config.enabled)
            .unwrap_or(false);
        let cache_key = CacheKey::ActionMetadataValidation {
            action_id: action.action_id.clone(),
            meta_hash: action.meta_hash.clone(),
            verifier_enabled,
            version: 2,
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

        let mut metadata_value = Self::normalize_metadata(action.meta_json.clone())
            .or_else(|| Self::normalize_metadata(action.metadata.clone()));

        let (hash_check, fetched_metadata) = self
            .evaluate_hash(action.meta_url.as_deref(), action.meta_hash.as_deref())
            .await;
        result.hash = hash_check.clone();

        if let Some(resolved) = fetched_metadata.as_ref() {
            result.resolved_url = Some(resolved.url.clone());
            if let Some(bytes) = resolved.bytes_read {
                result.notes.push(format!(
                    "Fetched {} bytes of metadata for hash validation",
                    bytes
                ));
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

        if metadata_value.is_none() {
            metadata_value = fetched_metadata.as_ref().and_then(|f| f.document.clone());
        }

        let on_chain_outcome = Self::evaluate_on_chain(metadata_value.as_ref());
        if matches!(
            on_chain_outcome.status,
            CheckStatus::Fail | CheckStatus::Warning
        ) {
            if let Some(message) = on_chain_outcome.message.clone() {
                result.notes.push(message.clone());
            }
        }
        result.on_chain = on_chain_outcome;

        let metadata_document = metadata_value.clone();

        let verifier_payload = metadata_document.as_ref().and_then(|value| {
            let object = if value.is_object() {
                Some(value.clone())
            } else if let Some(stringified) = value.as_str() {
                serde_json::from_str::<serde_json::Value>(stringified)
                    .ok()
                    .filter(|parsed| parsed.is_object())
            } else {
                None
            }?;

            let authors = object
                .get("authors")
                .and_then(|value| value.as_array())
                .map(|arr| arr.iter().filter(|author| !author.is_null()).count())
                .unwrap_or_default();

            if authors == 0 {
                None
            } else {
                Some(object)
            }
        });

        if let Some(verifier) = &self.verifier {
            if verifier.enabled {
                match verifier_payload {
                    Some(ref metadata_json) => match self
                        .verify_author_witness(&verifier.endpoint, metadata_json)
                        .await
                    {
                        Ok(outcome) => {
                            result.author_witness = outcome.outcome;
                            result.notes.extend(outcome.notes);
                        }
                        Err(error) => {
                            result.author_witness = error.to_check_outcome();
                            result.notes.push(error.user_note());
                        }
                    },
                    None => {
                        result.author_witness =
                            CheckOutcome::fail("Metadata contains no author witness data");
                    }
                }
            }
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
                "Metadata URI uses '{}' scheme; expected ipfs://",
                url.split(':').next().unwrap_or("unknown")
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
        let document = serde_json::from_slice(bytes.as_ref()).ok();

        Ok(FetchedMetadata {
            url: resolved_url,
            bytes_read: Some(bytes.len()),
            computed_hash: computed_hex,
            expected_hash: normalized_expected,
            hash_matches,
            document,
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

#[derive(Clone)]
struct FetchedMetadata {
    url: String,
    bytes_read: Option<usize>,
    computed_hash: String,
    expected_hash: String,
    hash_matches: bool,
    document: Option<serde_json::Value>,
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

struct AuthorVerifierOutcome {
    outcome: CheckOutcome,
    notes: Vec<String>,
}

#[derive(Debug)]
enum VerifierError {
    RateLimited,
    Network,
    InvalidResponse,
    ApiFailure(StatusCode),
}

impl VerifierError {
    fn to_check_outcome(&self) -> CheckOutcome {
        match self {
            VerifierError::RateLimited => {
                CheckOutcome::warning("Author witness verification temporarily rate limited")
            }
            VerifierError::Network => {
                CheckOutcome::warning("Unable to reach Cardano Foundation author witness verifier")
            }
            VerifierError::InvalidResponse => CheckOutcome::warning(
                "Unexpected response from Cardano Foundation author witness verifier",
            ),
            VerifierError::ApiFailure(status) => CheckOutcome::warning(&format!(
                "Cardano Foundation author witness verifier returned status {}",
                status.as_u16()
            )),
        }
    }

    fn user_note(&self) -> String {
        match self {
            VerifierError::RateLimited => {
                "Cardano Foundation verifier rate limit encountered; will retry later.".to_string()
            }
            VerifierError::Network => {
                "Cardano Foundation verifier unreachable; author witness verification deferred."
                    .to_string()
            }
            VerifierError::InvalidResponse => {
                "Cardano Foundation verifier returned an unexpected payload.".to_string()
            }
            VerifierError::ApiFailure(status) => format!(
                "Cardano Foundation verifier responded with HTTP status {}.",
                status.as_u16()
            ),
        }
    }
}

#[derive(Debug, Deserialize)]
struct CfVerifierResponse {
    success: bool,
    #[serde(default)]
    data: Option<CfVerifierData>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CfVerifierData {
    #[serde(default)]
    result: Option<bool>,
    #[serde(default, rename = "errorMsg")]
    error_msg: Option<String>,
    #[serde(default)]
    authors: Vec<CfAuthorResult>,
}

#[derive(Debug, Deserialize)]
struct CfAuthorResult {
    #[serde(default)]
    valid: bool,
    #[serde(default)]
    name: Option<String>,
}

impl MetadataValidator {
    async fn verify_author_witness(
        &self,
        endpoint: &str,
        metadata: &serde_json::Value,
    ) -> Result<AuthorVerifierOutcome, VerifierError> {
        let response = self
            .client
            .post(endpoint)
            .json(&serde_json::json!({ "metadata": metadata }))
            .send()
            .await
            .map_err(|_| VerifierError::Network)?;

        if response.status() == StatusCode::TOO_MANY_REQUESTS {
            return Err(VerifierError::RateLimited);
        }

        if !response.status().is_success() {
            return Err(VerifierError::ApiFailure(response.status()));
        }

        let payload: CfVerifierResponse = response
            .json()
            .await
            .map_err(|_| VerifierError::InvalidResponse)?;

        if !payload.success {
            let mut notes = vec!["Cardano Foundation verifier reported failure.".to_string()];
            if let Some(error) = payload.error {
                notes.push(Self::truncate_message(&error));
            }
            return Ok(AuthorVerifierOutcome {
                outcome: CheckOutcome::fail(
                    "Cardano Foundation verifier could not validate author witnesses",
                ),
                notes,
            });
        }

        let Some(data) = payload.data else {
            return Ok(AuthorVerifierOutcome {
                outcome: CheckOutcome::warning(
                    "Cardano Foundation verifier returned no data payload",
                ),
                notes: vec!["Verifier response missing data field.".to_string()],
            });
        };

        let mut notes = vec!["Author witnesses signatures valid".to_string()];

        let reported_failure = matches!(data.result, Some(false));

        if let Some(message) = data.error_msg.clone() {
            notes.push(Self::truncate_message(&message));
        }

        if reported_failure {
            notes.push(
                "Cardano Foundation verifier reported witness verification failure.".to_string(),
            );
        }

        let total = data.authors.len();
        if total == 0 {
            notes.push("No author witnesses returned by verifier.".to_string());
            return Ok(AuthorVerifierOutcome {
                outcome: CheckOutcome::warning("No author witnesses provided"),
                notes,
            });
        }

        let (invalid_count, invalid_named): (usize, Vec<String>) =
            data.authors
                .into_iter()
                .fold((0, Vec::new()), |(mut count, mut names), author| {
                    if !author.valid {
                        count += 1;
                        if let Some(name) = author.name {
                            names.push(name);
                        }
                    }
                    (count, names)
                });

        if invalid_count == 0 && !reported_failure {
            return Ok(AuthorVerifierOutcome {
                outcome: CheckOutcome::pass("Author witnesses verified via CF's CIP-100 verifier"),
                notes,
            });
        }

        notes.push(format!(
            "{invalid_count} of {total} author witnesses failed verification"
        ));

        if !invalid_named.is_empty() {
            notes.push(format!(
                "Invalid witnesses reported for: {}",
                invalid_named.join(", ")
            ));
        }

        Ok(AuthorVerifierOutcome {
            outcome: CheckOutcome::fail(
                "Cardano Foundation verifier reported invalid author witnesses",
            ),
            notes,
        })
    }

    fn truncate_message(message: &str) -> String {
        const LIMIT: usize = 120;
        if message.len() <= LIMIT {
            format!("Verifier message: {}", message)
        } else {
            format!("Verifier message: {}…", &message[..LIMIT].trim_end())
        }
    }

    fn normalize_metadata(value: Option<serde_json::Value>) -> Option<serde_json::Value> {
        match value {
            Some(serde_json::Value::String(raw)) => serde_json::from_str(&raw).ok(),
            Some(other) => Some(other),
            None => None,
        }
    }

    fn evaluate_on_chain(metadata: Option<&serde_json::Value>) -> CheckOutcome {
        let Some(root) = metadata else {
            return CheckOutcome::unknown("On-chain metadata extension not evaluated");
        };

        let on_chain_value = root
            .get("onChain")
            .or_else(|| root.get("body").and_then(|body| body.get("onChain")));

        match on_chain_value {
            Some(serde_json::Value::Object(_)) => {
                CheckOutcome::pass("On-chain metadata extension detected")
            }
            Some(serde_json::Value::Null) => {
                CheckOutcome::warning("On-chain metadata extension is null")
            }
            Some(_) => {
                CheckOutcome::warning("On-chain metadata extension is present but not an object")
            }
            None => CheckOutcome::warning("On-chain metadata extension not provided"),
        }
    }
}
