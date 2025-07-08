#!/bin/bash

# Docker権限確保スクリプト
# テスト環境でも必ず実行時のUID/GIDを設定する

set -e

# 現在のユーザーのUID/GIDを取得
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)

# 環境変数を設定
export HOST_UID=$CURRENT_UID
export HOST_GID=$CURRENT_GID

echo "Docker権限設定: UID=$HOST_UID, GID=$HOST_GID"

# 引数で渡されたコマンドを実行
exec "$@"