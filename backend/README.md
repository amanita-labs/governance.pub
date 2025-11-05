# GovTwool Backend

Rust backend service that abstracts Cardano data provider complexity (Blockfrost and Koios) behind a unified REST API.

## Features

- **Provider Abstraction**: Unified interface for Blockfrost and Koios APIs
- **Smart Routing**: Automatically selects the best provider for each operation type
- **Automatic Fallback**: Gracefully falls back to alternative providers on failure
- **Type Safety**: Strong typing with Rust's type system
- **High Performance**: Async runtime with Tokio

## Setup

### Prerequisites

- **Rust 1.70+** (stable toolchain)
- **Cargo** (comes with Rust)

### Installation

1. Install Rust toolchain (if not already installed):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Create `.env` file in the `backend/` directory:
```bash
cp .env.example .env
```

3. Edit `.env` and configure:
   - `BLOCKFROST_API_KEY`: Your Blockfrost project ID
   - `BLOCKFROST_NETWORK`: `mainnet` or `preview`
   - `KOIOS_BASE_URL`: Koios API base URL (default: https://preview.koios.rest/api/v1)
   - `BACKEND_PORT`: Server port (default: 8080)
   - `CORS_ORIGINS`: Allowed CORS origins (comma-separated)

## Development

### Run the backend:

```bash
cd backend
cargo run
```

Or from the project root:
```bash
npm run dev:backend
```

### Run both frontend and backend:

```bash
npm run dev:all
```

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

