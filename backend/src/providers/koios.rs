use crate::models::*;
use crate::providers::Provider;
use crate::utils::drep_id::normalize_to_cip129;
use async_trait::async_trait;
use reqwest::Client;
use serde_json::Value;
use std::collections::HashMap;
use std::time::Duration;

pub struct KoiosProvider {
    client: Client,
    base_url: String,
}

impl KoiosProvider {
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap();
        Self { client, base_url }
    }

    async fn fetch(
        &self,
        endpoint: &str,
        method: &str,
        body: Option<Value>,
    ) -> Result<Option<Value>, anyhow::Error> {
        let url = format!("{}{}", self.base_url, endpoint);

        let mut request = match method {
            "POST" => self.client.post(&url),
            _ => self.client.get(&url),
        };

        request = request.header("Content-Type", "application/json");

        if let Some(body) = body {
            request = request.json(&body);
        }

        let response = request.send().await?;

        if !response.status().is_success() {
            if response.status() == 429 {
                tracing::warn!("Koios API rate limited (429): {}", endpoint);
                return Ok(None);
            } else if response.status() == 404 {
                return Ok(None);
            } else {
                let status = response.status();
                let error_text = response.text().await.unwrap_or_default();
                tracing::error!(
                    "Koios API error: {} {} for {}",
                    status,
                    error_text,
                    endpoint
                );
                return Ok(None);
            }
        }

        let json: Value = response.json().await?;
        Ok(Some(json))
    }

    fn map_drep(&self, drep: &Value) -> Result<DRep, anyhow::Error> {
        Ok(DRep {
            drep_id: drep["drep_id"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing drep_id"))?
                .to_string(),
            drep_hash: None,
            hex: drep["hex"].as_str().map(|s| s.to_string()),
            view: None,
            url: None,
            metadata: None,
            anchor: None,
            voting_power: None,
            voting_power_active: None,
            amount: None,
            status: if drep["registered"].as_bool().unwrap_or(false) {
                Some("active".to_string())
            } else {
                Some("inactive".to_string())
            },
            active: drep["registered"].as_bool(),
            active_epoch: None,
            last_active_epoch: None,
            has_script: drep["has_script"].as_bool(),
            retired: None,
            expired: None,
            registration_tx_hash: None,
            registration_epoch: None,
            delegator_count: None,
            vote_count: None,
            last_vote_epoch: None,
            has_profile: None,
            given_name: None,
            objectives: None,
            motivations: None,
            qualifications: None,
            votes_last_year: None,
            identity_references: None,
            link_references: None,
            image_url: None,
            image_hash: None,
            latest_registration_date: None,
            latest_tx_hash: None,
            deposit: None,
            metadata_error: None,
            payment_address: None,
            is_script_based: drep["has_script"].as_bool(),
        })
    }

    fn map_governance_action(&self, proposal: &Value) -> Result<GovernanceAction, anyhow::Error> {
        let proposal_type = proposal["proposal_type"]
            .as_str()
            .unwrap_or("InfoAction")
            .to_string();

        let type_map: HashMap<&str, &str> = [
            ("ParameterChange", "parameter_change"),
            ("HardForkInitiation", "hard_fork_initiation"),
            ("TreasuryWithdrawals", "treasury_withdrawals"),
            ("NoConfidence", "no_confidence"),
            ("NewCommittee", "new_committee"),
            ("UpdateCommittee", "update_committee"),
            ("NewConstitution", "new_constitution"),
            ("InfoAction", "info"),
        ]
        .iter()
        .cloned()
        .collect();

        let action_type = type_map
            .get(proposal_type.as_str())
            .unwrap_or(&"info")
            .to_string();

        let mut status = "submitted".to_string();
        if proposal["enacted_epoch"].as_u64().is_some() {
            status = "enacted".to_string();
        } else if proposal["ratified_epoch"].as_u64().is_some() {
            status = "ratified".to_string();
        } else if proposal["dropped_epoch"].as_u64().is_some()
            || proposal["expired_epoch"].as_u64().is_some()
        {
            status = "expired".to_string();
        } else if proposal["proposed_epoch"].as_u64().is_some() {
            status = "voting".to_string();
        }

        Ok(GovernanceAction {
            tx_hash: proposal["proposal_tx_hash"]
                .as_str()
                .unwrap_or_default()
                .to_string(),
            action_id: proposal["proposal_id"]
                .as_str()
                .unwrap_or_default()
                .to_string(),
            proposal_id: proposal["proposal_id"].as_str().map(|s| s.to_string()),
            proposal_tx_hash: proposal["proposal_tx_hash"].as_str().map(|s| s.to_string()),
            proposal_index: proposal["proposal_index"].as_u64().map(|v| v as u32),
            cert_index: proposal["proposal_index"].as_u64().map(|v| v as u32),
            deposit: proposal["deposit"].as_u64().map(|v| v.to_string()),
            reward_account: None,
            return_address: proposal["return_address"].as_str().map(|s| s.to_string()),
            r#type: action_type,
            description: proposal["proposal_description"]
                .as_str()
                .or_else(|| {
                    proposal["proposal_description"]
                        .as_object()
                        .and_then(|obj| obj.get("description").and_then(|v| v.as_str()))
                })
                .map(|s| s.to_string()),
            status: Some(status),
            proposed_epoch: proposal["proposed_epoch"].as_u64().map(|v| v as u32),
            voting_epoch: proposal["proposed_epoch"].as_u64().map(|v| v as u32),
            ratification_epoch: proposal["ratified_epoch"].as_u64().map(|v| v as u32),
            ratified_epoch: proposal["ratified_epoch"].as_u64().map(|v| v as u32),
            enactment_epoch: proposal["enacted_epoch"].as_u64().map(|v| v as u32),
            expiry_epoch: proposal["expired_epoch"]
                .as_u64()
                .or_else(|| proposal["expiration"].as_u64())
                .map(|v| v as u32),
            expiration: proposal["expiration"].as_u64().map(|v| v as u32),
            dropped_epoch: proposal["dropped_epoch"].as_u64().map(|v| v as u32),
            meta_url: proposal["meta_url"].as_str().map(|s| s.to_string()),
            meta_hash: proposal["meta_hash"].as_str().map(|s| s.to_string()),
            meta_json: (!proposal["meta_json"].is_null()).then(|| proposal["meta_json"].clone()),
            meta_language: proposal["meta_language"].as_str().map(|s| s.to_string()),
            meta_comment: proposal["meta_comment"].as_str().map(|s| s.to_string()),
            meta_is_valid: proposal["meta_is_valid"].as_bool(),
            withdrawal: proposal["withdrawal"].as_object().map(|w| Withdrawal {
                amount: w["amount"]
                    .as_str()
                    .map(|s| s.to_string())
                    .or_else(|| w["amount"].as_u64().map(|v| v.to_string()))
                    .unwrap_or_default(),
                address: w["address"].as_str().map(|s| s.to_string()),
            }),
            param_proposal: (!proposal["param_proposal"].is_null())
                .then(|| proposal["param_proposal"].clone()),
            block_time: proposal["block_time"].as_u64(),
            metadata: (!proposal["meta_json"].is_null()).then(|| proposal["meta_json"].clone()),
        })
    }
}

