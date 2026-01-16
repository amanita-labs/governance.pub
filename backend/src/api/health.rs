use crate::db::Database;
use crate::providers::CachedProviderRouter;
use axum::{extract::State, http::StatusCode, response::Json};
use serde_json::{json, Value};

/// Overall health check endpoint
/// Returns 200 if healthy, 503 if degraded
/// Includes indexer metrics but uses fast queries to avoid timeouts
pub async fn health_check(
    State((router, database)): State<(CachedProviderRouter, Database)>,
) -> Result<Json<Value>, StatusCode> {
    let is_healthy = router.health_check().await.unwrap_or(false);
    let cache_stats = router.cache_stats().await;
    
    // Quick database health check (simple SELECT 1)
    let db_healthy = match database.health_check().await {
        Ok(healthy) => healthy,
        Err(_) => false,
    };
    
    // Get sync status with metrics (uses fast queries - no COUNT on large tables)
    let sync_status = database.get_sync_status().await.ok();
    let yaci_connected = sync_status.as_ref().map(|s| s.connected).unwrap_or(false);
    let yaci_synced = sync_status.as_ref().and_then(|s| s.latest_block_number).is_some();
    
    // Get indexer health with activity metrics (wrap in timeout to prevent hanging)
    let indexer_health = tokio::time::timeout(
        std::time::Duration::from_secs(2),
        database.get_indexer_health()
    )
    .await
    .ok()
    .and_then(|r| r.ok());
    
    let indexer_status = indexer_health.as_ref()
        .map(|h| match h.status {
            crate::db::queries::IndexerStatus::Active => "active",
            crate::db::queries::IndexerStatus::Stale => "stale",
            crate::db::queries::IndexerStatus::Stopped => "stopped",
        })
        .unwrap_or_else(|| {
            // Fallback: determine status from sync_status if indexer_health timed out
            if yaci_synced {
                "active"
            } else if yaci_connected {
                "syncing"
            } else {
                "unknown"
            }
        });

    // Get basic database metrics (with timeout to prevent hanging)
    let db_metrics = tokio::time::timeout(
        std::time::Duration::from_secs(1),
        async {
            // Quick queries for basic database info
            let db_name: Option<String> = sqlx::query_as::<_, (String,)>(
                "SELECT current_database()"
            )
            .fetch_optional(database.pool())
            .await
            .ok()
            .flatten()
            .map(|(name,)| name);
            
            let db_size: Option<i64> = sqlx::query_as::<_, (i64,)>(
                "SELECT pg_database_size(current_database())"
            )
            .fetch_optional(database.pool())
            .await
            .ok()
            .flatten()
            .map(|(size,)| size);
            
            let table_count: Option<i32> = sqlx::query_as::<_, (i64,)>(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
            )
            .fetch_optional(database.pool())
            .await
            .ok()
            .flatten()
            .map(|(count,)| count as i32);
            
            let pool = database.pool();
            let pool_size = pool.size() as u32;
            let num_idle = pool.num_idle() as u32;
            Some(json!({
                "name": db_name,
                "size_bytes": db_size,
                "size_mb": db_size.map(|b| (b as f64 / 1_048_576.0)),
                "total_tables": table_count,
                "connection_pool": {
                    "size": pool_size,
                    "active": pool_size.saturating_sub(num_idle),
                    "idle": num_idle
                }
            }))
        }
    )
    .await
    .ok()
    .flatten();

    let overall_healthy = is_healthy && db_healthy && yaci_connected;

    let response = json!({
        "status": if overall_healthy { "healthy" } else { "degraded" },
        "database": {
            "connected": db_healthy,
            "name": db_metrics.as_ref().and_then(|m| m.get("name").and_then(|v| v.as_str())),
            "size_bytes": db_metrics.as_ref().and_then(|m| m.get("size_bytes").and_then(|v| v.as_i64())),
            "size_mb": db_metrics.as_ref().and_then(|m| m.get("size_mb").and_then(|v| v.as_f64())),
            "total_tables": db_metrics.as_ref().and_then(|m| m.get("total_tables").and_then(|v| v.as_i64().map(|i| i as i32))),
            "connection_pool": db_metrics.as_ref()
                .and_then(|m| m.get("connection_pool"))
                .cloned()
                .unwrap_or_else(|| {
                    let pool = database.pool();
                    let pool_size = pool.size() as u32;
                    let num_idle = pool.num_idle() as u32;
                    json!({
                        "size": pool_size,
                        "active": pool_size.saturating_sub(num_idle),
                        "idle": num_idle
                    })
                })
        },
        "indexer": {
            "connected": yaci_connected,
            "synced": yaci_synced,
            "status": indexer_status,
            "latest_block": sync_status.as_ref().and_then(|s| s.latest_block_number),
            "latest_block_slot": sync_status.as_ref().and_then(|s| s.latest_block_slot),
            "latest_block_time": sync_status.as_ref().and_then(|s| s.latest_block_time),
            "latest_epoch": sync_status.as_ref().and_then(|s| s.latest_epoch),
            "total_blocks": sync_status.as_ref().and_then(|s| s.total_blocks),
            "sync_progress": sync_status.as_ref().and_then(|s| s.sync_progress.clone()),
            "is_syncing": indexer_health.as_ref().map(|h| h.is_syncing).unwrap_or(false),
            "blocks_last_hour": indexer_health.as_ref().and_then(|h| h.blocks_last_hour),
            "blocks_last_day": indexer_health.as_ref().and_then(|h| h.blocks_last_day),
            "sync_rate_per_minute": indexer_health.as_ref()
                .and_then(|h| h.sync_rate_per_minute)
                .map(|r| format!("{:.2}", r)),
            "last_sync_ago_seconds": indexer_health.as_ref().and_then(|h| h.last_sync_ago_seconds)
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
