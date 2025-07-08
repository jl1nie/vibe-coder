#!/bin/bash

echo "🚀 Vibe Coder Interactive Mode Test Environment"
echo "==============================================="

# カレントディレクトリ確認
echo "📁 Current directory: $(pwd)"
echo "📁 Workspace will be mounted at: /workspace"

# Dockerコンテナを起動
echo "🐳 Starting Docker container..."
cd packages/host

# HOST_UID/HOST_GIDを現在のユーザーに設定
export HOST_UID=$(id -u)
export HOST_GID=$(id -g)

# Docker Composeで起動（UID/GIDは実行時に環境変数で渡される）
docker compose -f docker/docker-compose.interactive.yml build
docker compose -f docker/docker-compose.interactive.yml up -d

echo "⏳ Waiting for container to be ready..."
sleep 5

# コンテナログを表示
echo "📋 Container logs:"
docker compose -f docker/docker-compose.interactive.yml logs --tail=20

# Host IDを表示
echo ""
echo "🔐 Retrieving Host ID..."
curl -s http://localhost:8080/ | jq -r '.'

echo ""
echo "✅ Interactive environment ready!"
echo ""
echo "📱 Next steps:"
echo "1. Open PWA: http://localhost:5173"
echo "2. Enter Host ID shown above"
echo "3. Enter 2FA code (check container logs for TOTP secret)"
echo "4. Test interactive Claude commands:"
echo "   - '/help'"
echo "   - 'what is 2+2?'"
echo "   - 'explain quantum computing'"
echo ""
echo "🛑 To stop: docker compose -f docker/docker-compose.interactive.yml down"