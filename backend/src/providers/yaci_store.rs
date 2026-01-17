use crate::db::{Database, queries};
use crate::models::*;
use crate::models::participation::ActionVoteRecord;
use crate::providers::Provider;
use crate::utils::drep_id::normalize_to_cip129;
use async_trait::async_trait;
use sqlx::{PgPool, Row};
use std::sync::Arc;

pub struct YaciStoreProvider {
    db: Arc<Database>,
}

impl YaciStoreProvider {
    pub fn new(database: Database) -> Self {
        Self {
            db: Arc::new(database),
        }
    }

    fn pool(&self) -> &PgPool {
        self.db.pool()
    }
}

#[async_trait]
impl Provider for YaciStoreProvider {
    async fn get_dreps_page(&self, query: &DRepsQuery) -> Result<DRepsPage, anyhow::Error> {
        queries::get_dreps_page(self.pool(), query).await
    }

    async fn get_drep(&self, id: &str) -> Result<Option<DRep>, anyhow::Error> {
        // Try to normalize the ID and query
        let normalized_id = normalize_to_cip129(id).unwrap_or_else(|_| id.to_string());
        queries::get_drep(self.pool(), &normalized_id).await
    }

    async fn get_drep_delegators(&self, id: &str) -> Result<Vec<DRepDelegator>, anyhow::Error> {
        let normalized_id = normalize_to_cip129(id).unwrap_or_else(|_| id.to_string());
        queries::get_drep_delegators(self.pool(), &normalized_id).await
    }

    async fn get_drep_voting_history(
        &self,
        id: &str,
    ) -> Result<Vec<DRepVotingHistory>, anyhow::Error> {
        let normalized_id = normalize_to_cip129(id).unwrap_or_else(|_| id.to_string());
        queries::get_drep_voting_history(self.pool(), &normalized_id).await
    }

    async fn get_governance_actions_page(
        &self,
        page: u32,
        count: u32,
    ) -> Result<ActionsPage, anyhow::Error> {
        queries::get_governance_actions_page(self.pool(), page, count).await
    }

    async fn get_governance_action(
        &self,
        id: &str,
    ) -> Result<Option<GovernanceAction>, anyhow::Error> {
        queries::get_governance_action(self.pool(), id).await
    }

    async fn get_action_voting_results(
        &self,
        id: &str,
    ) -> Result<ActionVotingBreakdown, anyhow::Error> {
        queries::get_action_voting_results(self.pool(), id).await
    }

    async fn get_drep_metadata(
        &self,
        id: &str,
    ) -> Result<Option<serde_json::Value>, anyhow::Error> {
        // Get DRep first to check for metadata
        let normalized_id = normalize_to_cip129(id).unwrap_or_else(|_| id.to_string());
        match queries::get_drep(self.pool(), &normalized_id).await? {
            Some(drep) => {
                if let Some(metadata) = drep.metadata {
                    Ok(Some(serde_json::json!({
                        "json_metadata": metadata.extra,
                        "url": drep.url,
                        "hash": drep.anchor.as_ref().map(|a| &a.data_hash)
                    })))
                } else {
                    Ok(None)
                }
            }
            None => Ok(None),
        }
    }

    async fn get_total_active_dreps(&self) -> Result<Option<u32>, anyhow::Error> {
        queries::get_total_active_dreps(self.pool()).await
    }

    async fn get_stake_delegation(
        &self,
        stake_address: &str,
    ) -> Result<Option<StakeDelegation>, anyhow::Error> {
        queries::get_stake_delegation(self.pool(), stake_address).await
    }

    async fn health_check(&self) -> Result<bool, anyhow::Error> {
        self.db.health_check().await
    }
}

// Additional methods used by CachedProviderRouter
impl YaciStoreProvider {
    pub async fn get_action_vote_records(
        &self,
        action: &GovernanceAction,
    ) -> Result<Vec<ActionVoteRecord>, anyhow::Error> {
        use crate::models::participation::VoteChoice;
        
        // Parse action_id to get tx_hash and idx
        let (tx_hash, idx) = if let Some(proposal_tx_hash) = &action.proposal_tx_hash {
            (proposal_tx_hash.clone(), action.proposal_index.unwrap_or(0) as i32)
        } else if action.action_id.contains('#') {
            let parts: Vec<&str> = action.action_id.split('#').collect();
            if parts.len() == 2 {
                (parts[0].to_string(), parts[1].parse::<i32>().unwrap_or(0))
            } else {
                (action.tx_hash.clone(), 0)
            }
        } else {
            (action.tx_hash.clone(), 0)
        };
        
        // Query all votes for this action
        let rows = sqlx::query(
            r#"
            SELECT 
                vp.voter_hash as voter_identifier,
                vp.voter_type,
                vp.vote,
                NULL as voting_power,
                vp.tx_hash,
                vp.idx as cert_index,
                vp.block_time
            FROM voting_procedure vp
            WHERE vp.gov_action_tx_hash = $1 AND vp.gov_action_index = $2
            ORDER BY vp.block_time DESC
            "#
        )
        .bind(&tx_hash)
        .bind(idx)
        .fetch_all(self.pool())
        .await?;
        
        Ok(rows.into_iter().map(|row| {
            let vote_str: Option<String> = row.get(2);
            let vote = vote_str.as_deref().and_then(|v| VoteChoice::from_str(v));
            
            ActionVoteRecord {
                voter_identifier: row.get(0),
                voter_type: row.get(1),
                vote,
                voting_power: row.get(3),
                tx_hash: row.get(4),
                cert_index: row.get::<Option<i32>, _>(5).map(|i| i as u32),
                block_time: row.get::<Option<i64>, _>(6).map(|t| t as u64),
            }
        }).collect())
    }

    pub async fn get_stake_pools_page(
        &self,
        _page: u32,
        _count: u32,
    ) -> Result<StakePoolPage, anyhow::Error> {
        // Placeholder - will implement with actual query
        Ok(StakePoolPage {
            pools: Vec::new(),
            has_more: false,
            total: None,
        })
    }

    pub async fn get_committee_members(&self) -> Result<Vec<CommitteeMemberInfo>, anyhow::Error> {
        // Placeholder - will implement with actual query
        // This queries committee/constitutional committee members
        Ok(Vec::new())
    }

    pub async fn get_epoch_start_time(&self, epoch: u32) -> Result<Option<u64>, anyhow::Error> {
        queries::get_epoch_start_time(self.pool(), epoch).await
    }
}

