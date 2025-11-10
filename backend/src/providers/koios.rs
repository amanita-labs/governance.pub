use crate::models::*;
use crate::providers::Provider;
use crate::utils::drep_id::normalize_to_cip129;
use async_trait::async_trait;
use reqwest::Client;
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
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
            proposed_epoch_start_time: None,
            voting_epoch_start_time: None,
            ratification_epoch_start_time: None,
            enactment_epoch_start_time: None,
            expiry_epoch_start_time: None,
            expiration_epoch_start_time: None,
            dropped_epoch_start_time: None,
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
            metadata_checks: None,
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
    async fn get_dreps_page(&self, query: &DRepsQuery) -> Result<DRepsPage, anyhow::Error> {
        // Koios doesn't support pagination directly, so we fetch all and paginate in memory
        let page = query.normalized_page();
        let count = query.count;
        let limit = page.saturating_mul(count).max(count);
        let endpoint = format!("/drep_list?limit={}", limit);
        let json = self.fetch(&endpoint, "GET", None).await?;
        let _total_returned = json
            .as_ref()
            .and_then(|value| value.as_array())
            .map(|arr| arr.len())
            .unwrap_or(0);

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
        let endpoint = format!("/proposal_list?limit={}", (page * count + 1));
        let json = self.fetch(&endpoint, "GET", None).await?;

        let mut all_actions = if let Some(Value::Array(arr)) = json {
            arr.iter()
                .filter_map(|proposal| self.map_governance_action(proposal).ok())
                .collect::<Vec<_>>()
        } else {
            vec![]
        };

        let has_more = all_actions.len() > (page * count) as usize;

        let start = ((page - 1) * count) as usize;
        let end = (start + count as usize).min(all_actions.len());
        let actions = if start < all_actions.len() {
            all_actions.drain(start..end).collect()
        } else {
            vec![]
        };

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
                let parse_u128 = |value: &Value| -> u128 {
                    value
                        .as_str()
                        .and_then(|s| s.parse::<u128>().ok())
                        .or_else(|| value.as_u64().map(|v| v as u128))
                        .unwrap_or(0)
                };

                let parse_u32 = |value: &Value| -> u32 {
                    value
                        .as_u64()
                        .or_else(|| value.as_str().and_then(|s| s.parse::<u64>().ok()))
                        .unwrap_or(0) as u32
                };

                let parse_f64 = |value: &Value| -> Option<f64> {
                    value
                        .as_f64()
                        .or_else(|| value.as_str().and_then(|s| s.parse::<f64>().ok()))
                };

                let to_string = |value: &Value| -> String {
                    value
                        .as_str()
                        .map(|s| s.to_string())
                        .or_else(|| value.as_u64().map(|v| v.to_string()))
                        .unwrap_or_else(|| "0".to_string())
                };

                let drep_yes_power = to_string(&summary["drep_yes_vote_power"]);
                let drep_no_power = to_string(&summary["drep_no_vote_power"]);
                let drep_abstain_active = parse_u128(&summary["drep_active_abstain_vote_power"]);
                let drep_abstain_always = parse_u128(&summary["drep_always_abstain_vote_power"]);
                let drep_abstain_power = (drep_abstain_active + drep_abstain_always).to_string();

                let pool_yes_power = to_string(&summary["pool_yes_vote_power"]);
                let pool_no_power = to_string(&summary["pool_no_vote_power"]);
                let pool_abstain_active = parse_u128(&summary["pool_active_abstain_vote_power"]);
                let pool_abstain_passive =
                    parse_u128(&summary["pool_passive_always_abstain_vote_power"]);
                let pool_abstain_power = (pool_abstain_active + pool_abstain_passive).to_string();

                let total_power = (drep_yes_power.parse::<u128>().unwrap_or(0)
                    + drep_no_power.parse::<u128>().unwrap_or(0)
                    + drep_abstain_power.parse::<u128>().unwrap_or(0)
                    + pool_yes_power.parse::<u128>().unwrap_or(0)
                    + pool_no_power.parse::<u128>().unwrap_or(0)
                    + pool_abstain_power.parse::<u128>().unwrap_or(0))
                .to_string();

                let drep_yes_votes = parse_u32(&summary["drep_yes_votes_cast"]);
                let drep_no_votes = parse_u32(&summary["drep_no_votes_cast"]);
                let drep_abstain_votes = parse_u32(&summary["drep_abstain_votes_cast"]);

                let pool_yes_votes = parse_u32(&summary["pool_yes_votes_cast"]);
                let pool_no_votes = parse_u32(&summary["pool_no_votes_cast"]);
                let pool_abstain_votes = parse_u32(&summary["pool_abstain_votes_cast"]);

                let committee_yes_votes = parse_u32(&summary["committee_yes_votes_cast"]);
                let committee_no_votes = parse_u32(&summary["committee_no_votes_cast"]);
                let committee_abstain_votes = parse_u32(&summary["committee_abstain_votes_cast"]);

                let summary_struct = ProposalVotingSummary {
                    proposal_type: summary["proposal_type"].as_str().map(|s| s.to_string()),
                    epoch_no: summary["epoch_no"].as_u64().map(|v| v as u32),
                    drep_yes_votes_cast: Some(drep_yes_votes),
                    drep_active_yes_vote_power: summary["drep_active_yes_vote_power"]
                        .as_str()
                        .map(|s| s.to_string()),
                    drep_yes_vote_power: Some(drep_yes_power.clone()),
                    drep_yes_pct: parse_f64(&summary["drep_yes_pct"]),
                    drep_no_votes_cast: Some(drep_no_votes),
                    drep_active_no_vote_power: summary["drep_active_no_vote_power"]
                        .as_str()
                        .map(|s| s.to_string()),
                    drep_no_vote_power: Some(drep_no_power.clone()),
                    drep_no_pct: parse_f64(&summary["drep_no_pct"]),
                    drep_abstain_votes_cast: Some(drep_abstain_votes),
                    drep_active_abstain_vote_power: summary["drep_active_abstain_vote_power"]
                        .as_str()
                        .map(|s| s.to_string()),
                    drep_always_no_confidence_vote_power: summary
                        ["drep_always_no_confidence_vote_power"]
                        .as_str()
                        .map(|s| s.to_string()),
                    drep_always_abstain_vote_power: summary["drep_always_abstain_vote_power"]
                        .as_str()
                        .map(|s| s.to_string()),
                    pool_yes_votes_cast: Some(pool_yes_votes),
                    pool_active_yes_vote_power: summary["pool_active_yes_vote_power"]
                        .as_str()
                        .map(|s| s.to_string()),
                    pool_yes_vote_power: Some(pool_yes_power.clone()),
                    pool_yes_pct: parse_f64(&summary["pool_yes_pct"]),
                    pool_no_votes_cast: Some(pool_no_votes),
                    pool_active_no_vote_power: summary["pool_active_no_vote_power"]
                        .as_str()
                        .map(|s| s.to_string()),
                    pool_no_vote_power: Some(pool_no_power.clone()),
                    pool_no_pct: parse_f64(&summary["pool_no_pct"]),
                    pool_abstain_votes_cast: Some(pool_abstain_votes),
                    pool_active_abstain_vote_power: summary["pool_active_abstain_vote_power"]
                        .as_str()
                        .map(|s| s.to_string()),
                    pool_passive_always_abstain_votes_assigned: summary
                        ["pool_passive_always_abstain_votes_assigned"]
                        .as_u64()
                        .map(|v| v as u32),
                    pool_passive_always_abstain_vote_power: summary
                        ["pool_passive_always_abstain_vote_power"]
                        .as_str()
                        .map(|s| s.to_string()),
                    pool_passive_always_no_confidence_votes_assigned: summary
                        ["pool_passive_always_no_confidence_votes_assigned"]
                        .as_u64()
                        .map(|v| v as u32),
                    pool_passive_always_no_confidence_vote_power: summary
                        ["pool_passive_always_no_confidence_vote_power"]
                        .as_str()
                        .map(|s| s.to_string()),
                    committee_yes_votes_cast: Some(committee_yes_votes),
                    committee_yes_pct: parse_f64(&summary["committee_yes_pct"]),
                    committee_no_votes_cast: Some(committee_no_votes),
                    committee_no_pct: parse_f64(&summary["committee_no_pct"]),
                    committee_abstain_votes_cast: Some(committee_abstain_votes),
                };

                let mut vote_timeline: Option<Vec<VoteTimelinePoint>> = None;
                if let Some(Value::Array(votes_arr)) = self
                    .fetch(&format!("/proposal_votes?_proposal_id={}", id), "GET", None)
                    .await?
                {
                    let mut grouped: BTreeMap<u64, (u32, u32, u32, u128, u128, u128)> =
                        BTreeMap::new();

                    for vote in votes_arr {
                        let raw_timestamp = vote["block_time"].as_u64().or_else(|| {
                            vote["block_time"]
                                .as_str()
                                .and_then(|s| s.parse::<u64>().ok())
                        });

                        let timestamp = match raw_timestamp {
                            Some(ts) if ts > 0 => ts,
                            _ => continue,
                        };

                        let power = vote["voting_power"]
                            .as_str()
                            .and_then(|s| s.parse::<u128>().ok())
                            .or_else(|| vote["voting_power"].as_u64().map(|v| v as u128))
                            .unwrap_or(0);

                        let vote_type = vote["vote"]
                            .as_str()
                            .unwrap_or_default()
                            .to_ascii_lowercase();

                        let entry = grouped
                            .entry(timestamp)
                            .or_insert((0u32, 0u32, 0u32, 0u128, 0u128, 0u128));

                        match vote_type.as_str() {
                            "yes" => {
                                entry.0 = entry.0.saturating_add(1);
                                entry.3 = entry.3.saturating_add(power);
                            }
                            "no" => {
                                entry.1 = entry.1.saturating_add(1);
                                entry.4 = entry.4.saturating_add(power);
                            }
                            _ => {
                                entry.2 = entry.2.saturating_add(1);
                                entry.5 = entry.5.saturating_add(power);
                            }
                        }
                    }

                    if !grouped.is_empty() {
                        let mut cumulative_counts = (0u32, 0u32, 0u32);
                        let mut cumulative_power = (0u128, 0u128, 0u128);
                        let mut timeline_points = Vec::with_capacity(grouped.len());

                        for (timestamp, (yes_c, no_c, abstain_c, yes_p, no_p, abstain_p)) in grouped
                        {
                            cumulative_counts.0 = cumulative_counts.0.saturating_add(yes_c);
                            cumulative_counts.1 = cumulative_counts.1.saturating_add(no_c);
                            cumulative_counts.2 = cumulative_counts.2.saturating_add(abstain_c);

                            cumulative_power.0 = cumulative_power.0.saturating_add(yes_p);
                            cumulative_power.1 = cumulative_power.1.saturating_add(no_p);
                            cumulative_power.2 = cumulative_power.2.saturating_add(abstain_p);

                            timeline_points.push(VoteTimelinePoint {
                                timestamp,
                                yes_votes: cumulative_counts.0,
                                no_votes: cumulative_counts.1,
                                abstain_votes: cumulative_counts.2,
                                yes_power: cumulative_power.0.to_string(),
                                no_power: cumulative_power.1.to_string(),
                                abstain_power: cumulative_power.2.to_string(),
                            });
                        }

                        if !timeline_points.is_empty() {
                            vote_timeline = Some(timeline_points);
                        }
                    }
                }

                return Ok(ActionVotingBreakdown {
                    drep_votes: VoteCounts {
                        yes: drep_yes_power,
                        no: drep_no_power,
                        abstain: drep_abstain_power,
                        yes_votes_cast: Some(drep_yes_votes),
                        no_votes_cast: Some(drep_no_votes),
                        abstain_votes_cast: Some(drep_abstain_votes),
                    },
                    spo_votes: VoteCounts {
                        yes: pool_yes_power,
                        no: pool_no_power,
                        abstain: pool_abstain_power,
                        yes_votes_cast: Some(pool_yes_votes),
                        no_votes_cast: Some(pool_no_votes),
                        abstain_votes_cast: Some(pool_abstain_votes),
                    },
                    cc_votes: VoteCounts {
                        yes: "0".to_string(),
                        no: "0".to_string(),
                        abstain: "0".to_string(),
                        yes_votes_cast: Some(committee_yes_votes),
                        no_votes_cast: Some(committee_no_votes),
                        abstain_votes_cast: Some(committee_abstain_votes),
                    },
                    total_voting_power: total_power,
                    summary: Some(summary_struct),
                    vote_timeline,
                });
            }
        }

        Ok(ActionVotingBreakdown {
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
                    delegated_pool: account["delegated_pool"].as_str().map(|s| s.to_string()),
                    delegated_drep: account["delegated_drep"].as_str().map(|s| s.to_string()),
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
