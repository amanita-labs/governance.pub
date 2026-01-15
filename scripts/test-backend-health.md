# Backend Health Check Guide

## Quick Test Commands

You can test your backend health endpoints using these simple curl commands:

### 1. Overall Health Check
```bash
curl https://govtwool-backend-p9k5.onrender.com/health | jq .
```

### 2. Database Health
```bash
curl https://govtwool-backend-p9k5.onrender.com/health/database | jq .
```

### 3. Indexer Health
```bash
curl https://govtwool-backend-p9k5.onrender.com/health/indexer | jq .
```

## Using the Test Script

Run the automated test script:

```bash
./scripts/test-backend-health.sh
```

Or test a different URL:

```bash
./scripts/test-backend-health.sh https://your-backend-url.onrender.com
```

## Expected Responses

### `/health` - Overall Health
- **200 OK**: All systems healthy
- **503 Service Unavailable**: System degraded (database or indexer issues)

Response includes:
- Overall status (healthy/degraded)
- Database connection status
- Indexer sync status
- Cache statistics

### `/health/database` - Database Statistics
- **200 OK**: Database connected
- **503 Service Unavailable**: Database not connected

Response includes:
- Database name and size
- Table counts and row counts
- Per-table statistics
- Connection pool information

### `/health/indexer` - Indexer Health
- **200 OK**: Indexer connected (may be stale/stopped but still returns 200)
- **503 Service Unavailable**: Indexer not connected

Response includes:
- Sync status (active/stale/stopped)
- Latest block information
- Blocks synced in last hour/day
- Sync rate (blocks per minute)

## Browser Testing

You can also test directly in your browser:

- https://govtwool-backend-p9k5.onrender.com/health
- https://govtwool-backend-p9k5.onrender.com/health/database
- https://govtwool-backend-p9k5.onrender.com/health/indexer

## Render Health Checks

Render will automatically use `/health` for health checks. Make sure:
- The endpoint returns 200 for healthy status
- The endpoint returns 503 for degraded/unhealthy status
- Response time is reasonable (< 1 second)
