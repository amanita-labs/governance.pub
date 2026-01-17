# Yaci Store Indexer Setup

This directory contains the configuration and setup for the Yaci Store Cardano blockchain indexer.

## Prerequisites

- Java 21 or higher
- PostgreSQL database
- Access to a Cardano node (Preview network)
  - Socket file: `~/cardano/node/sockets/preview-node.socket` (configured)
  - Or TCP/IP connection (alternative)

## Quick Start

### Option 1: Automatic Download (Recommended)

Run the download script:
```bash
./scripts/download-yaci-store.sh
```

This will automatically download the latest Yaci Store release.

### Option 2: Manual Download

1. Download Yaci Store binary from [releases](https://github.com/bloxbean/yaci-store/releases) or build from source
2. Place the JAR file in this directory (`backend/indexer/`)

### Then:

1. Configure `application.properties` with your database settings (or use the setup script)
2. Verify Cardano node socket file exists:
   ```bash
   test -S ~/cardano/node/sockets/preview-node.socket && echo "Socket exists" || echo "Socket not found"
   ```
3. Run Yaci Store:
   ```bash
   java -jar yaci-store-all-<version>.jar
   ```

Or use the automated setup script:
```bash
./scripts/dev-setup.sh
```

## Configuration

The `application.properties` file is configured for:

- **Network**: Preview (protocol magic = 1)
- **Node Connection**: Socket file at `~/cardano/node/sockets/preview-node.socket`
- **Database**: PostgreSQL (configured via script or manually)

### Using Socket File (Current Configuration)

The configuration uses N2C (Node-to-Client) protocol with a socket file:
```properties
store.cardano.n2c-node-socket-path=${HOME}/cardano/node/sockets/preview-node.socket
```

### Using TCP/IP Connection (Alternative)

If you prefer TCP/IP connection instead, comment out the socket path and uncomment:
```properties
store.cardano.host=localhost
store.cardano.port=3001
```

## Database Configuration

The database connection is configured via:
- Environment variables (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD)
- Or directly in `application.properties`

## Monitoring

Monitor indexing progress through:
- Yaci Store logs (`yaci-store.log`)
- Database table growth:
  ```bash
  psql -U postgres -d yaci_store -c "SELECT COUNT(*) FROM block;"
  ```
- Health check endpoints (if enabled)

## Troubleshooting

### Socket File Not Found

If you get errors about the socket file:
1. Verify the socket file exists:
   ```bash
   ls -l ~/cardano/node/sockets/preview-node.socket
   ```
2. Check file permissions (should be readable)
3. Ensure the Cardano node is running
4. Update the path in `application.properties` if different

### Connection Issues

- Verify PostgreSQL is running and accessible
- Check database credentials in `application.properties`
- Ensure Yaci Store has network access to the Cardano node

## Documentation

For more details, see:
- [Yaci Store Documentation](https://store.yaci.xyz/)
- [Yaci Store GitHub](https://github.com/bloxbean/yaci-store)
- [Local Development Setup](../LOCAL_DEVELOPMENT_SETUP.md)
