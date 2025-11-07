use crate::models::*;
use crate::providers::CachedProviderRouter;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct DRepsQueryParams {
    pub page: Option<u32>,
    pub count: Option<u32>,
    #[allow(dead_code)]
    pub enrich: Option<bool>,
}

pub async fn get_dreps(
    State(router): State<CachedProviderRouter>,
    Query(params): Query<DRepsQueryParams>,
) -> Result<Json<DRepsPage>, StatusCode> {
    let page = params.page.unwrap_or(1);
    let count = params.count.unwrap_or(20);

    match router.get_dreps_page(page, count).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            tracing::error!("Error fetching DReps: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_drep(
    State(router): State<CachedProviderRouter>,
    Path(id): Path<String>,
) -> Result<Json<Option<DRep>>, StatusCode> {
    match router.get_drep(&id).await {
        Ok(Some(drep)) => Ok(Json(Some(drep))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Error fetching DRep: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_drep_delegators(
    State(router): State<CachedProviderRouter>,
    Path(id): Path<String>,
) -> Result<Json<Vec<DRepDelegator>>, StatusCode> {
    match router.get_drep_delegators(&id).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            tracing::error!("Error fetching DRep delegators: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_drep_votes(
    State(router): State<CachedProviderRouter>,
    Path(id): Path<String>,
) -> Result<Json<Vec<DRepVotingHistory>>, StatusCode> {
    match router.get_drep_voting_history(&id).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            tracing::error!("Error fetching DRep voting history: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_drep_metadata(
    State(router): State<CachedProviderRouter>,
    Path(id): Path<String>,
) -> Result<Json<Option<Value>>, StatusCode> {
    match router.get_drep_metadata(&id).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            tracing::error!("Error fetching DRep metadata: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_drep_stats(
    State(router): State<CachedProviderRouter>,
) -> Result<Json<DRepStats>, StatusCode> {
    match router.get_total_active_dreps().await {
        Ok(Some(count)) => Ok(Json(DRepStats {
            active_dreps_count: Some(count),
        })),
        Ok(None) => Ok(Json(DRepStats {
            active_dreps_count: None,
        })),
        Err(e) => {
            tracing::error!("Error fetching DRep stats: {}", e);
            Ok(Json(DRepStats {
                active_dreps_count: None,
            }))
        }
    }
}
