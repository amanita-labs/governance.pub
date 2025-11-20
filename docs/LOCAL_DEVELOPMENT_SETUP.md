# Local Development Setup Guide

This guide will help you set up the local development environment to run and test the Yaci Store backend migration.

## Prerequisites

Before starting, ensure you have:

1. **Java 21+** - Required for Yaci Store
   ```bash
   java -version  # Should show version 21 or higher
   ```

2. **PostgreSQL** - Database for Yaci Store
   ```bash
   psql --version  # Should show PostgreSQL installed
   ```

3. **Rust 1.70+** - For the backend
   ```bash
   rustc --version  # Should show Rust installed
   ```

4. **Cardano Node** - Preview network node (you mentioned you have one available)
   - Node should be synced and accessible
   - Default port: 3001

## Step 1: Set Up PostgreSQL Database

1. **Start PostgreSQL service**:
   ```bash
   # macOS (Homebrew)
   brew services start postgresql@14
   
   # Linux (systemd)
   sudo systemctl start postgresql
   
   # Or use Docker
   docker run --name postgres-yaci -e POSTGRES_PASSWORD=password -e POSTGRES_DB=yaci_store -p 5432:5432 -d postgres:14
   ```

2. **Create database**:
   ```bash
   psql -U postgres
   CREATE DATABASE yaci_store;
   \q
   ```

3. **Verify connection**:
   ```bash
   psql -U postgres -d yaci_store -c "SELECT version();"
   ```

## Step 2: Set Up Yaci Store Indexer

1. **Download Yaci Store**:
   
   **Option A: Automatic Download (Recommended)**
   ```bash
   ./scripts/download-yaci-store.sh
   ```
   This will automatically download the latest release.
   
   **Option B: Manual Download**
   ```bash
   cd indexer
   # Visit https://github.com/bloxbean/yaci-store/releases
   # Download yaci-store-all-<version>.jar
   ```
   
   **Option C: Build from source (if you have Java/Gradle)**
   ```bash
   git clone https://github.com/bloxbean/yaci-store.git
   cd yaci-store
   ./gradlew clean build
   cp applications/all/build/libs/yaci-store-all-<version>.jar ../indexer/
   ```

2. **Configure Yaci Store**:
   
   Edit `indexer/application.properties`:
   ```properties
   # Update these values for your setup:
   store.cardano.host=<your-cardano-node-host>  # e.g., localhost or IP
   store.cardano.port=3001
   store.cardano.protocol-magic=1  # Preview network
   
   spring.datasource.url=jdbc:postgresql://localhost:5432/yaci_store
   spring.datasource.username=postgres
   spring.datasource.password=password  # Change to your password
   ```

3. **Start Yaci Store**:
   ```bash
   cd indexer
   java -jar yaci-store-all-<version>.jar
   ```

   **Note**: Initial sync will take time. For Preview network, it's faster than mainnet but still requires patience.

4. **Monitor indexing progress**:
   - Watch the logs for indexing progress
   - Check database tables are being populated:
     ```bash
     psql -U postgres -d yaci_store -c "\dt"  # List tables
     psql -U postgres -d yaci_store -c "SELECT COUNT(*) FROM block;"  # Check block count
     ```

## Step 3: Inspect Database Schema

Once Yaci Store has started indexing, inspect the actual schema:

```bash
psql -U postgres -d yaci_store

# List all tables
\dt

# Inspect governance-related tables (exact names may vary)
\d+ drep_registration
\d+ governance_action
\d+ vote
\d+ stake_delegation
\d+ epoch

# Check if tables exist and have data
SELECT COUNT(*) FROM drep_registration;
SELECT COUNT(*) FROM governance_action;
```

**Important**: Note the exact table names and column names - you'll need these to implement the SQL queries in `backend/src/db/queries.rs`.

## Step 4: Configure Backend

1. **Create `.env` file**:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **Edit `.env`** with your database credentials:
   ```env
   DATABASE_URL=postgresql://postgres:password@localhost:5432/yaci_store
   PORT=8080
   CACHE_ENABLED=true
   CACHE_MAX_ENTRIES=10000
   
   # Optional: GovTools enrichment
   GOVTOOLS_ENABLED=false
   GOVTOOLS_BASE_URL=https://be.preview.gov.tools
   
   # Optional: Metadata validation
   CARDANO_VERIFIER_ENABLED=false
   ```

