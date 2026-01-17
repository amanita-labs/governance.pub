use crate::models::*;
use sqlx::{PgPool, Row};
use anyhow::Result;

// Yaci Store Database Schema
//
// All queries use the 'preview' schema (set via search_path in database connection).
// The database contains the following governance-related tables:
//
// Core Tables:
// - drep_registration: DRep registrations and retirements
//   - Primary key: (tx_hash, cert_index)
//   - Key columns: drep_hash, drep_id, type, anchor_url, anchor_hash, epoch, tx_hash, block_time
//
// - gov_action_proposal: Governance action proposals
//   - Primary key: (tx_hash, idx) - note: uses 'idx' not 'cert_index'
//   - Key columns: tx_hash, idx, type, deposit, return_address, anchor_url, anchor_hash, details (jsonb), epoch, block_time
//   - Action ID format: {tx_hash}#{idx}
//
// - voting_procedure: Votes on governance actions
//   - Primary key: (tx_hash, voter_hash, gov_action_tx_hash, gov_action_index)
//   - Key columns: voter_type (drep/spo/cc), voter_hash, gov_action_tx_hash, gov_action_index, vote, epoch, block_time
//
// - delegation_vote: DRep delegations
//   - Primary key: (tx_hash, cert_index)
//   - Key columns: address, drep_id, drep_hash, epoch, block_time
//
// - delegation: Pool delegations
//   - Primary key: (tx_hash, cert_index)
//   - Key columns: address, pool_id, credential, epoch, block_time
//
// - local_drep_dist: DRep voting power per epoch
//   - Primary key: (drep_hash, epoch)
//   - Key columns: drep_hash, amount, epoch
//
// - local_gov_action_proposal_status: Action status tracking
//   - Primary key: (gov_action_tx_hash, gov_action_index, epoch)
//   - Key columns: gov_action_tx_hash, gov_action_index, status, epoch
//
// - epoch: Epoch information
//   - Primary key: number (bigint, not 'no')
//   - Key columns: number, start_time, end_time, block_count
//
// - stake_address_balance: Stake address balances
//   - Primary key: (address, slot)
//   - Key columns: address, quantity, slot, epoch, block_time
//
// All queries are implemented and use the actual schema discovered from the database.

pub struct DRepRow {
    pub drep_id: String,
    pub hex: Option<String>,
    pub view: Option<String>,
    pub anchor_url: Option<String>,
    pub anchor_hash: Option<String>,
    pub voting_power: Option<String>,
    pub voting_power_active: Option<String>,
    pub amount: Option<String>,
    pub status: Option<String>,
    pub active: Option<bool>,
    pub active_epoch: Option<i32>,
    pub last_active_epoch: Option<i32>,
    pub has_script: Option<bool>,
    pub retired: Option<bool>,
    pub expired: Option<bool>,
    pub registration_tx_hash: Option<String>,
    pub registration_epoch: Option<i32>,
}

pub struct GovernanceActionRow {
    pub action_id: String,
    pub tx_hash: String,
    pub proposal_tx_hash: Option<String>,
    pub proposal_index: Option<i32>,
    pub cert_index: Option<i32>,
    pub deposit: Option<String>,
    pub return_address: Option<String>,
    pub action_type: String,
    pub status: Option<String>,
    pub proposed_epoch: Option<i32>,
    pub voting_epoch: Option<i32>,
    pub ratification_epoch: Option<i32>,
    pub enactment_epoch: Option<i32>,
    pub expiry_epoch: Option<i32>,
    pub dropped_epoch: Option<i32>,
    pub meta_url: Option<String>,
    pub meta_hash: Option<String>,
    pub block_time: Option<i64>,
}

pub struct VoteRow {
    pub vote: String,
    pub voting_power: Option<String>,
    pub epoch: Option<i32>,
    pub tx_hash: Option<String>,
    pub cert_index: Option<i32>,
    pub voter_type: Option<String>,
    pub drep_id: Option<String>,
    pub pool_id: Option<String>,
    pub committee_member: Option<String>,
}

pub struct StakeDelegationRow {
    pub stake_address: String,
    pub drep_id: Option<String>,
    pub pool_id: Option<String>,
    pub balance: Option<String>,
}

pub struct EpochRow {
    pub no: i32,
    pub start_time: Option<i64>,
}

