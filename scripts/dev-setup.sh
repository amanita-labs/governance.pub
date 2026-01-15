#!/bin/bash

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="yaci_store"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-password}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKEND_PORT="${PORT:-8080}"

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INDEXER_DIR="$PROJECT_ROOT/backend/indexer"
BACKEND_DIR="$PROJECT_ROOT/backend"

# PID files for cleanup
YACI_PID_FILE="/tmp/yaci-store.pid"
BACKEND_PID_FILE="/tmp/govtwool-backend.pid"

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    
    if [ -f "$YACI_PID_FILE" ]; then
        YACI_PID=$(cat "$YACI_PID_FILE")
        if ps -p "$YACI_PID" > /dev/null 2>&1; then
            echo "Stopping Yaci Store (PID: $YACI_PID)..."
            kill "$YACI_PID" 2>/dev/null || true
        fi
        rm -f "$YACI_PID_FILE"
    fi
    
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE")
        if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
            echo "Stopping Backend (PID: $BACKEND_PID)..."
            kill "$BACKEND_PID" 2>/dev/null || true
        fi
        rm -f "$BACKEND_PID_FILE"
    fi
    
    echo -e "${GREEN}Cleanup complete${NC}"
}

# Set trap for cleanup on exit
trap cleanup EXIT INT TERM

# Print colored message
print_message() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_message "$BLUE" "Checking prerequisites..."
    
    local missing=0
    
    if ! command_exists java; then
        print_message "$RED" "✗ Java not found. Please install Java 21+"
        missing=1
    else
        JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | sed '/^1\./s///' | cut -d'.' -f1)
        if [ "$JAVA_VERSION" -lt 21 ] 2>/dev/null; then
            print_message "$RED" "✗ Java version $JAVA_VERSION found, but Java 21+ is required"
            missing=1
        else
            print_message "$GREEN" "✓ Java $JAVA_VERSION found"
        fi
    fi
    
    if ! command_exists psql; then
        print_message "$RED" "✗ PostgreSQL client (psql) not found. Please install PostgreSQL"
        missing=1
    else
        print_message "$GREEN" "✓ PostgreSQL client found"
    fi
    
    if ! command_exists cargo; then
        print_message "$RED" "✗ Rust/Cargo not found. Please install Rust"
        missing=1
    else
        print_message "$GREEN" "✓ Rust/Cargo found"
    fi
    
    if [ $missing -eq 1 ]; then
        print_message "$RED" "\nPlease install missing prerequisites and try again."
        exit 1
    fi
    
    print_message "$GREEN" "\nAll prerequisites met!\n"
}

# Check PostgreSQL connection
check_postgres() {
    print_message "$BLUE" "Checking PostgreSQL connection..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
        print_message "$GREEN" "✓ PostgreSQL connection successful"
    else
        print_message "$RED" "✗ Cannot connect to PostgreSQL"
        print_message "$YELLOW" "Please ensure PostgreSQL is running and credentials are correct:"
        print_message "$YELLOW" "  Host: $DB_HOST"
        print_message "$YELLOW" "  Port: $DB_PORT"
        print_message "$YELLOW" "  User: $DB_USER"
        print_message "$YELLOW" "\nYou can set these via environment variables:"
        print_message "$YELLOW" "  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD"
        exit 1
    fi
    
    unset PGPASSWORD
}

# Setup database
setup_database() {
    print_message "$BLUE" "Setting up database..."
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Check if database exists
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        print_message "$GREEN" "✓ Database '$DB_NAME' already exists"
    else
        print_message "$YELLOW" "Creating database '$DB_NAME'..."
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" >/dev/null 2>&1; then
            print_message "$GREEN" "✓ Database created successfully"
        else
            print_message "$RED" "✗ Failed to create database"
            exit 1
        fi
    fi
    
    unset PGPASSWORD
}

