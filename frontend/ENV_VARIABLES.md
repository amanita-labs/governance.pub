# Frontend Environment Variables

## Required Environment Variables

### 1. `NEXT_PUBLIC_BACKEND_URL` (Required)
- **Purpose**: URL of your Rust backend service (deployed on Render)
- **Example**: `https://govtwool-backend.onrender.com`
- **Used in**: API route handlers (`frontend/app/api/**/route.ts`)
- **Note**: Must have `NEXT_PUBLIC_` prefix to be accessible in Next.js API routes

## Optional Environment Variables

### 2. `NEXT_PUBLIC_NETWORK` (Optional)
- **Purpose**: Cardano network for client-side components (e.g., explorer URLs)
- **Used in**: `frontend/components/features/ActionDetail.tsx`
- **Default**: `mainnet`
- **Values**: `mainnet` or `preview`
- **Note**: Used to determine which CardanoScan explorer URL to use

## Summary for Vercel Deployment

### Minimum Required:
```
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
```

### Recommended Configuration:
```
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
NEXT_PUBLIC_NETWORK=mainnet
```

## Notes

- **Server-side vs Client-side**: Variables with `NEXT_PUBLIC_` prefix are exposed to the browser. Variables without the prefix are only available in server-side code (API routes, server components).
- **Security**: Never put sensitive API keys in `NEXT_PUBLIC_` variables as they'll be exposed in the browser bundle.
- **Backend**: The frontend uses the backend API exclusively. All data provider access (Blockfrost, Koios) is handled by the backend, so the frontend only needs the backend URL.
- **No Direct API Calls**: The frontend no longer makes direct calls to Blockfrost or Koios. All data is fetched through the backend API.
