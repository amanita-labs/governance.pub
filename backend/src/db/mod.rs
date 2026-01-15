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
}

