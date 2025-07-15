#!/bin/bash
# scripts/server-manager.sh
# Vibe Coder サーバー管理統合スクリプト
# 確実なサーバー停止・起動・状態確認

set -e

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Vibe Coder関連ポート定義
PORTS=(8080 5174 5175)
PORT_NAMES=("HostServer" "PWA/Signaling" "Signaling")

# プロセス検出・停止
kill_processes_by_port() {
    local port=$1
    local name=$2
    
    log_info "Checking port $port ($name)..."
    
    # lsof使用（最も確実）
    if command -v lsof &> /dev/null; then
        local pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            log_warn "Killing processes on port $port: $pids"
            echo "$pids" | xargs kill -TERM 2>/dev/null || true
            sleep 2
            # 強制終了が必要な場合
            local remaining=$(lsof -ti:$port 2>/dev/null || true)
            if [ -n "$remaining" ]; then
                log_warn "Force killing stubborn processes: $remaining"
                echo "$remaining" | xargs kill -KILL 2>/dev/null || true
            fi
            log_success "Port $port cleared"
        else
            log_info "Port $port is free"
        fi
    # ss使用（lsofがない場合）
    elif command -v ss &> /dev/null; then
        local pids=$(ss -tlnp | grep ":$port " | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true)
        if [ -n "$pids" ]; then
            log_warn "Killing processes on port $port: $pids"
            echo "$pids" | xargs kill -TERM 2>/dev/null || true
            sleep 2
            local remaining=$(ss -tlnp | grep ":$port " | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true)
            if [ -n "$remaining" ]; then
                log_warn "Force killing stubborn processes: $remaining"
                echo "$remaining" | xargs kill -KILL 2>/dev/null || true
            fi
            log_success "Port $port cleared"
        else
            log_info "Port $port is free"
        fi
    else
        log_error "Neither lsof nor ss available - cannot reliably kill processes"
        return 1
    fi
}

# プロセス名による停止
kill_vibe_coder_processes() {
    log_info "Killing Vibe Coder processes by name..."
    
    # Next.js開発サーバー
    pkill -f "next dev.*5174" 2>/dev/null || true
    
    # Vite開発サーバー
    pkill -f "vite.*5173" 2>/dev/null || true
    pkill -f "vite.*5174" 2>/dev/null || true
    
    # Node.jsプロセス（vibe-coder関連）
    pkill -f "node.*vibe-coder" 2>/dev/null || true
    
    # pnpm開発サーバー
    pkill -f "pnpm.*dev.*signaling" 2>/dev/null || true
    
    log_success "Process cleanup completed"
}

# Docker完全停止
stop_docker_containers() {
    log_info "Stopping Docker containers..."
    
    # Vibe Coder関連コンテナ停止
    docker compose -f docker-compose.yml down 2>/dev/null || true
    docker compose -f docker-compose.dev.yml down 2>/dev/null || true
    
    # 個別コンテナ停止（念のため）
    docker stop $(docker ps -q --filter "name=vibe-coder") 2>/dev/null || true
    
    # 停止済みコンテナ削除
    docker container prune -f 2>/dev/null || true
    
    log_success "Docker containers stopped and cleaned"
}

# 完全停止
stop_all() {
    log_info "🛑 Stopping all Vibe Coder services..."
    
    # 1. プロセス名による停止
    kill_vibe_coder_processes
    
    # 2. ポート別停止
    for i in "${!PORTS[@]}"; do
        kill_processes_by_port "${PORTS[$i]}" "${PORT_NAMES[$i]}"
    done
    
    # 3. Docker停止
    stop_docker_containers
    
    # 4. 最終確認
    sleep 3
    check_status
    
    log_success "🎉 All services stopped successfully"
}

# 状態確認
check_status() {
    log_info "📊 Service Status Check..."
    
    echo ""
    echo "🔍 Port Status:"
    for i in "${!PORTS[@]}"; do
        local port="${PORTS[$i]}"
        local name="${PORT_NAMES[$i]}"
        
        if command -v lsof &> /dev/null; then
            if lsof -i:$port &>/dev/null; then
                log_error "❌ Port $port ($name) is OCCUPIED"
            else
                log_success "✅ Port $port ($name) is FREE"
            fi
        elif command -v ss &> /dev/null; then
            if ss -tln | grep ":$port " &>/dev/null; then
                log_error "❌ Port $port ($name) is OCCUPIED"
            else
                log_success "✅ Port $port ($name) is FREE"
            fi
        fi
    done
    
    echo ""
    echo "🐳 Docker Status:"
    local running_containers=$(docker ps --filter "name=vibe-coder" --format "{{.Names}}" 2>/dev/null || true)
    if [ -n "$running_containers" ]; then
        log_warn "❌ Running containers: $running_containers"
    else
        log_success "✅ No running containers"
    fi
    
    echo ""
    echo "🔧 Process Status:"
    local vibe_processes=$(ps aux | grep -E "vite|next.*517[4-5]|node.*vibe-coder" | grep -v grep | wc -l)
    if [ "$vibe_processes" -gt 0 ]; then
        log_warn "❌ $vibe_processes Vibe Coder processes running"
        ps aux | grep -E "vite|next.*517[4-5]|node.*vibe-coder" | grep -v grep | awk '{print "   PID " $2 ": " $11 " " $12 " " $13}'
    else
        log_success "✅ No Vibe Coder processes running"
    fi
}

