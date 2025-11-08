pub mod blockfrost;
pub mod cached_router;
pub mod govtools;
pub mod koios;
pub mod router;

pub use blockfrost::BlockfrostProvider;
pub use cached_router::CachedProviderRouter;
pub use govtools::{GovToolsEnrichment, GovToolsProvider};
pub use koios::KoiosProvider;
pub use router::ProviderRouter;

use crate::models::*;
use async_trait::async_trait;

#[async_trait]
pub trait Provider: Send + Sync {
    async fn get_dreps_page(&self, page: u32, count: u32) -> Result<DRepsPage, anyhow::Error>;

    async fn get_drep(&self, id: &str) -> Result<Option<DRep>, anyhow::Error>;

    async fn get_drep_delegators(&self, id: &str) -> Result<Vec<DRepDelegator>, anyhow::Error>;

    async fn get_drep_voting_history(
        &self,
        id: &str,
    ) -> Result<Vec<DRepVotingHistory>, anyhow::Error>;

    async fn get_governance_actions_page(
        &self,
        page: u32,
        count: u32,
    ) -> Result<ActionsPage, anyhow::Error>;

    async fn get_governance_action(
        &self,
        id: &str,
    ) -> Result<Option<GovernanceAction>, anyhow::Error>;

    async fn get_action_voting_results(
        &self,
        id: &str,
    ) -> Result<ActionVotingBreakdown, anyhow::Error>;

    async fn get_drep_metadata(&self, id: &str)
        -> Result<Option<serde_json::Value>, anyhow::Error>;

    async fn get_total_active_dreps(&self) -> Result<Option<u32>, anyhow::Error>;

    async fn get_stake_delegation(
        &self,
        stake_address: &str,
    ) -> Result<Option<StakeDelegation>, anyhow::Error>;

    async fn health_check(&self) -> Result<bool, anyhow::Error>;
}