#[async_trait]
impl Provider for KoiosProvider {
    async fn get_dreps_page(&self, page: u32, count: u32) -> Result<DRepsPage, anyhow::Error> {
        // Koios doesn't support pagination directly, so we fetch all and paginate in memory
        let endpoint = format!("/drep_list?limit={}", (page * count));
        let json = self.fetch(&endpoint, "GET", None).await?;

        let mut all_dreps = if let Some(Value::Array(arr)) = json {
            arr.iter()
                .filter_map(|drep| self.map_drep(drep).ok())
                .collect::<Vec<_>>()
        } else {
            vec![]
        };

        let start = ((page - 1) * count) as usize;
        let end = (start + count as usize).min(all_dreps.len());
        let dreps = if start < all_dreps.len() {
            all_dreps.drain(start..end).collect()
        } else {
            vec![]
        };

        let has_more = end < all_dreps.len() + dreps.len();

        Ok(DRepsPage {
            dreps,
            has_more,
            total: None,
        })
    }

    async fn get_drep(&self, id: &str) -> Result<Option<DRep>, anyhow::Error> {
        // Koios doesn't have a single DRep endpoint, so we fetch the list and filter
        let cip129_id = normalize_to_cip129(id)?;
        let endpoint = "/drep_list";
        let json = self.fetch(&endpoint, "GET", None).await?;

        if let Some(Value::Array(arr)) = json {
            for drep in arr {
                if drep["drep_id"].as_str() == Some(&cip129_id) {
                    return Ok(Some(self.map_drep(&drep)?));
                }
            }
        }

        Ok(None)
    }