pub async fn get_dreps_page(
    pool: &PgPool,
    query: &DRepsQuery,
) -> Result<DRepsPage> {
    let page = query.normalized_page();
    let offset = (page - 1) * query.count;
    let limit = query.count;
    
    // Get latest epoch for voting power calculation
    let latest_epoch: Option<i32> = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT MAX(number) FROM epoch"
    )
    .fetch_optional(pool)
    .await?
    .flatten();
    
    // Build query using sqlx::query with manual row mapping
    let mut sql_builder = String::from(
        r#"
        WITH latest_dreps AS (
            SELECT DISTINCT ON (drep_hash)
                drep_hash,
                drep_id,
                type,
                anchor_url,
                anchor_hash,
                cred_type,
                epoch,
                tx_hash,
                block_time
            FROM drep_registration
            ORDER BY drep_hash, epoch DESC, block_time DESC
        )
        SELECT 
            COALESCE(ld.drep_id, ld.drep_hash) as drep_id,
            ld.drep_hash as hex,
            ld.drep_hash as view,
            ld.anchor_url,
            ld.anchor_hash,
            COALESCE(ldd.amount, 0)::text as voting_power,
            COALESCE(ldd.amount, 0)::text as voting_power_active,
            COALESCE(ldd.amount, 0)::text as amount,
            CASE 
                WHEN ld.type = 'drep_retirement' THEN 'retired'
                WHEN ld.drep_id IS NOT NULL THEN 'active'
                ELSE 'inactive'
            END as status,
            (ld.type = 'drep_registration' AND ld.drep_id IS NOT NULL) as active,
            ld.epoch::integer as active_epoch,
            ld.epoch::integer as last_active_epoch,
            (ld.cred_type = 'script') as has_script,
            (ld.type = 'drep_retirement') as retired,
            false as expired,
            ld.tx_hash as registration_tx_hash,
            ld.epoch::integer as registration_epoch
        FROM latest_dreps ld
        LEFT JOIN local_drep_dist ldd ON ld.drep_hash = ldd.drep_hash
            AND (ldd.epoch = $1 OR ldd.epoch IS NULL)
        "#,
    );
    
    // Add WHERE clause conditions
    let mut conditions = Vec::new();
    let mut param_idx = 2; // Start at 2 since $1 is used for epoch in JOIN
    
    // Status filter
    if !query.statuses.is_empty() {
        let status_conditions: Vec<String> = query.statuses.iter()
            .map(|s| match s.to_lowercase().as_str() {
                "active" => "ld.type = 'drep_registration' AND ld.drep_id IS NOT NULL".to_string(),
                "retired" => "ld.type = 'drep_retirement'".to_string(),
                "inactive" => "ld.type = 'drep_registration' AND ld.drep_id IS NULL".to_string(),
                _ => format!("ld.type = '{}'", s),
            })
            .collect();
        if !status_conditions.is_empty() {
            conditions.push(format!("({})", status_conditions.join(" OR ")));
        }
    }
    
    // Search filter
    if let Some(_search) = &query.search {
        conditions.push(format!(
            "(ld.drep_id ILIKE ${} OR ld.drep_hash ILIKE ${})",
            param_idx, param_idx
        ));
        param_idx += 1;
    }
    
    if !conditions.is_empty() {
        sql_builder.push_str(" WHERE ");
        sql_builder.push_str(&conditions.join(" AND "));
    }
    
    // Build ORDER BY
    let order_by = match query.sort.as_deref() {
        Some("voting_power") | Some("VotingPower") => {
            match query.direction.as_deref() {
                Some("asc") | Some("Ascending") => "COALESCE(ldd.amount, 0) ASC",
                _ => "COALESCE(ldd.amount, 0) DESC",
            }
        }
        Some("epoch") | Some("Epoch") => {
            match query.direction.as_deref() {
                Some("asc") | Some("Ascending") => "ld.epoch ASC",
                _ => "ld.epoch DESC",
            }
        }
        _ => "COALESCE(ldd.amount, 0) DESC",
    };
    
    sql_builder.push_str(&format!(" ORDER BY {}", order_by));
    sql_builder.push_str(&format!(" LIMIT ${} OFFSET ${}", param_idx, param_idx + 1));
    
    // Execute query with proper binding
    let mut query_builder = sqlx::query(&sql_builder);
    
    // Bind epoch first (used in JOIN)
    if let Some(epoch) = latest_epoch {
        query_builder = query_builder.bind(epoch);
    } else {
        query_builder = query_builder.bind::<Option<i32>>(None);
    }
    
    if let Some(search) = &query.search {
        let search_pattern = format!("%{}%", search);
        let search_pattern2 = search_pattern.clone();
        query_builder = query_builder.bind(search_pattern).bind(search_pattern2);
    }
    query_builder = query_builder.bind(limit as i64).bind(offset as i64);
    
    let rows = query_builder.fetch_all(pool).await?;
    
    let dreps: Vec<DRep> = rows.into_iter().map(|row| {
        DRep {
            drep_id: row.get::<String, _>(0),
            drep_hash: row.get::<Option<String>, _>(1).clone(),
            hex: row.get::<Option<String>, _>(1),
            view: row.get::<Option<String>, _>(2),
            url: row.get::<Option<String>, _>(3).clone(),
            metadata: None,
            anchor: row.get::<Option<String>, _>(3).and_then(|url| {
                row.get::<Option<String>, _>(4).map(|hash| DRepAnchor {
                    url,
                    data_hash: hash,
                })
            }),
            voting_power: row.get::<Option<String>, _>(5),
            voting_power_active: row.get::<Option<String>, _>(6),
            amount: row.get::<Option<String>, _>(7),
            status: row.get::<Option<String>, _>(8),
            active: row.get::<Option<bool>, _>(9),
            active_epoch: row.get::<Option<i32>, _>(10).map(|e| e as u32),
            last_active_epoch: row.get::<Option<i32>, _>(11).map(|e| e as u32),
            has_script: row.get::<Option<bool>, _>(12),
            retired: row.get::<Option<bool>, _>(13),
            expired: row.get::<Option<bool>, _>(14),
            registration_tx_hash: row.get::<Option<String>, _>(15),
            registration_epoch: row.get::<Option<i32>, _>(16).map(|e| e as u32),
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
            is_script_based: row.get::<Option<bool>, _>(12),
        }
    }).collect();
    
    // Get total count
    let mut count_sql = String::from(
        "SELECT COUNT(DISTINCT drep_hash) FROM drep_registration"
    );
    let mut count_conditions = Vec::new();
    
    if !query.statuses.is_empty() {
        let status_conditions: Vec<String> = query.statuses.iter()
            .map(|s| match s.to_lowercase().as_str() {
                "active" => "type = 'drep_registration' AND drep_id IS NOT NULL".to_string(),
                "retired" => "type = 'drep_retirement'".to_string(),
                "inactive" => "type = 'drep_registration' AND drep_id IS NULL".to_string(),
                _ => format!("type = '{}'", s),
            })
            .collect();
        if !status_conditions.is_empty() {
            count_conditions.push(format!("({})", status_conditions.join(" OR ")));
        }
    }
    
    if query.search.is_some() {
        count_conditions.push(format!(
            "(drep_id ILIKE $1 OR drep_hash ILIKE $1)"
        ));
    }
    
    if !count_conditions.is_empty() {
        count_sql.push_str(" WHERE ");
        count_sql.push_str(&count_conditions.join(" AND "));
    }
    
    let mut count_query = sqlx::query_scalar::<_, Option<i64>>(&count_sql);
    if let Some(search) = &query.search {
        let search_pattern = format!("%{}%", search);
        let search_pattern2 = search_pattern.clone();
        count_query = count_query.bind(search_pattern).bind(search_pattern2);
    }
    
    let total = count_query.fetch_optional(pool).await?.flatten();
    let has_more = total.map(|t| ((offset + limit) as i64) < t).unwrap_or(false);
    
    Ok(DRepsPage {
        dreps,
        has_more,
        total: total.map(|t| t as u64),
    })
}

