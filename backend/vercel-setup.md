# Deploying Rust Backend on Vercel

## Important Note

Vercel doesn't natively support running Axum servers as serverless functions. The current backend is designed as a standalone server that runs on a specific port.

## Recommended Approach

Deploy the Rust backend separately on a platform that supports Rust, then proxy requests from Vercel.

### Option 1: Deploy Backend on Railway (Recommended)

1. **Sign up for Railway**: https://railway.app
2. **Create a new project** and connect your GitHub repo
3. **Add a new service** and select "Empty Service"
4. **Configure the service**:
   - Root Directory: `backend`
   - Build Command: `cargo build --release`
   - Start Command: `./target/release/govtwool-backend`
5. **Set environment variables** in Railway:
   - `BLOCKFROST_API_KEY`
   - `BLOCKFROST_NETWORK`
   - `KOIOS_BASE_URL`
   - `BACKEND_PORT` (Railway will set `PORT` automatically)
6. **Get your Railway URL** (e.g., `https://govtwool-backend.railway.app`)
7. **Update `vercel.json`** with your Railway URL in the rewrites section

### Option 2: Deploy Backend on Render

1. **Sign up for Render**: https://render.com
2. **Create a new Web Service**
3. **Configure**:
   - Build Command: `cd backend && cargo build --release`
   - Start Command: `cd backend && ./target/release/govtwool-backend`
   - Environment: `Docker` or `Rust`
4. **Set environment variables** as above
5. **Update `vercel.json`** with your Render URL

### Option 3: Deploy Backend on Fly.io

1. **Install Fly CLI**: https://fly.io/docs/getting-started/installing-flyctl/
2. **Run**: `fly launch` in the `backend` directory
3. **Configure** environment variables
4. **Deploy**: `fly deploy`
5. **Update `vercel.json`** with your Fly.io URL

## Alternative: Convert to Vercel Serverless Functions

If you want to use Vercel's serverless functions directly, you would need to:

1. Convert Axum routes to individual serverless functions
2. Use `vercel-runtime` crate instead of Axum
3. Create separate functions for each API endpoint

This requires significant refactoring and is not recommended for this project structure.

## Configuration

After deploying your backend, update `vercel.json` with your backend URL:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-backend-url.com/api/:path*"
    }
  ]
}
```

Then set the `NEXT_PUBLIC_BACKEND_URL` environment variable in Vercel dashboard.

