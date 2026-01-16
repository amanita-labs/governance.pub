use crate::db::Database;
use crate::providers::CachedProviderRouter;
use axum::{extract::State, http::StatusCode, response::Json};
use serde_json::{json, Value};

/// Overall health check endpoint
/// Returns 200 if healthy, 503 if degraded
/// Optimized for fast response (used by Render for deployment health checks)
pub async fn health_check(
    State((router, database)): State<(CachedProviderRouter, Database)>,
) -> Result<Json<Value>, StatusCode> {
    // Fast checks only - no complex queries that could timeout
    let is_healthy = router.health_check().await.unwrap_or(false);
    let cache_stats = router.cache_stats().await;
    
    // Quick database health check (simple SELECT 1)
    let db_healthy = match database.health_check().await {
        Ok(healthy) => healthy,
        Err(_) => false,
    };
    
    // Quick sync status check (just verify database connection and basic sync)
    // Don't run expensive COUNT queries - just check if we can query blocks
    let yaci_connected = db_healthy; // If DB is healthy, indexer can connect
    let yaci_synced = sqlx::query("SELECT 1 FROM block LIMIT 1")
        .execute(database.pool())
        .await
        .is_ok();

    let overall_healthy = is_healthy && db_healthy && yaci_connected;

    let response = json!({
        "status": if overall_healthy { "healthy" } else { "degraded" },
        "database": {
            "connected": db_healthy
        },
        "indexer": {
            "connected": yaci_connected,
            "synced": yaci_synced
        },
        "cache": {
            "enabled": cache_stats.enabled,
            "entries": cache_stats.entries,
            "hits": cache_stats.hits,
            "misses": cache_stats.misses,
            "hit_rate": format!("{:.2}%", cache_stats.hit_rate)
        }
    });

    if overall_healthy {
        Ok(Json(response))
    } else {
        Err(StatusCode::SERVICE_UNAVAILABLE)
    }
}

/// Detailed database statistics endpoint
pub async fn database_health(
    State((_router, database)): State<(CachedProviderRouter, Database)>,
) -> Result<Json<Value>, StatusCode> {
    match database.get_database_stats().await {
        Ok(stats) => {
            let response = json!({
                "status": if stats.connected { "healthy" } else { "unhealthy" },
                "database": {
                    "name": stats.database_name,
                    "connected": stats.connected,
                    "size_bytes": stats.database_size_bytes,
                    "size_mb": stats.database_size_bytes.map(|b| (b as f64 / 1_048_576.0)),
                    "total_tables": stats.total_tables,
                    "total_rows": stats.total_rows,
                    "connection_pool": {
                        "size": stats.connection_pool_size,
                        "active_connections": stats.active_connections
                    },
                    "tables": stats.table_details.iter().map(|t| json!({
                        "name": t.table_name,
                        "rows": t.row_count,
                        "columns": t.column_count,
                        "size_bytes": t.table_size_bytes,
                        "size_mb": t.table_size_bytes.map(|b| (b as f64 / 1_048_576.0))
                    })).collect::<Vec<_>>()
                }
            });
            
            if stats.connected {
                Ok(Json(response))
            } else {
                Err(StatusCode::SERVICE_UNAVAILABLE)
            }
        }
        Err(_e) => {
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Detailed indexer health endpoint
pub async fn indexer_health(
    State((_router, database)): State<(CachedProviderRouter, Database)>,
) -> Result<Json<Value>, StatusCode> {
    match database.get_indexer_health().await {
        Ok(health) => {
            let response = json!({
                "status": match health.status {
                    crate::db::queries::IndexerStatus::Active => "active",
                    crate::db::queries::IndexerStatus::Stale => "stale",
                    crate::db::queries::IndexerStatus::Stopped => "stopped",
                },
                "connected": health.connected,
                "is_syncing": health.is_syncing,
                "latest_block": {
                    "number": health.latest_block_number,
                    "time": health.latest_block_time,
                    "time_ago_seconds": health.last_sync_ago_seconds
                },
                "total_blocks": health.total_blocks,
                "latest_epoch": health.latest_epoch,
                "activity": {
                    "blocks_last_hour": health.blocks_last_hour,
                    "blocks_last_day": health.blocks_last_day,
                    "sync_rate_per_minute": health.sync_rate_per_minute.map(|r| format!("{:.2}", r))
                }
            });
            
            // Return 200 OK even if stale/stopped, but 503 if not connected
            if health.connected {
                Ok(Json(response))
            } else {
                Err(StatusCode::SERVICE_UNAVAILABLE)
            }
        }
        Err(_e) => {
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