pub async fn get_drep(pool: &PgPool, id: &str) -> Result<Option<DRep>> {
    // Get latest epoch for voting power
    let latest_epoch: Option<i32> = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT MAX(number) FROM epoch"
    )
    .fetch_optional(pool)
    .await?
    .flatten();
    
    // Query latest DRep registration by drep_id or drep_hash
    let row = sqlx::query(
        r#"
        WITH latest_drep AS (
            SELECT DISTINCT ON (drep_hash)
                drep_hash,
                drep_id,
                type,
                anchor_url,
                anchor_hash,
                cred_type,
                epoch,
                tx_hash,
                block_time,
                deposit
            FROM drep_registration
            WHERE drep_id = $1 OR drep_hash = $1
            ORDER BY drep_hash, epoch DESC, block_time DESC
            LIMIT 1
        )
        SELECT 
            COALESCE(ld.drep_id, ld.drep_hash) as drep_id,
            ld.drep_hash as hex,
            ld.drep_hash as view,
            ld.anchor_url,
            ld.anchor_hash,
            COALESCE(ldd.amount, 0)::text as voting_power,
            COALESCE(ldd.amount, 0)::text as voting_power_active,
            COALESCE(ldd.amount, 0)::text as amount,
            CASE 
                WHEN ld.type = 'drep_retirement' THEN 'retired'
                WHEN ld.drep_id IS NOT NULL THEN 'active'
                ELSE 'inactive'
            END as status,
            (ld.type = 'drep_registration' AND ld.drep_id IS NOT NULL) as active,
            ld.epoch::integer as active_epoch,
            ld.epoch::integer as last_active_epoch,
            (ld.cred_type = 'script') as has_script,
            (ld.type = 'drep_retirement') as retired,
            false as expired,
            ld.tx_hash as registration_tx_hash,
            ld.epoch::integer as registration_epoch,
            ld.deposit::text
        FROM latest_drep ld
        LEFT JOIN local_drep_dist ldd ON ld.drep_hash = ldd.drep_hash
            AND (ldd.epoch = $2 OR ldd.epoch IS NULL)
        ORDER BY ldd.epoch DESC NULLS LAST
        LIMIT 1
        "#
    )
    .bind(id)
    .bind(latest_epoch)
    .fetch_optional(pool)
    .await?;
    
    if let Some(row) = row {
        // Get delegator count
        let delegator_count: Option<i64> = sqlx::query_scalar(
            "SELECT COUNT(DISTINCT address) FROM delegation_vote WHERE drep_id = $1 OR drep_hash = $1"
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .flatten();
        
        // Get vote count
        let vote_count: Option<i64> = sqlx::query_scalar(
            "SELECT COUNT(*) FROM voting_procedure WHERE voter_type = 'drep' AND voter_hash = (SELECT drep_hash FROM drep_registration WHERE drep_id = $1 OR drep_hash = $1 ORDER BY epoch DESC LIMIT 1)"
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .flatten();
        
        // Get last vote epoch
        let last_vote_epoch: Option<i32> = sqlx::query_scalar(
            "SELECT MAX(epoch) FROM voting_procedure WHERE voter_type = 'drep' AND voter_hash = (SELECT drep_hash FROM drep_registration WHERE drep_id = $1 OR drep_hash = $1 ORDER BY epoch DESC LIMIT 1)"
        )
        .bind(id)
        .fetch_optional(pool)
        .await?
        .flatten();
        
        Ok(Some(DRep {
            drep_id: row.get(0),
            drep_hash: row.get::<Option<String>, _>(1).clone(),
            hex: row.get(1),
            view: row.get(2),
            url: row.get::<Option<String>, _>(3).clone(),
            metadata: None,
            anchor: row.get::<Option<String>, _>(3).and_then(|url| {
                row.get::<Option<String>, _>(4).map(|hash| DRepAnchor {
                    url,
                    data_hash: hash,
                })
            }),
            voting_power: row.get(5),
            voting_power_active: row.get(6),
            amount: row.get(7),
            status: row.get(8),
            active: row.get(9),
            active_epoch: row.get::<Option<i32>, _>(10).map(|e| e as u32),
            last_active_epoch: row.get::<Option<i32>, _>(11).map(|e| e as u32),
            has_script: row.get(12),
            retired: row.get(13),
            expired: row.get(14),
            registration_tx_hash: row.get(15),
            registration_epoch: row.get::<Option<i32>, _>(16).map(|e| e as u32),
            delegator_count: delegator_count.map(|c| c as u32),
            vote_count: vote_count.map(|c| c as u32),
            last_vote_epoch: last_vote_epoch.map(|e| e as u32),
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
            deposit: row.get::<Option<String>, _>(17),
            metadata_error: None,
            payment_address: None,
            is_script_based: row.get(12),
        }))
    } else {
        Ok(None)
    }
}

pub async fn get_drep_delegators(pool: &PgPool, drep_id: &str) -> Result<Vec<DRepDelegator>> {
    // Get latest delegations for this DRep
    // Need to join with stake_address_balance to get current balances
    let rows = sqlx::query(
        r#"
        WITH latest_delegations AS (
            SELECT DISTINCT ON (address)
                dv.address,
                dv.epoch,
                dv.block_time
            FROM delegation_vote dv
            WHERE dv.drep_id = $1 OR dv.drep_hash = $1
            ORDER BY dv.address, dv.epoch DESC, dv.block_time DESC
        ),
        latest_balances AS (
            SELECT DISTINCT ON (address)
                address,
                quantity
            FROM stake_address_balance
            WHERE address IN (SELECT address FROM latest_delegations)
            ORDER BY address, slot DESC
        )
        SELECT 
            ld.address,
            COALESCE(lb.quantity, 0)::text as amount
        FROM latest_delegations ld
        LEFT JOIN latest_balances lb ON ld.address = lb.address
        ORDER BY COALESCE(lb.quantity, 0) DESC
        "#
    )
    .bind(drep_id)
    .fetch_all(pool)
    .await?;
    
    Ok(rows.into_iter().map(|row| {
        DRepDelegator {
            address: row.get(0),
            amount: row.get(1),
        }
    }).collect())
}

pub async fn get_drep_voting_history(pool: &PgPool, drep_id: &str) -> Result<Vec<DRepVotingHistory>> {
    // Get DRep hash first
    let drep_hash: Option<String> = sqlx::query_scalar(
        "SELECT drep_hash FROM drep_registration WHERE drep_id = $1 OR drep_hash = $1 ORDER BY epoch DESC LIMIT 1"
    )
    .bind(drep_id)
    .fetch_optional(pool)
    .await?
    .flatten();
    
    if let Some(hash) = drep_hash {
        let rows = sqlx::query(
            r#"
            SELECT 
                vp.tx_hash,
                vp.idx as cert_index,
                vp.gov_action_tx_hash || '#' || vp.gov_action_index as proposal_id,
                vp.gov_action_tx_hash || '#' || vp.gov_action_index as action_id,
                vp.gov_action_tx_hash as proposal_tx_hash,
                vp.gov_action_index as proposal_cert_index,
                vp.vote,
                NULL as voting_power,
                vp.epoch
            FROM voting_procedure vp
            WHERE vp.voter_type = 'drep' AND vp.voter_hash = $1
            ORDER BY vp.epoch DESC, vp.block_time DESC
            "#
        )
        .bind(&hash)
        .fetch_all(pool)
        .await?;
        
        Ok(rows.into_iter().map(|row| {
            DRepVotingHistory {
                tx_hash: row.get(0),
                cert_index: row.get::<Option<i32>, _>(1).map(|i| i as u32),
                proposal_id: row.get(2),
                action_id: row.get(3),
                proposal_tx_hash: row.get(4),
                proposal_cert_index: row.get::<Option<i32>, _>(5).map(|i| i as u32),
                vote: row.get::<Option<String>, _>(6).unwrap_or_else(|| "abstain".to_string()),
                voting_power: row.get(7),
                epoch: row.get::<Option<i32>, _>(8).map(|e| e as u32),
            }
        }).collect())
    } else {
        Ok(Vec::new())
    }
}

pub async fn get_governance_actions_page(
    pool: &PgPool,
    page: u32,
    count: u32,
) -> Result<ActionsPage> {
    let offset = (page - 1) * count;
    let limit = count;
    
    // Get latest status for each action
    let rows = sqlx::query(
        r#"
        WITH latest_status AS (
            SELECT DISTINCT ON (gov_action_tx_hash, gov_action_index)
                gov_action_tx_hash,
                gov_action_index,
                status,
                epoch
            FROM local_gov_action_proposal_status
            ORDER BY gov_action_tx_hash, gov_action_index, epoch DESC
        )
        SELECT 
            gap.tx_hash,
            gap.tx_hash || '#' || gap.idx as action_id,
            gap.tx_hash || '#' || gap.idx as proposal_id,
            gap.tx_hash as proposal_tx_hash,
            gap.idx as proposal_index,
            gap.idx as cert_index,
            gap.deposit::text,
            NULL as reward_account,
            gap.return_address,
            gap.type,
            NULL as description,
            ls.status,
            gap.epoch as proposed_epoch,
            gap.epoch as voting_epoch,
            NULL as ratification_epoch,
            NULL as ratified_epoch,
            NULL as enactment_epoch,
            NULL as expiry_epoch,
            NULL as expiration,
            NULL as dropped_epoch,
            gap.anchor_url as meta_url,
            gap.anchor_hash as meta_hash,
            gap.details as meta_json,
            NULL as meta_language,
            NULL as meta_comment,
            NULL as meta_is_valid,
            gap.block_time
        FROM gov_action_proposal gap
        LEFT JOIN latest_status ls ON gap.tx_hash = ls.gov_action_tx_hash AND gap.idx = ls.gov_action_index
        ORDER BY gap.block_time DESC, gap.epoch DESC
        LIMIT $1 OFFSET $2
        "#
    )
    .bind(limit as i64)
    .bind(offset as i64)
    .fetch_all(pool)
    .await?;
    
    let actions: Vec<GovernanceAction> = rows.into_iter().map(|row| {
        GovernanceAction {
            tx_hash: row.get(0),
            action_id: row.get(1),
            proposal_id: row.get(2),
            proposal_tx_hash: row.get(3),
            proposal_index: row.get::<Option<i32>, _>(4).map(|i| i as u32),
            cert_index: row.get::<Option<i32>, _>(5).map(|i| i as u32),
            deposit: row.get(6),
            reward_account: row.get(7),
            return_address: row.get(8),
            r#type: row.get(9),
            description: row.get(10),
            status: row.get(11),
            proposed_epoch: row.get::<Option<i32>, _>(12).map(|e| e as u32),
            voting_epoch: row.get::<Option<i32>, _>(13).map(|e| e as u32),
            proposed_epoch_start_time: None,
            voting_epoch_start_time: None,
            ratification_epoch_start_time: None,
            enactment_epoch_start_time: None,
            expiry_epoch_start_time: None,
            expiration_epoch_start_time: None,
            dropped_epoch_start_time: None,
            ratification_epoch: row.get::<Option<i32>, _>(14).map(|e| e as u32),
            ratified_epoch: row.get::<Option<i32>, _>(15).map(|e| e as u32),
            enactment_epoch: row.get::<Option<i32>, _>(16).map(|e| e as u32),
            expiry_epoch: row.get::<Option<i32>, _>(17).map(|e| e as u32),
            expiration: row.get::<Option<i32>, _>(18).map(|e| e as u32),
            dropped_epoch: row.get::<Option<i32>, _>(19).map(|e| e as u32),
            meta_url: row.get(20),
            meta_hash: row.get(21),
            meta_json: row.get(22),
            meta_language: row.get(23),
            meta_comment: row.get(24),
            meta_is_valid: row.get(25),
            metadata_checks: None,
            withdrawal: None,
            param_proposal: None,
            block_time: row.get::<Option<i64>, _>(26).map(|t| t as u64),
            metadata: None,
        }
    }).collect();
    
    // Get total count
    let total: Option<i64> = sqlx::query_scalar(
        "SELECT COUNT(*) FROM gov_action_proposal"
    )
    .fetch_optional(pool)
    .await?
    .flatten();
    
    let has_more = total.map(|t| ((offset + count) as i64) < t).unwrap_or(false);
    
    Ok(ActionsPage {
        actions,
        has_more,
        total: total.map(|t| t as u64),
    })
}

pub async fn get_governance_action(pool: &PgPool, action_id: &str) -> Result<Option<GovernanceAction>> {
    // Parse action_id - can be tx_hash#idx or just tx_hash (assumes idx=0)
    let (tx_hash, idx) = if action_id.contains('#') {
        let parts: Vec<&str> = action_id.split('#').collect();
        if parts.len() == 2 {
            (parts[0].to_string(), parts[1].parse::<i32>().unwrap_or(0))
        } else {
            (action_id.to_string(), 0)
        }
    } else if action_id.len() == 64 {
        (action_id.to_string(), 0)
    } else {
        // Try to find by CIP-129 format - would need to decode, but for now try direct match
        return Ok(None);
    };
    
    let row = sqlx::query(
        r#"
        WITH latest_status AS (
            SELECT DISTINCT ON (gov_action_tx_hash, gov_action_index)
                gov_action_tx_hash,
                gov_action_index,
                status,
                epoch
            FROM local_gov_action_proposal_status
            WHERE gov_action_tx_hash = $1 AND gov_action_index = $2
            ORDER BY gov_action_tx_hash, gov_action_index, epoch DESC
            LIMIT 1
        )
        SELECT 
            gap.tx_hash,
            gap.tx_hash || '#' || gap.idx as action_id,
            gap.tx_hash || '#' || gap.idx as proposal_id,
            gap.tx_hash as proposal_tx_hash,
            gap.idx as proposal_index,
            gap.idx as cert_index,
            gap.deposit::text,
            NULL as reward_account,
            gap.return_address,
            gap.type,
            NULL as description,
            ls.status,
            gap.epoch as proposed_epoch,
            gap.epoch as voting_epoch,
            NULL as ratification_epoch,
            NULL as ratified_epoch,
            NULL as enactment_epoch,
            NULL as expiry_epoch,
            NULL as expiration,
            NULL as dropped_epoch,
            gap.anchor_url as meta_url,
            gap.anchor_hash as meta_hash,
            gap.details as meta_json,
            NULL as meta_language,
            NULL as meta_comment,
            NULL as meta_is_valid,
            gap.block_time
        FROM gov_action_proposal gap
        LEFT JOIN latest_status ls ON gap.tx_hash = ls.gov_action_tx_hash AND gap.idx = ls.gov_action_index
        WHERE gap.tx_hash = $1 AND gap.idx = $2
        LIMIT 1
        "#
    )
    .bind(&tx_hash)
    .bind(idx)
    .fetch_optional(pool)
    .await?;
    
    if let Some(row) = row {
        Ok(Some(GovernanceAction {
            tx_hash: row.get(0),
            action_id: row.get(1),
            proposal_id: row.get(2),
            proposal_tx_hash: row.get(3),
            proposal_index: row.get::<Option<i32>, _>(4).map(|i| i as u32),
            cert_index: row.get::<Option<i32>, _>(5).map(|i| i as u32),
            deposit: row.get(6),
            reward_account: row.get(7),
            return_address: row.get(8),
            r#type: row.get(9),
            description: row.get(10),
            status: row.get(11),
            proposed_epoch: row.get::<Option<i32>, _>(12).map(|e| e as u32),
            voting_epoch: row.get::<Option<i32>, _>(13).map(|e| e as u32),
            proposed_epoch_start_time: None,
            voting_epoch_start_time: None,
            ratification_epoch_start_time: None,
            enactment_epoch_start_time: None,
            expiry_epoch_start_time: None,
            expiration_epoch_start_time: None,
            dropped_epoch_start_time: None,
            ratification_epoch: row.get::<Option<i32>, _>(14).map(|e| e as u32),
            ratified_epoch: row.get::<Option<i32>, _>(15).map(|e| e as u32),
            enactment_epoch: row.get::<Option<i32>, _>(16).map(|e| e as u32),
            expiry_epoch: row.get::<Option<i32>, _>(17).map(|e| e as u32),
            expiration: row.get::<Option<i32>, _>(18).map(|e| e as u32),
            dropped_epoch: row.get::<Option<i32>, _>(19).map(|e| e as u32),
            meta_url: row.get(20),
            meta_hash: row.get(21),
            meta_json: row.get(22),
            meta_language: row.get(23),
            meta_comment: row.get(24),
            meta_is_valid: row.get(25),
            metadata_checks: None,
            withdrawal: None,
            param_proposal: None,
            block_time: row.get::<Option<i64>, _>(26).map(|t| t as u64),
            metadata: None,
        }))
    } else {
        Ok(None)
    }
}

pub async fn get_action_voting_results(
    pool: &PgPool,
    action_id: &str,
) -> Result<ActionVotingBreakdown> {
    // Parse action_id
    let (tx_hash, idx) = if action_id.contains('#') {
        let parts: Vec<&str> = action_id.split('#').collect();
        if parts.len() == 2 {
            (parts[0].to_string(), parts[1].parse::<i32>().unwrap_or(0))
        } else {
            (action_id.to_string(), 0)
        }
    } else if action_id.len() == 64 {
        (action_id.to_string(), 0)
    } else {
        return Ok(ActionVotingBreakdown::default());
    };
    
    // Aggregate votes by voter type and vote choice
    // Note: voting_power needs to be calculated from DRep distribution or pool stake
    // For now, we'll count votes and set power to "0" - this needs enhancement
    
    // DRep votes
    let drep_yes: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM voting_procedure WHERE gov_action_tx_hash = $1 AND gov_action_index = $2 AND voter_type = 'drep' AND vote = 'yes'"
    )
    .bind(&tx_hash)
    .bind(idx)
    .fetch_optional(pool)
    .await?
    .unwrap_or(0);
    
    let drep_no: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM voting_procedure WHERE gov_action_tx_hash = $1 AND gov_action_index = $2 AND voter_type = 'drep' AND vote = 'no'"
    )
    .bind(&tx_hash)
    .bind(idx)
    .fetch_optional(pool)
    .await?
    .unwrap_or(0);
    
    let drep_abstain: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM voting_procedure WHERE gov_action_tx_hash = $1 AND gov_action_index = $2 AND voter_type = 'drep' AND (vote = 'abstain' OR vote IS NULL)"
    )
    .bind(&tx_hash)
    .bind(idx)
    .fetch_optional(pool)
    .await?
    .unwrap_or(0);
    
    // SPO votes
    let spo_yes: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM voting_procedure WHERE gov_action_tx_hash = $1 AND gov_action_index = $2 AND voter_type = 'spo' AND vote = 'yes'"
    )
    .bind(&tx_hash)
    .bind(idx)
    .fetch_optional(pool)
    .await?
    .unwrap_or(0);
    
    let spo_no: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM voting_procedure WHERE gov_action_tx_hash = $1 AND gov_action_index = $2 AND voter_type = 'spo' AND vote = 'no'"
    )
    .bind(&tx_hash)
    .bind(idx)
    .fetch_optional(pool)
    .await?
    .unwrap_or(0);
    
    let spo_abstain: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM voting_procedure WHERE gov_action_tx_hash = $1 AND gov_action_index = $2 AND voter_type = 'spo' AND (vote = 'abstain' OR vote IS NULL)"
    )
    .bind(&tx_hash)
    .bind(idx)
    .fetch_optional(pool)
    .await?
    .unwrap_or(0);
    
    // CC votes
    let cc_yes: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM voting_procedure WHERE gov_action_tx_hash = $1 AND gov_action_index = $2 AND voter_type = 'cc' AND vote = 'yes'"
    )
    .bind(&tx_hash)
    .bind(idx)
    .fetch_optional(pool)
    .await?
    .unwrap_or(0);
    
    let cc_no: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM voting_procedure WHERE gov_action_tx_hash = $1 AND gov_action_index = $2 AND voter_type = 'cc' AND vote = 'no'"
    )
    .bind(&tx_hash)
    .bind(idx)
    .fetch_optional(pool)
    .await?
    .unwrap_or(0);
    
    let cc_abstain: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM voting_procedure WHERE gov_action_tx_hash = $1 AND gov_action_index = $2 AND voter_type = 'cc' AND (vote = 'abstain' OR vote IS NULL)"
    )
    .bind(&tx_hash)
    .bind(idx)
    .fetch_optional(pool)
    .await?
    .unwrap_or(0);
    
    Ok(ActionVotingBreakdown {
        drep_votes: VoteCounts {
            yes: "0".to_string(), // TODO: Calculate actual voting power
            no: "0".to_string(),
            abstain: "0".to_string(),
            yes_votes_cast: Some(drep_yes as u32),
            no_votes_cast: Some(drep_no as u32),
            abstain_votes_cast: Some(drep_abstain as u32),
        },
        spo_votes: VoteCounts {
            yes: "0".to_string(), // TODO: Calculate actual voting power
            no: "0".to_string(),
            abstain: "0".to_string(),
            yes_votes_cast: Some(spo_yes as u32),
            no_votes_cast: Some(spo_no as u32),
            abstain_votes_cast: Some(spo_abstain as u32),
        },
        cc_votes: VoteCounts {
            yes: "0".to_string(), // TODO: Calculate actual voting power
            no: "0".to_string(),
            abstain: "0".to_string(),
            yes_votes_cast: Some(cc_yes as u32),
            no_votes_cast: Some(cc_no as u32),
            abstain_votes_cast: Some(cc_abstain as u32),
        },
        total_voting_power: "0".to_string(), // TODO: Calculate total
        summary: None,
        vote_timeline: None,
    })
}

