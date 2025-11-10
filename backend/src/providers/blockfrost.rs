use crate::models::*;
use crate::providers::Provider;
use crate::utils::drep_id::convert_to_cip105;
use async_trait::async_trait;
use reqwest::Client;
use serde_json::Value;

pub struct BlockfrostProvider {
    client: Client,
    base_url: String,
    api_key: String,
}

impl BlockfrostProvider {
    pub fn new(base_url: String, api_key: String) -> Self {
        let client = Client::new();
        Self {
            client,
            base_url,
            api_key,
        }
    }

    async fn fetch(&self, path: &str) -> Result<Option<Value>, anyhow::Error> {
        let url = format!("{}{}", self.base_url, path);
        let response = self
            .client
            .get(&url)
            .header("project_id", &self.api_key)
            .send()
            .await?;

        if response.status() == 404 {
            return Ok(None);
        }

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();

            if status == 400 {
                if error_text.contains("Invalid path") || error_text.contains("not found") {
                    tracing::warn!("Blockfrost endpoint not available: {}", path);
                    return Ok(None);
                }
            }

            return Err(anyhow::anyhow!(
                "Blockfrost API error: {} {}",
                status,
                error_text
            ));
        }

        let json: Value = response.json().await?;
        Ok(Some(json))
    }

    fn map_drep(&self, drep: &Value) -> Result<DRep, anyhow::Error> {
        let mut result = DRep {
            drep_id: drep["drep_id"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing drep_id"))?
                .to_string(),
            drep_hash: drep["drep_hash"].as_str().map(|s| s.to_string()),
            hex: drep["hex"].as_str().map(|s| s.to_string()),
            view: drep["view"].as_str().map(|s| s.to_string()),
            url: drep["url"].as_str().map(|s| s.to_string()),
            metadata: drep["metadata"].as_object().map(|_| DRepMetadata {
                extra: drep["metadata"].clone(),
            }),
            anchor: drep["anchor"].as_object().map(|anchor| DRepAnchor {
                url: anchor["url"].as_str().unwrap_or_default().to_string(),
                data_hash: anchor["data_hash"].as_str().unwrap_or_default().to_string(),
            }),
            voting_power: drep["voting_power"]
                .as_str()
                .map(|s| s.to_string())
                .or_else(|| drep["voting_power"].as_u64().map(|v| v.to_string())),
            voting_power_active: drep["voting_power_active"]
                .as_str()
                .map(|s| s.to_string())
                .or_else(|| drep["voting_power_active"].as_u64().map(|v| v.to_string()))
                .or_else(|| drep["amount"].as_str().map(|s| s.to_string()))
                .or_else(|| drep["amount"].as_u64().map(|v| v.to_string())),
            amount: drep["amount"]
                .as_str()
                .map(|s| s.to_string())
                .or_else(|| drep["amount"].as_u64().map(|v| v.to_string())),
            status: drep["status"].as_str().map(|s| s.to_string()),
            active: drep["active"].as_bool(),
            active_epoch: drep["active_epoch"].as_u64().map(|v| v as u32),
            last_active_epoch: drep["last_active_epoch"].as_u64().map(|v| v as u32),
            has_script: drep["has_script"].as_bool(),
            retired: drep["retired"].as_bool(),
            expired: drep["expired"].as_bool(),
            registration_tx_hash: drep["registration_tx_hash"].as_str().map(|s| s.to_string()),
            registration_epoch: drep["registration_epoch"].as_u64().map(|v| v as u32),
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
            latest_tx_hash: drep["tx_hash"].as_str().map(|s| s.to_string()),
            deposit: drep["deposit"]
                .as_str()
                .map(|s| s.to_string())
                .or_else(|| drep["deposit"].as_u64().map(|v| v.to_string())),
            metadata_error: drep["metadata_error"].as_str().map(|s| s.to_string()),
            payment_address: None,
            is_script_based: drep["has_script"].as_bool(),
        };

        // Determine status
        if result.retired == Some(true) {
            result.status = Some("retired".to_string());
        } else if result.active == Some(false) {
            result.status = Some("inactive".to_string());
        } else if result.status.is_none() {
            result.status = Some("active".to_string());
        }

        Ok(result)
    }

    fn map_governance_action(&self, action: &Value) -> Result<GovernanceAction, anyhow::Error> {
        Ok(GovernanceAction {
            tx_hash: action["tx_hash"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing tx_hash"))?
                .to_string(),
            action_id: action["action_id"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing action_id"))?
                .to_string(),
            proposal_id: action["proposal_id"].as_str().map(|s| s.to_string()),
            proposal_tx_hash: action["proposal_tx_hash"].as_str().map(|s| s.to_string()),
            proposal_index: action["proposal_index"].as_u64().map(|v| v as u32),
            cert_index: action["cert_index"].as_u64().map(|v| v as u32),
            deposit: action["deposit"]
                .as_str()
                .map(|s| s.to_string())
                .or_else(|| action["deposit"].as_u64().map(|v| v.to_string())),
            reward_account: action["reward_account"].as_str().map(|s| s.to_string()),
            return_address: action["return_address"].as_str().map(|s| s.to_string()),
            r#type: action["type"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing type"))?
                .to_string(),
            description: action["description"].as_str().map(|s| s.to_string()),
            status: action["status"].as_str().map(|s| s.to_string()),
            proposed_epoch: action["proposed_epoch"].as_u64().map(|v| v as u32),
            voting_epoch: action["voting_epoch"].as_u64().map(|v| v as u32),
            ratification_epoch: action["ratification_epoch"].as_u64().map(|v| v as u32),
            ratified_epoch: action["ratified_epoch"].as_u64().map(|v| v as u32),
            enactment_epoch: action["enactment_epoch"].as_u64().map(|v| v as u32),
            expiry_epoch: action["expiry_epoch"].as_u64().map(|v| v as u32),
            expiration: action["expiration"].as_u64().map(|v| v as u32),
            dropped_epoch: action["dropped_epoch"].as_u64().map(|v| v as u32),
            proposed_epoch_start_time: None,
            voting_epoch_start_time: None,
            ratification_epoch_start_time: None,
            enactment_epoch_start_time: None,
            expiry_epoch_start_time: None,
            expiration_epoch_start_time: None,
            dropped_epoch_start_time: None,
            meta_url: action["meta_url"].as_str().map(|s| s.to_string()),
            meta_hash: action["meta_hash"].as_str().map(|s| s.to_string()),
            meta_json: (!action["meta_json"].is_null()).then(|| action["meta_json"].clone()),
            meta_language: action["meta_language"].as_str().map(|s| s.to_string()),
            meta_comment: action["meta_comment"].as_str().map(|s| s.to_string()),
            meta_is_valid: action["meta_is_valid"].as_bool(),
            metadata_checks: None,
            withdrawal: action["withdrawal"].as_object().map(|w| Withdrawal {
                amount: w["amount"]
                    .as_str()
                    .map(|s| s.to_string())
                    .or_else(|| w["amount"].as_u64().map(|v| v.to_string()))
                    .unwrap_or_default(),
                address: w["address"].as_str().map(|s| s.to_string()),
            }),
            param_proposal: (!action["param_proposal"].is_null())
                .then(|| action["param_proposal"].clone()),
            block_time: None,
            metadata: (!action["metadata"].is_null()).then(|| action["metadata"].clone()),
        })
    }

    pub async fn get_epoch_start_time(&self, epoch: u32) -> Result<Option<u64>, anyhow::Error> {
        let path = format!("/epochs/{}", epoch);
        let json = self.fetch(&path).await?;

        if let Some(Value::Object(obj)) = json {
            if let Some(start_time_value) = obj.get("start_time") {
                if let Some(ts) = start_time_value.as_u64() {
                    return Ok(Some(ts));
                }
                if let Some(ts_str) = start_time_value.as_str() {
                    if let Ok(parsed) = ts_str.parse::<u64>() {
                        return Ok(Some(parsed));
                    }
                }
            }
        }

        Ok(None)
    }
}

#[async_trait]
impl Provider for BlockfrostProvider {
    async fn get_dreps_page(&self, query: &DRepsQuery) -> Result<DRepsPage, anyhow::Error> {
        let page = query.normalized_page();
        let count = query.count;
        let path = format!("/governance/dreps?page={}&count={}", page, count);
        let json = self.fetch(&path).await?;

        let dreps = if let Some(Value::Array(arr)) = json {
            arr.iter()
                .filter_map(|drep| self.map_drep(drep).ok())
                .collect()
        } else {
            vec![]
        };

        let has_more = dreps.len() == count as usize;

        Ok(DRepsPage {
            dreps,
            has_more,
            total: None,
        })
    }

    async fn get_drep(&self, id: &str) -> Result<Option<DRep>, anyhow::Error> {
        let cip105_id = convert_to_cip105(id)?;
        let path = format!("/governance/dreps/{}", cip105_id);
        let json = self.fetch(&path).await?;

        if let Some(drep_json) = json {
            Ok(Some(self.map_drep(&drep_json)?))
        } else {
            Ok(None)
        }
    }

    async fn get_drep_delegators(&self, id: &str) -> Result<Vec<DRepDelegator>, anyhow::Error> {
        let cip105_id = convert_to_cip105(id)?;
        let mut all_delegators = Vec::new();
        let mut page = 1;

        loop {
            let path = format!(
                "/governance/dreps/{}/delegators?page={}&count=100",
                cip105_id, page
            );
            let json = self.fetch(&path).await?;

            if let Some(Value::Array(arr)) = json {
                let arr_len = arr.len();
                if arr_len == 0 {
                    break;
                }

                for item in arr {
                    all_delegators.push(DRepDelegator {
                        address: item["address"].as_str().unwrap_or_default().to_string(),
                        amount: item["amount"]
                            .as_str()
                            .map(|s| s.to_string())
                            .or_else(|| item["amount"].as_u64().map(|v| v.to_string()))
                            .unwrap_or_default(),
                    });
                }

                if arr_len < 100 {
                    break;
                }
                page += 1;
            } else {
                break;
            }
        }

        Ok(all_delegators)
    }

    async fn get_drep_voting_history(
        &self,
        id: &str,
    ) -> Result<Vec<DRepVotingHistory>, anyhow::Error> {
        let cip105_id = convert_to_cip105(id)?;
        let mut all_votes = Vec::new();
        let mut page = 1;

        loop {
            let path = format!(
                "/governance/dreps/{}/votes?page={}&count=100",
                cip105_id, page
            );
            let json = self.fetch(&path).await?;

            if let Some(Value::Array(arr)) = json {
                let arr_len = arr.len();
                if arr_len == 0 {
                    break;
                }

                for item in arr {
                    all_votes.push(DRepVotingHistory {
                        tx_hash: item["tx_hash"].as_str().map(|s| s.to_string()),
                        cert_index: item["cert_index"].as_u64().map(|v| v as u32),
                        proposal_id: item["proposal_id"].as_str().map(|s| s.to_string()),
                        action_id: item["proposal_id"].as_str().map(|s| s.to_string()),
                        proposal_tx_hash: item["proposal_tx_hash"].as_str().map(|s| s.to_string()),
                        proposal_cert_index: item["proposal_cert_index"].as_u64().map(|v| v as u32),
                        vote: item["vote"]
                            .as_str()
                            .unwrap_or_default()
                            .to_string()
                            .to_lowercase(),
                        voting_power: item["voting_power"]
                            .as_str()
                            .map(|s| s.to_string())
                            .or_else(|| item["voting_power"].as_u64().map(|v| v.to_string())),
                        epoch: item["epoch"].as_u64().map(|v| v as u32),
                    });
                }

                if arr_len < 100 {
                    break;
                }
                page += 1;
            } else {
                break;
            }
        }

        Ok(all_votes)
    }

    async fn get_governance_actions_page(
        &self,
        page: u32,
        count: u32,
    ) -> Result<ActionsPage, anyhow::Error> {
        let path = format!("/governance/actions?page={}&count={}", page, count);
        let json = self.fetch(&path).await?;

        let actions = if let Some(Value::Array(arr)) = json {
            arr.iter()
                .filter_map(|action| self.map_governance_action(action).ok())
                .collect()
        } else {
            vec![]
        };

        let has_more = actions.len() == count as usize;

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
        let path = format!("/governance/actions/{}", id);
        let json = self.fetch(&path).await?;

        if let Some(action_json) = json {
            Ok(Some(self.map_governance_action(&action_json)?))
        } else {
            Ok(None)
        }
    }

    async fn get_action_voting_results(
        &self,
        id: &str,
    ) -> Result<ActionVotingBreakdown, anyhow::Error> {
        let mut all_votes = Vec::new();
        let mut page = 1;

        loop {
            let path = format!("/governance/actions/{}/votes?page={}&count=100", id, page);
            let json = self.fetch(&path).await?;

            if let Some(Value::Array(arr)) = json {
                let arr_len = arr.len();
                if arr_len == 0 {
                    break;
                }

                for item in arr {
                    all_votes.push((
                        item["voter_type"].as_str().unwrap_or_default().to_string(),
                        item["vote"]
                            .as_str()
                            .unwrap_or_default()
                            .to_string()
                            .to_lowercase(),
                        item["voting_power"]
                            .as_str()
                            .map(|s| s.to_string())
                            .or_else(|| item["voting_power"].as_u64().map(|v| v.to_string()))
                            .unwrap_or_default(),
                    ));
                }

                if arr_len < 100 {
                    break;
                }
                page += 1;
            } else {
                break;
            }
        }

        let mut breakdown = ActionVotingBreakdown {
            drep_votes: VoteCounts {
                yes: "0".to_string(),
                no: "0".to_string(),
                abstain: "0".to_string(),
                yes_votes_cast: Some(0),
                no_votes_cast: Some(0),
                abstain_votes_cast: Some(0),
            },
            spo_votes: VoteCounts {
                yes: "0".to_string(),
                no: "0".to_string(),
                abstain: "0".to_string(),
                yes_votes_cast: Some(0),
                no_votes_cast: Some(0),
                abstain_votes_cast: Some(0),
            },
            cc_votes: VoteCounts {
                yes: "0".to_string(),
                no: "0".to_string(),
                abstain: "0".to_string(),
                yes_votes_cast: Some(0),
                no_votes_cast: Some(0),
                abstain_votes_cast: Some(0),
            },
            total_voting_power: "0".to_string(),
            summary: None,
            vote_timeline: None,
        };

        let mut total_power = 0u128;
        let mut drep_vote_counts = (0u32, 0u32, 0u32);
        let mut spo_vote_counts = (0u32, 0u32, 0u32);
        let mut cc_vote_counts = (0u32, 0u32, 0u32);

        for (voter_type, vote, power_str) in all_votes {
            let power: u128 = power_str.parse().unwrap_or(0);
            total_power += power;

            let vote_type = match vote.as_str() {
                "yes" => "yes",
                "no" => "no",
                _ => "abstain",
            };

            match voter_type.as_str() {
                "drep" => match vote_type {
                    "yes" => {
                        let current: u128 = breakdown.drep_votes.yes.parse().unwrap_or(0);
                        breakdown.drep_votes.yes = (current + power).to_string();
                        drep_vote_counts.0 = drep_vote_counts.0.saturating_add(1);
                    }
                    "no" => {
                        let current: u128 = breakdown.drep_votes.no.parse().unwrap_or(0);
                        breakdown.drep_votes.no = (current + power).to_string();
                        drep_vote_counts.1 = drep_vote_counts.1.saturating_add(1);
                    }
                    _ => {
                        let current: u128 = breakdown.drep_votes.abstain.parse().unwrap_or(0);
                        breakdown.drep_votes.abstain = (current + power).to_string();
                        drep_vote_counts.2 = drep_vote_counts.2.saturating_add(1);
                    }
                },
                "spo" => match vote_type {
                    "yes" => {
                        let current: u128 = breakdown.spo_votes.yes.parse().unwrap_or(0);
                        breakdown.spo_votes.yes = (current + power).to_string();
                        spo_vote_counts.0 = spo_vote_counts.0.saturating_add(1);
                    }
                    "no" => {
                        let current: u128 = breakdown.spo_votes.no.parse().unwrap_or(0);
                        breakdown.spo_votes.no = (current + power).to_string();
                        spo_vote_counts.1 = spo_vote_counts.1.saturating_add(1);
                    }
                    _ => {
                        let current: u128 = breakdown.spo_votes.abstain.parse().unwrap_or(0);
                        breakdown.spo_votes.abstain = (current + power).to_string();
                        spo_vote_counts.2 = spo_vote_counts.2.saturating_add(1);
                    }
                },
                "cc" => match vote_type {
                    "yes" => {
                        let current: u128 = breakdown.cc_votes.yes.parse().unwrap_or(0);
                        breakdown.cc_votes.yes = (current + power).to_string();
                        cc_vote_counts.0 = cc_vote_counts.0.saturating_add(1);
                    }
                    "no" => {
                        let current: u128 = breakdown.cc_votes.no.parse().unwrap_or(0);
                        breakdown.cc_votes.no = (current + power).to_string();
                        cc_vote_counts.1 = cc_vote_counts.1.saturating_add(1);
                    }
                    _ => {
                        let current: u128 = breakdown.cc_votes.abstain.parse().unwrap_or(0);
                        breakdown.cc_votes.abstain = (current + power).to_string();
                        cc_vote_counts.2 = cc_vote_counts.2.saturating_add(1);
                    }
                },
                _ => {}
            }
        }

        breakdown.total_voting_power = total_power.to_string();
        breakdown.drep_votes.yes_votes_cast = Some(drep_vote_counts.0);
        breakdown.drep_votes.no_votes_cast = Some(drep_vote_counts.1);
        breakdown.drep_votes.abstain_votes_cast = Some(drep_vote_counts.2);
        breakdown.spo_votes.yes_votes_cast = Some(spo_vote_counts.0);
        breakdown.spo_votes.no_votes_cast = Some(spo_vote_counts.1);
        breakdown.spo_votes.abstain_votes_cast = Some(spo_vote_counts.2);
        breakdown.cc_votes.yes_votes_cast = Some(cc_vote_counts.0);
        breakdown.cc_votes.no_votes_cast = Some(cc_vote_counts.1);
        breakdown.cc_votes.abstain_votes_cast = Some(cc_vote_counts.2);

        Ok(breakdown)
    }

    async fn get_drep_metadata(&self, id: &str) -> Result<Option<Value>, anyhow::Error> {
        let cip105_id = convert_to_cip105(id)?;
        let path = format!("/governance/dreps/{}/metadata", cip105_id);
        let json = self.fetch(&path).await?;
        Ok(json)
    }

    async fn get_total_active_dreps(&self) -> Result<Option<u32>, anyhow::Error> {
        // Blockfrost doesn't have a direct endpoint for this
        // We'd need to count all DReps, which is expensive
        Ok(None)
    }

    async fn get_stake_delegation(
        &self,
        stake_address: &str,
    ) -> Result<Option<StakeDelegation>, anyhow::Error> {
        let path = format!("/accounts/{}", stake_address);
        let json = self.fetch(&path).await?;

        if let Some(account) = json {
            return Ok(Some(StakeDelegation {
                stake_address: stake_address.to_string(),
                delegated_pool: account["pool_id"].as_str().map(|s| s.to_string()),
                delegated_drep: account["drep_id"].as_str().map(|s| s.to_string()),
                total_balance: account["controlled_amount"].as_str().map(|s| s.to_string()),
                utxo_balance: account["withdrawable_amount"]
                    .as_str()
                    .map(|s| s.to_string()),
                rewards_available: account["withdrawable_amount"]
                    .as_str()
                    .map(|s| s.to_string()),
            }));
        }

        Ok(None)
    }

    async fn health_check(&self) -> Result<bool, anyhow::Error> {
        let path = "/health";
        let response = self
            .client
            .get(&format!("{}{}", self.base_url, path))
            .header("project_id", &self.api_key)
            .send()
            .await?;

        Ok(response.status().is_success())
    }
}
