use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub server_port: u16,
    pub blockfrost_api_key: String,
    pub blockfrost_network: String,
    pub koios_base_url: String,
    #[allow(dead_code)]
    pub cors_origins: Vec<String>,
    pub cache_enabled: bool,
    pub cache_max_entries: usize,
    pub govtools_base_url: String,
    pub govtools_enabled: bool,
}

impl Config {
    pub fn from_env() -> Result<Self, anyhow::Error> {
        dotenv::dotenv().ok();

        let blockfrost_network = env::var("BLOCKFROST_NETWORK")
            .unwrap_or_else(|_| "mainnet".to_string());

        // GovTools only provides mainnet data, so disable it for non-mainnet networks
        let is_mainnet = blockfrost_network.to_lowercase() == "mainnet";
        let govtools_enabled_default = if is_mainnet { "true" } else { "false" };

        let govtools_enabled = env::var("GOVTOOLS_ENABLED")
            .unwrap_or_else(|_| govtools_enabled_default.to_string())
            .parse()
            .unwrap_or(is_mainnet);

        Ok(Config {
            server_port: env::var("PORT")
                .or_else(|_| env::var("BACKEND_PORT"))
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .unwrap_or(8080),
            blockfrost_api_key: env::var("BLOCKFROST_API_KEY")
                .map_err(|_| anyhow::anyhow!("BLOCKFROST_API_KEY not set"))?,
            blockfrost_network: blockfrost_network.clone(),
            koios_base_url: env::var("KOIOS_BASE_URL")
                .unwrap_or_else(|_| "https://preview.koios.rest/api/v1".to_string()),
            cors_origins: env::var("CORS_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:3000".to_string())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
            cache_enabled: env::var("CACHE_ENABLED")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
            cache_max_entries: env::var("CACHE_MAX_ENTRIES")
                .unwrap_or_else(|_| "10000".to_string())
                .parse()
                .unwrap_or(10000),
            govtools_base_url: env::var("GOVTOOLS_BASE_URL")
                .unwrap_or_else(|_| "https://be.gov.tools".to_string()),
            govtools_enabled,
        })
    }

    pub fn blockfrost_base_url(&self) -> String {
        if self.blockfrost_network == "mainnet" {
            "https://cardano-mainnet.blockfrost.io/api/v0".to_string()
        } else {
            "https://cardano-preview.blockfrost.io/api/v0".to_string()
        }
    }
}
