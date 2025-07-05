#!/bin/bash

# 🧪 Vibe Coder Local User Testing Script
# ローカル環境でのユーザーテスト実施

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.local"

# Ports
SIGNALING_PORT=3001
PWA_PORT=3000
HOST_PORT=8080

# PIDs for cleanup
SIGNALING_PID=""
PWA_PID=""
HOST_PID=""

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_title() {
    echo -e "${PURPLE}🎯 $1${NC}"
}

log_url() {
    echo -e "${CYAN}🔗 $1${NC}"
}

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Please install Node.js: https://nodejs.org/"
        exit 1
    fi
}

# Load environment
load_environment() {
    if [[ -f "$ENV_FILE" ]]; then
        source "$ENV_FILE"
        log_success "Environment loaded from .env.local"
    else
        log_warning ".env.local not found, creating from example..."
        cp "$PROJECT_ROOT/.env.example" "$ENV_FILE"
        log_info "Please edit .env.local and set your CLAUDE_API_KEY"
        read -p "Press Enter after setting CLAUDE_API_KEY..."
        source "$ENV_FILE"
    fi
    
    if [[ -z "${CLAUDE_API_KEY:-}" ]]; then
        log_error "CLAUDE_API_KEY is required for testing"
        log_info "Please set CLAUDE_API_KEY in .env.local"
        exit 1
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Root dependencies
    cd "$PROJECT_ROOT"
    npm install
    
    # Signaling server dependencies
    if [[ -d "$PROJECT_ROOT/packages/signaling" ]]; then
        cd "$PROJECT_ROOT/packages/signaling"
        npm install
    fi
    
    # PWA dependencies (if exists)
    if [[ -d "$PROJECT_ROOT/apps/web" ]]; then
        cd "$PROJECT_ROOT/apps/web"
        npm install
    fi
    
    cd "$PROJECT_ROOT"
    log_success "Dependencies installed"
}

