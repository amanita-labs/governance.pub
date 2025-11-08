use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Hash, PartialEq, Eq, Serialize, Deserialize)]
pub enum CacheKey {
    DRepsPage { page: u32, count: u32 },
    DRep { id: String },
    DRepDelegators { id: String },
    DRepVotingHistory { id: String },
    DRepMetadata { id: String },
    DRepStats,
    ActionsPage { page: u32, count: u32 },
    Action { id: String },
    ActionVotes { id: String },
    StakeDelegation { stake_address: String },
}

impl CacheKey {
    pub fn to_string(&self) -> String {
        match self {
            CacheKey::DRepsPage { page, count } => {
                format!("dreps_page:page={}:count={}", page, count)
            }
            CacheKey::DRep { id } => format!("drep:{}", id),
            CacheKey::DRepDelegators { id } => format!("drep_delegators:{}", id),
            CacheKey::DRepVotingHistory { id } => format!("drep_votes:{}", id),
            CacheKey::DRepMetadata { id } => format!("drep_metadata:{}", id),
            CacheKey::DRepStats => "dreps_stats".to_string(),
            CacheKey::ActionsPage { page, count } => {
                format!("actions_page:page={}:count={}", page, count)
            }
            CacheKey::Action { id } => format!("action:{}", id),
            CacheKey::ActionVotes { id } => format!("action_votes:{}", id),
            CacheKey::StakeDelegation { stake_address } => format!("stake_delegation:{}", stake_address),
        }
    }

    pub fn ttl_seconds(&self) -> u64 {
        match self {
            // DRep/Action lists (page=1): 30 seconds
            CacheKey::DRepsPage { page, .. } | CacheKey::ActionsPage { page, .. } => {
                if *page == 1 {
                    30
                } else {
                    60
                }
            }
            // Single DRep/Action: 120 seconds
            CacheKey::DRep { .. } | CacheKey::Action { .. } => 120,
            // DRep stats: 60 seconds
            CacheKey::DRepStats => 60,
            // DRep delegators: 180 seconds
            CacheKey::DRepDelegators { .. } => 180,
            // DRep voting history: 300 seconds
            CacheKey::DRepVotingHistory { .. } => 300,
            // DRep metadata: 600 seconds
            CacheKey::DRepMetadata { .. } => 600,
            // Action votes: 180 seconds
            CacheKey::ActionVotes { .. } => 180,
            // Stake delegation: 60 seconds
            CacheKey::StakeDelegation { .. } => 60,
        }
    }
}
