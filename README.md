# govtwool -- 2025 summit hackathon entry

Team insects entry for the 2025 LayerUp hackathon -- Gov**Two**ol (get it?)

## Why did we build this?

- There are some cool features and standards which existing governance tooling has not implemented
- We felt we have experience in governance tools, and could produce something okay in the time

### Nice features

These are features of GovtWool
which are not widely present in current governance tooling offerings.

- Sheep theme
- Night mode / light mode
- Overall tried to provide a lot of information in an approachable way

#### Governance Action Explorer

- Differentiates 'budget' governance actions from Info actions
- Detailed voting summary
- Detailed metadata validation summary
  - hash checks
  - warning if author not using ipfs
  - author witness validation
  - CIP-???? | On-chain effects implementation

#### DRep Directory

- Voting and delegator history

### Bad bits

- Data sources, we are getting data from like three different sources, this is annoying and bad.

## Access

For ease, we have hosted it at
- https://govtwool.vercel.app

Using Render to host the backend.

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
git clone https://github.com/Ryun1/govtwool
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