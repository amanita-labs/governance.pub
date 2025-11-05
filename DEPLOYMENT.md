# Deployment Guide

This guide explains how to deploy the GovTwool monorepo with frontend on Vercel and backend on Render.

## Architecture

- **Frontend**: Next.js app deployed on [Vercel](https://vercel.com)
- **Backend**: Rust Axum server deployed on [Render](https://render.com)
- **Communication**: Frontend proxies API requests to backend via Next.js API routes

## Step 1: Deploy Backend on Render

### Using Render Dashboard (Recommended)

1. **Sign up**: https://render.com
2. **Create new Web Service** from your GitHub repository
3. **Configure the service**:
   - **Name**: `govtwool-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Rust`
   - **Build Command**: `cargo build --release`
   - **Start Command**: `./target/release/govtwool-backend`
4. **Set environment variables**:
   - `BLOCKFROST_API_KEY` (required) - Get from [Blockfrost](https://blockfrost.io/)
   - `BLOCKFROST_NETWORK` (optional, default: `mainnet`)
   - `KOIOS_BASE_URL` (optional, default: `https://preview.koios.rest/api/v1`)
   - `CACHE_ENABLED` (optional, default: `true`)
   - `CACHE_MAX_ENTRIES` (optional, default: `10000`)
   - Note: Render automatically sets `PORT` environment variable
5. **Deploy** and copy your Render URL (e.g., `https://govtwool-backend.onrender.com`)

### Using Render Blueprint (Alternative)

If you prefer Infrastructure as Code, you can use the `backend/render.yaml` file:

1. In your Render dashboard, go to **New** → **Blueprint**
2. Connect your GitHub repository
3. Render will automatically detect and use `backend/render.yaml`
4. Review and deploy the service
5. Set the `BLOCKFROST_API_KEY` environment variable (marked as `sync: false` in the YAML)

## Step 2: Deploy Frontend on Vercel

1. **Sign up**: https://vercel.com
2. **Import** your GitHub repository
3. **Configure project**:
   - **Root Directory**: `frontend` (set this in Vercel dashboard → Settings → General → Root Directory)
   - **Framework Preset**: `Next.js` (auto-detected)
   - Build Command: `npm run build` (default, or set in vercel.json)
   - Output Directory: `.next` (default, or set in vercel.json)
4. **Set environment variables**:
   - `NEXT_PUBLIC_BACKEND_URL`: Your Render backend URL (e.g., `https://govtwool-backend.onrender.com`)
   - `BLOCKFROST_API_KEY`: (if frontend needs direct access)
   - `BLOCKFROST_NETWORK`: (if frontend needs direct access)
5. **Deploy** - Vercel will automatically build and deploy your frontend

> **Important**: Set the **Root Directory** to `frontend` in the Vercel dashboard (Settings → General → Root Directory), not in `vercel.json`. The `rootDirectory` property is not supported in `vercel.json` and must be configured in the dashboard.

## Step 3: Update Frontend API Routes (If Needed)

The frontend already has API routes in `frontend/app/api/` that proxy to the backend. Make sure these routes use the `NEXT_PUBLIC_BACKEND_URL` environment variable.

## Verification

1. **Backend health check**: `https://your-backend-url.com/health`
2. **Frontend**: `https://your-vercel-app.vercel.app`
3. **Test API**: Frontend should successfully proxy requests to backend

## Environment Variables Summary

### Backend (Render)
- `BLOCKFROST_API_KEY` (required) - Get from [Blockfrost](https://blockfrost.io/)
- `BLOCKFROST_NETWORK` (optional, default: `mainnet`)
- `KOIOS_BASE_URL` (optional, default: `https://preview.koios.rest/api/v1`)
- `PORT` (auto-set by Render, no need to configure)
- `CACHE_ENABLED` (optional, default: `true`)
- `CACHE_MAX_ENTRIES` (optional, default: `10000`)

### Frontend (Vercel)
- `NEXT_PUBLIC_BACKEND_URL` (required) - Your backend URL
- `BLOCKFROST_API_KEY` (if frontend uses it directly)
- `BLOCKFROST_NETWORK` (if frontend uses it directly)

## Troubleshooting

### Backend not reachable
- Check backend logs in Render dashboard
- Verify all required environment variables are set (especially `BLOCKFROST_API_KEY`)
- Test the health endpoint: `https://your-backend.onrender.com/health`
- Check CORS settings if getting CORS errors (backend allows all origins by default)

### Frontend can't reach backend
- Verify `NEXT_PUBLIC_BACKEND_URL` is set correctly in Vercel dashboard
- Check that backend URL is accessible (try `/health` endpoint)
- Verify Next.js API routes are correctly proxying requests
- Check browser console for CORS errors

### Build failures
- **Backend**: Render automatically detects Rust and installs the toolchain
  - If build fails, check `backend/Cargo.toml` for dependency issues
  - Ensure `Cargo.lock` is committed (it should be for consistent builds)
- **Frontend**: Ensure Node.js version matches `package.json` engines field (>=20.9.0)
  - Vercel auto-detects Next.js framework

### Render-specific issues
- **Cold starts**: Free tier services spin down after 15 minutes of inactivity
  - First request after inactivity may take 30-60 seconds
  - Consider upgrading to paid plan for always-on service
- **Build timeouts**: Large Rust builds may timeout on free tier
  - Consider using Docker build for faster builds
  - Or upgrade to paid plan for longer build times

