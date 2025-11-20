# Render Deployment Guide

This guide covers deploying the GovTwool backend and Yaci Store indexer to Render.

## Architecture Overview

The deployment consists of three services:

1. **PostgreSQL Database** - Stores blockchain data indexed by Yaci Store
2. **Backend API** - Rust service that queries the database
3. **Yaci Store Indexer** - Java service that syncs blockchain data to the database

## Quick Start

### Option 1: Deploy via Render Dashboard (Recommended)

1. **Connect your GitHub repository** to Render
2. **Create a new Blueprint** and paste the contents of `render.yaml`
3. Render will automatically create all three services
4. **Set environment variables** as needed (see below)

### Option 2: Deploy Services Individually

#### 1. Create PostgreSQL Database

1. Go to Render Dashboard → New → PostgreSQL
2. Name: `govtwool-database`
3. Database: `yaci_store`
4. User: `yaci_store_user`
5. Plan: Starter (or higher for production)
6. Note the connection details

#### 2. Deploy Backend API

1. Go to Render Dashboard → New → Web Service
2. Connect your GitHub repository
3. Configure:
   - **Name**: `govtwool-backend`
   - **Environment**: `Rust`
   - **Root Directory**: `backend`
   - **Build Command**: `cargo build --release`
   - **Start Command**: `./target/release/govtwool-backend`
   - **Health Check Path**: `/health`

4. **Environment Variables**:
   ```bash
   DATABASE_URL=<from PostgreSQL service>
   PORT=8080
   CACHE_ENABLED=true
   CACHE_MAX_ENTRIES=10000
   GOVTOOLS_ENABLED=false
   CORS_ORIGINS=*
   ```

#### 3. Deploy Yaci Store Indexer

1. Go to Render Dashboard → New → Background Worker
2. Connect your GitHub repository
3. Configure:
   - **Name**: `govtwool-indexer`
   - **Environment**: `Docker`
   - **Root Directory**: `indexer`
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Context**: `.`

4. **Environment Variables**:
   ```bash
   SPRING_DATASOURCE_URL=<from PostgreSQL service>
   SPRING_DATASOURCE_USERNAME=<from PostgreSQL service>
   SPRING_DATASOURCE_PASSWORD=<from PostgreSQL service>
   STORE_CARDANO_PROTOCOL_MAGIC=2
   STORE_CARDANO_HOST=preview-node.play.dev.cardano.org
   STORE_CARDANO_PORT=3001
   STORE_PARALLEL_PROCESSING=true
   STORE_VIRTUAL_THREADS_ENABLED=true
   ```

## Environment Variables Reference

### Backend Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string (auto-linked) |
| `PORT` | No | `8080` | Server port |
| `CACHE_ENABLED` | No | `true` | Enable in-memory caching |
| `CACHE_MAX_ENTRIES` | No | `10000` | Maximum cache entries |
| `GOVTOOLS_ENABLED` | No | `false` | Enable GovTools enrichment |
| `GOVTOOLS_BASE_URL` | No | `https://be.preview.gov.tools` | GovTools API URL |
| `CORS_ORIGINS` | No | `*` | CORS allowed origins (comma-separated) |

### Yaci Store Indexer

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SPRING_DATASOURCE_URL` | Yes | - | PostgreSQL connection string (auto-linked) |
| `SPRING_DATASOURCE_USERNAME` | Yes | - | Database username (auto-linked) |
| `SPRING_DATASOURCE_PASSWORD` | Yes | - | Database password (auto-linked) |
| `STORE_CARDANO_PROTOCOL_MAGIC` | No | `2` | Network protocol magic (2=Preprod, 1=Preview) |
| `STORE_CARDANO_HOST` | No | `preview-node.play.dev.cardano.org` | N2N relay node hostname |
| `STORE_CARDANO_PORT` | No | `3001` | N2N relay node port |
| `STORE_PARALLEL_PROCESSING` | No | `true` | Enable parallel processing |
| `STORE_VIRTUAL_THREADS_ENABLED` | No | `true` | Enable virtual threads |

## Network Configuration

### Preprod Network (Default)

- Protocol Magic: `2`
- Relay Node: `preview-node.play.dev.cardano.org:3001`

### Preview Network

Update environment variables:
- `STORE_CARDANO_PROTOCOL_MAGIC=1`
- `STORE_CARDANO_HOST=preview-node.play.dev.cardano.org`
- `STORE_CARDANO_PORT=3001`

### Mainnet

Update environment variables:
- `STORE_CARDANO_PROTOCOL_MAGIC=764824073`
- `STORE_CARDANO_HOST=<mainnet-relay-node>`
- `STORE_CARDANO_PORT=3001`

## Deployment Checklist

- [ ] PostgreSQL database created and running
- [ ] Backend service deployed with database connection
- [ ] Yaci Store indexer deployed with database connection
- [ ] Environment variables configured
- [ ] Health check endpoint responding (`/health`)
- [ ] Yaci Store logs show successful sync
- [ ] Database tables populated with blockchain data

## Monitoring

### Check Backend Health

```bash
curl https://your-backend.onrender.com/health
```

### Check Yaci Store Logs

1. Go to Render Dashboard → `govtwool-indexer` → Logs
2. Look for:
   - `Application is ready. Let's start the sync process ...`
   - `# of blocks written: 100`
   - `Block No: <number>`

### Check Database Sync Progress

Connect to your PostgreSQL database and run:

```sql
SELECT COUNT(*) as total_blocks FROM block;
SELECT MAX(block_number) as latest_block FROM block;
SELECT COUNT(*) as drep_registrations FROM drep_registration;
```

## Troubleshooting

### Backend Can't Connect to Database

- Verify `DATABASE_URL` is set correctly
- Check database service is running
- Ensure database allows connections from Render's IP ranges

### Yaci Store Not Syncing

- Check logs for connection errors
- Verify `STORE_CARDANO_HOST` and `STORE_CARDANO_PORT` are correct
- Ensure `STORE_CARDANO_PROTOCOL_MAGIC` matches your network
- Check database connection is working

### Build Failures

**Backend (Rust)**:
- Ensure `Cargo.lock` is committed
- Check Rust version compatibility
- Review build logs for dependency errors

**Yaci Store (Docker)**:
- Verify `yaci-store-all-*.jar` exists in `indexer/` directory
- Check Dockerfile syntax
- Review Docker build logs

### Performance Issues

- **Slow sync**: Increase database plan (more CPU/RAM)
- **High memory usage**: Adjust `STORE_PARALLEL_PROCESSING` and `STORE_VIRTUAL_THREADS_ENABLED`
- **Database size**: Monitor disk usage, consider archiving old data

## Cost Optimization

- **Starter Plan**: Suitable for development/testing
- **Standard Plan**: Recommended for production
- **Database**: Start with Starter, upgrade as needed
- **Indexer**: Can run on Standard plan for better performance

## Security Notes

- Never commit `.env` files or secrets
- Use Render's environment variable management
- Enable database backups
- Restrict CORS origins in production (`CORS_ORIGINS`)

## Next Steps

After deployment:

1. **Wait for initial sync**: Yaci Store needs to sync historical blocks (can take hours)
2. **Verify data**: Check database tables are populated
3. **Test API**: Query backend endpoints
4. **Monitor**: Watch logs and metrics
5. **Scale**: Adjust plans based on usage

## Support

- Render Documentation: https://render.com/docs
- Yaci Store: https://store.yaci.xyz
- Project Issues: GitHub Issues

