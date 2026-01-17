use crate::db::Database;
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
    #[serde(default, alias = "pageSize")]
    pub page_size: Option<u32>,
    #[serde(default, alias = "status[]")]
    pub status: Vec<String>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub sort: Option<String>,
    #[serde(default)]
    pub direction: Option<String>,
    #[serde(default)]
    #[allow(dead_code)]
    pub enrich: Option<bool>,
}

impl DRepsQueryParams {
    fn into_query(self) -> DRepsQuery {
        let page = self.page.unwrap_or(1);
        let count = self.page_size.or(self.count).unwrap_or(20);

        DRepsQuery {
            page,
            count,
            statuses: self.status,
            search: self.search,
            sort: self.sort,
            direction: self.direction,
            enrich: self.enrich.unwrap_or(false),
        }
        .with_defaults()
    }
}

pub async fn get_dreps(
    State((router, _)): State<(CachedProviderRouter, Database)>,
    Query(params): Query<DRepsQueryParams>,
) -> Result<Json<DRepsPage>, StatusCode> {
    let query = params.into_query();

    match router.get_dreps_page(&query).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            tracing::error!("Error fetching DReps: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_drep(
    State((router, _)): State<(CachedProviderRouter, Database)>,
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
    State((router, _)): State<(CachedProviderRouter, Database)>,
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
    State((router, _)): State<(CachedProviderRouter, Database)>,
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
    State((router, _)): State<(CachedProviderRouter, Database)>,
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
    State((router, _)): State<(CachedProviderRouter, Database)>,
) -> Result<Json<DRepStats>, StatusCode> {
    match router.get_drep_stats().await {
        Ok(stats) => Ok(Json(stats)),
        Err(e) => {
            tracing::error!("Error fetching DRep stats: {}", e);
            Ok(Json(DRepStats {
                active_dreps_count: None,
                total_dreps_count: None,
                total_voting_power: None,
                top_drep: None,
            }))
        }
    }
}
