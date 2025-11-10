# GovTwool Backend

Rust backend service that abstracts Cardano data provider complexity (Blockfrost and Koios) behind a unified REST API.

## Features

- **Provider Abstraction**: Unified interface for Blockfrost, Koios, and GovTools APIs (mainnet & preview)
- **Smart Routing**: Automatically selects the best provider for each operation type
- **Automatic Fallback**: Gracefully falls back to alternative providers on failure
- **Type Safety**: Strong typing with Rust's type system
- **High Performance**: Async runtime with Tokio
- **Stake Insights**: Unified stake delegation endpoint with pool, DRep, and balance data

## Setup

### Prerequisites

- **Rust 1.70+** (stable toolchain)
- **Cargo** (comes with Rust)

### Installation

1. Install Rust toolchain (if not already installed):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Create a `.env` file in `backend/` with the required configuration:
```env
BLOCKFROST_API_KEY=your_blockfrost_project_id_here
BLOCKFROST_NETWORK=preview
KOIOS_BASE_URL=https://preview.koios.rest/api/v1
GOVTOOLS_BASE_URL=https://be.gov.tools
GOVTOOLS_ENABLED=false
CACHE_ENABLED=true
CACHE_MAX_ENTRIES=10000
BACKEND_PORT=8080
# Optional: CORS_ORIGINS=https://app.yourdomain.com,https://staging.yourdomain.com
```

3. Adjust values as needed:
   - `BLOCKFROST_API_KEY`: Required Blockfrost project ID
   - `BLOCKFROST_NETWORK`: `mainnet`, `preview`, or `preprod` (defaults to `mainnet` if unset)
   - `KOIOS_BASE_URL`: Koios API base URL (defaults to https://preview.koios.rest/api/v1)
   - `GOVTOOLS_BASE_URL`: GovTools enrichment API (defaults to https://be.gov.tools)
   - `GOVTOOLS_ENABLED`: Toggle GovTools enrichment (`true`/`false`, **auto-disabled for non-mainnet**)
   - `CACHE_ENABLED`: Toggle in-memory caching (`true`/`false`, default `true`)
   - `CACHE_MAX_ENTRIES`: Cache size limit (default `10000`)
   - `BACKEND_PORT`: Server port for local runs (defaults to `8080`; Render sets `PORT`)
   - `CORS_ORIGINS`: Comma-separated list of allowed origins (optional; wildcard by default)

> **⚠️ Network Note:** GovTools currently supports mainnet and preview. The backend auto-selects `https://be.gov.tools` for mainnet and `https://be.preview.gov.tools` for preview; other networks default to disabled unless you explicitly configure `GOVTOOLS_ENABLED=true` and provide a `GOVTOOLS_BASE_URL`.

> **Note:** The current CORS configuration allows all origins when no override is provided. Fine-grained origin control will honour `CORS_ORIGINS` as the gateway hardening work progresses.

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

## Provider Routing Strategy

The backend implements smart routing with automatic fallback:

- **DRep list**: Tries Koios first (faster bulk queries), falls back to Blockfrost
- **DRep details**: Uses Blockfrost (more complete metadata)
- **DRep delegators**: Tries Koios first (specialized endpoint), falls back to Blockfrost
- **DRep voting history**: Tries Koios first (specialized endpoint), falls back to Blockfrost
- **Governance actions list**: Tries Koios first, falls back to Blockfrost
- **Governance action details**: Uses Blockfrost (more complete)
- **Voting results**: Tries Koios first (specialized), falls back to Blockfrost
- **Active DReps count**: Uses Koios epoch summary
- **Stake delegation lookups**: Tries Koios first, falls back to Blockfrost

## Architecture

```
backend/
├── src/
│   ├── main.rs          # Server entry point
│   ├── config.rs        # Configuration management
│   ├── api/             # REST API handlers
│   │   ├── dreps.rs
│   │   ├── actions.rs
│   │   └── health.rs
│   ├── providers/       # Provider abstraction layer
│   │   ├── blockfrost.rs
│   │   ├── koios.rs
│   │   └── router.rs    # Smart routing logic
│   ├── models/          # Data models
│   │   ├── drep.rs
│   │   ├── action.rs
│   │   └── common.rs
│   └── utils/           # Utility functions
│       ├── bech32.rs
│       ├── drep_id.rs   # CIP-105/CIP-129 conversions
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

