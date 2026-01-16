#!/bin/bash
set -e

# Parse Render's connectionString and construct proper JDBC URL
# Render format: postgresql://user:password@host:port/database
# Spring Boot needs: jdbc:postgresql://host:port/database (credentials provided separately)
if [ -n "$SPRING_DATASOURCE_URL" ]; then
    # Store original for debugging
    ORIGINAL_URL="$SPRING_DATASOURCE_URL"
    
    # Remove protocol prefixes (handle both formats)
    DB_URL="${ORIGINAL_URL}"
    DB_URL="${DB_URL#postgresql://}"
    DB_URL="${DB_URL#jdbc:postgresql://}"
    
    # Extract host:port/database part by removing user:password@
    # Pattern: user:password@host:port/database -> host:port/database
    if [[ "$DB_URL" == *"@"* ]]; then
        # Split at @ and take the second part
        IFS='@' read -r CREDS DB_URL <<< "$DB_URL"
        echo "Removed credentials from URL"
    fi
    
    # Construct clean JDBC URL without credentials
    export SPRING_DATASOURCE_URL="jdbc:postgresql://${DB_URL}"
    echo "Original URL: ${ORIGINAL_URL}"
    echo "Parsed JDBC URL (without credentials): ${SPRING_DATASOURCE_URL}"
elif [ -n "$SPRING_DATASOURCE_USERNAME" ] && [ -n "$SPRING_DATASOURCE_PASSWORD" ]; then
    # Fallback: construct from individual components if available
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5432}"
    DB_NAME="${DB_NAME:-yaci_store}"
    export SPRING_DATASOURCE_URL="jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}"
    echo "Constructed JDBC URL from components"
fi

# Set default values for environment variables before substitution
# envsubst doesn't handle ${VAR:-default} syntax, so we set defaults here
export STORE_CARDANO_PROTOCOL_MAGIC=${STORE_CARDANO_PROTOCOL_MAGIC:-2}
export STORE_CARDANO_HOST=${STORE_CARDANO_HOST:-preview-node.play.dev.cardano.org}
export STORE_CARDANO_PORT=${STORE_CARDANO_PORT:-3001}
export STORE_PARALLEL_PROCESSING=${STORE_PARALLEL_PROCESSING:-true}
export STORE_VIRTUAL_THREADS_ENABLED=${STORE_VIRTUAL_THREADS_ENABLED:-true}
export STORE_BATCH_SIZE=${STORE_BATCH_SIZE:-1000}
export STORE_PARALLEL_WORKERS=${STORE_PARALLEL_WORKERS:-2}
export SPRING_DATASOURCE_HIKARI_MAX_POOL_SIZE=${SPRING_DATASOURCE_HIKARI_MAX_POOL_SIZE:-5}
export SPRING_DATASOURCE_HIKARI_MIN_IDLE=${SPRING_DATASOURCE_HIKARI_MIN_IDLE:-2}
export SPRING_DATASOURCE_HIKARI_CONNECTION_TIMEOUT=${SPRING_DATASOURCE_HIKARI_CONNECTION_TIMEOUT:-30000}
export SPRING_DATASOURCE_HIKARI_IDLE_TIMEOUT=${SPRING_DATASOURCE_HIKARI_IDLE_TIMEOUT:-600000}
export SPRING_JPA_BATCH_SIZE=${SPRING_JPA_BATCH_SIZE:-1000}

# Generate application.properties from environment variables
cat > /app/application.properties << 'PROPERTIES_EOF'
# Generated from environment variables at runtime
spring.datasource.url=${SPRING_DATASOURCE_URL}
spring.datasource.username=${SPRING_DATASOURCE_USERNAME}
spring.datasource.password=${SPRING_DATASOURCE_PASSWORD}
spring.datasource.driver-class-name=org.postgresql.Driver

store.cardano.protocol-magic=${STORE_CARDANO_PROTOCOL_MAGIC}
store.cardano.host=${STORE_CARDANO_HOST}
store.cardano.port=${STORE_CARDANO_PORT}
store.cardano.n2n-host=${STORE_CARDANO_HOST}
store.cardano.n2n-port=${STORE_CARDANO_PORT}

store.governance.enabled=true
store.staking.enabled=true
store.transactions.enabled=true
store.blocks.enabled=true
store.metadata.enabled=true
store.utxo.enabled=true
store.assets.enabled=false
store.epoch.enabled=true

store.parallel-processing=${STORE_PARALLEL_PROCESSING}
store.virtual-threads-enabled=${STORE_VIRTUAL_THREADS_ENABLED}

# Performance tuning for faster sync
# Batch size for bulk inserts (reduced to prevent OOM - increase gradually if memory allows)
store.batch-size=${STORE_BATCH_SIZE}
# Number of parallel workers for processing (reduced to prevent memory pressure)
store.parallel-workers=${STORE_PARALLEL_WORKERS}

# Database connection pool settings (reduced to save memory)
spring.datasource.hikari.maximum-pool-size=${SPRING_DATASOURCE_HIKARI_MAX_POOL_SIZE}
spring.datasource.hikari.minimum-idle=${SPRING_DATASOURCE_HIKARI_MIN_IDLE}
spring.datasource.hikari.connection-timeout=${SPRING_DATASOURCE_HIKARI_CONNECTION_TIMEOUT}
spring.datasource.hikari.idle-timeout=${SPRING_DATASOURCE_HIKARI_IDLE_TIMEOUT}

# JPA/Hibernate batch settings for bulk inserts (reduced to match batch-size)
spring.jpa.properties.hibernate.jdbc.batch_size=${SPRING_JPA_BATCH_SIZE}
# Disable second-level cache to save memory
spring.jpa.properties.hibernate.cache.use_second_level_cache=false
spring.jpa.properties.hibernate.cache.use_query_cache=false
spring.jpa.properties.hibernate.order_inserts=true
spring.jpa.properties.hibernate.order_updates=true
spring.jpa.properties.hibernate.jdbc.batch_versioned_data=true

# Disable unnecessary features during initial sync for speed
# Re-enable after sync completes if needed
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=false

logging.level.com.bloxbean.cardano.yaci=INFO
logging.level.com.bloxbean.cardano.yaci.store=INFO
PROPERTIES_EOF

# Substitute environment variables
envsubst < /app/application.properties > /app/application.properties.tmp
mv /app/application.properties.tmp /app/application.properties

echo "Starting Yaci Store with configuration:"
cat /app/application.properties | grep -v password | grep -v "spring.datasource.password"

# JVM memory settings for better performance
# Adjust based on available memory in Render worker instance
# -Xms: Initial heap size
# -Xmx: Maximum heap size (increased to prevent OOM)
# -XX:+UseG1GC: Use G1 garbage collector (better for large heaps)
# -XX:MaxGCPauseMillis: Target max GC pause time
# -XX:+HeapDumpOnOutOfMemoryError: Create heap dump on OOM for debugging
# -XX:+ExitOnOutOfMemoryError: Exit immediately on OOM (prevents hanging)
JVM_OPTS="${JVM_OPTS:--Xms512m -Xmx3g -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/heapdump.hprof -XX:+ExitOnOutOfMemoryError}"

echo "JVM Options: $JVM_OPTS"
echo "Available memory: $(free -h 2>/dev/null | grep Mem | awk '{print $7}' || echo 'unknown')"

exec java $JVM_OPTS -jar /app/yaci-store.jar

