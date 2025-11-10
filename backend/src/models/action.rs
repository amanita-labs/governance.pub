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
    pub proposed_epoch_start_time: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voting_epoch_start_time: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ratification_epoch_start_time: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enactment_epoch_start_time: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expiry_epoch_start_time: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expiration_epoch_start_time: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dropped_epoch_start_time: Option<u64>,
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
    pub metadata_checks: Option<MetadataCheckResult>,
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

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "snake_case")]
pub struct ActionVotingBreakdown {
    pub drep_votes: VoteCounts,
    pub spo_votes: VoteCounts,
    pub cc_votes: VoteCounts,
    pub total_voting_power: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<ProposalVotingSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vote_timeline: Option<Vec<VoteTimelinePoint>>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "snake_case")]
pub struct VoteCounts {
    pub yes: String,
    pub no: String,
    pub abstain: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub yes_votes_cast: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub no_votes_cast: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub abstain_votes_cast: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "snake_case")]
pub struct VoteTimelinePoint {
    pub timestamp: u64,
    pub yes_votes: u32,
    pub no_votes: u32,
    pub abstain_votes: u32,
    pub yes_power: String,
    pub no_power: String,
    pub abstain_power: String,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "snake_case")]
pub struct ProposalVotingSummary {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proposal_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub epoch_no: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drep_yes_votes_cast: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drep_active_yes_vote_power: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drep_yes_vote_power: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drep_yes_pct: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drep_no_votes_cast: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drep_active_no_vote_power: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drep_no_vote_power: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drep_no_pct: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drep_abstain_votes_cast: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drep_active_abstain_vote_power: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drep_always_no_confidence_vote_power: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub drep_always_abstain_vote_power: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_yes_votes_cast: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_active_yes_vote_power: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_yes_vote_power: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_yes_pct: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_no_votes_cast: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_active_no_vote_power: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_no_vote_power: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_no_pct: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_abstain_votes_cast: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_active_abstain_vote_power: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_passive_always_abstain_votes_assigned: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_passive_always_abstain_vote_power: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_passive_always_no_confidence_votes_assigned: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pool_passive_always_no_confidence_vote_power: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub committee_yes_votes_cast: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub committee_yes_pct: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub committee_no_votes_cast: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub committee_no_pct: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub committee_abstain_votes_cast: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct MetadataCheckResult {
    pub hash: CheckOutcome,
    pub ipfs: CheckOutcome,
    pub author_witness: CheckOutcome,
    pub on_chain: CheckOutcome,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolved_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub koios_meta_is_valid: Option<bool>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub notes: Vec<String>,
}

impl MetadataCheckResult {
    pub fn default_with_koios(meta_is_valid: Option<bool>) -> Self {
        Self {
            hash: CheckOutcome::unknown("Hash validation pending"),
            ipfs: CheckOutcome::unknown("Hosting validation pending"),
            author_witness: CheckOutcome::pending("Author witness verification pending"),
            on_chain: CheckOutcome::unknown("On-chain metadata extension validation pending"),
            resolved_url: None,
            koios_meta_is_valid: meta_is_valid,
            notes: Vec::new(),
        }
    }

    pub fn no_metadata(meta_is_valid: Option<bool>) -> Self {
        let mut result = Self::default_with_koios(meta_is_valid);
        result.hash = CheckOutcome::unknown("No metadata anchor provided");
        result.ipfs = CheckOutcome::unknown("No metadata anchor provided");
        result.on_chain = CheckOutcome::unknown("No metadata available for on-chain validation");
        result
            .notes
            .push("Governance action lacks metadata URL or hash".to_string());
        result
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CheckOutcome {
    pub status: CheckStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl CheckOutcome {
    pub fn pass(message: impl Into<String>) -> Self {
        Self {
            status: CheckStatus::Pass,
            message: Some(message.into()),
        }
    }

    pub fn fail(message: impl Into<String>) -> Self {
        Self {
            status: CheckStatus::Fail,
            message: Some(message.into()),
        }
    }

    pub fn warning(message: impl Into<String>) -> Self {
        Self {
            status: CheckStatus::Warning,
            message: Some(message.into()),
        }
    }

    pub fn pending(message: impl Into<String>) -> Self {
        Self {
            status: CheckStatus::Pending,
            message: Some(message.into()),
        }
    }

    pub fn unknown(message: impl Into<String>) -> Self {
        Self {
            status: CheckStatus::Unknown,
            message: Some(message.into()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckStatus {
    Pass,
    Fail,
    Warning,
    Pending,
    Unknown,
}
