use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StakeDelegation {
    pub stake_address: String,
    pub delegated_pool: Option<String>,
    pub delegated_drep: Option<String>,
    pub total_balance: Option<String>,
    pub utxo_balance: Option<String>,
    pub rewards_available: Option<String>,
}
