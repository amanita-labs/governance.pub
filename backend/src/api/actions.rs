use crate::db::Database;
use crate::models::*;
use crate::providers::CachedProviderRouter;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct ActionsQueryParams {
    pub page: Option<u32>,
    pub count: Option<u32>,
    #[allow(dead_code)]
    pub enrich: Option<bool>,
}

pub async fn get_actions(
    State((router, _)): State<(CachedProviderRouter, Database)>,
    Query(params): Query<ActionsQueryParams>,
) -> Result<Json<ActionsPage>, StatusCode> {
    let page = params.page.unwrap_or(1);
    let count = params.count.unwrap_or(20);

    match router.get_governance_actions_page(page, count).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            tracing::error!("Error fetching governance actions: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_action(
    State((router, _)): State<(CachedProviderRouter, Database)>,
    Path(id): Path<String>,
) -> Result<Json<Option<GovernanceAction>>, StatusCode> {
    match router.get_governance_action(&id).await {
        Ok(Some(action)) => Ok(Json(Some(action))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Error fetching governance action: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_action_votes(
    State((router, _)): State<(CachedProviderRouter, Database)>,
    Path(id): Path<String>,
) -> Result<Json<ActionVotingBreakdown>, StatusCode> {
    match router.get_action_voting_results(&id).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            tracing::error!("Error fetching action voting results: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_action_participation(
    State((router, _)): State<(CachedProviderRouter, Database)>,
    Path(id): Path<String>,
) -> Result<Json<ActionVoterParticipation>, StatusCode> {
    match router.get_action_voter_participation(&id).await {
        Ok(result) => Ok(Json(result)),
        Err(error) => {
            tracing::error!("Error fetching action participation {}: {}", id, error);
            if error.to_string().contains("not found") {
                Err(StatusCode::NOT_FOUND)
            } else {
                Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
    }
}
