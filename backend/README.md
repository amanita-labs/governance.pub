# GovTwool Backend

Rust backend service that provides a unified REST API for Cardano governance data using Yaci Store indexer.

## Features

- **Self-Hosted Indexer**: Uses Yaci Store for blockchain indexing (no dependency on external APIs)
- **PostgreSQL Database**: Direct database queries for high performance
- **Type Safety**: Strong typing with Rust's type system
- **High Performance**: Async runtime with Tokio and connection pooling
- **Caching**: In-memory caching layer for frequently accessed data
- **Metadata Validation**: Optional Cardano Verifier API integration
- **DRep Enrichment**: Optional GovTools integration for enhanced DRep metadata

## Setup

### Prerequisites

- **Rust 1.70+** (stable toolchain)
- **Cargo** (comes with Rust)
- **PostgreSQL Database**: Yaci Store database must be running and accessible
- **Yaci Store Indexer**: Must be running and synced (see `indexer/README.md`)

### Installation

1. Install Rust toolchain (if not already installed):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Ensure Yaci Store indexer is running and database is accessible (see `indexer/README.md`)

3. Create a `.env` file in `backend/` with the required configuration:
```env
# Required: Database connection
DATABASE_URL=postgresql://postgres:password@localhost:5432/yaci_store

# Optional: Server configuration
PORT=8080

# Optional: Network configuration (used for GovTools URL selection)
CARDANO_NETWORK=preview  # Options: mainnet, preview, preprod

# Optional: Cache configuration
CACHE_ENABLED=true
CACHE_MAX_ENTRIES=10000

# Optional: GovTools enrichment
GOVTOOLS_ENABLED=false
GOVTOOLS_BASE_URL=https://be.preview.gov.tools

# Optional: Metadata validation
CARDANO_VERIFIER_ENABLED=false
```

4. Configuration options:
   - `DATABASE_URL`: PostgreSQL connection string (required)
   - `PORT`: Server port (defaults to `8080`)
   - `CARDANO_NETWORK`: Network identifier for GovTools URL selection (defaults to `mainnet`)
   - `CACHE_ENABLED`: Toggle in-memory caching (default `true`)
   - `CACHE_MAX_ENTRIES`: Cache size limit (default `10000`)
   - `GOVTOOLS_ENABLED`: Toggle GovTools enrichment (default `false` for unsupported networks)
   - `CARDANO_VERIFIER_ENABLED`: Toggle metadata validation (default `false`)

> **Note:** The backend uses Yaci Store as the sole data source. All governance data is queried directly from the PostgreSQL database populated by the Yaci Store indexer.

## Development

### Run the backend:

```bash
cd backend
cargo run
```

Keep the backend running in its own terminal and start the frontend separately from `frontend/` with `npm run dev`.

## API Endpoints

For detailed API documentation, see [API.md](./API.md).

### Quick Reference

**DRep Endpoints:**
- `GET /api/dreps` - Get paginated DRep list
- `GET /api/dreps/stats` - Get DRep statistics
- `GET /api/dreps/:id` - Get single DRep details
- `GET /api/dreps/:id/delegators` - Get DRep delegators
- `GET /api/dreps/:id/votes` - Get DRep voting history
- `GET /api/dreps/:id/metadata` - Get DRep metadata

**Governance Action Endpoints:**
- `GET /api/actions` - Get paginated governance actions
- `GET /api/actions/:id` - Get single governance action
- `GET /api/actions/:id/votes` - Get action voting results

**Stake Endpoints:**
- `GET /api/stake/:stake_address/delegation` - Retrieve pool, DRep, and balance information for a stake address

**Health Check:**
- `GET /health` - Health check endpoint with cache statistics

## Architecture

The backend queries Yaci Store's PostgreSQL database directly for all governance data:

- **DRep Data**: Queries `drep_registration` table, joins with `local_drep_dist` for voting power
- **Governance Actions**: Queries `gov_action_proposal` table, joins with `local_gov_action_proposal_status` for status
- **Votes**: Queries `voting_procedure` table with joins to governance actions
- **DRep Delegations**: Queries `delegation_vote` table for DRep delegations
- **Pool Delegations**: Queries `delegation` table for stake pool delegations
- **Stake Balances**: Queries `stake_address_balance` table for current balances
- **Epoch Data**: Queries `epoch` table for epoch start times and information

**Important**: The database uses schema separation by network. For Preview network, all tables are in the `preview` schema. The backend automatically sets `search_path` to `preview, public` when connecting.

All queries are optimized with proper indexing and connection pooling.

### Data Flow

```
┌─────────────────┐
│   Frontend      │
│   (Next.js)     │
└────────┬────────┘
         │ HTTP/REST API
         ▼
┌─────────────────┐
│  Backend API    │
│  (Rust/Axum)    │
│  ┌───────────┐  │
│  │  Cache    │  │
│  └───────────┘  │
└────────┬────────┘
         │ SQL Queries
         ▼
┌─────────────────┐      ┌─────────────────┐
│  PostgreSQL     │◄─────│  Yaci Store     │
│  Database       │      │  Indexer        │
└─────────────────┘      └─────────────────┘
```

### Code Structure

```
backend/
├── src/
│   ├── main.rs              # Server entry point
│   ├── config.rs            # Configuration management
│   ├── db/                  # Database layer
│   │   ├── mod.rs           # Database connection pool
│   │   └── queries.rs       # SQL queries
│   ├── api/                 # REST API handlers
│   │   ├── mod.rs
│   │   ├── dreps.rs
│   │   ├── actions.rs
│   │   ├── health.rs
│   │   └── stake.rs
│   ├── providers/           # Provider layer
│   │   ├── mod.rs
│   │   ├── yaci_store.rs           # Yaci Store provider
│   │   ├── yaci_store_router.rs    # Yaci Store router
│   │   ├── cached_router.rs        # Caching wrapper
│   │   ├── router_trait.rs         # Router trait
│   │   └── govtools.rs             # GovTools enrichment (optional)
│   ├── services/            # Business logic services
│   │   ├── mod.rs
│   │   └── metadata_validation.rs
│   ├── models/              # Data models
│   │   ├── mod.rs
│   │   ├── drep.rs
│   │   ├── action.rs
│   │   ├── common.rs
│   │   ├── participation.rs
│   │   └── stake.rs
│   ├── cache/               # Caching layer
│   │   ├── mod.rs
│   │   └── keys.rs
│   └── utils/               # Utility functions
│       ├── mod.rs
│       ├── bech32.rs
│       ├── drep_id.rs       # CIP-105/CIP-129 conversions
│       └── proposal_id.rs
└── Cargo.toml
```

## Building for Production

```bash
cd backend
cargo build --release
```

The binary will be in `target/release/govtwool-backend`.

## License

Apache License 2.0

