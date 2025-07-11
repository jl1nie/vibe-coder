#!/bin/bash

# Vibe Coder 開発環境停止スクリプト

set -e

echo "🛑 Vibe Coder 開発環境を停止しています..."

# 色付きログ関数
log_info() {
    echo -e "\033[32m[INFO]\033[0m $1"
}

log_warn() {
    echo -e "\033[33m[WARN]\033[0m $1"
}

# 現在のディレクトリを確認
if [[ ! -f "package.json" ]] || [[ ! -d "packages" ]]; then
    log_warn "⚠️  このスクリプトはプロジェクトルートから実行してください"
    exit 1
fi

# PWA (Vercel dev) プロセス終了
log_info "🔄 PWA (Vercel dev) プロセスを停止中..."
pkill -f "vercel dev" 2>/dev/null || log_warn "⚠️  Vercel dev プロセスが見つかりませんでした"

# Signaling サーバー停止
log_info "🔄 Signaling サーバーを停止中..."
if [[ -d "signaling-server" ]]; then
    cd signaling-server
    docker-compose down 2>/dev/null || log_warn "⚠️  Signaling サーバーが起動していませんでした"
    cd ..
fi

# Host サーバー停止
log_info "🔄 Host サーバーを停止中..."
if [[ -d "docker" ]]; then
    cd docker
    docker-compose down 2>/dev/null || log_warn "⚠️  Host サーバーが起動していませんでした"
    cd ..
fi

# 残留プロセスの確認
log_info "🔍 残留プロセスを確認中..."
REMAINING_PROCESSES=$(ps aux | grep -E "(vercel|vibe-coder)" | grep -v grep | wc -l)

if [ "$REMAINING_PROCESSES" -gt 0 ]; then
    log_warn "⚠️  ${REMAINING_PROCESSES} 個の関連プロセスが残っています"
    ps aux | grep -E "(vercel|vibe-coder)" | grep -v grep || true
fi

log_info "✅ Vibe Coder 開発環境を停止しました"