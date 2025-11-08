use axum::{extract::{Path, State}, http::StatusCode, Json};
use crate::models::StakeDelegation; // restored import (even if unused originally before cleanup)
use crate::providers::CachedProviderRouter;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct StakeDelegationResponse {
    pub stake_address: String,
    pub delegated_pool: Option<String>,
    pub delegated_drep: Option<String>,
    pub total_balance: Option<String>,
    pub utxo_balance: Option<String>,
    pub rewards_available: Option<String>,
}

pub async fn get_stake_delegation(
    State(router): State<CachedProviderRouter>,
    Path(stake_address): Path<String>,
) -> Result<Json<StakeDelegationResponse>, StatusCode> {
    match router.get_stake_delegation(&stake_address).await {
        Ok(Some(delegation)) => Ok(Json(StakeDelegationResponse {
            stake_address: delegation.stake_address,
            delegated_pool: delegation.delegated_pool,
            delegated_drep: delegation.delegated_drep,
            total_balance: delegation.total_balance,
            utxo_balance: delegation.utxo_balance,
            rewards_available: delegation.rewards_available,
        })),
        Ok(None) => {
            tracing::warn!("Stake address not found: {}", stake_address);
            Err(StatusCode::NOT_FOUND)
        }
        Err(e) => {
            tracing::error!("Error fetching stake delegation: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
