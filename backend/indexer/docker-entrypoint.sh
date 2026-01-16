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

# Core store flags (all enabled by default per Yaci Store docs)
store.assets.enabled=true
store.blocks.enabled=true
store.epoch.enabled=true
store.metadata.enabled=true
store.mir.enabled=true
store.script.enabled=true
store.staking.enabled=true
store.transaction.enabled=true
store.utxo.enabled=true
store.governance.enabled=true

# Performance Configuration (per Yaci Store docs)
store.executor.enable-parallel-processing=true
store.executor.use-virtual-thread-for-batch-processing=true
store.executor.use-virtual-thread-for-event-processing=true

# Logging
logging.level.com.bloxbean.cardano.yaci=INFO
logging.level.com.bloxbean.cardano.yaci.store=INFO

# Enable UTxO pruning
store.utxo.pruning-enabled=true
store.utxo.pruning.interval=600
store.utxo.pruning-safe-blocks=2160
store.utxo.pruning-batch-size=3000

# Enable transaction pruning
store.transaction.pruning-enabled=true
store.transaction.pruning.interval=86400
store.transaction.pruning-safe-slot=43200

# JOOQ batch settings (per Yaci Store docs)
store.db.batch-size=1000
store.db.parallel-insert=true
EOF

# Add sync start configuration if provided (optional)
if [ -n "$STORE_CARDANO_SYNC_START_SLOT" ]; then
    echo "" >> /app/application.properties
    echo "# Sync Start Configuration" >> /app/application.properties
    echo "store.cardano.sync-start-slot=\${STORE_CARDANO_SYNC_START_SLOT}" >> /app/application.properties
    if [ -n "$STORE_CARDANO_SYNC_START_BLOCKHASH" ]; then
        echo "store.cardano.sync-start-blockhash=\${STORE_CARDANO_SYNC_START_BLOCKHASH}" >> /app/application.properties
    fi
fi

# Substitute environment variables
envsubst < /app/application.properties > /app/application.properties.tmp
mv /app/application.properties.tmp /app/application.properties

echo "Starting Yaci Store..."
exec java $JVM_OPTS -jar /app/yaci-store.jar
