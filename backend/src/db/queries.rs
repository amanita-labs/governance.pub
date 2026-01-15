use crate::models::*;
use sqlx::PgPool;
use anyhow::Result;

// NOTE: These queries are placeholders based on expected Yaci Store schema.
// The actual table names, column names, and schema structure MUST be verified
// by inspecting the Yaci Store database after it's set up and synced.
// 
// Expected tables (to be verified):
// - drep_registration (or similar)
// - governance_action (or similar)
// - vote (or similar)
// - stake_delegation (or similar)
// - stake_address (or similar)
// - epoch (or similar)
//
// These functions will need to be implemented with actual SQL queries
// once the database schema is known.

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
    
    // Build WHERE clause
    let mut where_clauses = Vec::new();
    let mut params: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync>> = Vec::new();
    
    // Status filter
    if !query.statuses.is_empty() {
        let statuses = query.statuses.iter()
            .map(|s| s.to_lowercase())
            .collect::<Vec<_>>();
        where_clauses.push(format!("LOWER(status) = ANY(${}::text[])", params.len() + 1));
        params.push(Box::new(statuses));
    }
    
    // Search filter
    if let Some(search) = &query.search {
        let search_pattern = format!("%{}%", search);
        where_clauses.push(format!(
            "(drep_id ILIKE ${} OR view ILIKE ${} OR hex ILIKE ${})",
            params.len() + 1, params.len() + 1, params.len() + 1
        ));
        params.push(Box::new(search_pattern.clone()));
        params.push(Box::new(search_pattern.clone()));
        params.push(Box::new(search_pattern));
    }
    
    let where_clause = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };
    
    // Build ORDER BY
    let order_by = match query.sort.as_deref() {
        Some("voting_power") | Some("VotingPower") => {
            match query.direction.as_deref() {
                Some("asc") | Some("Ascending") => "voting_power_active ASC NULLS LAST",
                _ => "voting_power_active DESC NULLS LAST",
            }
        }
        Some("epoch") | Some("Epoch") => {
            match query.direction.as_deref() {
                Some("asc") | Some("Ascending") => "active_epoch ASC NULLS LAST",
                _ => "active_epoch DESC NULLS LAST",
            }
        }
        _ => "voting_power_active DESC NULLS LAST",
    };
    
    let sql = format!(
        "SELECT drep_id, hex, view, anchor_url, anchor_hash, voting_power, 
                voting_power_active, amount, status, active, active_epoch, 
                last_active_epoch, has_script, retired, expired, 
                registration_tx_hash, registration_epoch
         FROM drep_registration
         {}
         ORDER BY {}
         LIMIT ${} OFFSET ${}",
        where_clause,
        order_by,
        params.len() + 1,
        params.len() + 2
    );
    
    // Note: This is a simplified version. Actual implementation needs proper parameter binding.
    // For now, using a placeholder that will need to be adjusted based on sqlx query builder.
    
    // Count query for total
    let count_sql = format!(
        "SELECT COUNT(*) FROM drep_registration {}",
        where_clause
    );
    
    // Placeholder implementation - will need proper sqlx query building
    Ok(DRepsPage {
        dreps: Vec::new(),
        has_more: false,
        total: None,
    })
}

pub async fn get_drep(pool: &PgPool, id: &str) -> Result<Option<DRep>> {
    // Placeholder - will implement with actual query
    Ok(None)
}

pub async fn get_drep_delegators(pool: &PgPool, drep_id: &str) -> Result<Vec<DRepDelegator>> {
    // Placeholder - will implement with actual query
    Ok(Vec::new())
}

pub async fn get_drep_voting_history(pool: &PgPool, drep_id: &str) -> Result<Vec<DRepVotingHistory>> {
    // Placeholder - will implement with actual query
    Ok(Vec::new())
}

pub async fn get_governance_actions_page(
    pool: &PgPool,
    page: u32,
    count: u32,
) -> Result<ActionsPage> {
    // Placeholder - will implement with actual query
    Ok(ActionsPage {
        actions: Vec::new(),
        has_more: false,
        total: None,
    })
}

pub async fn get_governance_action(pool: &PgPool, action_id: &str) -> Result<Option<GovernanceAction>> {
    // Placeholder - will implement with actual query
    Ok(None)
}

pub async fn get_action_voting_results(
    pool: &PgPool,
    action_id: &str,
) -> Result<ActionVotingBreakdown> {
    // Placeholder - will implement with actual query
    Ok(ActionVotingBreakdown::default())
}

pub async fn get_stake_delegation(
    pool: &PgPool,
    stake_address: &str,
) -> Result<Option<StakeDelegation>> {
    // Placeholder - will implement with actual query
    Ok(None)
}

pub async fn get_total_active_dreps(pool: &PgPool) -> Result<Option<u32>> {
    // Placeholder - will implement with actual query
    Ok(None)
}

pub async fn get_epoch_start_time(pool: &PgPool, epoch: u32) -> Result<Option<u64>> {
    // Placeholder - will implement with actual query
    Ok(None)
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
    
    // Get latest block information
    let latest_block = sqlx::query_as::<_, (Option<i64>, Option<i64>, Option<i64>)>(
        "SELECT number, slot, block_time FROM block ORDER BY number DESC LIMIT 1"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    
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
    
    // Get latest epoch (try epoch table first, fallback to block.epoch)
    let latest_epoch_from_table: Option<i32> = sqlx::query_as::<_, (Option<i32>,)>(
        "SELECT MAX(number) FROM epoch"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .and_then(|(epoch,)| epoch);
    
    // If epoch table is empty, get from block table
    let latest_epoch = if latest_epoch_from_table.is_some() {
        latest_epoch_from_table
    } else {
        sqlx::query_as::<_, (Option<i32>,)>(
            "SELECT MAX(epoch) FROM block"
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
            Some(format!("Block {} of {} synced", block_num, total))
        } else {
            Some("Initializing...".to_string())
        }
    } else {
        Some("Not synced yet".to_string())
    };
    
    Ok(SyncStatus {
        connected,
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

    // Get latest block information
    let latest_block = sqlx::query_as::<_, (Option<i64>, Option<i64>)>(
        "SELECT number, block_time FROM block ORDER BY number DESC LIMIT 1"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

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

    // Get latest epoch
    let latest_epoch_from_table: Option<i32> = sqlx::query_as::<_, (Option<i32>,)>(
        "SELECT MAX(number) FROM epoch"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .and_then(|(epoch,)| epoch);

    let latest_epoch = if latest_epoch_from_table.is_some() {
        latest_epoch_from_table
    } else {
        sqlx::query_as::<_, (Option<i32>,)>(
            "SELECT MAX(epoch) FROM block"
        )
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|(epoch,)| epoch)
    };

    // Get blocks synced in last hour
    // block_time is stored as bigint (Unix timestamp in milliseconds)
    // Convert to timestamp: to_timestamp(block_time / 1000) converts milliseconds to seconds
    let blocks_last_hour: Option<i64> = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*)::bigint FROM block WHERE to_timestamp(block_time / 1000) > NOW() - INTERVAL '1 hour'"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|(count,)| count);

    // Get blocks synced in last day
    let blocks_last_day: Option<i64> = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*)::bigint FROM block WHERE to_timestamp(block_time / 1000) > NOW() - INTERVAL '1 day'"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|(count,)| count);

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
        connected,
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
