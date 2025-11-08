use serde::{Deserialize, Serialize};

fn title_case(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + &chars.as_str().to_lowercase(),
        None => String::new(),
    }
}

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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub given_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub objectives: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub motivations: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub qualifications: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub votes_last_year: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity_references: Option<Vec<DRepExternalReference>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link_references: Option<Vec<DRepExternalReference>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latest_registration_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latest_tx_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deposit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_script_based: Option<bool>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DRepExternalReference {
    #[serde(rename = "@type")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reference_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uri: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DRepsQuery {
    pub page: u32,
    pub count: u32,
    pub statuses: Vec<String>,
    pub search: Option<String>,
    pub sort: Option<String>,
    pub direction: Option<String>,
    pub enrich: bool,
}

impl Default for DRepsQuery {
    fn default() -> Self {
        Self {
            page: 1,
            count: 20,
            statuses: Vec::new(),
            search: None,
            sort: None,
            direction: None,
            enrich: false,
        }
    }
}

impl DRepsQuery {
    pub fn with_defaults(mut self) -> Self {
        if self.page == 0 {
            self.page = 1;
        }
        if self.count == 0 {
            self.count = 20;
        }
        self
    }

    pub fn normalized_page(&self) -> u32 {
        if self.page == 0 {
            1
        } else {
            self.page
        }
    }

    pub fn normalized_statuses(&self) -> Vec<String> {
        let mut statuses = self
            .statuses
            .iter()
            .filter_map(|status| {
                let trimmed = status.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_ascii_lowercase())
                }
            })
            .collect::<Vec<_>>();

        statuses.sort();
        statuses.dedup();
        statuses
    }

    pub fn govtool_statuses(&self) -> Vec<String> {
        self.normalized_statuses()
            .into_iter()
            .map(|status| match status.as_str() {
                "active" => "Active".to_string(),
                "inactive" => "Inactive".to_string(),
                "retired" => "Retired".to_string(),
                "script" => "Script".to_string(),
                other => title_case(other),
            })
            .collect()
    }

    pub fn govtool_sort(&self) -> Option<String> {
        self.sort.as_ref().and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(title_case(trimmed))
            }
        })
    }

    pub fn govtool_direction(&self) -> Option<String> {
        self.direction.as_ref().and_then(|value| {
            let normalized = value.trim().to_ascii_lowercase();
            if normalized.is_empty() {
                None
            } else {
                let mapped = match normalized.as_str() {
                    "asc" | "ascending" => "Ascending".to_string(),
                    "desc" | "descending" => "Descending".to_string(),
                    _ => title_case(&normalized),
                };
                Some(mapped)
            }
        })
    }

    pub fn has_filters(&self) -> bool {
        !self.statuses.is_empty()
            || self
                .search
                .as_ref()
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false)
            || self
                .sort
                .as_ref()
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false)
            || self
                .direction
                .as_ref()
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false)
    }

    pub fn cache_descriptor(&self) -> Option<String> {
        let mut parts: Vec<String> = Vec::new();

        if let Some(search) = &self.search {
            let trimmed = search.trim();
            if !trimmed.is_empty() {
                parts.push(format!("search={}", trimmed.to_ascii_lowercase()));
            }
        }

        let statuses = self.normalized_statuses();
        if !statuses.is_empty() {
            parts.push(format!("status={}", statuses.join(",")));
        }

        if let Some(sort) = &self.sort {
            let trimmed = sort.trim();
            if !trimmed.is_empty() {
                parts.push(format!("sort={}", trimmed.to_ascii_lowercase()));
            }
        }

        if let Some(direction) = &self.direction {
            let trimmed = direction.trim();
            if !trimmed.is_empty() {
                parts.push(format!("direction={}", trimmed.to_ascii_lowercase()));
            }
        }

        if self.enrich {
            parts.push("enrich=true".to_string());
        }

        if parts.is_empty() {
            None
        } else {
            parts.sort();
            Some(parts.join("|"))
        }
    }
}
