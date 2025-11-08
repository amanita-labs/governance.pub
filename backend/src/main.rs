mod api;
mod cache;
mod config;
mod models;
mod providers;
mod utils;

use axum::{routing::get, Router};
use cache::CacheManager;
use config::Config;
use providers::{
    BlockfrostProvider, CachedProviderRouter, GovToolsProvider, KoiosProvider, ProviderRouter,
};
use std::net::SocketAddr;
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "govtwool_backend=debug,tower_http=debug".into()),
        )
        .init();

    let config = Config::from_env()?;

    let blockfrost_base_url = config.blockfrost_base_url();
    let blockfrost_provider =
        BlockfrostProvider::new(blockfrost_base_url, config.blockfrost_api_key);
    let koios_provider = KoiosProvider::new(config.koios_base_url);
    let provider_router = ProviderRouter::new(blockfrost_provider, koios_provider);
    let govtools_provider = if config.govtools_enabled {
        Some(GovToolsProvider::new(config.govtools_base_url.clone()))
    } else {
        None
    };

    // Initialize cache
    let cache_manager = CacheManager::new(config.cache_enabled, config.cache_max_entries);
    let router = CachedProviderRouter::new(provider_router, cache_manager, govtools_provider);

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(api::health::health_check))
        .route("/api/dreps", get(api::dreps::get_dreps))
        .route("/api/dreps/stats", get(api::dreps::get_drep_stats))
        .route("/api/dreps/:id", get(api::dreps::get_drep))
        .route(
            "/api/dreps/:id/delegators",
            get(api::dreps::get_drep_delegators),
        )
        .route("/api/dreps/:id/votes", get(api::dreps::get_drep_votes))
        .route(
            "/api/dreps/:id/metadata",
            get(api::dreps::get_drep_metadata),
        )
        .route("/api/actions", get(api::actions::get_actions))
        .route("/api/actions/:id", get(api::actions::get_action))
        .route(
            "/api/actions/:id/votes",
            get(api::actions::get_action_votes),
        )
        .route(
            "/api/stake/:stake_address/delegation",
            get(api::stake::get_stake_delegation),
        )
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(cors),
        )
        .with_state(router);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.server_port));
    tracing::info!("Starting server on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