    async fn get_drep_delegators(&self, id: &str) -> Result<Vec<DRepDelegator>, anyhow::Error> {
        let cip129_id = normalize_to_cip129(id)?;

        let body = serde_json::json!([{
            "_drep_id": cip129_id
        }]);

        let json = self.fetch("/drep_delegators", "POST", Some(body)).await?;

        let delegators = if let Some(Value::Array(arr)) = json {
            arr.iter()
                .filter_map(|item| {
                    Some(DRepDelegator {
                        address: item["stake_address"].as_str()?.to_string(),
                        amount: item["amount"].as_str()?.to_string(),
                    })
                })
                .collect()
        } else {
            vec![]
        };

        Ok(delegators)
    }

    async fn get_drep_voting_history(
        &self,
        id: &str,
    ) -> Result<Vec<DRepVotingHistory>, anyhow::Error> {
        let cip129_id = normalize_to_cip129(id)?;

        let body = serde_json::json!([{
            "_drep_id": cip129_id
        }]);

        let json = self.fetch("/drep_votes", "POST", Some(body)).await?;

        let votes = if let Some(Value::Array(arr)) = json {
            arr.iter()
                .filter_map(|item| {
                    Some(DRepVotingHistory {
                        tx_hash: item["vote_tx_hash"].as_str().map(|s| s.to_string()),
                        cert_index: None,
                        proposal_id: item["proposal_id"].as_str().map(|s| s.to_string()),
                        action_id: item["proposal_id"].as_str().map(|s| s.to_string()),
                        proposal_tx_hash: item["proposal_tx_hash"].as_str().map(|s| s.to_string()),
                        proposal_cert_index: item["proposal_index"].as_u64().map(|v| v as u32),
                        vote: item["vote"].as_str().unwrap_or_default().to_lowercase(),
                        voting_power: None,
                        epoch: None,
                    })
                })
                .collect()
        } else {
            vec![]
        };

        Ok(votes)
    }

    async fn get_governance_actions_page(
        &self,
        page: u32,
        count: u32,
    ) -> Result<ActionsPage, anyhow::Error> {
        let endpoint = format!("/proposal_list?limit={}", (page * count));
        let json = self.fetch(&endpoint, "GET", None).await?;

        let mut all_actions = if let Some(Value::Array(arr)) = json {
            arr.iter()
                .filter_map(|proposal| self.map_governance_action(proposal).ok())
                .collect::<Vec<_>>()
        } else {
            vec![]
        };

        let start = ((page - 1) * count) as usize;
        let end = (start + count as usize).min(all_actions.len());
        let actions = if start < all_actions.len() {
            all_actions.drain(start..end).collect()
        } else {
            vec![]
        };

        let has_more = end < all_actions.len() + actions.len();

        Ok(ActionsPage {
            actions,
            has_more,
            total: None,
        })
    }

    async fn get_governance_action(
        &self,
        id: &str,
    ) -> Result<Option<GovernanceAction>, anyhow::Error> {
        // Try to find in proposal list
        let endpoint = "/proposal_list";
        let json = self.fetch(&endpoint, "GET", None).await?;

        if let Some(Value::Array(arr)) = json {
            for proposal in arr {
                if proposal["proposal_id"].as_str() == Some(id) {
                    return Ok(Some(self.map_governance_action(&proposal)?));
                }
            }
        }

        Ok(None)
    }

