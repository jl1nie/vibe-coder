#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ヘルパー関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 実行時間測定
start_time=$(date +%s)

# 使用方法
usage() {
    echo "🚀 Fast Test Runner for Vibe Coder"
    echo
    echo "Usage: $0 {fast|integration|full|watch|clean}"
    echo
    echo "Test Levels:"
    echo "  fast        : Level 1 - Basic tests (shared + signaling) ~2s"
    echo "  integration : Level 2 - Integration tests (+ host) ~15s"
    echo "  full        : Level 3 - Complete tests (+ E2E) ~30s"
    echo "  watch       : Watch mode for continuous testing"
    echo "  clean       : Clean test cache and run fresh tests"
    echo
    echo "Examples:"
    echo "  $0 fast           # Quick feedback during development"
    echo "  $0 integration    # Before committing changes"
    echo "  $0 full           # Before releasing"
    echo "  $0 watch          # Continuous testing during development"
}

# テスト前のクリーンアップ
cleanup_processes() {
    log_info "Cleaning up existing processes..."
    
    # Docker containers
    docker ps | grep vibe-coder-host && docker stop vibe-coder-host 2>/dev/null || true
    
    # Host processes
    ps aux | grep "node.*vibe-coder" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null || true
    ps aux | grep "vercel" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null || true
    
    # Check ports
    if ss -tulpn | grep :8080 > /dev/null 2>&1; then
        log_warn "Port 8080 still in use"
    fi
    
    if ss -tulpn | grep :5174 > /dev/null 2>&1; then
        log_warn "Port 5174 still in use"
    fi
}

# テスト環境のセットアップ
setup_test_env() {
    log_info "Setting up test environment..."
    
    # テスト専用ワークスペース作成
    export NODE_ENV=test
    export VIBE_CODER_WORKSPACE_PATH=/tmp/vibe-coder-test
    export CLAUDE_WORKSPACE_PATH=/tmp/claude-test
    export CLAUDE_CONFIG_PATH=/tmp/claude-config
    
    # 必要な環境変数設定
    export VIBE_CODER_PORT=8080
    export VIBE_CODER_PWA_PORT=5174
    export VIBE_CODER_HOST_URL=http://localhost:8080
    export VIBE_CODER_PWA_URL=http://localhost:5174
    export VIBE_CODER_SIGNALING_URL=http://localhost:5174/api/signal
    export VIBE_CODER_CLAUDE_PATH=./.claude
    
    # ディレクトリ作成
    mkdir -p /tmp/claude-test /tmp/vibe-coder-test /tmp/claude-config
    chmod 755 /tmp/claude-test /tmp/vibe-coder-test /tmp/claude-config
    
    # HOST_UID/HOST_GID設定
    export HOST_UID=$(id -u)
    export HOST_GID=$(id -g)
    
    log_success "Test environment ready"
}

# テスト実行時間の表示
show_duration() {
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    log_success "Test completed in ${duration}s"
}

# Level 1: 基本テスト
run_fast_tests() {
    log_info "🟢 Level 1: Running basic tests (shared + signaling)"
    echo "Expected time: ~2 seconds"
    echo
    
    cleanup_processes
    setup_test_env
    
    # 並列実行で高速化
    pnpm test:fast
    
    show_duration
    log_success "✅ Basic tests passed!"
}

# Level 2: 統合テスト
run_integration_tests() {
    log_info "🟡 Level 2: Running integration tests (+ host)"
    echo "Expected time: ~15 seconds"
    echo
    
    cleanup_processes
    setup_test_env
    
    # hostパッケージも含めて並列実行
    pnpm test:integration
    
    show_duration
    log_success "✅ Integration tests passed!"
}

# Level 3: 完全テスト
run_full_tests() {
    log_info "🔴 Level 3: Running complete tests (+ E2E)"
    echo "Expected time: ~30 seconds"
    echo
    
    cleanup_processes
    setup_test_env
    
    # Unit/Integration tests
    log_info "Running unit and integration tests..."
    pnpm test
    
    # E2E tests
    log_info "Running E2E tests..."
    
    # サービス起動確認
    if ! curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
        log_info "Starting services for E2E tests..."
        pnpm build > /dev/null 2>&1
        pnpm --filter @vibe-coder/host start > /dev/null 2>&1 &
        HOST_PID=$!
        
        # サーバー起動待機
        for i in {1..15}; do
            if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
                break
            fi
            sleep 2
        done
        
        if ! curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
            log_error "Failed to start host server for E2E tests"
            kill $HOST_PID 2>/dev/null || true
            exit 1
        fi
    fi
    
    # PWA server check
    if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
        log_info "Starting PWA server for E2E tests..."
        pnpm --filter @vibe-coder/web dev > /dev/null 2>&1 &
        PWA_PID=$!
        
        for i in {1..10}; do
            if curl -s http://localhost:5173 > /dev/null 2>&1; then
                break
            fi
            sleep 2
        done
    fi
    
    # E2E実行
    pnpm exec playwright test
    
    show_duration
    log_success "✅ Complete tests passed!"
}

# ウォッチモード
run_watch_tests() {
    log_info "👀 Watch mode: Continuous testing"
    echo "Press Ctrl+C to stop"
    echo
    
    cleanup_processes
    setup_test_env
    
    # 基本テストをウォッチモードで実行
    pnpm test:watch
}

# クリーンテスト
run_clean_tests() {
    log_info "🧹 Clean test: Clearing cache and running fresh tests"
    
    cleanup_processes
    setup_test_env
    
    # キャッシュクリア
    pnpm test:clean
    
    show_duration
    log_success "✅ Clean tests passed!"
}

# メイン処理
case "$1" in
    fast)
        run_fast_tests
        ;;
    integration)
        run_integration_tests
        ;;
    full)
        run_full_tests
        ;;
    watch)
        run_watch_tests
        ;;
    clean)
        run_clean_tests
        ;;
    *)
        usage
        exit 1
        ;;
esac