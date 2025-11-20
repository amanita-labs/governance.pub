# Render Setup Instructions

Render Blueprints don't support creating PostgreSQL databases directly. Follow these steps:

## Step 1: Create PostgreSQL Database

1. Go to **Render Dashboard** → **New** → **PostgreSQL**
2. Configure:
   - **Name**: `govtwool-database`
   - **Database**: `yaci_store`
   - **User**: `yaci_store_user` (or leave default)
   - **Plan**: Starter (or higher)
   - **Region**: Oregon (or your preferred region)
3. Click **Create Database**
4. **Save the connection details** shown after creation

## Step 2: Deploy Services via Blueprint

1. Go to **Render Dashboard** → **New** → **Blueprint**
2. Connect your GitHub repository
3. Paste the contents of `render.yaml`
4. Click **Apply**

## Step 3: Configure Environment Variables

After the services are created, you need to link them to your database:

### For Backend Service (`govtwool-backend`)

Go to the service → **Environment** tab and set:

```
DATABASE_URL=postgresql://user:password@host:port/yaci_store
DB_HOST=<database-host>
DB_PORT=<database-port>
DB_NAME=yaci_store
DB_USER=<database-user>
DB_PASSWORD=<database-password>
```

### For Indexer Service (`govtwool-indexer`)

Go to the service → **Environment** tab and set:

```
SPRING_DATASOURCE_URL=postgresql://user:password@host:port/yaci_store
SPRING_DATASOURCE_USERNAME=<database-user>
SPRING_DATASOURCE_PASSWORD=<database-password>
```

**Tip**: You can copy these values from your PostgreSQL service's **Connections** tab.

## Alternative: Manual Service Creation

If you prefer not to use Blueprints:

1. Create PostgreSQL database (Step 1 above)
2. Create Backend Web Service:
   - **Environment**: Rust
   - **Root Directory**: `backend`
   - **Build Command**: `cargo build --release`
   - **Start Command**: `./target/release/govtwool-backend`
   - Set environment variables as above
3. Create Indexer Worker:
   - **Environment**: Docker
   - **Root Directory**: `indexer`
   - **Dockerfile Path**: `./Dockerfile`
   - Set environment variables as above

## Verification

1. Check backend health: `https://your-backend.onrender.com/health`
2. Check indexer logs for sync progress
3. Verify database has tables: Connect to PostgreSQL and run `\dt`

