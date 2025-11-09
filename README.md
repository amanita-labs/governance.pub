# govtwool -- 2025 summit hackathon entry

Team insects entry for the 2025 LayerUp hackathon -- Gov**Two**ol (get it?)

<p align="center">
  <img width="750" src="./logo.png"/>
</p>

## About

GovTwool is a playful Cardano governance companion that makes participating in on-chain governance fun and intuitive. Built around a delightful sheep-in-a-field theme, it provides an easy-to-use experience for:

- **Exploring DReps** with detailed statistics, voting history, and metadata
- **Tracking Governance Actions** through timelines, heatmaps, and outcome summaries
- **Delegating Voting Power or Registering as a DRep** using guided flows and wallet integration
- **Inspecting Stake Delegations** with live insights into pool, DRep, and reward balances

## Highlights

- 🐑 **Delightful Theme** – Lighthearted visuals keep Cardano governance approachable
- 📊 **Rich Visualizations** – Heatmaps, charts, and timelines surface governance insights
- 🔗 **Wallet Integration** – Mesh SDK-powered support for popular Cardano wallets
- 🛰️ **Smart Backend Routing** – Rust backend unifies Blockfrost, Koios, and GovTools data
- 🚀 **Caching & Fallbacks** – High-performance API with automatic provider failover
- 🔍 **Stake Intelligence** – Stake address lookups show live delegation and balance data

## Tech Stack

**Frontend**
- Next.js 16 (App Router) with TypeScript
- Tailwind CSS + custom component primitives
- Mesh SDK for wallet connectivity and transaction building
- Recharts & bespoke visualizations for governance data
- Framer Motion for premium interactions

**Backend**
- Rust (Axum + Tokio) service with layered provider abstraction
- Integrations with Blockfrost, Koios, and GovTools APIs
- Moka-powered caching and provider failover strategy
- Flexible deployment via Render, Railway, or any standard Rust host

## Setup

### Prerequisites

- **Node.js 20.9.0+** (Next.js 16 requires Node 20.9.0 or newer; Node 22 LTS recommended)
- **Rust 1.75+** with `cargo` (install via [rustup.rs](https://rustup.rs))
- A **Blockfrost API key** for Cardano network access

### Local Development

```bash
git clone <repository-url>
cd govtwool
```

#### Frontend (`frontend/`)

```bash
cd frontend
npm install

# Optional - create .env.local
cat <<'EOF' > .env.local
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_NETWORK=preview
EOF

npm run dev
```

The frontend defaults to `http://localhost:8080` if `NEXT_PUBLIC_BACKEND_URL` is not set, so the `.env.local` step is optional for local work.

#### Backend (`backend/`)

```bash
cd backend
cargo fetch  # optional warm-up

cat <<'EOF' > .env
BLOCKFROST_API_KEY=your_blockfrost_project_id_here
BLOCKFROST_NETWORK=preview
KOIOS_BASE_URL=https://preview.koios.rest/api/v1
GOVTOOLS_BASE_URL=https://be.preview.gov.tools
GOVTOOLS_ENABLED=true
CACHE_ENABLED=true
CACHE_MAX_ENTRIES=10000
BACKEND_PORT=8080
EOF

cargo run
```

Environment variables such as `BLOCKFROST_API_KEY`, `GOVTOOLS_ENABLED`, and `CORS_ORIGINS` can be tuned as described in `backend/README.md`.

#### Access

- Frontend: http://localhost:3000
- Backend API: http://localhost:8080 (see `backend/API.md` for endpoints)

### Production Builds

- **Frontend:** `cd frontend && npm run build && npm run start`
- **Backend:** `cd backend && cargo build --release && ./target/release/govtwool-backend`

Refer to `docs/DEPLOYMENT_SETUP.md` for Render + Vercel CI/CD guidance.

## Project Structure

This is a monorepo with separate frontend and backend directories:

```
govtwool/
├── frontend/              # Next.js frontend application
│   ├── app/              # Next.js app router pages
│   │   ├── actions/      # Governance actions pages
│   │   ├── dreps/        # DRep pages
│   │   ├── delegate/     # Delegation page
│   │   ├── register-drep/# DRep registration page
│   │   └── api/          # API routes
│   ├── components/       # React components
│   │   ├── ui/           # Base UI components
│   │   └── ...           # Feature components
│   ├── lib/              # Utility libraries (API helpers, governance utilities, formatting)
│   │   ├── api/          # Backend API client + Mesh utilities
│   │   ├── governance/   # Governance calculations and transaction builders
│   │   └── utils/        # Formatting helpers
│   ├── hooks/            # React hooks
│   ├── types/            # TypeScript types
│   └── package.json      # Frontend dependencies
├── backend/              # Rust backend service
│   ├── src/              # Rust source code
│   │   ├── api/          # API endpoints
│   │   ├── providers/    # Data provider abstractions + smart routing
│   │   ├── models/       # Data models
│   │   ├── cache/        # Caching layer
│   │   └── main.rs       # Application entry point
│   └── Cargo.toml        # Rust dependencies
├── package.json          # Root workspace configuration
└── README.md
```

## Usage Basics

- **Connect Wallet:** Use the navigation bar button to connect Mesh-supported wallets (Nami, Eternl, Flint, etc.)
- **Discover DReps:** `/dreps` lists DReps with stats, delegators, votes, and metadata
- **Review Governance Actions:** `/actions` provides paginated proposals with voting breakdowns
- **Delegate Voting Rights:** `/delegate` walks through delegation and transaction signing
- **Register as a DRep:** `/register-drep` guides metadata creation and registration transactions
- **Check Stake Delegations:** `/stake/[stake_address]` (or via API) reveals live delegation details

## Documentation Index

- `backend/README.md` – backend configuration, environment variables, and provider routing
- `backend/API.md` – full REST API reference (DReps, Governance Actions, Stake)
- `docs/DEPLOYMENT_SETUP.md` – Render + Vercel CI/CD workflow instructions
- `frontend/ENV_VARIABLES.md` – frontend runtime configuration guide
- `docs/UI_UX_RESEARCH_AND_MODERNIZATION_PLAN.md` – UX modernization roadmap

## License

Apache License 2.0
