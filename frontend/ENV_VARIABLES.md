# Frontend Environment Variables

## Required Environment Variables

### 1. `NEXT_PUBLIC_BACKEND_URL` (Required)
- **Purpose**: URL of your Rust backend service (deployed on Render)
- **Example**: `https://govtwool-backend.onrender.com`
- **Used in**: API route handlers (`frontend/app/api/**/route.ts`)
- **Note**: Must have `NEXT_PUBLIC_` prefix to be accessible in Next.js API routes

## Optional Environment Variables

### 2. `BLOCKFROST_API_KEY` (Optional - for direct API access)
- **Purpose**: Blockfrost API key for direct API calls (if frontend makes direct calls)
- **Used in**: `frontend/lib/api/blockfrost.ts` (server-side only)
- **Note**: Without `NEXT_PUBLIC_` prefix, so it's only available server-side for security
- **Default**: Empty string (may cause errors if used without backend)

### 3. `BLOCKFROST_NETWORK` (Optional - for direct API access)
- **Purpose**: Cardano network (`mainnet` or `preview`)
- **Used in**: `frontend/lib/api/blockfrost.ts` (server-side only)
- **Default**: `mainnet`
- **Note**: Only needed if frontend makes direct Blockfrost API calls

### 4. `NEXT_PUBLIC_BLOCKFROST_NETWORK` (Optional)
- **Purpose**: Network for client-side components (e.g., explorer URLs)
- **Used in**: `frontend/components/features/ActionDetail.tsx`
- **Default**: `mainnet`
- **Note**: Has `NEXT_PUBLIC_` prefix, so accessible in client-side code

### 5. `NEXT_PUBLIC_KOIOS_URL` (Optional)
- **Purpose**: Koios API base URL
- **Used in**: `frontend/lib/api/koios.ts`
- **Default**: `https://preview.koios.rest/api/v1`
- **Note**: Usually not needed unless using a different Koios instance

## Summary for Vercel Deployment

### Minimum Required:
```
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
```

### Recommended (if frontend uses Blockfrost directly):
```
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
BLOCKFROST_API_KEY=your_blockfrost_api_key
BLOCKFROST_NETWORK=mainnet
NEXT_PUBLIC_BLOCKFROST_NETWORK=mainnet
```

### Full Configuration:
```
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
BLOCKFROST_API_KEY=your_blockfrost_api_key
BLOCKFROST_NETWORK=mainnet
NEXT_PUBLIC_BLOCKFROST_NETWORK=mainnet
NEXT_PUBLIC_KOIOS_URL=https://preview.koios.rest/api/v1
```

## Notes

- **Server-side vs Client-side**: Variables with `NEXT_PUBLIC_` prefix are exposed to the browser. Variables without the prefix are only available in server-side code (API routes, server components).
- **Security**: Never put sensitive API keys in `NEXT_PUBLIC_` variables as they'll be exposed in the browser bundle.
- **Backend**: Since you're using a Rust backend, the frontend primarily needs `NEXT_PUBLIC_BACKEND_URL`. The Blockfrost variables are only needed if the frontend makes direct API calls (which it might do for some features).

