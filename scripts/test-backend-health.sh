#!/bin/bash

# Test script for backend health endpoints
# Usage: ./scripts/test-backend-health.sh [base_url]
# Default: https://govtwool-backend-p9k5.onrender.com

BASE_URL="${1:-https://govtwool-backend-p9k5.onrender.com}"

echo "🔍 Testing Backend Health Endpoints"
echo "===================================="
echo "Base URL: $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test an endpoint
test_endpoint() {
    local endpoint=$1
    local name=$2
    local url="${BASE_URL}${endpoint}"
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📡 Testing: $name"
    echo "   GET $url"
    echo ""
    
    response=$(curl -s -w "\n%{http_code}" "$url" 2>&1)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ Status: $http_code OK${NC}"
        echo ""
        echo "Response:"
        echo "$body" | jq . 2>/dev/null || echo "$body"
    elif [ "$http_code" = "503" ]; then
        echo -e "${YELLOW}⚠ Status: $http_code Service Unavailable (degraded)${NC}"
        echo ""
        echo "Response:"
        echo "$body" | jq . 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ Status: $http_code Error${NC}"
        echo ""
        echo "Response:"
        echo "$body"
    fi
    echo ""
}

# Test all endpoints
test_endpoint "/health" "Overall Health Check"
test_endpoint "/health/database" "Database Health"
test_endpoint "/health/indexer" "Indexer Health"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Testing complete!"
echo ""
echo "Quick test commands:"
echo "  curl $BASE_URL/health | jq ."
echo "  curl $BASE_URL/health/database | jq ."
echo "  curl $BASE_URL/health/indexer | jq ."