    async fn get_action_voting_results(
        &self,
        id: &str,
    ) -> Result<ActionVotingBreakdown, anyhow::Error> {
        let endpoint = format!("/proposal_voting_summary?_proposal_id={}", id);
        let json = self.fetch(&endpoint, "GET", None).await?;

        if let Some(Value::Array(arr)) = json {
            if let Some(summary) = arr.first() {
                let drep_yes = summary["drep_yes_vote_power"]
                    .as_str()
                    .unwrap_or("0")
                    .to_string();
                let drep_no = summary["drep_no_vote_power"]
                    .as_str()
                    .unwrap_or("0")
                    .to_string();
                let drep_abstain = (summary["drep_active_abstain_vote_power"]
                    .as_str()
                    .unwrap_or("0")
                    .parse::<u128>()
                    .unwrap_or(0)
                    + summary["drep_always_abstain_vote_power"]
                        .as_str()
                        .unwrap_or("0")
                        .parse::<u128>()
                        .unwrap_or(0))
                .to_string();

                let pool_yes = summary["pool_yes_vote_power"]
                    .as_str()
                    .unwrap_or("0")
                    .to_string();
                let pool_no = summary["pool_no_vote_power"]
                    .as_str()
                    .unwrap_or("0")
                    .to_string();
                let pool_abstain = (summary["pool_active_abstain_vote_power"]
                    .as_str()
                    .unwrap_or("0")
                    .parse::<u128>()
                    .unwrap_or(0)
                    + summary["pool_passive_always_abstain_vote_power"]
                        .as_str()
                        .unwrap_or("0")
                        .parse::<u128>()
                        .unwrap_or(0))
                .to_string();

                let total = (drep_yes.parse::<u128>().unwrap_or(0)
                    + drep_no.parse::<u128>().unwrap_or(0)
                    + drep_abstain.parse::<u128>().unwrap_or(0)
                    + pool_yes.parse::<u128>().unwrap_or(0)
                    + pool_no.parse::<u128>().unwrap_or(0)
                    + pool_abstain.parse::<u128>().unwrap_or(0))
                .to_string();

                return Ok(ActionVotingBreakdown {
                    drep_votes: VoteCounts {
                        yes: drep_yes,
                        no: drep_no,
                        abstain: drep_abstain,
                    },
                    spo_votes: VoteCounts {
                        yes: pool_yes,
                        no: pool_no,
                        abstain: pool_abstain,
                    },
                    cc_votes: VoteCounts {
                        yes: "0".to_string(),
                        no: "0".to_string(),
                        abstain: "0".to_string(),
                    },
                    total_voting_power: total,
                });
            }
        }

        Ok(ActionVotingBreakdown {
            drep_votes: VoteCounts {
                yes: "0".to_string(),
                no: "0".to_string(),
                abstain: "0".to_string(),
            },
            spo_votes: VoteCounts {
                yes: "0".to_string(),
                no: "0".to_string(),
                abstain: "0".to_string(),
            },
            cc_votes: VoteCounts {
                yes: "0".to_string(),
                no: "0".to_string(),
                abstain: "0".to_string(),
            },
            total_voting_power: "0".to_string(),
        })
    }

    async fn get_drep_metadata(&self, _id: &str) -> Result<Option<Value>, anyhow::Error> {
        // Koios doesn't have a metadata endpoint for DReps
        Ok(None)
    }

    async fn get_total_active_dreps(&self) -> Result<Option<u32>, anyhow::Error> {
        let endpoint = "/drep_epoch_summary";
        let json = self.fetch(&endpoint, "GET", None).await?;

        if let Some(Value::Array(arr)) = json {
            if let Some(summary) = arr.first() {
                if let Some(dreps) = summary["dreps"].as_u64() {
                    return Ok(Some(dreps as u32));
                }
            }
        }

        Ok(None)
    }

    async fn get_stake_delegation(
        &self,
        stake_address: &str,
    ) -> Result<Option<StakeDelegation>, anyhow::Error> {
        let body = serde_json::json!({
            "_stake_addresses": [stake_address]
        });

        let json = self.fetch("/account_info", "POST", Some(body)).await?;

        if let Some(Value::Array(arr)) = json {
            if let Some(account) = arr.first() {
                return Ok(Some(StakeDelegation {
                    stake_address: stake_address.to_string(),
                    delegated_pool: account["delegated_pool"]
                        .as_str()
                        .map(|s| s.to_string()),
                    delegated_drep: account["delegated_drep"]
                        .as_str()
                        .map(|s| s.to_string()),
                    total_balance: account["total_balance"]
                        .as_str()
                        .map(|s| s.to_string())
                        .or_else(|| account["total_balance"].as_u64().map(|v| v.to_string())),
                    utxo_balance: account["utxo"]
                        .as_str()
                        .map(|s| s.to_string())
                        .or_else(|| account["utxo"].as_u64().map(|v| v.to_string())),
                    rewards_available: account["rewards_available"]
                        .as_str()
                        .map(|s| s.to_string())
                        .or_else(|| account["rewards_available"].as_u64().map(|v| v.to_string())),
                }));
            }
        }

        Ok(None)
    }

    async fn health_check(&self) -> Result<bool, anyhow::Error> {
        let endpoint = "/tip";
        let json = self.fetch(&endpoint, "GET", None).await?;
        Ok(json.is_some())
    }
}
