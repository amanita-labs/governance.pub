# govtwool -- 2025 summit hackathon entry

Team insects entry for the 2025 LayerUp hackathon -- Gov**Two**ol (get it?)

<p align="center">
  <img width="750" src="./logo.png"/>
</p>

## About

GovTwool is a playful Cardano governance application that makes participating in on-chain governance fun and intuitive. Built with Next.js 16.0.0, featuring a delightful sheep-in-a-field theme, it provides an easy-to-use interface for:

- **Browsing DReps** - Explore Delegated Representatives with detailed statistics and voting history
- **Viewing Governance Actions** - Track live and past governance proposals with voting results
- **Delegating Voting Rights** - Delegate your voting power to a DRep of your choice
- **Registering as DRep** - Become a Delegated Representative and participate in governance

## Features

- 🐑 **Playful Sheep Theme** - A lighthearted interface that makes governance accessible
- 📊 **Advanced Visualizations** - Heatmaps, timelines, and charts for governance data
- 🔗 **Wallet Integration** - Connect with popular Cardano wallets (Nami, Eternl, Flint, etc.)
- 📈 **Real-time Data** - Live governance data from Blockfrost API
- 🎨 **Beautiful UI/UX** - Intuitive design inspired by platforms like PolarisGov

## Tech Stack

**Frontend:**
- **Next.js 16.0.0** with Turbopack for fast development
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Mesh SDK** for wallet connection and transaction building
- **Recharts** for data visualization
- **Framer Motion** for animations

**Backend:**
- **Rust** with Axum web framework
- **Tokio** for async runtime
- **Moka** for high-performance caching
- **Blockfrost API** and **Koios API** for Cardano blockchain data
- Provider abstraction layer with smart routing

## Setup

### Prerequisites

- **Node.js 20.9.0 or higher** (Next.js 16 requires Node 20.9.0+)
  - Recommended: **Node.js 22.x LTS** for best compatibility
  - You can check your version with: `node --version`
  - Use [nvm](https://github.com/nvm-sh/nvm) to manage Node.js versions if needed
- npm or yarn
- Blockfrost API key ([Get one here](https://blockfrost.io/))

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd govtwool
```

2. Install dependencies:
```bash
npm install
```

3. Create environment files:

   **Frontend** - Create `frontend/.env.local`:
   ```env
   BLOCKFROST_API_KEY=your_blockfrost_project_id_here
   BLOCKFROST_NETWORK=mainnet
   ```
   
   **Backend** - Create `backend/.env`:
   ```env
   BLOCKFROST_API_KEY=your_blockfrost_project_id_here
   BLOCKFROST_NETWORK=mainnet
   KOIOS_BASE_URL=https://preview.koios.rest/api/v1
   BACKEND_PORT=8080
   CACHE_ENABLED=true
   CACHE_MAX_ENTRIES=10000
   ```
   
   Get your API key from [Blockfrost.io](https://blockfrost.io/).

4. Run the development servers:

   **Frontend only:**
   ```bash
   npm run dev
   # or
   cd frontend && npm run dev
   ```

   **Backend only:**
   ```bash
   npm run dev:backend
   # or
   cd backend && cargo run
   ```

   **Both frontend and backend:**
   ```bash
   npm run dev:all
   ```

5. Open [http://localhost:3000](http://localhost:3000) for frontend
   - Backend API runs on [http://localhost:8080](http://localhost:8080)

### Building for Production

**Frontend:**
```bash
npm run build
npm start
```

**Backend:**
```bash
npm run build:backend
cd backend && ./target/release/govtwool-backend
```

**Both:**
```bash
npm run build:all
```

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
│   ├── lib/              # Utility libraries
│   │   ├── blockfrost.ts # Blockfrost API client
│   │   ├── mesh.ts       # Mesh SDK utilities
│   │   └── transactions/ # Transaction builders
│   ├── hooks/            # React hooks
│   ├── types/            # TypeScript types
│   └── package.json      # Frontend dependencies
├── backend/              # Rust backend service
│   ├── src/              # Rust source code
│   │   ├── api/          # API endpoints
│   │   ├── providers/    # Data provider abstractions
│   │   ├── models/      # Data models
│   │   ├── cache/       # Caching layer
│   │   └── main.rs       # Application entry point
│   └── Cargo.toml        # Rust dependencies
├── package.json          # Root workspace configuration
└── README.md
```

## Usage

### Connect Your Wallet

1. Click the "Connect Wallet" button in the navigation
2. Select your preferred Cardano wallet
3. Approve the connection in your wallet

### Browse DReps

- Visit `/dreps` to see all Delegated Representatives
- Filter and search by name, status, or voting power
- Click on a DRep to see detailed statistics and voting history

### View Governance Actions

- Visit `/actions` to see all governance actions
- Filter by status, type, or search terms
- View heatmaps and timelines of governance activity
- Click on an action to see detailed voting results

### Delegate Voting Rights

1. Visit `/delegate`
2. Search and select a DRep
3. Review delegation details
4. Confirm the transaction in your wallet

### Register as DRep

1. Visit `/register-drep`
2. Fill in optional metadata (URL, anchor, etc.)
3. Confirm the registration transaction in your wallet

## CI/CD

This project uses GitHub Actions for continuous integration and deployment.

### Status
![CI](https://github.com/your-org/govtwool/workflows/CI/badge.svg)

### Quick CI Checks

Run these locally before pushing:

```bash
# Validate CI setup
./scripts/validate-ci.sh

# Run all CI checks
npm run lint
npx tsc --noEmit
npm run build
```

### Workflows

- **CI** (`ci.yml`): Runs on push/PR - Lints, type-checks, and builds
- **Code Quality** (`quality.yml`): Weekly quality audits and dependency checks
- **PR Checks** (`pr-checks.yml`): Enhanced checks for pull requests
- **Deploy** (`deploy.yml`): Manual deployment workflow

For detailed CI/CD documentation, see [CICD.md](./CICD.md).

## License

Apache License 2.0
