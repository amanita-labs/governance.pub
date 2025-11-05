#[allow(dead_code)]
pub fn is_cip129_proposal_id(proposal_id: &str) -> bool {
    proposal_id.starts_with("gov_action1")
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct ProposalIdParse {
    pub format: ProposalIdFormat,
    pub tx_hash: Option<String>,
    pub cert_index: Option<u32>,
    pub proposal_id: Option<String>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum ProposalIdFormat {
    Cip129,
    Blockfrost,
    Unknown,
}

#[allow(dead_code)]
pub fn parse_proposal_id(proposal_id: &str) -> ProposalIdParse {
    if is_cip129_proposal_id(proposal_id) {
        return ProposalIdParse {
            format: ProposalIdFormat::Cip129,
            tx_hash: None,
            cert_index: None,
            proposal_id: Some(proposal_id.to_string()),
        };
    }
    
    // Check if it's Blockfrost format (tx_hash#cert_index)
    if let Some(hash_index) = proposal_id.split('#').collect::<Vec<_>>().get(0..2) {
        if hash_index.len() == 2 {
            if let (Some(hash), Ok(index)) = (hash_index[0].get(..64), hash_index[1].parse::<u32>()) {
                if hash.chars().all(|c| c.is_ascii_hexdigit()) {
                    return ProposalIdParse {
                        format: ProposalIdFormat::Blockfrost,
                        tx_hash: Some(hash.to_string()),
                        cert_index: Some(index),
                        proposal_id: None,
                    };
                }
            }
        }
    }
    
    // Check if it's just a tx_hash (64 hex characters)
    if proposal_id.len() == 64 && proposal_id.chars().all(|c| c.is_ascii_hexdigit()) {
        return ProposalIdParse {
            format: ProposalIdFormat::Blockfrost,
            tx_hash: Some(proposal_id.to_string()),
            cert_index: Some(0),
            proposal_id: None,
        };
    }
    
    ProposalIdParse {
        format: ProposalIdFormat::Unknown,
        tx_hash: None,
        cert_index: None,
        proposal_id: None,
    }
}

#[allow(dead_code)]
pub fn extract_tx_hash_and_index(proposal_id: &str) -> Option<(String, u32)> {
    let parsed = parse_proposal_id(proposal_id);
    match parsed.format {
        ProposalIdFormat::Blockfrost => {
            if let (Some(tx_hash), Some(cert_index)) = (parsed.tx_hash, parsed.cert_index) {
                Some((tx_hash, cert_index))
            } else {
                None
            }
        }
        _ => None,
    }
}

#[allow(dead_code)]
pub fn format_proposal_id(tx_hash: &str, cert_index: u32) -> String {
    format!("{}#{}", tx_hash, cert_index)
}