# Check Yaci Store JAR
check_yaci_store() {
    print_message "$BLUE" "Checking for Yaci Store..." >&2
    
    local jar_file=$(find "$INDEXER_DIR" -name "yaci-store-all-*.jar" 2>/dev/null | head -n 1)
    
    if [ -z "$jar_file" ]; then
        print_message "$RED" "✗ Yaci Store JAR not found in $INDEXER_DIR" >&2
        print_message "$YELLOW" "\nPlease download Yaci Store:" >&2
        print_message "$YELLOW" "  1. Visit https://github.com/bloxbean/yaci-store/releases" >&2
        print_message "$YELLOW" "  2. Download yaci-store-all-<version>.jar" >&2
        print_message "$YELLOW" "  3. Place it in the $INDEXER_DIR directory" >&2
        print_message "$YELLOW" "\nOr run: ./scripts/download-yaci-store.sh" >&2
        exit 1
    fi
    
    print_message "$GREEN" "✓ Found Yaci Store: $(basename "$jar_file")" >&2
    # Output ONLY the jar file path to stdout (for capture)
    echo "$jar_file"
}

# Update Yaci Store configuration
update_yaci_config() {
    local jar_file=$1
    local config_file="$INDEXER_DIR/application.properties"
    
    print_message "$BLUE" "Updating Yaci Store configuration..."
    
    if [ ! -f "$config_file" ]; then
        print_message "$RED" "✗ Configuration file not found: $config_file"
        exit 1
    fi
    
    # Update database URL in config
    local db_url="jdbc:postgresql://$DB_HOST:$DB_PORT/$DB_NAME"
    
    # Use sed to update the config file
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|spring.datasource.url=.*|spring.datasource.url=$db_url|" "$config_file"
        sed -i '' "s|spring.datasource.username=.*|spring.datasource.username=$DB_USER|" "$config_file"
        sed -i '' "s|spring.datasource.password=.*|spring.datasource.password=$DB_PASSWORD|" "$config_file"
    else
        # Linux
        sed -i "s|spring.datasource.url=.*|spring.datasource.url=$db_url|" "$config_file"
        sed -i "s|spring.datasource.username=.*|spring.datasource.username=$DB_USER|" "$config_file"
        sed -i "s|spring.datasource.password=.*|spring.datasource.password=$DB_PASSWORD|" "$config_file"
    fi
    
    print_message "$GREEN" "✓ Configuration updated"
    
    # Check if socket file exists
    local socket_path="${HOME}/cardano/node/sockets/preview-node.socket"
    if [ -S "$socket_path" ]; then
        print_message "$GREEN" "✓ Cardano node socket found: $socket_path"
    else
        print_message "$YELLOW" "⚠️  Cardano node socket not found at: $socket_path"
        print_message "$YELLOW" "   Please verify the socket path in $config_file"
        print_message "$YELLOW" "   Current path: store.cardano.n2c-node-socket-path"
    fi
}