pub async fn get_stake_delegation(
    pool: &PgPool,
    stake_address: &str,
) -> Result<Option<StakeDelegation>> {
    // Get latest delegation (can be to pool or DRep)
    // Check delegation_vote first (DRep delegation)
    let drep_row = sqlx::query(
        r#"
        SELECT DISTINCT ON (address)
            address,
            drep_id,
            NULL as pool_id,
            epoch,
            block_time
        FROM delegation_vote
        WHERE address = $1
        ORDER BY address, epoch DESC, block_time DESC
        LIMIT 1
        "#
    )
    .bind(stake_address)
    .fetch_optional(pool)
    .await?;
    
    // If no DRep delegation, check pool delegation
    let (delegated_drep, delegated_pool) = if let Some(row) = drep_row {
        (row.get::<Option<String>, _>(1), None)
    } else {
        let pool_row = sqlx::query(
            r#"
            SELECT DISTINCT ON (address)
                address,
                NULL as drep_id,
                pool_id,
                epoch,
                block_time
            FROM delegation
            WHERE address = $1
            ORDER BY address, epoch DESC, block_time DESC
            LIMIT 1
            "#
        )
        .bind(stake_address)
        .fetch_optional(pool)
        .await?;
        
        if let Some(row) = pool_row {
            (None, row.get::<Option<String>, _>(2))
        } else {
            (None, None)
        }
    };
    
    // Get latest balance
    let balance_row = sqlx::query(
        r#"
        SELECT DISTINCT ON (address)
            address,
            quantity::text,
            epoch
        FROM stake_address_balance
        WHERE address = $1
        ORDER BY address, slot DESC
        LIMIT 1
        "#
    )
    .bind(stake_address)
    .fetch_optional(pool)
    .await?;
    
    let total_balance = balance_row.and_then(|row| {
        row.get::<Option<String>, _>(1)
    });
    
    // For now, set utxo_balance and rewards_available to None
    // These would need additional queries to UTXO table
    Ok(Some(StakeDelegation {
        stake_address: stake_address.to_string(),
        delegated_pool,
        delegated_drep,
        total_balance,
        utxo_balance: None,
        rewards_available: None,
    }))
}

