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

# Check if test environment is already running
HOST_RUNNING=$(curl -s http://localhost:8080/api/health 2>/dev/null && echo "true" || echo "false")
SIGNALING_RUNNING=$(nc -z localhost 5175 2>/dev/null && echo "true" || echo "false")
PWA_RUNNING=$(curl -s http://localhost:5174/ 2>/dev/null && echo "true" || echo "false")

if [ "$HOST_RUNNING" = "false" ] || [ "$SIGNALING_RUNNING" = "false" ] || [ "$PWA_RUNNING" = "false" ]; then
    log_info "🚀 Starting test environment..."
    ./scripts/start-test-environment.sh
    log_success "✅ Test environment ready"
else
    log_info "🔧 Using existing running Vibe Coder services"
fi

log_info "🧪 Running E2E tests..."

# Run global setup and E2E tests
pnpm exec playwright test "$@"
TEST_EXIT_CODE=$?

# Cleanup function
cleanup() {
    log_info "🧹 Cleaning up test environment..."
    rm -f .test-config.json 2>/dev/null || true
    log_success "✅ Test configuration cleaned up"
    log_info "🎯 Test environment teardown complete"
}

# Set trap for cleanup
trap cleanup EXIT

# Check test results
if [ $TEST_EXIT_CODE -eq 0 ]; then
    log_success "🎉 All E2E tests passed!"
else
    log_error "❌ Some E2E tests failed (exit code: $TEST_EXIT_CODE)"
    
    # Show helpful information
    echo ""
    log_info "To open last HTML report run:"
    echo ""
    echo -e "  ${GREEN}pnpm exec playwright show-report${NC}"
    echo ""
fi

exit $TEST_EXIT_CODE