#!/bin/bash

# 高速テスト用環境変数設定
export NODE_ENV=test
export VIBE_CODER_PORT=8080
export VIBE_CODER_PWA_PORT=5174
export VIBE_CODER_HOST_URL=http://localhost:8080
export VIBE_CODER_PWA_URL=http://localhost:5174
export VIBE_CODER_SIGNALING_URL=http://localhost:5174/api/signal
export VIBE_CODER_CLAUDE_PATH=./.claude
export VIBE_CODER_WORKSPACE_PATH=/tmp/vibe-coder-test
export CLAUDE_WORKSPACE_PATH=/tmp/claude-test
export HOST_UID=$(id -u)
export HOST_GID=$(id -g)

# テスト実行
echo "🚀 Running quick tests..."
start_time=$(date +%s)

case "${1:-fast}" in
    "fast")
        echo "⚡ Level 1: Basic tests (shared + signaling)"
        pnpm --filter @vibe-coder/shared --filter @vibe-coder/signaling test --run
        ;;
    "integration")
        echo "🔄 Level 2: Integration tests (+ host)"
        pnpm --filter @vibe-coder/shared --filter @vibe-coder/signaling --filter @vibe-coder/host test --run
        ;;
    "full")
        echo "🎯 Level 3: Full tests"
        pnpm test
        ;;
    *)
        echo "Usage: $0 {fast|integration|full}"
        exit 1
        ;;
esac

end_time=$(date +%s)
duration=$((end_time - start_time))
echo "✅ Tests completed in ${duration}s"