# Start signaling server
start_signaling_server() {
    log_info "Starting Signaling Server on port $SIGNALING_PORT..."
    
    cd "$PROJECT_ROOT/packages/signaling"
    
    # Create vercel.json for local development if not exists
    if [[ ! -f "vercel.json" ]]; then
        cat > vercel.json << 'EOF'
{
  "functions": {
    "api/*.ts": {
      "runtime": "@vercel/node"
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
EOF
    fi
    
    # Start vercel dev in background
    PORT=$SIGNALING_PORT npm run dev &
    SIGNALING_PID=$!
    
    # Wait for server to be ready
    log_info "Waiting for Signaling Server to be ready..."
    for i in {1..30}; do
        if curl -s "http://localhost:$SIGNALING_PORT/api" &>/dev/null; then
            break
        fi
        if [[ $i -eq 30 ]]; then
            log_error "Signaling Server failed to start"
            cleanup
            exit 1
        fi
        sleep 1
    done
    
    log_success "Signaling Server ready at http://localhost:$SIGNALING_PORT"
}

# Start PWA (if available)
start_pwa() {
    if [[ -d "$PROJECT_ROOT/apps/web" ]]; then
        log_info "Starting PWA on port $PWA_PORT..."
        
        cd "$PROJECT_ROOT/apps/web"
        
        # Update signaling server URL for local testing
        if [[ -f ".env.local" ]]; then
            sed -i.bak "s|SIGNALING_SERVER_URL=.*|SIGNALING_SERVER_URL=http://localhost:$SIGNALING_PORT|" .env.local
        else
            echo "SIGNALING_SERVER_URL=http://localhost:$SIGNALING_PORT" > .env.local
        fi
        
        # Start dev server
        PORT=$PWA_PORT npm run dev &
        PWA_PID=$!
        
        # Wait for PWA to be ready
        log_info "Waiting for PWA to be ready..."
        for i in {1..30}; do
            if curl -s "http://localhost:$PWA_PORT" &>/dev/null; then
                break
            fi
            if [[ $i -eq 30 ]]; then
                log_error "PWA failed to start"
                cleanup
                exit 1
            fi
            sleep 1
        done
        
        log_success "PWA ready at http://localhost:$PWA_PORT"
    else
        log_warning "PWA not found, using public PWA at https://vibe-coder.space"
    fi
}

# Start host server
start_host_server() {
    log_info "Starting Host Server on port $HOST_PORT..."
    
    cd "$PROJECT_ROOT"
    
    # Update signaling server URL for local testing
    export SIGNALING_SERVER_URL="http://localhost:$SIGNALING_PORT"
    export HOST_PORT="$HOST_PORT"
    
    # Start using the unified script
    npm run vibe-coder &
    HOST_PID=$!
    
    # Wait for host server to be ready
    log_info "Waiting for Host Server to be ready..."
    for i in {1..60}; do
        if curl -s "http://localhost:$HOST_PORT/health" &>/dev/null; then
            break
        fi
        if [[ $i -eq 60 ]]; then
            log_error "Host Server failed to start"
            cleanup
            exit 1
        fi
        sleep 2
    done
    
    log_success "Host Server ready at http://localhost:$HOST_PORT"
}

# Get server connection info
get_connection_info() {
    log_info "Getting connection information..."
    
    local server_id=""
    for i in {1..10}; do
        server_id=$(curl -s "http://localhost:$HOST_PORT/api/connection/id" 2>/dev/null || echo "")
        if [[ -n "$server_id" ]]; then
            break
        fi
        sleep 1
    done
    
    if [[ -n "$server_id" ]]; then
        log_success "Server ID: $server_id"
        echo "$server_id" > "$PROJECT_ROOT/.server-id"
    else
        log_warning "Could not retrieve Server ID"
    fi
}

# Display user testing information
show_user_testing_info() {
    clear
    log_title "🧪 Vibe Coder Local User Testing Ready!"
    echo
    
    log_info "📱 ユーザーテスト手順:"
    echo "  1. Chrome ブラウザを開く"
    if [[ -d "$PROJECT_ROOT/apps/web" ]]; then
        log_url "  2. PWA にアクセス: http://localhost:$PWA_PORT"
    else
        log_url "  2. 公式PWA にアクセス: https://vibe-coder.space"
    fi
    echo "  3. Server ID を入力"
    echo "  4. 接続ボタンをクリック"
    echo "  5. 音声コマンドやクイックコマンドを試す"
    echo
    
    log_info "🔗 アクセス情報:"
    if [[ -d "$PROJECT_ROOT/apps/web" ]]; then
        log_url "  PWA: http://localhost:$PWA_PORT"
    else
        log_url "  PWA: https://vibe-coder.space"
    fi
    log_url "  Host API: http://localhost:$HOST_PORT"
    log_url "  Signaling: http://localhost:$SIGNALING_PORT"
    echo
    
    if [[ -f "$PROJECT_ROOT/.server-id" ]]; then
        local server_id=$(cat "$PROJECT_ROOT/.server-id")
        log_success "📡 Server ID: $server_id"
    else
        log_warning "Server ID: 取得中..."
    fi
    echo
    
    log_info "🎤 テストシナリオ:"
    echo "  • 音声コマンド: 「認証機能を追加して」"
    echo "  • クイックコマンド: 🔐 Login ボタンをタップ"
    echo "  • ファイル操作: 「新しいファイルを作成して」"
    echo "  • バグ修正: 「このコードをレビューして」"
    echo
    
    log_info "📊 フィードバック収集:"
    echo "  • 操作の直感性"
    echo "  • レスポンス速度"
    echo "  • 音声認識の精度"
    echo "  • モバイルでの使いやすさ"
    echo
    
    log_warning "停止するには Ctrl+C を押してください"
}

# Cleanup function
cleanup() {
    log_info "Stopping services..."
    
    if [[ -n "$SIGNALING_PID" ]]; then
        kill $SIGNALING_PID 2>/dev/null || true
    fi
    
    if [[ -n "$PWA_PID" ]]; then
        kill $PWA_PID 2>/dev/null || true
    fi
    
    if [[ -n "$HOST_PID" ]]; then
        kill $HOST_PID 2>/dev/null || true
    fi
    
    # Stop any running docker containers
    docker stop vibe-coder-host 2>/dev/null || true
    
    log_success "Services stopped"
}

# Handle interrupts
trap cleanup EXIT INT TERM

# Open browser automatically
open_browser() {
    local url="$1"
    local os=$(uname -s)
    
    log_info "Opening browser..."
    
    case "$os" in
        "Darwin")
            open "$url"
            ;;
        "Linux")
            if command -v xdg-open &> /dev/null; then
                xdg-open "$url"
            elif command -v google-chrome &> /dev/null; then
                google-chrome "$url"
            fi
            ;;
        "MINGW"*|"CYGWIN"*|"MSYS"*)
            start "$url"
            ;;
    esac
}

# Main function
main() {
    log_title "🧪 Starting Vibe Coder Local User Testing"
    echo
    
    # Setup
    check_dependencies
    load_environment
    install_dependencies
    
    echo
    log_info "🚀 Starting all services..."
    
    # Start services in order
    start_signaling_server
    sleep 2
    
    start_pwa
    sleep 2
    
    start_host_server
    sleep 3
    
    # Get connection info
    get_connection_info
    
    # Show testing info
    show_user_testing_info
    
    # Open browser
    if [[ -d "$PROJECT_ROOT/apps/web" ]]; then
        open_browser "http://localhost:$PWA_PORT"
    else
        open_browser "https://vibe-coder.space"
    fi
    
    # Keep script running
    log_info "Press Ctrl+C to stop all services and exit"
    while true; do
        sleep 1
    done
}

# Handle command line arguments
case "${1:-start}" in
    "start")
        main
        ;;
    "stop")
        cleanup
        ;;
    "help"|"-h"|"--help")
        echo "🧪 Vibe Coder Local User Testing"
        echo
        echo "Usage:"
        echo "  $0 [COMMAND]"
        echo
        echo "Commands:"
        echo "  start    Start local testing environment (default)"
        echo "  stop     Stop all services"
        echo "  help     Show this help"
        echo
        echo "This script starts:"
        echo "  • Signaling Server (localhost:3001)"
        echo "  • PWA (localhost:3000 or vibe-coder.space)"
        echo "  • Host Server (localhost:8080)"
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac