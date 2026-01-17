#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Stopping development services...${NC}"

# Stop Yaci Store
YACI_PID_FILE="/tmp/yaci-store.pid"
if [ -f "$YACI_PID_FILE" ]; then
    YACI_PID=$(cat "$YACI_PID_FILE")
    if ps -p "$YACI_PID" > /dev/null 2>&1; then
        echo -e "${GREEN}Stopping Yaci Store (PID: $YACI_PID)...${NC}"
        kill "$YACI_PID" 2>/dev/null || true
        sleep 1
        if ps -p "$YACI_PID" > /dev/null 2>&1; then
            kill -9 "$YACI_PID" 2>/dev/null || true
        fi
    fi
    rm -f "$YACI_PID_FILE"
fi

# Stop Backend
BACKEND_PID_FILE="/tmp/govtwool-backend.pid"
if [ -f "$BACKEND_PID_FILE" ]; then
    BACKEND_PID=$(cat "$BACKEND_PID_FILE")
    if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
        echo -e "${GREEN}Stopping Backend (PID: $BACKEND_PID)...${NC}"
        kill "$BACKEND_PID" 2>/dev/null || true
        sleep 1
        if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
            kill -9 "$BACKEND_PID" 2>/dev/null || true
        fi
    fi
    rm -f "$BACKEND_PID_FILE"
fi

# Also try to kill by process name (fallback)
pkill -f "yaci-store" 2>/dev/null || true
pkill -f "govtwool-backend" 2>/dev/null || true

echo -e "${GREEN}All services stopped${NC}"

