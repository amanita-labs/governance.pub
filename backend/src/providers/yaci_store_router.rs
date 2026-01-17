use crate::models::*;
use crate::providers::{Provider, Router as RouterTrait, yaci_store::YaciStoreProvider};
use async_trait::async_trait;
use std::sync::Arc;

#[derive(Clone)]
pub struct YaciStoreRouter {
    provider: Arc<YaciStoreProvider>,
}

impl YaciStoreRouter {
    pub fn new(provider: YaciStoreProvider) -> Self {
        Self {
            provider: Arc::new(provider),
        }
    }

    pub async fn get_dreps_page(&self, query: &DRepsQuery) -> Result<DRepsPage, anyhow::Error> {
        Provider::get_dreps_page(self.provider.as_ref(), query).await
    }

    pub async fn get_drep(&self, id: &str) -> Result<Option<DRep>, anyhow::Error> {
        Provider::get_drep(self.provider.as_ref(), id).await
    }

    pub async fn get_drep_delegators(&self, id: &str) -> Result<Vec<DRepDelegator>, anyhow::Error> {
        Provider::get_drep_delegators(self.provider.as_ref(), id).await
    }

    pub async fn get_drep_voting_history(
        &self,
        id: &str,
    ) -> Result<Vec<DRepVotingHistory>, anyhow::Error> {
        Provider::get_drep_voting_history(self.provider.as_ref(), id).await
    }

    pub async fn get_governance_actions_page(
        &self,
        page: u32,
        count: u32,
    ) -> Result<ActionsPage, anyhow::Error> {
        Provider::get_governance_actions_page(self.provider.as_ref(), page, count).await
    }

    pub async fn get_governance_action(
        &self,
        id: &str,
    ) -> Result<Option<GovernanceAction>, anyhow::Error> {
        Provider::get_governance_action(self.provider.as_ref(), id).await
    }

    pub async fn get_action_voting_results(
        &self,
        id: &str,
    ) -> Result<ActionVotingBreakdown, anyhow::Error> {
        Provider::get_action_voting_results(self.provider.as_ref(), id).await
    }

    pub async fn get_drep_metadata(
        &self,
        id: &str,
    ) -> Result<Option<serde_json::Value>, anyhow::Error> {
        Provider::get_drep_metadata(self.provider.as_ref(), id).await
    }

    pub async fn get_total_active_dreps(&self) -> Result<Option<u32>, anyhow::Error> {
        Provider::get_total_active_dreps(self.provider.as_ref()).await
    }

    pub async fn get_stake_delegation(
        &self,
        stake_address: &str,
    ) -> Result<Option<StakeDelegation>, anyhow::Error> {
        Provider::get_stake_delegation(self.provider.as_ref(), stake_address).await
    }

    pub async fn get_stake_pools_page(
        &self,
        page: u32,
        count: u32,
    ) -> Result<StakePoolPage, anyhow::Error> {
        self.provider.get_stake_pools_page(page, count).await
    }

    pub async fn get_committee_members(&self) -> Result<Vec<CommitteeMemberInfo>, anyhow::Error> {
        self.provider.get_committee_members().await
    }

    pub async fn get_action_vote_records(
        &self,
        action: &GovernanceAction,
    ) -> Result<Vec<ActionVoteRecord>, anyhow::Error> {
        self.provider.get_action_vote_records(action).await
    }

    pub async fn health_check(&self) -> Result<bool, anyhow::Error> {
        Provider::health_check(self.provider.as_ref()).await
    }

    pub async fn get_epoch_start_time(&self, epoch: u32) -> Result<Option<u64>, anyhow::Error> {
        self.provider.get_epoch_start_time(epoch).await
    }
}

#[async_trait]
impl RouterTrait for YaciStoreRouter {
    async fn get_dreps_page(&self, query: &DRepsQuery) -> Result<DRepsPage, anyhow::Error> {
        YaciStoreRouter::get_dreps_page(self, query).await
    }

    async fn get_drep(&self, id: &str) -> Result<Option<DRep>, anyhow::Error> {
        YaciStoreRouter::get_drep(self, id).await
    }

    async fn get_drep_delegators(&self, id: &str) -> Result<Vec<DRepDelegator>, anyhow::Error> {
        YaciStoreRouter::get_drep_delegators(self, id).await
    }

    async fn get_drep_voting_history(&self, id: &str) -> Result<Vec<DRepVotingHistory>, anyhow::Error> {
        YaciStoreRouter::get_drep_voting_history(self, id).await
    }

    async fn get_governance_actions_page(&self, page: u32, count: u32) -> Result<ActionsPage, anyhow::Error> {
        YaciStoreRouter::get_governance_actions_page(self, page, count).await
    }

    async fn get_governance_action(&self, id: &str) -> Result<Option<GovernanceAction>, anyhow::Error> {
        YaciStoreRouter::get_governance_action(self, id).await
    }

    async fn get_action_voting_results(&self, id: &str) -> Result<ActionVotingBreakdown, anyhow::Error> {
        YaciStoreRouter::get_action_voting_results(self, id).await
    }

    async fn get_drep_metadata(&self, id: &str) -> Result<Option<serde_json::Value>, anyhow::Error> {
        YaciStoreRouter::get_drep_metadata(self, id).await
    }

    async fn get_total_active_dreps(&self) -> Result<Option<u32>, anyhow::Error> {
        YaciStoreRouter::get_total_active_dreps(self).await
    }

    async fn get_stake_delegation(&self, stake_address: &str) -> Result<Option<StakeDelegation>, anyhow::Error> {
        YaciStoreRouter::get_stake_delegation(self, stake_address).await
    }

    async fn get_stake_pools_page(&self, page: u32, count: u32) -> Result<StakePoolPage, anyhow::Error> {
        YaciStoreRouter::get_stake_pools_page(self, page, count).await
    }

    async fn get_committee_members(&self) -> Result<Vec<CommitteeMemberInfo>, anyhow::Error> {
        YaciStoreRouter::get_committee_members(self).await
    }

    async fn get_action_vote_records(&self, action: &GovernanceAction) -> Result<Vec<ActionVoteRecord>, anyhow::Error> {
        YaciStoreRouter::get_action_vote_records(self, action).await
    }

    async fn health_check(&self) -> Result<bool, anyhow::Error> {
        YaciStoreRouter::health_check(self).await
    }

    async fn get_epoch_start_time(&self, epoch: u32) -> Result<Option<u64>, anyhow::Error> {
        YaciStoreRouter::get_epoch_start_time(self, epoch).await
    }
}

