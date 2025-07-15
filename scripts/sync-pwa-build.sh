#!/bin/bash

# PWAビルド成果物をSignalingプロジェクトに同期するスクリプト
# 使用方法: scripts/sync-pwa-build.sh

set -e

echo "🚀 PWAビルド成果物同期開始..."

# ルートディレクトリに移動
cd "$(dirname "$0")/.."

# 1. PWAプロジェクトをビルド
echo "📦 PWAプロジェクトをビルド中..."
cd apps/web
pnpm build

# 2. ビルド成果物の検証
if [ ! -f "dist/index.html" ]; then
    echo "❌ エラー: PWAビルドが正常に完了していません"
    exit 1
fi

# 3. Signalingプロジェクトの古いファイルをクリーンアップ
echo "🧹 古いファイルをクリーンアップ中..."
cd ../../packages/signaling
rm -rf public/assets/*
rm -f public/index.html public/manifest.webmanifest public/sw.js public/registerSW.js public/workbox-*.js

# 4. 新しいビルド成果物をコピー
echo "📋 新しいビルド成果物をコピー中..."
cp -r ../../apps/web/dist/* public/

# 5. ファイル同期の確認
if [ -f "public/index.html" ]; then
    echo "✅ PWAビルド成果物の同期完了"
    echo "📁 同期されたファイル:"
    ls -la public/
else
    echo "❌ エラー: ファイル同期に失敗しました"
    exit 1
fi

echo "🎉 PWAビルド同期が正常に完了しました"