3. **Verify configuration**:
   ```bash
   cd backend
   cargo check  # Should compile without errors
   ```

## Step 5: Implement SQL Queries

Before the backend will work, you need to implement the actual SQL queries:

1. **Inspect the database schema** (from Step 3)
2. **Update `backend/src/db/queries.rs`** with actual queries based on the schema
3. **Example query structure** (adjust table/column names as needed):
   ```rust
   pub async fn get_drep(pool: &PgPool, id: &str) -> Result<Option<DRep>> {
       let row = sqlx::query_as!(
           DRepRow,
           "SELECT drep_id, hex, view, voting_power, active FROM drep_registration WHERE drep_id = $1",
           id
       )
       .fetch_optional(pool)
       .await?;
       
       // Map DRepRow to DRep model
       // ...
   }
   ```

## Step 6: Run the Backend

1. **Start the backend**:
   ```bash
   cd backend
   cargo run
   ```

2. **Verify it's running**:
   ```bash
   curl http://localhost:8080/health
   ```

   Expected response:
   ```json
   {
     "status": "healthy",
     "providers": {...},
     "cache": {...}
   }
   ```

## Step 7: Test API Endpoints

Test the endpoints to verify everything works:

```bash
# Health check
curl http://localhost:8080/health

# DReps list (will return empty until queries are implemented)
curl http://localhost:8080/api/dreps?page=1&count=20

# DRep stats
curl http://localhost:8080/api/dreps/stats

# Governance actions
curl http://localhost:8080/api/actions?page=1&count=20
```

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
psql -U postgres -d yaci_store -c "SELECT 1;"

# Check if database exists
psql -U postgres -l | grep yaci_store

# Verify connection string format
# Should be: postgresql://username:password@host:port/database
```

### Yaci Store Not Indexing

1. **Check node connection**:
   ```bash
   # Test if Cardano node is accessible
   telnet <node-host> 3001
   ```

2. **Check Yaci Store logs** for errors

3. **Verify protocol magic** matches your network:
   - Preview: 1
   - Preprod: 1
   - Mainnet: 764824073

### Backend Compilation Errors

```bash
# Clean and rebuild
cd backend
cargo clean
cargo build

# Check for missing dependencies
cargo check
```

### Empty API Responses

This is expected until SQL queries are implemented. The placeholder queries return empty results.

## Development Workflow

1. **Start services in order**:
   ```bash
   # Terminal 1: PostgreSQL (if not running as service)
   # Terminal 2: Yaci Store indexer
   java -jar indexer/yaci-store-all-<version>.jar
   
   # Terminal 3: Backend
   cd backend && cargo run
   ```

2. **Monitor logs**:
   - Yaci Store: Watch for indexing progress
   - Backend: Watch for database connection and query execution

3. **Iterate on queries**:
   - Update `backend/src/db/queries.rs`
   - Test with `cargo run`
   - Verify API responses

## Quick Start Script

An automated setup script is available at `scripts/dev-setup.sh`:

```bash
# Run the setup script
./scripts/dev-setup.sh

# Or with custom database credentials
DB_USER=myuser DB_PASSWORD=mypass ./scripts/dev-setup.sh
```

The script will:
- ✅ Check all prerequisites (Java, PostgreSQL, Rust)
- ✅ Verify PostgreSQL connection
- ✅ Create database if it doesn't exist
- ✅ Update Yaci Store configuration
- ✅ Start Yaci Store indexer
- ✅ Configure backend environment
- ✅ Start backend server
- ✅ Display status and useful commands

**Stop services:**
```bash
./scripts/stop-dev.sh
```

Or press `Ctrl+C` in the terminal where the script is running.

## Next Steps

Once the basic setup is working:

1. **Implement all SQL queries** in `backend/src/db/queries.rs`
2. **Add database indexes** for performance
3. **Test all API endpoints** thoroughly
4. **Compare responses** with old provider-based backend
5. **Optimize queries** based on performance testing

## Resources

- [Yaci Store Documentation](https://store.yaci.xyz/)
- [Yaci Store GitHub](https://github.com/bloxbean/yaci-store)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [sqlx Documentation](https://docs.rs/sqlx/)

