use crate::models::{DRep, DRepAnchor, DRepExternalReference, DRepMetadata, DRepsPage, DRepsQuery};
use reqwest::{Client, Url};
use serde::Deserialize;
use serde_json::{Map as JsonMap, Value as JsonValue};
use std::time::Duration;

#[derive(Clone)]
pub struct GovToolsProvider {
    client: Client,
    base_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GovToolsResponse {
    #[serde(default)]
    page: Option<u32>,
    #[serde(default)]
    page_size: Option<u32>,
    #[serde(default)]
    total: Option<u64>,
    #[serde(default)]
    elements: Vec<GovToolsDrep>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GovToolsDrep {
    #[serde(default)]
    drep_id: Option<String>,
    #[serde(default)]
    view: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    metadata_hash: Option<String>,
    #[serde(default)]
    voting_power: Option<u64>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    latest_tx_hash: Option<String>,
    #[serde(default)]
    latest_registration_date: Option<String>,
    #[serde(default)]
    deposit: Option<i64>,
    #[serde(default)]
    metadata_error: Option<String>,
    #[serde(default)]
    payment_address: Option<String>,
    #[serde(default)]
    is_script_based: Option<bool>,
    #[serde(default)]
    given_name: Option<String>,
    #[serde(default)]
    objectives: Option<String>,
    #[serde(default)]
    motivations: Option<String>,
    #[serde(default)]
    qualifications: Option<String>,
    #[serde(default)]
    votes_last_year: Option<u64>,
    #[serde(default)]
    identity_references: Vec<GovToolsReference>,
    #[serde(default)]
    link_references: Vec<GovToolsReference>,
    #[serde(default)]
    image_url: Option<String>,
    #[serde(default)]
    image_hash: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GovToolsReference {
    #[serde(rename = "@type")]
    #[serde(default)]
    reference_type: Option<String>,
    #[serde(default)]
    label: Option<String>,
    #[serde(default)]
    uri: Option<String>,
}

#[derive(Debug, Clone)]
pub struct GovToolsEnrichment {
    pub given_name: Option<String>,
    pub objectives: Option<String>,
    pub motivations: Option<String>,
    pub qualifications: Option<String>,
    pub votes_last_year: Option<u32>,
    pub identity_references: Vec<DRepExternalReference>,
    pub link_references: Vec<DRepExternalReference>,
    pub image_url: Option<String>,
    pub image_hash: Option<String>,
    pub latest_registration_date: Option<String>,
    pub latest_tx_hash: Option<String>,
    pub deposit: Option<String>,
    pub metadata_error: Option<String>,
    pub payment_address: Option<String>,
    pub is_script_based: Option<bool>,
}

impl From<GovToolsDrep> for GovToolsEnrichment {
    fn from(drep: GovToolsDrep) -> Self {
        let identity_references = drep
            .identity_references
            .into_iter()
            .map(|reference| DRepExternalReference {
                reference_type: reference.reference_type,
                label: reference.label,
                uri: reference.uri,
            })
            .collect::<Vec<_>>();

        let link_references = drep
            .link_references
            .into_iter()
            .map(|reference| DRepExternalReference {
                reference_type: reference.reference_type,
                label: reference.label,
                uri: reference.uri,
            })
            .collect::<Vec<_>>();

        GovToolsEnrichment {
            given_name: drep.given_name,
            objectives: drep.objectives,
            motivations: drep.motivations,
            qualifications: drep.qualifications,
            votes_last_year: drep.votes_last_year.map(|v| v as u32),
            identity_references,
            link_references,
            image_url: drep.image_url,
            image_hash: drep.image_hash,
            latest_registration_date: drep.latest_registration_date,
            latest_tx_hash: drep.latest_tx_hash,
            deposit: drep.deposit.map(|v| v.to_string()),
            metadata_error: drep.metadata_error,
            payment_address: drep.payment_address,
            is_script_based: drep.is_script_based,
        }
    }
}

fn trimmed(value: &Option<String>) -> Option<String> {
    value
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn build_metadata(enrichment: &GovToolsEnrichment) -> Option<DRepMetadata> {
    let mut metadata = JsonMap::new();

    if let Some(name) = trimmed(&enrichment.given_name) {
        metadata.insert("name".to_string(), JsonValue::String(name));
    }

    if let Some(objectives) = trimmed(&enrichment.objectives) {
        metadata.insert("objectives".to_string(), JsonValue::String(objectives));
    }

    if let Some(motivations) = trimmed(&enrichment.motivations) {
        metadata.insert("motivations".to_string(), JsonValue::String(motivations));
    }

    if let Some(qualifications) = trimmed(&enrichment.qualifications) {
        metadata.insert("qualifications".to_string(), JsonValue::String(qualifications));
    }

    if let Some(image_url) = trimmed(&enrichment.image_url) {
        metadata.insert("image".to_string(), JsonValue::String(image_url));
    }

    if let Some(payment_address) = trimmed(&enrichment.payment_address) {
        metadata.insert("paymentAddress".to_string(), JsonValue::String(payment_address));
    }

    if metadata.is_empty() {
        None
    } else {
        Some(DRepMetadata {
            extra: JsonValue::Object(metadata),
        })
    }
}

fn apply_enrichment(target: &mut DRep, enrichment: &GovToolsEnrichment) {
    if target.metadata.is_none() {
        target.metadata = build_metadata(enrichment);
    }

    if target.given_name.is_none() {
        target.given_name = trimmed(&enrichment.given_name);
    }
    if target.objectives.is_none() {
        target.objectives = trimmed(&enrichment.objectives);
    }
    if target.motivations.is_none() {
        target.motivations = trimmed(&enrichment.motivations);
    }
    if target.qualifications.is_none() {
        target.qualifications = trimmed(&enrichment.qualifications);
    }
    if target.image_url.is_none() {
        target.image_url = trimmed(&enrichment.image_url);
    }
    if target.image_hash.is_none() {
        target.image_hash = trimmed(&enrichment.image_hash);
    }
    if target.latest_registration_date.is_none() {
        target.latest_registration_date = enrichment.latest_registration_date.clone();
    }
    if target.latest_tx_hash.is_none() {
        target.latest_tx_hash = enrichment.latest_tx_hash.clone();
    }
    if target.deposit.is_none() {
        target.deposit = enrichment.deposit.clone();
    }
    if target.metadata_error.is_none() {
        target.metadata_error = enrichment.metadata_error.clone();
    }
    if target.payment_address.is_none() {
        target.payment_address = enrichment.payment_address.clone();
    }
    if target.is_script_based.is_none() {
        target.is_script_based = enrichment.is_script_based;
    }
    if target.votes_last_year.is_none() {
        target.votes_last_year = enrichment.votes_last_year;
    }

    if !enrichment.identity_references.is_empty() {
        match &mut target.identity_references {
            Some(existing) => existing.extend(enrichment.identity_references.clone()),
            None => target.identity_references = Some(enrichment.identity_references.clone()),
        }
    }

    if !enrichment.link_references.is_empty() {
        match &mut target.link_references {
            Some(existing) => existing.extend(enrichment.link_references.clone()),
            None => target.link_references = Some(enrichment.link_references.clone()),
        }
    }

    if target.has_profile != Some(true) {
        let has_profile = target
            .metadata
            .as_ref()
            .map(|meta| !meta.extra.is_null())
            .unwrap_or(false)
            || target.given_name.is_some()
            || target.objectives.is_some()
            || target.motivations.is_some()
            || target.qualifications.is_some()
            || target.image_url.is_some()
            || target
                .identity_references
                .as_ref()
                .map(|refs| !refs.is_empty())
                .unwrap_or(false)
            || target
                .link_references
                .as_ref()
                .map(|refs| !refs.is_empty())
                .unwrap_or(false);

        if has_profile {
            target.has_profile = Some(true);
        }
    }
}

impl GovToolsProvider {
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .unwrap();

        Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    fn build_profile_url(&self, hex_id: &str) -> String {
        format!(
            "{}/drep/list?page=0&pageSize=1&search={}",
            self.base_url, hex_id
        )
    }

    fn build_list_url(&self, query: &DRepsQuery) -> Result<Url, anyhow::Error> {
        let mut url = Url::parse(&format!("{}/drep/list", self.base_url))?;
        {
            let mut pairs = url.query_pairs_mut();
            let page = query.normalized_page().saturating_sub(1);
            pairs.append_pair("page", &page.to_string());
            pairs.append_pair("pageSize", &query.count.to_string());

            if let Some(search) = &query.search {
                let trimmed = search.trim();
                if !trimmed.is_empty() {
                    pairs.append_pair("search", trimmed);
                }
            }

            for status in query.govtool_statuses() {
                pairs.append_pair("status[]", &status);
            }

            if let Some(sort) = query.govtool_sort() {
                pairs.append_pair("sort", &sort);
            }

            if let Some(direction) = query.govtool_direction() {
                pairs.append_pair("direction", &direction);
            }
        }
        Ok(url)
    }

    fn map_list_drep(drep: GovToolsDrep) -> Option<DRep> {
        let drep_id = drep
            .view
            .clone()
            .or_else(|| drep.drep_id.clone())
            .unwrap_or_default();

        if drep_id.is_empty() {
            return None;
        }

        let status_normalized = drep
            .status
            .as_ref()
            .map(|status| status.trim().to_ascii_lowercase());
        let active = status_normalized.as_ref().map(|status| status == "active");
        let retired = status_normalized.as_ref().map(|status| status == "retired");

        let voting_power = drep.voting_power.map(|value| value.to_string());

        let anchor = match (drep.url.clone(), drep.metadata_hash.clone()) {
            (Some(url), Some(data_hash)) if !url.is_empty() && !data_hash.is_empty() => {
                Some(DRepAnchor { url, data_hash })
            }
            _ => None,
        };

        let enrichment = GovToolsEnrichment::from(drep.clone());

        let mut result = DRep {
            drep_id,
            drep_hash: None,
            hex: drep.drep_id,
            view: drep.view,
            url: drep.url,
            metadata: None,
            anchor,
            voting_power: voting_power.clone(),
            voting_power_active: voting_power.clone(),
            amount: voting_power,
            status: status_normalized,
            active,
            active_epoch: None,
            last_active_epoch: None,
            has_script: drep.is_script_based,
            retired,
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
            is_script_based: None,
        };

        apply_enrichment(&mut result, &enrichment);

        Some(result)
    }

    pub async fn list_dreps(&self, query: &DRepsQuery) -> Result<DRepsPage, anyhow::Error> {
        let url = self.build_list_url(query)?;
        let response = self.client.get(url).send().await?;

        if response.status() == 404 {
            return Ok(DRepsPage {
                dreps: vec![],
                has_more: false,
                total: Some(0),
            });
        }

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            tracing::debug!(
                "GovTools list API error: {} {} for page {}",
                status,
                text,
                query.normalized_page()
            );
            return Err(anyhow::anyhow!(
                "GovTools list error: status {} body {}",
                status,
                text
            ));
        }

        let payload: GovToolsResponse = response.json().await?;
        let dreps = payload
            .elements
            .into_iter()
            .filter_map(Self::map_list_drep)
            .collect::<Vec<_>>();

        let has_more = if let (Some(page), Some(page_size), Some(total)) =
            (payload.page, payload.page_size, payload.total)
        {
            let next_start = (page + 1) as u64 * page_size as u64;
            next_start < total
        } else {
            dreps.len() as u32 == query.count
        };

        Ok(DRepsPage {
            dreps,
            has_more,
            total: payload.total,
        })
    }

    pub async fn get_drep_profile(
        &self,
        hex_id: &str,
    ) -> Result<Option<GovToolsEnrichment>, anyhow::Error> {
        let url = self.build_profile_url(hex_id);
        let response = self.client.get(&url).send().await?;

        if response.status() == 404 {
            return Ok(None);
        }

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            tracing::debug!("GovTools API error: {} {} for {}", status, text, url);
            return Ok(None);
        }

        let payload: GovToolsResponse = response.json().await?;
        let drep = match payload.elements.into_iter().next() {
            Some(d) => d,
            None => return Ok(None),
        };

        Ok(Some(GovToolsEnrichment::from(drep)))
    }
}