pub async fn get_total_active_dreps(pool: &PgPool) -> Result<Option<u32>> {
    let count: Option<i64> = sqlx::query_scalar(
        r#"
        SELECT COUNT(DISTINCT drep_hash)
        FROM drep_registration
        WHERE type = 'drep_registration' AND drep_id IS NOT NULL
        "#
    )
    .fetch_optional(pool)
    .await?
    .flatten();
    
    Ok(count.map(|c| c as u32))
}

pub async fn get_epoch_start_time(pool: &PgPool, epoch: u32) -> Result<Option<u64>> {
    let start_time: Option<i64> = sqlx::query_scalar(
        "SELECT start_time FROM epoch WHERE number = $1"
    )
    .bind(epoch as i64)
    .fetch_optional(pool)
    .await?
    .flatten();
    
    Ok(start_time.map(|t| t as u64))
}

// Database statistics structures
#[derive(Debug, Clone)]
pub struct DatabaseStats {
    pub connected: bool,
    pub database_name: String,
    pub database_size_bytes: Option<i64>,
    pub total_tables: Option<i32>,
    pub total_rows: Option<i64>,
    pub connection_pool_size: Option<u32>,
    pub active_connections: Option<u32>,
    pub table_details: Vec<TableStats>,
}

#[derive(Debug, Clone)]
pub struct TableStats {
    pub table_name: String,
    pub row_count: Option<i64>,
    pub column_count: Option<i32>,
    pub table_size_bytes: Option<i64>,
}

