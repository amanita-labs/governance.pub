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
}

impl Config {
    pub fn from_env() -> Result<Self, anyhow::Error> {
        dotenv::dotenv().ok();

        Ok(Config {
            server_port: env::var("BACKEND_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .unwrap_or(8080),
            blockfrost_api_key: env::var("BLOCKFROST_API_KEY")
                .map_err(|_| anyhow::anyhow!("BLOCKFROST_API_KEY not set"))?,
            blockfrost_network: env::var("BLOCKFROST_NETWORK")
                .unwrap_or_else(|_| "mainnet".to_string()),
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

