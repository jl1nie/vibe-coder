#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if servers are already running
HOST_RUNNING=$(curl -s http://localhost:8080/api/health 2>/dev/null && echo "true" || echo "false")
SIGNALING_RUNNING=$(curl -s http://localhost:5174/ 2>/dev/null && echo "true" || echo "false")

STARTED_SERVERS=false

if [ "$HOST_RUNNING" = "false" ] || [ "$SIGNALING_RUNNING" = "false" ]; then
    log_info "🚀 Starting Vibe Coder in development mode for E2E tests..."
    
    # Start Vibe Coder in development mode (background)
    ./scripts/vibe-coder dev > vibe-coder-test.log 2>&1 &
    VIBE_CODER_PID=$!
    STARTED_SERVERS=true
    
    log_info "⏳ Waiting for Vibe Coder services to start..."
    
    # Wait for servers to be ready (max 90 seconds)
    for i in {1..90}; do
        HOST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/health 2>/dev/null)
        SIGNALING_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5174/ 2>/dev/null)
        
        if [ "$HOST_STATUS" = "200" ] && [ "$SIGNALING_STATUS" = "200" ]; then
            log_success "✅ Vibe Coder services are ready! (Host: $HOST_STATUS, Signaling: $SIGNALING_STATUS)"
            break
        fi
        
        if [ $((i % 15)) -eq 0 ]; then
            log_info "   Attempt $i/90 - Host: $HOST_STATUS, Signaling: $SIGNALING_STATUS"
        fi
        
        if [ $i -eq 90 ]; then
            log_error "❌ Vibe Coder services failed to start within 90 seconds"
            log_error "   Final status - Host: $HOST_STATUS, Signaling: $SIGNALING_STATUS"
            if [ "$STARTED_SERVERS" = "true" ]; then
                log_info "Vibe Coder logs:"
                tail -20 vibe-coder-test.log 2>/dev/null || echo "No logs available"
                kill $VIBE_CODER_PID 2>/dev/null || true
                ./scripts/vibe-coder stop 2>/dev/null || true
            fi
            exit 1
        fi
        sleep 1
    done
else
    log_info "🔧 Using existing running Vibe Coder services"
fi

# Function to cleanup if we started servers
cleanup() {
    if [ "$STARTED_SERVERS" = "true" ]; then
        log_info "🧹 Cleaning up Vibe Coder services..."
        kill $VIBE_CODER_PID 2>/dev/null || true
        ./scripts/vibe-coder stop 2>/dev/null || true
        rm -f vibe-coder-test.log
        log_success "✅ Cleanup completed"
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Run the E2E tests
log_info "🧪 Running E2E tests..."
npx playwright test --config=playwright.config.ts "$@"

log_success "🎉 E2E tests completed!"