// Indexer health structures
#[derive(Debug, Clone)]
pub enum IndexerStatus {
    Active,
    Stale,
    Stopped,
}

#[derive(Debug, Clone)]
pub struct IndexerHealth {
    pub connected: bool,
    pub is_syncing: bool,
    pub latest_block_number: Option<i64>,
    pub latest_block_time: Option<i64>,
    pub total_blocks: Option<i64>,
    pub latest_epoch: Option<i32>,
    pub blocks_last_hour: Option<i64>,
    pub blocks_last_day: Option<i64>,
    pub sync_rate_per_minute: Option<f64>,
    pub last_sync_ago_seconds: Option<i64>,
    pub status: IndexerStatus,
}

// Yaci Store sync status queries
pub struct SyncStatus {
    pub connected: bool,
    pub latest_block_number: Option<i64>,
    pub latest_block_slot: Option<i64>,
    pub latest_block_time: Option<i64>,
    pub total_blocks: Option<i64>,
    pub latest_epoch: Option<i32>,
    pub sync_progress: Option<String>,
}

pub async fn get_yaci_sync_status(pool: &PgPool) -> Result<SyncStatus> {
    // Check database connection
    let connected = sqlx::query("SELECT 1")
        .execute(pool)
        .await
        .is_ok();
    
    if !connected {
        return Ok(SyncStatus {
            connected: false,
            latest_block_number: None,
            latest_block_slot: None,
            latest_block_time: None,
            total_blocks: None,
            latest_epoch: None,
            sync_progress: Some("Database not connected".to_string()),
        });
    }
    
    // Check if block table exists and get its column names for debugging
    let block_table_exists: bool = sqlx::query_as::<_, (bool,)>(
        "SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'block'
        )"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|(exists,)| exists)
    .unwrap_or(false);
    
    if !block_table_exists {
        return Ok(SyncStatus {
            connected: true,
            latest_block_number: None,
            latest_block_slot: None,
            latest_block_time: None,
            total_blocks: None,
            latest_epoch: None,
            sync_progress: Some("Block table does not exist".to_string()),
        });
    }
    
    // Try to get a simple count first to verify table is accessible
    let simple_count: Option<i64> = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*)::bigint FROM block"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|(count,)| count);
    
    if simple_count == Some(0) {
        return Ok(SyncStatus {
            connected: true,
            latest_block_number: None,
            latest_block_slot: None,
            latest_block_time: None,
            total_blocks: Some(0),
            latest_epoch: None,
            sync_progress: Some("Block table exists but is empty".to_string()),
        });
    }
    
    // First, try to discover the actual column names in the block table
    // Get latest block information - try multiple column name patterns
    let latest_block = {
        // Try pattern 1: block_no, slot_no, time (common Yaci Store pattern)
        match sqlx::query_as::<_, (Option<i64>, Option<i64>, Option<i64>)>(
            "SELECT block_no, slot_no, time FROM block ORDER BY block_no DESC LIMIT 1"
        )
        .fetch_optional(pool)
        .await
        {
            Ok(Some(result)) => Some(result),
            _ => {
                // Try pattern 2: number, slot, block_time
                match sqlx::query_as::<_, (Option<i64>, Option<i64>, Option<i64>)>(
                    "SELECT number, slot, block_time FROM block ORDER BY number DESC LIMIT 1"
                )
                .fetch_optional(pool)
                .await
                {
                    Ok(Some(result)) => Some(result),
                    _ => {
                        // Try pattern 3: COALESCE approach
                        sqlx::query_as::<_, (Option<i64>, Option<i64>, Option<i64>)>(
                            r#"
                            SELECT 
                                COALESCE(block_no, number)::bigint,
                                COALESCE(slot_no, slot)::bigint,
                                COALESCE(time, block_time)::bigint
                            FROM block 
                            ORDER BY COALESCE(block_no, number) DESC 
                            LIMIT 1
                            "#
                        )
                        .fetch_optional(pool)
                        .await
                        .ok()
                        .flatten()
                    }
                }
            }
        }
    };
    
    let (latest_block_number, latest_block_slot, latest_block_time) = latest_block.unwrap_or((None, None, None));
    
    // Get total block count
    let total_blocks: Option<i64> = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*)::bigint FROM block"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|(count,)| count);
    
    // Get latest epoch - check if epoch table exists
    let epoch_table_exists: bool = sqlx::query_as::<_, (bool,)>(
        "SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'epoch'
        )"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|(exists,)| exists)
    .unwrap_or(false);
    
    let latest_epoch = if epoch_table_exists {
        // Try epoch table first
        let epoch_from_table = sqlx::query_as::<_, (Option<i32>,)>(
            "SELECT MAX(COALESCE(no, number)) FROM epoch"
        )
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|(epoch,)| epoch);
        
        // Fallback to block.epoch if epoch table query returned None
        if epoch_from_table.is_some() {
            epoch_from_table
        } else {
            sqlx::query_as::<_, (Option<i32>,)>(
                "SELECT MAX(epoch) FROM block WHERE epoch IS NOT NULL"
            )
            .fetch_optional(pool)
            .await
            .ok()
            .flatten()
            .and_then(|(epoch,)| epoch)
        }
    } else {
        // No epoch table, try to get from block table
        sqlx::query_as::<_, (Option<i32>,)>(
            "SELECT MAX(epoch) FROM block WHERE epoch IS NOT NULL"
        )
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|(epoch,)| epoch)
    };
    
    // Determine sync status
    let sync_progress = if let (Some(block_num), Some(total)) = (latest_block_number, total_blocks) {
        if total > 0 {
            Some(format!("Block {} synced", block_num))
        } else {
            Some("Initializing...".to_string())
        }
    } else {
        Some("Not synced yet".to_string())
    };
    
    Ok(SyncStatus {
        connected: true,
        latest_block_number,
        latest_block_slot,
        latest_block_time,
        total_blocks,
        latest_epoch,
        sync_progress,
    })
}

