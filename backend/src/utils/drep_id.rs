use crate::utils::bech32::{decode_bech32, encode_bech32};

const SPECIAL_SYSTEM_DREPS: &[&str] = &[
    "drep_always_abstain",
    "drep_always_no_confidence",
    "drep_always_yes",
    "drep_always_no",
];

pub fn is_special_system_drep(drep_id: &str) -> bool {
    SPECIAL_SYSTEM_DREPS.contains(&drep_id)
}

pub fn is_valid_drep_id(bech_id: &str) -> bool {
    if is_special_system_drep(bech_id) {
        return true;
    }

    // DRep ID pattern: drep1... (51-53 chars) or drep_script1... (51 chars)
    bech_id.starts_with("drep1") || bech_id.starts_with("drep_script1")
}

pub fn decode_drep_id_to_hex(bech_id: &str) -> Result<String, anyhow::Error> {
    let (_, bytes) = decode_bech32(bech_id)?;
    Ok(hex::encode(bytes))
}

pub fn is_hex_id_cip105(hex_id: &str) -> bool {
    hex_id.len() == 56
}

pub fn is_bech_id_script_based(bech32_id: &str, is_cip105: bool) -> bool {
    if bech32_id.starts_with("drep_script1") {
        return true;
    }

    let hex_encoded = match decode_drep_id_to_hex(bech32_id) {
        Ok(hex) => hex,
        Err(_) => return false,
    };

    if !is_cip105 && hex_encoded.starts_with("23") {
        return true;
    }

    false
}

pub fn hex_to_bech32(
    hex_id: &str,
    is_script: bool,
    use_cip129: bool,
) -> Result<String, anyhow::Error> {
    let bytes = hex::decode(hex_id)?;
    let is_cip105 = !use_cip129 && is_hex_id_cip105(hex_id);

    if is_cip105 {
        let hrp = if is_script { "drep_script" } else { "drep" };
        encode_bech32(hrp, &bytes)
    } else {
        // CIP-129: Always use "drep" prefix
        encode_bech32("drep", &bytes)
    }
}

pub fn convert_cip105_to_cip129(cip105_id: &str) -> Result<String, anyhow::Error> {
    let hex_encoded_id = decode_drep_id_to_hex(cip105_id)?;
    let is_cip105 = is_hex_id_cip105(&hex_encoded_id);

    if !is_cip105 {
        return Ok(cip105_id.to_string());
    }

    let is_script_based = is_bech_id_script_based(cip105_id, true);
    let prefix = if is_script_based { "23" } else { "22" };
    let cip129_hex = format!("{}{}", prefix, hex_encoded_id);

    hex_to_bech32(&cip129_hex, false, true)
}

pub fn convert_cip129_to_cip105(cip129_id: &str) -> Result<String, anyhow::Error> {
    let hex_encoded_id = decode_drep_id_to_hex(cip129_id)?;
    let is_cip105 = is_hex_id_cip105(&hex_encoded_id);

    if is_cip105 {
        return Ok(cip129_id.to_string());
    }

    let cip105_hex = hex_encoded_id[2..].to_string();
    let is_script_based = hex_encoded_id.starts_with("23");

    hex_to_bech32(&cip105_hex, is_script_based, false)
}

pub fn normalize_to_cip129(drep_id: &str) -> Result<String, anyhow::Error> {
    if is_special_system_drep(drep_id) {
        return Ok(drep_id.to_string());
    }

    if !is_valid_drep_id(drep_id) {
        return Err(anyhow::anyhow!("Invalid DRep ID: {}", drep_id));
    }

    let hex_encoded_id = decode_drep_id_to_hex(drep_id)?;
    let is_cip105 = is_hex_id_cip105(&hex_encoded_id);

    if is_cip105 {
        convert_cip105_to_cip129(drep_id)
    } else {
        Ok(drep_id.to_string())
    }
}

pub fn convert_to_cip105(drep_id: &str) -> Result<String, anyhow::Error> {
    if !is_valid_drep_id(drep_id) {
        return Err(anyhow::anyhow!("Invalid DRep ID: {}", drep_id));
    }

    let hex_encoded_id = decode_drep_id_to_hex(drep_id)?;
    let is_cip105 = is_hex_id_cip105(&hex_encoded_id);

    if is_cip105 {
        Ok(drep_id.to_string())
    } else {
        convert_cip129_to_cip105(drep_id)
    }
}

#[allow(dead_code)]
pub fn convert_to_cip129(drep_id: &str) -> Result<String, anyhow::Error> {
    if !is_valid_drep_id(drep_id) {
        return Err(anyhow::anyhow!("Invalid DRep ID: {}", drep_id));
    }

    let hex_encoded_id = decode_drep_id_to_hex(drep_id)?;
    let is_cip105 = is_hex_id_cip105(&hex_encoded_id);

    if !is_cip105 {
        Ok(drep_id.to_string())
    } else {
        convert_cip105_to_cip129(drep_id)
    }
}
