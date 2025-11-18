# govtWool 🐏

The cosiest Cardano governance interface.

Built by [@Ryun1](https://github.com/Ryun1) & [@elenabardho](https://github.com/elenabardho) originally for the 2025 Cardano Summit LayerUp hackathon.

## Motivation

There are a few fully featured governance interface tools in the ecosystem.
There has been a lot of community feedback on these tools.

We wanted to build a new governance interface tool,
which *hopefully* addresses some of the community feedback.

Additionally, we wanted a tool we could use to quickly implement newer governance
standards or ideas, to test them out.

### Why Us?

We have experience using and building Cardano governance tools.

### Aims for the project

Build a governance interface tool which;

- offers strong UI UX -- the governance model is complex, we want to present it in an approachable way
- is fully featured -- offers full support for browsing governance data, DRep and Ada holder interactions
- offers newer governance standards -- new standards are proposed but lacking adoption i.e. [CIP-149](https://github.com/cardano-foundation/CIPs/tree/master/CIP-0149), [CIP-169?](https://github.com/cardano-foundation/CIPs/pull/1101)

### Features

#### Key Features

- Wooly theme
- meme generator
- CIP-169
- CIP-149

#### Governance Action Explorer

- Clear timeline view of governance action lifetime
- Generate memes
- Differentiates 'budget' governance actions from Info actions
- Detailed metadata validation
  - hash checks
  - warning if author not using IPFS to host metadata
  - author witness validation
  - CIP-0169? | On-chain effects implementation
- Detailed voter participation tab with export to CSV
- Detailed voting tally summary

#### DRep Directory

- Full DRep metadata rendering
- generate memes
- Voting and delegator history
- Detailed voting statistics

#### Governance Interaction

- Wallet connect
- DRep registration
- DRep Update
- DRep retirement
- Vote delegation

### Features we would like to add

- Get user feedback on UI UX
- Global governance search
- Properly connect all DRep and governance action filters
- Create a custom backend to stop reliance on data services
- Deep governance analytics
- Governance action submission

## Tech Stack

### Frontend

- Next.js 16 with TypeScript
- Tailwind CSS + custom component primitives
- Mesh SDK for wallet connectivity and transaction building
- Recharts & bespoke visualizations for governance data
- Framer Motion for premium interactions

### Backend

- Rust (Axum + Tokio) service with layered provider abstraction
- Integrations with Blockfrost, Koios, and GovTools APIs
- Moka-powered caching and provider failover strategy

## Setup

### Prerequisites

- **Node.js 20.9.0+**
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
```

Fill in your `.env`, you can use the example.

```bash
npm run dev
```

#### Backend (`backend/`)

```bash
cd backend
cargo fetch
```

Fill in your `.env`, you can use the example.

```
cargo run
```

Environment variables such as `BLOCKFROST_API_KEY`, `GOVTOOLS_ENABLED`, and `CORS_ORIGINS` can be tuned as described in `backend/README.md`.

#### Access

- Frontend: http://localhost:3000
- Backend API: http://localhost:8080 (see `backend/API.md` for endpoints)
