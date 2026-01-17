//! Provider abstraction layer
//!
//! Provides a unified interface for accessing governance data from various sources.
//! Currently implements Yaci Store provider with optional GovTools enrichment.
//!
//! Architecture:
//! - `Provider` trait: Core interface for data providers
//! - `YaciStoreProvider`: Primary provider that queries PostgreSQL database
//! - `YaciStoreRouter`: Thin wrapper implementing Router trait
//! - `CachedProviderRouter`: Caching layer wrapper
//! - `GovToolsProvider`: Optional enrichment service

pub mod cached_router;
pub mod govtools;
pub mod provider;
pub mod router_trait;
pub mod yaci_store;
pub mod yaci_store_router;

pub use cached_router::CachedProviderRouter;
pub use govtools::{GovToolsEnrichment, GovToolsProvider};
pub use provider::Provider;
pub use router_trait::Router;
pub use yaci_store::YaciStoreProvider;
pub use yaci_store_router::YaciStoreRouter;
