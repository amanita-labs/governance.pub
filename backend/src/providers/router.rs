use crate::models::*;
use crate::providers::{BlockfrostProvider, KoiosProvider, Provider};
use std::sync::Arc;

#[derive(Clone)]
pub struct ProviderRouter {
    blockfrost: Arc<BlockfrostProvider>,
    koios: Arc<KoiosProvider>,
}

impl ProviderRouter {
    pub fn new(blockfrost: BlockfrostProvider, koios: KoiosProvider) -> Self {
        Self {
            blockfrost: Arc::new(blockfrost),
            koios: Arc::new(koios),
        }
    }

    // Smart routing strategy:
    // - DRep list: Try Koios first (faster bulk queries), fallback to Blockfrost
    // - DRep details: Use Blockfrost (more complete metadata)
    // - DRep delegators: Use Koios (specialized endpoint), fallback to Blockfrost
    // - DRep voting history: Use Koios (specialized endpoint), fallback to Blockfrost
    // - Governance actions list: Try Koios first, fallback to Blockfrost
    // - Governance action details: Try Koios first, fallback to Blockfrost
    // - Voting results: Use Koios (specialized), fallback to Blockfrost
    // - Active DReps count: Use Koios epoch summary

    pub async fn get_dreps_page(&self, page: u32, count: u32) -> Result<DRepsPage, anyhow::Error> {
        // Try Koios first (faster bulk queries)
        match self.koios.get_dreps_page(page, count).await {
            Ok(result) if !result.dreps.is_empty() => {
                tracing::debug!("Using Koios for DReps page");
                return Ok(result);
            }
            _ => {
                tracing::debug!("Koios failed, falling back to Blockfrost for DReps page");
            }
        }

        // Fallback to Blockfrost
        self.blockfrost.get_dreps_page(page, count).await
    }

    pub async fn get_drep(&self, id: &str) -> Result<Option<DRep>, anyhow::Error> {
        // Use Blockfrost (more complete metadata)
        self.blockfrost.get_drep(id).await
    }

    pub async fn get_drep_delegators(&self, id: &str) -> Result<Vec<DRepDelegator>, anyhow::Error> {
        // Try Koios first (specialized endpoint)
        match self.koios.get_drep_delegators(id).await {
            Ok(result) if !result.is_empty() => {
                tracing::debug!("Using Koios for DRep delegators");
                return Ok(result);
            }
            Ok(_) => {
                // Empty result, try Blockfrost
            }
            Err(e) => {
                tracing::debug!(
                    "Koios failed for DRep delegators: {}, falling back to Blockfrost",
                    e
                );
            }
        }

        // Fallback to Blockfrost
        self.blockfrost.get_drep_delegators(id).await
    }

    pub async fn get_drep_voting_history(
        &self,
        id: &str,
    ) -> Result<Vec<DRepVotingHistory>, anyhow::Error> {
        // Try Koios first (specialized endpoint)
        match self.koios.get_drep_voting_history(id).await {
            Ok(result) if !result.is_empty() => {
                tracing::debug!("Using Koios for DRep voting history");
                return Ok(result);
            }
            Ok(_) => {
                // Empty result, try Blockfrost
            }
            Err(e) => {
                tracing::debug!(
                    "Koios failed for DRep voting history: {}, falling back to Blockfrost",
                    e
                );
            }
        }

        // Fallback to Blockfrost
        self.blockfrost.get_drep_voting_history(id).await
    }

    pub async fn get_governance_actions_page(
        &self,
        page: u32,
        count: u32,
    ) -> Result<ActionsPage, anyhow::Error> {
        // Try Koios first
        match self.koios.get_governance_actions_page(page, count).await {
            Ok(result) if !result.actions.is_empty() => {
                tracing::debug!("Using Koios for governance actions page");
                return Ok(result);
            }
            _ => {
                tracing::debug!(
                    "Koios failed, falling back to Blockfrost for governance actions page"
                );
            }
        }

        // Fallback to Blockfrost
        self.blockfrost
            .get_governance_actions_page(page, count)
            .await
    }

    pub async fn get_governance_action(
        &self,
        id: &str,
    ) -> Result<Option<GovernanceAction>, anyhow::Error> {
        // Try Koios first
        match self.koios.get_governance_action(id).await {
            Ok(Some(action)) => {
                tracing::debug!("Using Koios for governance action");
                return Ok(Some(action));
            }
            Ok(None) => {
                tracing::debug!(
                    "Koios returned None, falling back to Blockfrost for governance action"
                );
            }
            Err(e) => {
                tracing::debug!(
                    "Koios failed for governance action: {}, falling back to Blockfrost",
                    e
                );
            }
        }

        // Fallback to Blockfrost
        self.blockfrost.get_governance_action(id).await
    }

    pub async fn get_action_voting_results(
        &self,
        id: &str,
    ) -> Result<ActionVotingBreakdown, anyhow::Error> {
        // Try Koios first (specialized)
        match self.koios.get_action_voting_results(id).await {
            Ok(result) if result.total_voting_power != "0" => {
                tracing::debug!("Using Koios for action voting results");
                return Ok(result);
            }
            _ => {
                tracing::debug!(
                    "Koios failed, falling back to Blockfrost for action voting results"
                );
            }
        }

        // Fallback to Blockfrost
        self.blockfrost.get_action_voting_results(id).await
    }

    pub async fn get_drep_metadata(
        &self,
        id: &str,
    ) -> Result<Option<serde_json::Value>, anyhow::Error> {
        // Use Blockfrost (has metadata endpoint)
        self.blockfrost.get_drep_metadata(id).await
    }

    pub async fn get_total_active_dreps(&self) -> Result<Option<u32>, anyhow::Error> {
        // Use Koios epoch summary
        self.koios.get_total_active_dreps().await
    }

    pub async fn get_stake_delegation(
        &self,
        stake_address: &str,
    ) -> Result<Option<StakeDelegation>, anyhow::Error> {
        // Try Koios first (specialized endpoint)
        match self.koios.get_stake_delegation(stake_address).await {
            Ok(Some(delegation)) => {
                tracing::debug!("Using Koios for stake delegation");
                return Ok(Some(delegation));
            }
            Ok(None) => {
                tracing::debug!(
                    "Koios returned None, falling back to Blockfrost for stake delegation"
                );
            }
            Err(e) => {
                tracing::debug!(
                    "Koios failed for stake delegation: {}, falling back to Blockfrost",
                    e
                );
            }
        }

        // Fallback to Blockfrost
        self.blockfrost.get_stake_delegation(stake_address).await
    }

    pub async fn health_check(&self) -> Result<bool, anyhow::Error> {
        let blockfrost_ok = self.blockfrost.health_check().await.unwrap_or(false);
        let koios_ok = self.koios.health_check().await.unwrap_or(false);
        Ok(blockfrost_ok && koios_ok)
    }
}
