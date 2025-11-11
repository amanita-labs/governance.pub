# Frontend Environment Variables

## Required Environment Variables

### 1. `NEXT_PUBLIC_BACKEND_URL` (Required in hosted environments)
- **Purpose**: Public URL of your Rust backend service (Render, Railway, Fly.io, etc.)
- **Example**: `https://your-backend-host.com`
- **Used in**: API route handlers (`frontend/app/api/**/route.ts`) and client components
- **Default**: Falls back to `http://localhost:8080` during local development if unset
- **Note**: Must have the `NEXT_PUBLIC_` prefix to be available in browser bundles

## Optional Environment Variables

### 1. `BACKEND_URL` (Server-only override)

- **Purpose**: Override backend URL for Next.js server contexts without exposing it to the browser
- **Used in**: API route handlers (`frontend/app/api/**/route.ts`) when `NEXT_PUBLIC_BACKEND_URL` is not set
- **When to use**: Provide a value if you need a private URL for server-side requests that differs from the public client URL

### 2. `NEXT_PUBLIC_NETWORK` (Optional)

- **Purpose**: Cardano network for client-side components (e.g., explorer URLs)
- **Used in**: `frontend/components/features/ActionDetail.tsx`
- **Default**: `mainnet`
- **Values**: `mainnet` or `preview`
- **Note**: Used to determine which CardanoScan explorer URL to use

### 3. `NEXT_PUBLIC_KOIOS_API_KEY` (Required for on-chain transactions in browser)

- Purpose: API key for Koios provider used by the Mesh SDK to build and submit transactions (register/update DRep, delegate, vote)
- Used in: `frontend/lib/governance/transactions/*.ts`
- Notes:
	- Must be prefixed with `NEXT_PUBLIC_` to be available in the browser environment where the wallet signs
	- For mainnet, create an API key at <https://koios.rest/>
	- On preview/preprod networks, the same env var is used; the network is auto-detected from the wallet

Example:

```env
NEXT_PUBLIC_KOIOS_API_KEY=your_koios_api_key
```

### 4. IPFS Provider API Keys (Optional - For DRep Registration & Vote Rationale Upload)

Users can provide these keys at registration time, or use the custom URL option. These are not required environment variables but can be provided by users when registering as a DRep.

#### Pinata

- **Purpose**: Upload DRep metadata to IPFS via Pinata
- **Where to get**: <https://app.pinata.cloud/developers/keys>
- **Format**: JWT token
- **Note**: User provides this in the DRep metadata form if they choose Pinata

#### Blockfrost IPFS

- **Purpose**: Upload DRep metadata to IPFS via Blockfrost
- **Where to get**: <https://blockfrost.io/dashboard> (create IPFS project)
- **Format**: Project ID (e.g., `ipfsEnrkKWDwlA9hV4IajI4ILrFdsHJpIqNC`)
- **Note**: User provides this in the DRep metadata form if they choose Blockfrost

## Summary for Vercel Deployment

### Minimum Required

```env
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
NEXT_PUBLIC_KOIOS_API_KEY=your_koios_api_key
```

### Recommended Configuration

```env
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
BACKEND_URL=https://internal-backend.onrender.com
NEXT_PUBLIC_NETWORK=mainnet
```

## Notes

- **Server-side vs Client-side**: Variables with `NEXT_PUBLIC_` prefix are exposed to the browser. Variables without the prefix are only available in server-side code (API routes, server components).
- **Security**: Never put sensitive API keys in `NEXT_PUBLIC_` variables as they'll be exposed in the browser bundle.
- **Backend**: The frontend uses the backend API exclusively. All data provider access (Blockfrost, Koios, GovTools) is handled by the backend, so the frontend only needs the backend URL.
- **No Direct API Calls**: The frontend no longer makes direct calls to Blockfrost or Koios. All data is fetched through the backend API.
- **Local Development**: If neither `NEXT_PUBLIC_BACKEND_URL` nor `BACKEND_URL` is provided, requests default to `http://localhost:8080`.
