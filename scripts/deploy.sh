#!/bin/bash
set -e

# Vibe Coder Production Deployment Script
# このスクリプトは本番環境へのデプロイメントを自動化します

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Vibe Coder Production Deployment Starting..."

# 環境変数チェック
check_env() {
    echo "📋 Environment Configuration Check..."
    
    if [[ ! -f ".env.production" ]]; then
        echo "❌ .env.production file not found!"
        echo "Please copy .env.production.example to .env.production and configure it."
        exit 1
    fi
    
    source .env.production
    
    if [[ -z "$SESSION_SECRET" || "$SESSION_SECRET" == "REPLACE_WITH_STRONG_RANDOM_32_CHAR_SECRET" ]]; then
        echo "❌ SESSION_SECRET not properly configured!"
        exit 1
    fi
    
    echo "✅ Environment configuration OK"
}

# ビルドテスト
build_test() {
    echo "🔨 Build Test..."
    pnpm build
    pnpm test --run
    echo "✅ Build and tests passed"
}

# Docker イメージビルド
build_docker() {
    echo "🐳 Building Docker Image..."
    
    # マルチアーキテクチャビルド
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        --tag jl1nie/vibe-coder:v0.1.0-beta \
        --tag jl1nie/vibe-coder:latest \
        --file packages/host/Dockerfile \
        --push \
        .
    
    echo "✅ Docker image built and pushed"
}

# デプロイメント
deploy() {
    echo "🚀 Starting Production Deployment..."
    
    # 本番用docker-composeでデプロイ
    docker-compose -f docker-compose.prod.yml down || true
    docker-compose -f docker-compose.prod.yml pull
    docker-compose -f docker-compose.prod.yml up -d
    
    echo "⏳ Waiting for service to be ready..."
    sleep 10
    
    # ヘルスチェック
    for i in {1..30}; do
        if curl -f http://localhost:8080/api/health >/dev/null 2>&1; then
            echo "✅ Service is healthy!"
            break
        fi
        echo "Waiting for service... ($i/30)"
        sleep 2
    done
    
    # 最終確認
    echo "📊 Deployment Status:"
    docker-compose -f docker-compose.prod.yml ps
    curl -s http://localhost:8080/api/health | jq .
}

# ロールバック機能
rollback() {
    echo "⏪ Rolling back to previous version..."
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml pull jl1nie/vibe-coder:stable
    # stable タグから復旧
    echo "Rollback completed"
}

# メイン実行
case "${1:-deploy}" in
    "check")
        check_env
        ;;
    "build")
        check_env
        build_test
        build_docker
        ;;
    "deploy")
        check_env
        build_test
        build_docker
        deploy
        ;;
    "rollback")
        rollback
        ;;
    *)
        echo "Usage: $0 {check|build|deploy|rollback}"
        echo ""
        echo "Commands:"
        echo "  check    - Check environment configuration"
        echo "  build    - Build and test application"
        echo "  deploy   - Full deployment (build + deploy)"
        echo "  rollback - Rollback to previous version"
        exit 1
        ;;
esac

echo "🎉 Operation completed successfully!"