// Database statistics queries
pub async fn get_database_stats(pool: &PgPool) -> Result<DatabaseStats> {
    // Check connection
    let connected = sqlx::query("SELECT 1")
        .execute(pool)
        .await
        .is_ok();

    // Get database name
    let database_name: String = sqlx::query_as::<_, (String,)>(
        "SELECT current_database()"
    )
    .fetch_one(pool)
    .await
    .map(|(name,)| name)
    .unwrap_or_else(|_| "unknown".to_string());

    // Get database size
    let database_size_bytes: Option<i64> = sqlx::query_as::<_, (i64,)>(
        "SELECT pg_database_size(current_database())"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|(size,)| size);

    // Get table count
    let total_tables: Option<i32> = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|(count,)| count as i32);

    // Get total row count (sum across all tables)
    let total_rows: Option<i64> = sqlx::query_as::<_, (Option<i64>,)>(
        "SELECT SUM(n_live_tup) FROM pg_stat_user_tables"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .and_then(|(sum,)| sum);

    // Get per-table statistics
    let table_rows: Vec<(String, i64, i64)> = sqlx::query_as::<_, (String, i64, i64)>(
        r#"
        SELECT 
            tablename,
            COALESCE(n_live_tup, 0)::bigint as row_count,
            pg_total_relation_size(schemaname||'.'||tablename) as table_size
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
        "#
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Get column counts per table
    let column_counts: Vec<(String, i32)> = sqlx::query_as::<_, (String, i64)>(
        r#"
        SELECT 
            table_name,
            COUNT(*)::bigint as column_count
        FROM information_schema.columns
        WHERE table_schema = 'public'
        GROUP BY table_name
        "#
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|(name, count)| (name, count as i32))
    .collect();

    // Combine table stats
    let mut table_details = Vec::new();
    let mut column_map: std::collections::HashMap<String, i32> = column_counts.into_iter().collect();

    for (table_name, row_count, table_size) in table_rows {
        let column_count = column_map.remove(&table_name);
        table_details.push(TableStats {
            table_name,
            row_count: Some(row_count),
            column_count,
            table_size_bytes: Some(table_size),
        });
    }

    // Add tables that have columns but no rows yet
    for (table_name, column_count) in column_map {
        table_details.push(TableStats {
            table_name,
            row_count: Some(0),
            column_count: Some(column_count),
            table_size_bytes: None,
        });
    }

    Ok(DatabaseStats {
        connected,
        database_name,
        database_size_bytes,
        total_tables,
        total_rows,
        connection_pool_size: None, // Will be set by Database wrapper
        active_connections: None,    // Will be set by Database wrapper
        table_details,
    })
}

// Enhanced indexer health query
pub async fn get_indexer_health(pool: &PgPool) -> Result<IndexerHealth> {
    // Check connection
    let connected = sqlx::query("SELECT 1")
        .execute(pool)
        .await
        .is_ok();

    if !connected {
        return Ok(IndexerHealth {
            connected: false,
            is_syncing: false,
            latest_block_number: None,
            latest_block_time: None,
            total_blocks: None,
            latest_epoch: None,
            blocks_last_hour: None,
            blocks_last_day: None,
            sync_rate_per_minute: None,
            last_sync_ago_seconds: None,
            status: IndexerStatus::Stopped,
        });
    }

    // Check if block table exists
    let block_table_exists: bool = sqlx::query_as::<_, (bool,)>(
        "SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'block'
        )"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|(exists,)| exists)
    .unwrap_or(false);

    if !block_table_exists {
        return Ok(IndexerHealth {
            connected: true,
            is_syncing: false,
            latest_block_number: None,
            latest_block_time: None,
            total_blocks: None,
            latest_epoch: None,
            blocks_last_hour: None,
            blocks_last_day: None,
            sync_rate_per_minute: None,
            last_sync_ago_seconds: None,
            status: IndexerStatus::Stopped,
        });
    }

    // Get latest block information - try multiple column name patterns
    let latest_block = {
        // Try pattern 1: block_no, time (common Yaci Store pattern)
        match sqlx::query_as::<_, (Option<i64>, Option<i64>)>(
            "SELECT block_no, time FROM block ORDER BY block_no DESC LIMIT 1"
        )
        .fetch_optional(pool)
        .await
        {
            Ok(Some(result)) => Some(result),
            _ => {
                // Try pattern 2: number, block_time
                match sqlx::query_as::<_, (Option<i64>, Option<i64>)>(
                    "SELECT number, block_time FROM block ORDER BY number DESC LIMIT 1"
                )
                .fetch_optional(pool)
                .await
                {
                    Ok(Some(result)) => Some(result),
                    _ => {
                        // Try pattern 3: COALESCE approach
                        sqlx::query_as::<_, (Option<i64>, Option<i64>)>(
                            r#"
                            SELECT 
                                COALESCE(block_no, number)::bigint,
                                COALESCE(time, block_time)::bigint
                            FROM block 
                            ORDER BY COALESCE(block_no, number) DESC 
                            LIMIT 1
                            "#
                        )
                        .fetch_optional(pool)
                        .await
                        .ok()
                        .flatten()
                    }
                }
            }
        }
    };

    let (latest_block_number, latest_block_time) = latest_block.unwrap_or((None, None));

    // Get total block count
    let total_blocks: Option<i64> = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*)::bigint FROM block"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|(count,)| count);

    // Get latest epoch - check if epoch table exists
    let epoch_table_exists: bool = sqlx::query_as::<_, (bool,)>(
        "SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'epoch'
        )"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|(exists,)| exists)
    .unwrap_or(false);

    let latest_epoch = if epoch_table_exists {
        let epoch_from_table = sqlx::query_as::<_, (Option<i32>,)>(
            "SELECT MAX(COALESCE(no, number)) FROM epoch"
        )
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|(epoch,)| epoch);
        
        // Fallback to block.epoch if epoch table query returned None
        if epoch_from_table.is_some() {
            epoch_from_table
        } else {
            sqlx::query_as::<_, (Option<i32>,)>(
                "SELECT MAX(epoch) FROM block WHERE epoch IS NOT NULL"
            )
            .fetch_optional(pool)
            .await
            .ok()
            .flatten()
            .and_then(|(epoch,)| epoch)
        }
    } else {
        sqlx::query_as::<_, (Option<i32>,)>(
            "SELECT MAX(epoch) FROM block WHERE epoch IS NOT NULL"
        )
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|(epoch,)| epoch)
    };

    // Get blocks synced in last hour - handle different time column names
    let blocks_last_hour: Option<i64> = match sqlx::query_as::<_, (i64,)>(
        r#"
        SELECT COUNT(*)::bigint 
        FROM block 
        WHERE (
            CASE 
                WHEN time IS NOT NULL THEN to_timestamp(time / 1000) > NOW() - INTERVAL '1 hour'
                WHEN block_time IS NOT NULL THEN to_timestamp(block_time / 1000) > NOW() - INTERVAL '1 hour'
                ELSE false
            END
        )
        "#
    )
    .fetch_optional(pool)
    .await
    {
        Ok(Some((count,))) => Some(count),
        _ => {
            // Fallback: try simpler query with block_time
            sqlx::query_as::<_, (i64,)>(
                "SELECT COUNT(*)::bigint FROM block WHERE to_timestamp(block_time / 1000) > NOW() - INTERVAL '1 hour'"
            )
            .fetch_optional(pool)
            .await
            .ok()
            .flatten()
            .map(|(count,)| count)
        }
    };

    // Get blocks synced in last day
    let blocks_last_day: Option<i64> = match sqlx::query_as::<_, (i64,)>(
        r#"
        SELECT COUNT(*)::bigint 
        FROM block 
        WHERE (
            CASE 
                WHEN time IS NOT NULL THEN to_timestamp(time / 1000) > NOW() - INTERVAL '1 day'
                WHEN block_time IS NOT NULL THEN to_timestamp(block_time / 1000) > NOW() - INTERVAL '1 day'
                ELSE false
            END
        )
        "#
    )
    .fetch_optional(pool)
    .await
    {
        Ok(Some((count,))) => Some(count),
        _ => {
            sqlx::query_as::<_, (i64,)>(
                "SELECT COUNT(*)::bigint FROM block WHERE to_timestamp(block_time / 1000) > NOW() - INTERVAL '1 day'"
            )
            .fetch_optional(pool)
            .await
            .ok()
            .flatten()
            .map(|(count,)| count)
        }
    };

    // Calculate sync rate (blocks per minute)
    let sync_rate_per_minute = blocks_last_hour.map(|blocks| blocks as f64 / 60.0);

    // Calculate time since last sync
    let last_sync_ago_seconds = latest_block_time.and_then(|block_time| {
        // block_time is Unix timestamp in milliseconds
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .ok()?
            .as_secs() as i64;
        let block_time_secs = block_time / 1000;
        Some(now - block_time_secs)
    });

    // Determine indexer status
    let status = if let Some(ago_seconds) = last_sync_ago_seconds {
        if ago_seconds < 300 {
            // Synced within last 5 minutes - Active
            IndexerStatus::Active
        } else if ago_seconds < 3600 {
            // Synced within last hour but > 5 minutes - Stale
            IndexerStatus::Stale
        } else {
            // No sync in last hour - Stopped
            IndexerStatus::Stopped
        }
    } else {
        IndexerStatus::Stopped
    };

    let is_syncing = matches!(status, IndexerStatus::Active) && blocks_last_hour.unwrap_or(0) > 0;

    Ok(IndexerHealth {
        connected: true,
        is_syncing,
        latest_block_number,
        latest_block_time,
        total_blocks,
        latest_epoch,
        blocks_last_hour,
        blocks_last_day,
        sync_rate_per_minute,
        last_sync_ago_seconds,
        status,
    })
}
