//! Configuration management
//!
//! Handles loading and parsing of environment variables into a structured Config.
//! Supports both DATABASE_URL and individual DB component variables.

use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub server_port: u16,
    pub database_url: String,
    pub network: String,
    pub cache_enabled: bool,
    pub cache_max_entries: usize,
    pub govtools_base_url: String,
    pub govtools_enabled: bool,
    pub cardano_verifier_enabled: bool,
    pub cardano_verifier_endpoint: String,
}

impl Config {
    pub fn from_env() -> Result<Self, anyhow::Error> {
        dotenv::dotenv().ok();

        // Network configuration - defaults to mainnet, can be overridden via CARDANO_NETWORK
        let network = env::var("CARDANO_NETWORK")
            .or_else(|_| env::var("BLOCKFROST_NETWORK"))
            .unwrap_or_else(|_| "mainnet".to_string());

        // Choose GovTools base URL by network (GovTools supports mainnet and preview)
        let network_lc = network.to_lowercase();
        let default_govtools_base_url = match network_lc.as_str() {
            "mainnet" => "https://be.gov.tools",
            "preview" => "https://be.preview.gov.tools",
            // Unknown for preprod; allow override via GOVTOOLS_BASE_URL if available
            _ => "https://be.gov.tools",
        };

        // Enable GovTools by default on networks we know are supported
        let govtools_supported_by_default = matches!(network_lc.as_str(), "mainnet" | "preview");
        let govtools_enabled = env::var("GOVTOOLS_ENABLED")
            .ok()
            .and_then(|s| s.parse::<bool>().ok())
            .unwrap_or(govtools_supported_by_default);

        Ok(Config {
            server_port: env::var("PORT")
                .or_else(|_| env::var("BACKEND_PORT"))
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .unwrap_or(8080),
            database_url: env::var("DATABASE_URL")
                .or_else(|_| {
                    // Fallback to constructing from individual components
                    let host = env::var("DB_HOST").unwrap_or_else(|_| "localhost".to_string());
                    let port = env::var("DB_PORT").unwrap_or_else(|_| "5432".to_string());
                    let name = env::var("DB_NAME").unwrap_or_else(|_| "yaci_store".to_string());
                    let user = env::var("DB_USER").unwrap_or_else(|_| "postgres".to_string());
                    let password = env::var("DB_PASSWORD")
                        .map_err(|_| anyhow::anyhow!("DATABASE_URL or DB_PASSWORD not set"))?;
                    Ok(format!("postgresql://{}:{}@{}:{}/{}", user, password, host, port, name))
                })
                .map_err(|e: anyhow::Error| anyhow::anyhow!("Database configuration error: {}", e))?,
            network: network.clone(),
            cache_enabled: env::var("CACHE_ENABLED")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
            cache_max_entries: env::var("CACHE_MAX_ENTRIES")
                .unwrap_or_else(|_| "10000".to_string())
                .parse()
                .unwrap_or(10000),
            govtools_base_url: env::var("GOVTOOLS_BASE_URL")
                .unwrap_or_else(|_| default_govtools_base_url.to_string()),
            govtools_enabled,
            cardano_verifier_enabled: env::var("CARDANO_VERIFIER_ENABLED")
                .unwrap_or_else(|_| "false".to_string())
                .parse()
                .unwrap_or(false),
            cardano_verifier_endpoint: env::var("CARDANO_VERIFIER_ENDPOINT").unwrap_or_else(|_| {
                "https://verifycardanomessage.cardanofoundation.org/api/verify-cip100".to_string()
            }),
        })
    }
}
