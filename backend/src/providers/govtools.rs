use crate::models::DRepExternalReference;
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;

#[derive(Clone)]
pub struct GovToolsProvider {
    client: Client,
    base_url: String,
}

#[derive(Debug, Deserialize)]
struct GovToolsResponse {
    #[serde(default)]
    elements: Vec<GovToolsDrep>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GovToolsDrep {
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
    #[serde(default)]
    latest_registration_date: Option<String>,
    #[serde(default)]
    latest_tx_hash: Option<String>,
    #[serde(default)]
    deposit: Option<u64>,
    #[serde(default)]
    metadata_error: Option<String>,
    #[serde(default)]
    payment_address: Option<String>,
    #[serde(default)]
    is_script_based: Option<bool>,
}

#[derive(Debug, Deserialize)]
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

    fn build_url(&self, hex_id: &str) -> String {
        format!(
            "{}/drep/list?page=0&pageSize=1&search={}",
            self.base_url, hex_id
        )
    }

    pub async fn get_drep_profile(
        &self,
        hex_id: &str,
    ) -> Result<Option<GovToolsEnrichment>, anyhow::Error> {
        let url = self.build_url(hex_id);
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

        Ok(Some(GovToolsEnrichment {
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
        }))
    }
}
