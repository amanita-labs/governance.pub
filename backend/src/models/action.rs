use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct GovernanceAction {
    pub tx_hash: String,
    pub action_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proposal_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proposal_tx_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proposal_index: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cert_index: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deposit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reward_account: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub return_address: Option<String>,
    pub r#type: String, // 'parameter_change' | 'hard_fork_initiation' | etc.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>, // 'submitted' | 'voting' | 'ratified' | etc.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proposed_epoch: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voting_epoch: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ratification_epoch: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ratified_epoch: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enactment_epoch: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expiry_epoch: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expiration: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dropped_epoch: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta_json: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta_language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta_comment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta_is_valid: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub withdrawal: Option<Withdrawal>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub param_proposal: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_time: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct Withdrawal {
    pub amount: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ActionsPage {
    pub actions: Vec<GovernanceAction>,
    pub has_more: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ActionVotingBreakdown {
    pub drep_votes: VoteCounts,
    pub spo_votes: VoteCounts,
    pub cc_votes: VoteCounts,
    pub total_voting_power: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct VoteCounts {
    pub yes: String,
    pub no: String,
    pub abstain: String,
}
