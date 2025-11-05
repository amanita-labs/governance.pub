use bech32::{decode, encode, Hrp};

pub fn decode_bech32(bech32_str: &str) -> Result<(String, Vec<u8>), anyhow::Error> {
    let (hrp, data) = decode(bech32_str)?;
    Ok((hrp.to_string(), data))
}

pub fn encode_bech32(hrp: &str, bytes: &[u8]) -> Result<String, anyhow::Error> {
    let hrp_parsed = Hrp::parse(hrp)?;
    Ok(encode::<bech32::Bech32>(hrp_parsed, bytes)?)
}
