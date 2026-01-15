//! Database layer
//!
//! Provides database connection pooling and query execution.
//! All SQL queries are defined in the `queries` submodule.

pub mod queries;

use sqlx::{PgPool, postgres::PgPoolOptions};
use std::time::Duration;
use anyhow::Result;

#[derive(Clone)]
pub struct Database {
    pool: PgPool,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .acquire_timeout(Duration::from_secs(30))
            .connect(database_url)
            .await?;

        Ok(Self { pool })
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    pub async fn health_check(&self) -> Result<bool> {
        sqlx::query("SELECT 1")
            .execute(self.pool())
            .await
            .map(|_| true)
            .map_err(|e| anyhow::anyhow!("Database health check failed: {}", e))
    }
    
    pub async fn get_sync_status(&self) -> Result<queries::SyncStatus> {
        queries::get_yaci_sync_status(self.pool()).await
    }

    pub async fn get_database_stats(&self) -> Result<queries::DatabaseStats> {
        let mut stats = queries::get_database_stats(self.pool()).await?;
        
        // Add connection pool information
        let pool = self.pool();
        let pool_size = pool.size() as u32;
        let num_idle = pool.num_idle() as u32;
        stats.connection_pool_size = Some(pool_size);
        stats.active_connections = Some(pool_size.saturating_sub(num_idle));
        
        Ok(stats)
    }

    pub async fn get_indexer_health(&self) -> Result<queries::IndexerHealth> {
        queries::get_indexer_health(self.pool()).await
    }
}