# 安全な起動
safe_start() {
    local mode="${1:-dev}"
    
    log_info "🚀 Safe start mode: $mode"
    
    # 完全停止
    stop_all
    
    # 起動待機
    log_info "Waiting 3 seconds before start..."
    sleep 3
    
    # 起動
    case "$mode" in
        "dev"|"development")
            log_info "Starting development mode..."
            ./scripts/vibe-coder dev
            ;;
        "prod"|"production")
            log_info "Starting production mode..."
            ./scripts/vibe-coder start
            ;;
        *)
            log_error "Unknown mode: $mode"
            log_info "Available modes: dev, prod"
            exit 1
            ;;
    esac
}

# サーバー準備完了待機
wait_for_servers() {
    log_info "⏳ Waiting for servers to be ready..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        local all_ready=true
        
        # Host Server (8080) チェック
        if ! curl -s http://localhost:8080/ >/dev/null 2>&1; then
            all_ready=false
        fi
        
        # PWA (5174) チェック
        if ! curl -s http://localhost:5174/ >/dev/null 2>&1; then
            all_ready=false
        fi
        
        # Signaling (5175) WebSocket チェック
        if ! nc -z localhost 5175 2>/dev/null; then
            all_ready=false
        fi
        
        if [ "$all_ready" = true ]; then
            log_success "✅ All servers are ready!"
            return 0
        fi
        
        log_info "   Attempt $((attempt + 1))/$max_attempts - servers not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_error "❌ Servers failed to start within ${max_attempts} attempts"
    return 1
}

# テスト前クリーンアップ
test_cleanup() {
    log_info "🧪 Test environment cleanup..."
    
    stop_all
    
    # テスト関連ファイルクリーンアップ
    rm -rf test-results/ 2>/dev/null || true
    rm -rf coverage/ 2>/dev/null || true
    rm -f .test-execution-info 2>/dev/null || true
    
    log_success "Test environment cleaned"
}

# テスト用サーバー起動
start_for_tests() {
    log_info "🧪 Starting servers for E2E tests..."
    
    # クリーンアップ
    test_cleanup
    
    # 起動
    log_info "Starting development mode..."
    ./scripts/vibe-coder dev > /dev/null 2>&1 &
    
    # 準備完了まで待機
    if wait_for_servers; then
        log_success "🎉 Test environment ready!"
        return 0
    else
        log_error "❌ Failed to start test environment"
        stop_all
        return 1
    fi
}

# 使用方法
usage() {
    echo "Vibe Coder Server Manager"
    echo ""
    echo "Usage: $0 {stop|status|start|restart|test-cleanup|start-for-tests} [mode]"
    echo ""
    echo "Commands:"
    echo "  stop            : Stop all services completely"
    echo "  status          : Check current service status"
    echo "  start [mode]    : Safe start (dev|prod, default: dev)"
    echo "  restart [mode]  : Stop + Start (dev|prod, default: dev)"
    echo "  test-cleanup    : Prepare clean test environment"
    echo "  start-for-tests : Start servers and wait until ready for E2E tests"
    echo ""
    echo "Examples:"
    echo "  $0 stop"
    echo "  $0 start dev"
    echo "  $0 restart prod"
    echo "  $0 test-cleanup"
}

# メイン処理
case "${1:-status}" in
    "stop")
        stop_all
        ;;
    "status")
        check_status
        ;;
    "start")
        safe_start "${2:-dev}"
        ;;
    "restart")
        safe_start "${2:-dev}"
        ;;
    "test-cleanup")
        test_cleanup
        ;;
    "start-for-tests")
        start_for_tests
        ;;
    "help"|"-h"|"--help")
        usage
        ;;
    *)
        log_error "Unknown command: $1"
        usage
        exit 1
        ;;
esac