use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DRep {
    pub drep_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drep_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hex: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub view: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<DRepMetadata>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anchor: Option<DRepAnchor>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voting_power: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voting_power_active: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>, // 'active' | 'inactive' | 'retired'
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_epoch: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_active_epoch: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_script: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retired: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expired: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registration_tx_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registration_epoch: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delegator_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vote_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_vote_epoch: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_profile: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DRepMetadata {
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DRepAnchor {
    pub url: String,
    pub data_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DRepDelegator {
    pub address: String,
    pub amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DRepVotingHistory {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tx_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cert_index: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proposal_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proposal_tx_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proposal_cert_index: Option<u32>,
    pub vote: String, // 'yes' | 'no' | 'abstain'
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voting_power: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub epoch: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DRepsPage {
    pub dreps: Vec<DRep>,
    pub has_more: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DRepStats {
    pub active_dreps_count: Option<u32>,
}

