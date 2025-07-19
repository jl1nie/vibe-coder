#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[TEST-ENV]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[TEST-ENV]${NC} $1"
}

log_error() {
    echo -e "${RED}[TEST-ENV]${NC} $1"
}

cleanup() {
    log_info "🧹 Cleaning up test environment..."
    
    # Kill PWA test server if started by this script
    if [ ! -z "$PWA_PID" ]; then
        kill $PWA_PID 2>/dev/null || true
        log_info "Stopped PWA test server (PID: $PWA_PID)"
    fi
    
    # Stop Docker services if started by this script
    if [ "$STARTED_DOCKER" = "true" ]; then
        docker compose -f docker-compose.dev.yml down >/dev/null 2>&1 || true
        log_info "Stopped Docker services"
    fi
    
    log_success "✅ Test environment cleanup complete"
}

# Set up cleanup trap
trap cleanup EXIT

log_info "🚀 Starting Vibe Coder test environment..."

# Check if Docker services are running
DOCKER_RUNNING=$(docker compose -f docker-compose.dev.yml ps --services --filter "status=running" 2>/dev/null | wc -l)
STARTED_DOCKER=false

if [ "$DOCKER_RUNNING" -lt 2 ]; then
    log_info "📦 Starting Docker services (host + signaling)..."
    docker compose -f docker-compose.dev.yml up -d
    STARTED_DOCKER=true
    
    # Wait for Docker services to be ready
    log_info "⏳ Waiting for Docker services to be healthy..."
    for i in {1..30}; do
        HOST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/health 2>/dev/null)
        SIGNALING_STATUS=$(nc -z localhost 5175 2>/dev/null && echo "200" || echo "000")
        
        if [ "$HOST_STATUS" = "200" ] && [ "$SIGNALING_STATUS" = "200" ]; then
            log_success "✅ Docker services are ready!"
            break
        fi
        
        if [ $i -eq 30 ]; then
            log_error "❌ Docker services failed to start within 30 seconds"
            exit 1
        fi
        
        sleep 1
    done
else
    log_info "📦 Using existing Docker services"
fi

# Check if PWA test server is running
PWA_RUNNING=$(curl -s http://localhost:5174/ 2>/dev/null && echo "true" || echo "false")

if [ "$PWA_RUNNING" = "false" ]; then
    log_info "🌐 Starting PWA development server..."
    cd apps/web
    
    # Start PWA development server with test environment variables
    log_info "🚀 Starting PWA dev server (React needs dev environment)..."
    npm run dev:test &
    PWA_PID=$!
    cd ../..
    
    # Wait for PWA to be ready
    log_info "⏳ Waiting for PWA server to be ready..."
    for i in {1..30}; do
        PWA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5174/ 2>/dev/null)
        
        if [ "$PWA_STATUS" = "200" ]; then
            log_success "✅ PWA dev server is ready!"
            break
        fi
        
        if [ $i -eq 30 ]; then
            log_error "❌ PWA dev server failed to start within 30 seconds"
            exit 1
        fi
        
        sleep 1
    done
else
    log_info "🌐 Using existing PWA server"
fi

log_success "🎉 Test environment is ready!"
log_info "📊 Service Status:"
log_info "   • Host Server: http://localhost:8080"
log_info "   • Signaling Server: ws://localhost:5175"
log_info "   • PWA Server: http://localhost:5174"

# If running in interactive mode, keep services running
if [ "$1" = "--interactive" ]; then
    log_info "🔄 Running in interactive mode. Press Ctrl+C to stop services."
    
    # Keep script running and show logs
    tail -f vibe-coder-test.log 2>/dev/null &
    
    # Wait for user interrupt
    while true; do
        sleep 1
    done
else
    log_info "✅ Test environment started successfully"
    log_info "💡 Use './scripts/start-test-environment.sh --interactive' to keep services running"
fi