# Start Yaci Store
start_yaci_store() {
    local jar_file=$1
    
    print_message "$BLUE" "Starting Yaci Store..."
    
    cd "$INDEXER_DIR"
    
    # Check if already running
    if [ -f "$YACI_PID_FILE" ]; then
        local old_pid=$(cat "$YACI_PID_FILE")
        if ps -p "$old_pid" > /dev/null 2>&1; then
            print_message "$YELLOW" "Yaci Store is already running (PID: $old_pid)"
            return
        fi
    fi
    
    # Start Yaci Store in background
    # Redirect only Java output to log file, not script output
    cd "$INDEXER_DIR"
    
    # Convert to absolute path if relative, and verify it's clean
    if [[ "$jar_file" != /* ]]; then
        jar_file="$(cd "$INDEXER_DIR" && pwd)/$(basename "$jar_file")"
    fi
    
    # Verify jar file exists and is readable
    if [ ! -f "$jar_file" ] || [ ! -r "$jar_file" ]; then
        print_message "$RED" "✗ JAR file not found or not readable: $jar_file" >&2
        exit 1
    fi
    
    # Start Java with clean environment - only Java output goes to log
    nohup java -jar "$jar_file" > yaci-store.log 2>&1 </dev/null &
    local yaci_pid=$!
    echo "$yaci_pid" > "$YACI_PID_FILE"
    cd "$PROJECT_ROOT"
    
    # Verify process started
    sleep 1
    if ! ps -p "$yaci_pid" > /dev/null 2>&1; then
        print_message "$RED" "✗ Yaci Store process failed to start" >&2
        if [ -f "$INDEXER_DIR/yaci-store.log" ]; then
            print_message "$YELLOW" "Last 10 lines of log:" >&2
            tail -10 "$INDEXER_DIR/yaci-store.log" >&2
        fi
        exit 1
    fi
    
    print_message "$GREEN" "✓ Yaci Store started (PID: $yaci_pid)" >&2
    print_message "$YELLOW" "  Logs: $INDEXER_DIR/yaci-store.log" >&2
    print_message "$YELLOW" "  Waiting for initialization..." >&2
    
    # Wait a bit for startup
    sleep 5
    
    # Check if still running
    if ! ps -p "$yaci_pid" > /dev/null 2>&1; then
        print_message "$RED" "✗ Yaci Store failed to start. Check logs: $INDEXER_DIR/yaci-store.log" >&2
        if [ -f "$INDEXER_DIR/yaci-store.log" ]; then
            print_message "$YELLOW" "Last 20 lines of log:" >&2
            tail -20 "$INDEXER_DIR/yaci-store.log" >&2
        fi
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
}

# Setup backend environment
setup_backend_env() {
    print_message "$BLUE" "Setting up backend environment..."
    
    local env_file="$BACKEND_DIR/.env"
    local env_example="$BACKEND_DIR/.env.example"
    
    if [ ! -f "$env_example" ]; then
        print_message "$RED" "✗ .env.example not found"
        exit 1
    fi
    
    if [ ! -f "$env_file" ]; then
        print_message "$YELLOW" "Creating .env file from .env.example..."
        cp "$env_example" "$env_file"
    fi
    
    # Update DATABASE_URL
    local db_url="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if grep -q "^DATABASE_URL=" "$env_file"; then
            sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=$db_url|" "$env_file"
        else
            echo "DATABASE_URL=$db_url" >> "$env_file"
        fi
        sed -i '' "s|^PORT=.*|PORT=$BACKEND_PORT|" "$env_file"
    else
        # Linux
        if grep -q "^DATABASE_URL=" "$env_file"; then
            sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$db_url|" "$env_file"
        else
            echo "DATABASE_URL=$db_url" >> "$env_file"
        fi
        sed -i "s|^PORT=.*|PORT=$BACKEND_PORT|" "$env_file"
    fi
    
    print_message "$GREEN" "✓ Backend environment configured"
}

# Check backend compilation
check_backend() {
    print_message "$BLUE" "Checking backend compilation..."
    
    cd "$BACKEND_DIR"
    
    if cargo check >/dev/null 2>&1; then
        print_message "$GREEN" "✓ Backend compiles successfully"
    else
        print_message "$YELLOW" "⚠️  Backend has compilation warnings/errors"
        print_message "$YELLOW" "   Run 'cargo check' in $BACKEND_DIR for details"
    fi
    
    cd "$PROJECT_ROOT"
}

# Start backend
start_backend() {
    print_message "$BLUE" "Starting backend..."
    
    cd "$BACKEND_DIR"
    
    # Check if already running
    if [ -f "$BACKEND_PID_FILE" ]; then
        local old_pid=$(cat "$BACKEND_PID_FILE")
        if ps -p "$old_pid" > /dev/null 2>&1; then
            print_message "$YELLOW" "Backend is already running (PID: $old_pid)"
            return
        fi
    fi
    
    # Start backend in background
    # Redirect only cargo output to log file, not script output
    cd "$BACKEND_DIR"
    nohup cargo run > backend.log 2>&1 </dev/null &
    local backend_pid=$!
    echo "$backend_pid" > "$BACKEND_PID_FILE"
    cd "$PROJECT_ROOT"
    
    # Verify PID file was written correctly
    if [ ! -f "$BACKEND_PID_FILE" ] || [ -z "$(cat "$BACKEND_PID_FILE")" ]; then
        print_message "$RED" "✗ Failed to write backend PID file" >&2
        exit 1
    fi
    
    local backend_pid=$(cat "$BACKEND_PID_FILE")
    
    print_message "$GREEN" "✓ Backend started (PID: $backend_pid)" >&2
    print_message "$YELLOW" "  Logs: $BACKEND_DIR/backend.log" >&2
    print_message "$YELLOW" "  Waiting for startup..." >&2
    
    # Wait for backend to start
    sleep 3
    
    # Check if still running
    if ! ps -p "$backend_pid" > /dev/null 2>&1; then
        print_message "$RED" "✗ Backend failed to start. Check logs: $BACKEND_DIR/backend.log" >&2
        if [ -f "$BACKEND_DIR/backend.log" ]; then
            print_message "$YELLOW" "Last 20 lines of log:" >&2
            tail -20 "$BACKEND_DIR/backend.log" >&2
        fi
        exit 1
    fi
    
    # Try to check health endpoint
    sleep 2
    if curl -s "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
        print_message "$GREEN" "✓ Backend is responding" >&2
    else
        print_message "$YELLOW" "⚠️  Backend started but health check failed (may still be initializing)" >&2
    fi
    
    cd "$PROJECT_ROOT"
}

# Print status
print_status() {
    print_message "$GREEN" "\n=========================================="
    print_message "$GREEN" "Development environment is running!"
    print_message "$GREEN" "==========================================\n"
    
    print_message "$BLUE" "Services:"
    if [ -f "$YACI_PID_FILE" ]; then
        local yaci_pid=$(cat "$YACI_PID_FILE")
        if ps -p "$yaci_pid" > /dev/null 2>&1; then
            print_message "$GREEN" "  ✓ Yaci Store (PID: $yaci_pid)"
            print_message "$YELLOW" "    Logs: $INDEXER_DIR/yaci-store.log"
        else
            print_message "$RED" "  ✗ Yaci Store (not running)"
        fi
    else
        print_message "$RED" "  ✗ Yaci Store (not started)"
    fi
    
    if [ -f "$BACKEND_PID_FILE" ]; then
        local backend_pid=$(cat "$BACKEND_PID_FILE")
        if ps -p "$backend_pid" > /dev/null 2>&1; then
            print_message "$GREEN" "  ✓ Backend (PID: $backend_pid)"
            print_message "$YELLOW" "    URL: http://localhost:$BACKEND_PORT"
            print_message "$YELLOW" "    Logs: $BACKEND_DIR/backend.log"
        else
            print_message "$RED" "  ✗ Backend (not running)"
        fi
    else
        print_message "$RED" "  ✗ Backend (not started)"
    fi
    
    print_message "$BLUE" "\nUseful commands:"
    print_message "$YELLOW" "  Health check: curl http://localhost:$BACKEND_PORT/health"
    print_message "$YELLOW" "  View Yaci logs: tail -f $INDEXER_DIR/yaci-store.log"
    print_message "$YELLOW" "  View backend logs: tail -f $BACKEND_DIR/backend.log"
    print_message "$YELLOW" "  Stop services: Press Ctrl+C or run: pkill -f yaci-store; pkill -f govtwool-backend"
    
    print_message "$BLUE" "\nNext steps:"
    print_message "$YELLOW" "  1. Wait for Yaci Store to sync (check logs)"
    print_message "$YELLOW" "  2. Inspect database schema: psql -U $DB_USER -d $DB_NAME"
    print_message "$YELLOW" "  3. Implement SQL queries in backend/src/db/queries.rs"
    print_message "$YELLOW" "  4. Test API endpoints"
    
    print_message "$GREEN" "\nPress Ctrl+C to stop all services\n"
}

# Main execution
main() {
    print_message "$GREEN" "=========================================="
    print_message "$GREEN" "GovTwool Development Environment Setup"
    print_message "$GREEN" "==========================================\n"
    
    check_prerequisites
    check_postgres
    setup_database
    
    # Capture jar_file path (stdout only), messages go to stderr
    local jar_file=$(check_yaci_store 2>/dev/null)
    if [ -z "$jar_file" ] || [ ! -f "$jar_file" ]; then
        print_message "$RED" "✗ Failed to find Yaci Store JAR" >&2
        exit 1
    fi
    update_yaci_config "$jar_file"
    start_yaci_store "$jar_file"
    
    setup_backend_env
    check_backend
    start_backend
    
    print_status
    
    # Wait for user interrupt
    wait
}

# Run main function
main

