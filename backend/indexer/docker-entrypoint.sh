#!/bin/bash
set -e

# Parse Render's connectionString and construct proper JDBC URL
if [ -n "$SPRING_DATASOURCE_URL" ]; then
    DB_URL="${SPRING_DATASOURCE_URL#postgresql://}"
    DB_URL="${DB_URL#jdbc:postgresql://}"
    
    # Remove credentials from URL (Spring Boot needs them separately)
    if [[ "$DB_URL" == *"@"* ]]; then
        IFS='@' read -r CREDS DB_URL <<< "$DB_URL"
    fi
    
    export SPRING_DATASOURCE_URL="jdbc:postgresql://${DB_URL}"
fi

# Set defaults for optional variables
export STORE_CARDANO_PROTOCOL_MAGIC=${STORE_CARDANO_PROTOCOL_MAGIC:-2}
export STORE_CARDANO_HOST=${STORE_CARDANO_HOST:-preview-node.play.dev.cardano.org}
export STORE_CARDANO_PORT=${STORE_CARDANO_PORT:-3001}
export JVM_OPTS=${JVM_OPTS:--Xms512m -Xmx3g -XX:+UseG1GC}

# Sync start configuration (REQUIRED - prevents starting from genesis)
export STORE_CARDANO_SYNC_START_SLOT=${STORE_CARDANO_SYNC_START_SLOT:-}
export STORE_CARDANO_SYNC_START_BLOCKHASH=${STORE_CARDANO_SYNC_START_BLOCKHASH:-}

# Validate that sync start configuration is provided
if [ -z "$STORE_CARDANO_SYNC_START_SLOT" ]; then
    echo "ERROR: STORE_CARDANO_SYNC_START_SLOT is required to prevent starting from genesis."
    echo "Please set STORE_CARDANO_SYNC_START_SLOT and STORE_CARDANO_SYNC_START_BLOCKHASH environment variables."
    exit 1
fi

if [ -z "$STORE_CARDANO_SYNC_START_BLOCKHASH" ]; then
    echo "ERROR: STORE_CARDANO_SYNC_START_BLOCKHASH is required to prevent starting from genesis."
    echo "Please set STORE_CARDANO_SYNC_START_BLOCKHASH environment variable."
    exit 1
fi

# Generate application.properties
cat > /app/application.properties << EOF
# Database
spring.datasource.url=\${SPRING_DATASOURCE_URL}
spring.datasource.username=\${SPRING_DATASOURCE_USERNAME}
spring.datasource.password=\${SPRING_DATASOURCE_PASSWORD}
spring.datasource.driver-class-name=org.postgresql.Driver

# Cardano Network
store.cardano.protocol-magic=\${STORE_CARDANO_PROTOCOL_MAGIC}
store.cardano.host=\${STORE_CARDANO_HOST}
store.cardano.port=\${STORE_CARDANO_PORT}
store.cardano.n2n-host=\${STORE_CARDANO_HOST}
store.cardano.n2n-port=\${STORE_CARDANO_PORT}
EOF

# Add sync start configuration (required - prevents genesis sync)
echo "" >> /app/application.properties
echo "# Sync Start Configuration (REQUIRED)" >> /app/application.properties
echo "# Start indexing from a specific slot and blockhash" >> /app/application.properties
echo "# This prevents starting from genesis" >> /app/application.properties
echo "store.cardano.sync-start-slot=\${STORE_CARDANO_SYNC_START_SLOT}" >> /app/application.properties
echo "store.cardano.sync-start-blockhash=\${STORE_CARDANO_SYNC_START_BLOCKHASH}" >> /app/application.properties

# Continue with rest of configuration
cat >> /app/application.properties << EOF

# Enabled Stores
store.governance.enabled=true
store.staking.enabled=true
store.transactions.enabled=true
store.blocks.enabled=true
store.metadata.enabled=true
store.utxo.enabled=true
store.assets.enabled=false
store.epoch.enabled=true

# Performance (sensible defaults)
store.parallel-processing=true
store.virtual-threads-enabled=true

# Sync Control - Disable auto-start to prevent accidental genesis sync
# Sync will only start from the configured sync-start-slot and sync-start-blockhash
store.sync-auto-start=false

# Logging
logging.level.com.bloxbean.cardano.yaci=INFO
logging.level.com.bloxbean.cardano.yaci.store=INFO
EOF

# Substitute environment variables
envsubst < /app/application.properties > /app/application.properties.tmp
mv /app/application.properties.tmp /app/application.properties

echo "Starting Yaci Store..."
exec java $JVM_OPTS -jar /app/yaci-store.jar
