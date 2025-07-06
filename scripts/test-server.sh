#!/bin/bash

# Vibe Coder Host Server Test Script
# Usage: ./scripts/test-server.sh

set -e

# Configuration
SERVER_URL="http://localhost:8080"
TIMEOUT=5
HOST_DIR="/home/minoru/src/vibe-coder/packages/host"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARN:${NC} $1"
}

# Check if server is running
check_server() {
    log "Checking server status..."
    if curl --max-time 2 -s "$SERVER_URL/" >/dev/null 2>&1; then
        return 0  # Server is running
    else
        return 1  # Server is not running
    fi
}

# Start server
start_server() {
    log "Starting Vibe Coder Host Server..."
    cd "$HOST_DIR"
    
    # Kill any existing processes
    pkill -f "tsx watch" 2>/dev/null || true
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    
    # Start server in background
    nohup npm run dev > server.log 2>&1 &
    SERVER_PID=$!
    echo $SERVER_PID > server.pid
    
    # Wait for server to start
    for i in {1..10}; do
        if check_server; then
            log "Server started successfully (PID: $SERVER_PID)"
            return 0
        fi
        sleep 1
    done
    
    error "Server failed to start"
    return 1
}

# Stop server
stop_server() {
    log "Stopping server..."
    if [ -f "$HOST_DIR/server.pid" ]; then
        PID=$(cat "$HOST_DIR/server.pid")
        kill $PID 2>/dev/null || true
        rm -f "$HOST_DIR/server.pid"
        log "Server stopped (PID: $PID)"
    fi
    pkill -f "tsx watch" 2>/dev/null || true
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
}

# Generate TOTP code
generate_totp() {
    local secret=$1
    cd "$HOST_DIR"
    node -e "
const speakeasy = require('speakeasy');
const token = speakeasy.totp({
  secret: '$secret',
  encoding: 'base32',
  time: Math.floor(Date.now() / 1000)
});
console.log(token);
"
}

# Test endpoints
test_endpoints() {
    log "Testing endpoints..."
    
    # Test health endpoint
    log "1. Testing health endpoint..."
    if curl --max-time $TIMEOUT -s "$SERVER_URL/api/health" | grep -q "status"; then
        log "✅ Health endpoint: OK"
    else
        error "❌ Health endpoint: FAILED"
        return 1
    fi
    
    # Test session creation
    log "2. Testing session creation..."
    SESSION_RESPONSE=$(curl --max-time $TIMEOUT -X POST -H "Content-Type: application/json" -s "$SERVER_URL/api/auth/sessions")
    SESSION_ID=$(echo "$SESSION_RESPONSE" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
    TOTP_SECRET=$(echo "$SESSION_RESPONSE" | grep -o '"totpSecret":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$SESSION_ID" ] && [ -n "$TOTP_SECRET" ]; then
        log "✅ Session creation: OK (Session: $SESSION_ID)"
    else
        error "❌ Session creation: FAILED"
        return 1
    fi
    
    # Test TOTP authentication
    log "3. Testing TOTP authentication..."
    TOTP_CODE=$(generate_totp "$TOTP_SECRET")
    AUTH_RESPONSE=$(curl --max-time $TIMEOUT -X POST -H "Content-Type: application/json" \
        -d "{\"totpCode\":\"$TOTP_CODE\"}" -s "$SERVER_URL/api/auth/sessions/$SESSION_ID/verify")
    JWT_TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$JWT_TOKEN" ]; then
        log "✅ TOTP authentication: OK"
    else
        error "❌ TOTP authentication: FAILED"
        return 1
    fi
    
    # Test echo command
    log "4. Testing echo command..."
    ECHO_RESPONSE=$(curl --max-time $TIMEOUT -X POST -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" -d '{"command":"echo Hello Test"}' \
        -s "$SERVER_URL/api/claude/execute")
    
    if echo "$ECHO_RESPONSE" | grep -q "Hello Test"; then
        log "✅ Echo command: OK"
    else
        error "❌ Echo command: FAILED"
        echo "Response: $ECHO_RESPONSE"
        return 1
    fi
    
    # Test WebRTC endpoints
    log "5. Testing WebRTC endpoints..."
    WEBRTC_RESPONSE=$(curl --max-time $TIMEOUT -H "Authorization: Bearer $JWT_TOKEN" \
        -s "$SERVER_URL/api/webrtc/connections")
    
    if echo "$WEBRTC_RESPONSE" | grep -q "connections"; then
        log "✅ WebRTC endpoints: OK"
    else
        error "❌ WebRTC endpoints: FAILED"
        return 1
    fi
    
    log "🎉 All endpoint tests passed!"
}

# Main function
main() {
    log "Starting Vibe Coder Host Server Test"
    
    case "${1:-test}" in
        "start")
            if check_server; then
                warn "Server is already running"
            else
                start_server
            fi
            ;;
        "stop")
            stop_server
            ;;
        "restart")
            stop_server
            sleep 2
            start_server
            ;;
        "test")
            if ! check_server; then
                start_server
                STARTED_BY_SCRIPT=true
            fi
            
            test_endpoints
            
            if [ "$STARTED_BY_SCRIPT" = true ]; then
                log "Stopping server (started by script)..."
                stop_server
            fi
            ;;
        *)
            echo "Usage: $0 {start|stop|restart|test}"
            echo "  start   - Start the server"
            echo "  stop    - Stop the server"
            echo "  restart - Restart the server"
            echo "  test    - Run endpoint tests (default)"
            exit 1
            ;;
    esac
    
    log "Test script completed"
}

main "$@"