# Deployment Guide

This project can be deployed to Render with minimal configuration. Choose your deployment method below.

## Quick Deploy (Recommended)

### Using Render Blueprint

1. **Push your code to GitHub**
2. **Go to Render Dashboard** → New → Blueprint
3. **Connect your repository**
4. **Paste the contents of `render.yaml`**
5. **Render will automatically create**:
   - PostgreSQL database
   - Backend API service
   - Yaci Store indexer worker

That's it! Render handles everything automatically.

## Manual Deployment

See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for detailed step-by-step instructions.

## What Gets Deployed

### Services

1. **PostgreSQL Database** (`govtwool-database`)
   - Stores all blockchain data
   - Auto-configured with proper schema

2. **Backend API** (`govtwool-backend`)
   - Rust service running on port 8080
   - Queries the PostgreSQL database
   - Provides REST API endpoints

3. **Yaci Store Indexer** (`govtwool-indexer`)
   - Background worker service
   - Syncs blockchain data to PostgreSQL
   - Runs continuously

## Prerequisites

- GitHub repository with your code
- Render account (free tier works)
- Yaci Store JAR file in `indexer/` directory

## Environment Setup

All environment variables are configured in `render.yaml`. You can override them in the Render dashboard if needed.

### Required Variables

- `DATABASE_URL` - Auto-linked from PostgreSQL service
- `SPRING_DATASOURCE_URL` - Auto-linked from PostgreSQL service

### Optional Variables

See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for full list.

## Post-Deployment

1. **Wait for initial sync** (can take hours for full chain)
2. **Check health**: `curl https://your-backend.onrender.com/health`
3. **Monitor logs** in Render dashboard
4. **Verify database** is populating with blocks

## Troubleshooting

See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md#troubleshooting) for common issues and solutions.

## Cost Estimate

- **Free Tier**: Suitable for development/testing
- **Starter Plan**: ~$7/month per service
- **Standard Plan**: ~$25/month per service (recommended for production)

Total: ~$21/month (Starter) or ~$75/month (Standard) for all three services.

