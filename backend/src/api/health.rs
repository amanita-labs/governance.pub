use crate::providers::CachedProviderRouter;
use axum::{extract::State, http::StatusCode, response::Json};
use serde_json::{json, Value};

pub async fn health_check(
    State(router): State<CachedProviderRouter>,
) -> Result<Json<Value>, StatusCode> {
    let is_healthy = router.health_check().await.unwrap_or(false);
    let cache_stats = router.cache_stats().await;

    if is_healthy {
        Ok(Json(json!({
            "status": "healthy",
            "providers": {
                "blockfrost": "ok",
                "koios": "ok"
            },
            "cache": {
                "enabled": cache_stats.enabled,
                "entries": cache_stats.entries,
                "hits": cache_stats.hits,
                "misses": cache_stats.misses,
                "hit_rate": format!("{:.2}%", cache_stats.hit_rate)
            }
        })))
    } else {
        Ok(Json(json!({
            "status": "degraded",
            "providers": {
                "blockfrost": "unknown",
                "koios": "unknown"
            },
            "cache": {
                "enabled": cache_stats.enabled,
                "entries": cache_stats.entries,
                "hits": cache_stats.hits,
                "misses": cache_stats.misses,
                "hit_rate": format!("{:.2}%", cache_stats.hit_rate)
            }
        })))
    }
}
