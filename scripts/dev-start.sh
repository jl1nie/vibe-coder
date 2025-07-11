#!/bin/bash

# Vibe Coder 開発環境統合起動スクリプト
# PWA (Vercel dev) + Signaling (Docker) + Host (Docker) を順次起動

set -e

echo "🚀 Vibe Coder 開発環境を起動しています..."

# 色付きログ関数
log_info() {
    echo -e "\033[32m[INFO]\033[0m $1"
}

log_warn() {
    echo -e "\033[33m[WARN]\033[0m $1"
}

log_error() {
    echo -e "\033[31m[ERROR]\033[0m $1"
}

# プロセス終了時のクリーンアップ
cleanup() {
    log_info "🛑 開発環境を停止しています..."
    
    # Docker コンテナ停止
    cd signaling-server && docker-compose down 2>/dev/null || true
    cd ../docker && docker-compose down 2>/dev/null || true
    
    log_info "✅ 開発環境を停止しました"
    log_info "💡 PWAも手動で停止してください (Ctrl+C)"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 現在のディレクトリを確認
if [[ ! -f "package.json" ]] || [[ ! -d "packages" ]]; then
    log_error "❌ このスクリプトはプロジェクトルートから実行してください"
    exit 1
fi

# 必要な環境変数の確認
if [[ ! -f ".env.development" ]]; then
    log_error "❌ .env.development ファイルが見つかりません"
    exit 1
fi

# 環境変数を読み込み
source .env.development

log_info "📦 環境変数確認:"
log_info "  PWA URL: ${VIBE_CODER_PWA_URL}"
log_info "  Signaling URL: ${VIBE_CODER_SIGNALING_URL}"
log_info "  Host URL: ${VIBE_CODER_HOST_URL}"

# Step 1: Signaling サーバー起動
log_info "🔄 Signaling サーバーを起動しています..."
cd signaling-server

# Docker ビルド & 起動
docker-compose up --build -d

# ヘルスチェック待機
log_info "⏳ Signaling サーバーのヘルスチェック中..."
for i in {1..15}; do
    if curl -f http://localhost:5001/api/health >/dev/null 2>&1; then
        log_info "✅ Signaling サーバーが起動しました (http://localhost:5001)"
        break
    fi
    
    if [ $i -eq 15 ]; then
        log_error "❌ Signaling サーバーの起動がタイムアウトしました"
        docker-compose logs
        exit 1
    fi
    
    sleep 2
done

cd ..

# Step 2: Host サーバー起動
log_info "🔄 Host サーバーを起動しています..."
cd docker

# Host ID の永続化確認
if [[ ! -f ".vibe-coder-host-id" ]]; then
    log_warn "⚠️  新しい Host ID が生成されます"
fi

# Docker ビルド & 起動
export HOST_UID=$(id -u)
export HOST_GID=$(id -g)
docker-compose up --build -d

# ヘルスチェック待機
log_info "⏳ Host サーバーのヘルスチェック中..."
for i in {1..15}; do
    if curl -f http://localhost:8080/api/health >/dev/null 2>&1; then
        log_info "✅ Host サーバーが起動しました (http://localhost:8080)"
        
        # Host ID を表示
        if [[ -f ".vibe-coder-host-id" ]]; then
            HOST_ID=$(cat .vibe-coder-host-id 2>/dev/null | sed 's/Vibe Coder Host ID: //' || echo "未設定")
            log_info "🔑 Host ID: ${HOST_ID}"
        fi
        break
    fi
    
    if [ $i -eq 15 ]; then
        log_error "❌ Host サーバーの起動がタイムアウトしました"
        docker-compose logs
        exit 1
    fi
    
    sleep 2
done

# Host自動登録をSignalingサーバーに通知
log_info "📡 Host サーバーをSignalingサーバーに登録中..."
HOST_ID=$(cat .vibe-coder-host-id 2>/dev/null | sed 's/Vibe Coder Host ID: //' || echo "")
if [[ ! -z "$HOST_ID" ]]; then
    curl -X POST http://localhost:5001/api/hosts/register \
        -H "Content-Type: application/json" \
        -d "{\"hostId\":\"${HOST_ID}\",\"hostUrl\":\"http://localhost:8080\"}" \
        >/dev/null 2>&1 || log_warn "⚠️  Host自動登録に失敗しました"
    log_info "✅ Host ID ${HOST_ID} を登録しました"
fi

cd ..

# Step 3: PWA (Vercel dev) 起動案内
log_info "📱 PWA (Vercel dev) の起動について:"
log_info "  PWAは別ターミナルで起動してください"
log_info "  1. cd packages/signaling"
log_info "  2. vercel dev --listen ${VIBE_CODER_PWA_PORT}"
log_info ""
log_info "  または apps/web ディレクトリで："
log_info "  1. cd apps/web"
log_info "  2. npm run dev"

# 起動完了通知
echo ""
echo "🎉 Vibe Coder 開発環境が起動しました！"
echo ""
echo "🔄 Signaling サーバー: http://localhost:${VIBE_CODER_SIGNALING_PORT}"
echo "🏠 Host サーバー: http://localhost:${VIBE_CODER_PORT}"
if [[ ! -z "$HOST_ID" ]]; then
    echo "🔑 Host ID: ${HOST_ID}"
fi
echo ""
echo "📱 PWA起動（別ターミナルで実行）:"
echo "  vercel dev --listen ${VIBE_CODER_PWA_PORT} (signalingディレクトリ)"
echo "  または npm run dev (apps/webディレクトリ)"
echo ""
echo "💡 使用方法:"
echo "  1. PWA起動後、スマホでアクセス: http://localhost:${VIBE_CODER_PWA_PORT}"
echo "  2. Host ID '${HOST_ID}' を入力"
echo "  3. 2FA認証後、Claude Code を実行可能"
echo ""
echo "🛑 停止するには Ctrl+C を押してください"

# フォアグラウンドで待機
while true; do
    sleep 30
    # ヘルスチェック
    curl -f http://localhost:5001/api/health >/dev/null 2>&1 || log_error "❌ Signaling サーバーがダウンしました"
    curl -f http://localhost:8080/api/health >/dev/null 2>&1 || log_error "❌ Host サーバーがダウンしました"
done