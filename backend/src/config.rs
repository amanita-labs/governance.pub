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
    pub cardano_verifier_enabled: bool,
    pub cardano_verifier_endpoint: String,
}

impl Config {
    pub fn from_env() -> Result<Self, anyhow::Error> {
        dotenv::dotenv().ok();

        let blockfrost_network =
            env::var("BLOCKFROST_NETWORK").unwrap_or_else(|_| "mainnet".to_string());

        // Choose GovTools base URL by network (GovTools supports mainnet and preview)
        let network_lc = blockfrost_network.to_lowercase();
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

    pub fn blockfrost_base_url(&self) -> String {
        if self.blockfrost_network == "mainnet" {
            "https://cardano-mainnet.blockfrost.io/api/v0".to_string()
        } else {
            "https://cardano-preview.blockfrost.io/api/v0".to_string()
        }
    }
}
