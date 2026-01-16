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
store.cardano.n2n-host=\${STORE_CARDANO_HOST}
store.cardano.n2n-port=\${STORE_CARDANO_PORT}

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

# Logging
logging.level.com.bloxbean.cardano.yaci=INFO
logging.level.com.bloxbean.cardano.yaci.store=INFO
EOF

# Substitute environment variables
envsubst < /app/application.properties > /app/application.properties.tmp
mv /app/application.properties.tmp /app/application.properties

echo "Starting Yaci Store..."
exec java $JVM_OPTS -jar /app/yaci-store.jar
