use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Hash, PartialEq, Eq, Serialize, Deserialize)]
pub enum CacheKey {
    DRepsPage {
        page: u32,
        count: u32,
        #[serde(skip_serializing_if = "Option::is_none")]
        filters: Option<String>,
    },
    DRep {
        id: String,
    },
    DRepDelegators {
        id: String,
    },
    DRepVotingHistory {
        id: String,
    },
    DRepMetadata {
        id: String,
    },
    DRepStats,
    ActionsPage {
        page: u32,
        count: u32,
    },
    Action {
        id: String,
    },
    ActionVotes {
        id: String,
    },
    ActionMetadataValidation {
        action_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        meta_hash: Option<String>,
        verifier_enabled: bool,
        version: u8,
    },
    StakeDelegation {
        stake_address: String,
    },
    EpochStartTime {
        epoch: u32,
    },
}

impl CacheKey {
    pub fn to_string(&self) -> String {
        match self {
            CacheKey::DRepsPage {
                page,
                count,
                filters,
            } => {
                let mut base = format!("dreps_page:page={}:count={}", page, count);
                if let Some(filters) = filters {
                    base.push_str(&format!(":filters={}", filters));
                }
                base
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
            CacheKey::ActionMetadataValidation {
                action_id,
                meta_hash,
                verifier_enabled,
                version,
            } => match meta_hash {
                Some(hash) => format!(
                    "action_metadata:{action_id}:hash={}:verifier={}:v={}",
                    hash.to_lowercase(),
                    verifier_enabled,
                    version
                ),
                None => format!(
                    "action_metadata:{action_id}:nohash:verifier={}:v={}",
                    verifier_enabled, version
                ),
            },
            CacheKey::StakeDelegation { stake_address } => {
                format!("stake_delegation:{}", stake_address)
            }
            CacheKey::EpochStartTime { epoch } => format!("epoch_start_time:{}", epoch),
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
            // Metadata validation: 600 seconds
            CacheKey::ActionMetadataValidation { .. } => 600,
            // Action votes: 180 seconds
            CacheKey::ActionVotes { .. } => 180,
            // Stake delegation: 60 seconds
            CacheKey::StakeDelegation { .. } => 60,
            // Epoch start times: 1 hour
            CacheKey::EpochStartTime { .. } => 3600,
        }
    }
}
