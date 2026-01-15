#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INDEXER_DIR="$PROJECT_ROOT/backend/indexer"

print_message() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Check if curl or wget is available
if command -v curl >/dev/null 2>&1; then
    DOWNLOAD_CMD="curl -L -o"
elif command -v wget >/dev/null 2>&1; then
    DOWNLOAD_CMD="wget -O"
else
    print_message "$RED" "✗ Neither curl nor wget found. Please install one of them."
    exit 1
fi

print_message "$BLUE" "Downloading Yaci Store..."

# Try to get latest release from GitHub API
print_message "$YELLOW" "Fetching latest release information..."

if command -v curl >/dev/null 2>&1; then
    LATEST_RELEASE=$(curl -s https://api.github.com/repos/bloxbean/yaci-store/releases/latest 2>/dev/null)
elif command -v wget >/dev/null 2>&1; then
    LATEST_RELEASE=$(wget -qO- https://api.github.com/repos/bloxbean/yaci-store/releases/latest 2>/dev/null)
fi

if [ -z "$LATEST_RELEASE" ]; then
    print_message "$YELLOW" "Could not fetch release info. Please download manually:"
    print_message "$YELLOW" "  1. Visit https://github.com/bloxbean/yaci-store/releases"
    print_message "$YELLOW" "  2. Download yaci-store-all-<version>.jar"
    print_message "$YELLOW" "  3. Place it in: $INDEXER_DIR"
    exit 1
fi

# Extract download URL for the JAR file
if command -v grep >/dev/null 2>&1 && command -v sed >/dev/null 2>&1; then
    JAR_URL=$(echo "$LATEST_RELEASE" | grep -o '"browser_download_url": "[^"]*yaci-store-all[^"]*\.jar"' | head -n 1 | sed 's/"browser_download_url": "\(.*\)"/\1/')
    VERSION=$(echo "$LATEST_RELEASE" | grep -o '"tag_name": "[^"]*"' | head -n 1 | sed 's/"tag_name": "\(.*\)"/\1/')
else
    print_message "$YELLOW" "Could not parse release info. Please download manually:"
    print_message "$YELLOW" "  1. Visit https://github.com/bloxbean/yaci-store/releases"
    print_message "$YELLOW" "  2. Download yaci-store-all-<version>.jar"
    print_message "$YELLOW" "  3. Place it in: $INDEXER_DIR"
    exit 1
fi

if [ -z "$JAR_URL" ]; then
    print_message "$RED" "✗ Could not find JAR download URL"
    print_message "$YELLOW" "\nPlease download manually:"
    print_message "$YELLOW" "  1. Visit https://github.com/bloxbean/yaci-store/releases"
    print_message "$YELLOW" "  2. Download yaci-store-all-<version>.jar"
    print_message "$YELLOW" "  3. Place it in: $INDEXER_DIR"
    exit 1
fi

print_message "$GREEN" "Found release: $VERSION"
print_message "$BLUE" "Download URL: $JAR_URL"

# Extract filename from URL
JAR_FILENAME=$(basename "$JAR_URL")
OUTPUT_FILE="$INDEXER_DIR/$JAR_FILENAME"

# Check if file already exists
if [ -f "$OUTPUT_FILE" ]; then
    print_message "$YELLOW" "File already exists: $JAR_FILENAME"
    read -p "Do you want to download again? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_message "$GREEN" "Using existing file: $JAR_FILENAME"
        exit 0
    fi
    rm -f "$OUTPUT_FILE"
fi

# Create indexer directory if it doesn't exist
mkdir -p "$INDEXER_DIR"

# Download the file
print_message "$BLUE" "Downloading to: $OUTPUT_FILE"
print_message "$YELLOW" "This may take a few minutes..."

if $DOWNLOAD_CMD "$OUTPUT_FILE" "$JAR_URL"; then
    print_message "$GREEN" "✓ Download complete: $JAR_FILENAME"
    
    # Verify it's a valid JAR file
    if file "$OUTPUT_FILE" | grep -q "Java archive\|Zip archive"; then
        print_message "$GREEN" "✓ File verified as valid JAR"
    else
        print_message "$YELLOW" "⚠️  Warning: File may not be a valid JAR"
    fi
    
    print_message "$GREEN" "\nYaci Store is ready to use!"
    print_message "$BLUE" "Run: ./scripts/dev-setup.sh"
else
    print_message "$RED" "✗ Download failed"
    print_message "$YELLOW" "\nPlease download manually:"
    print_message "$YELLOW" "  1. Visit https://github.com/bloxbean/yaci-store/releases"
    print_message "$YELLOW" "  2. Download yaci-store-all-<version>.jar"
    print_message "$YELLOW" "  3. Place it in: $INDEXER_DIR"
    exit 1
fi

