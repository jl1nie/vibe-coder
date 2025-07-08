#!/bin/sh
set -e

# 必須のUID/GID（環境変数が設定されていない場合はエラー）
if [ -z "$HOST_UID" ] || [ -z "$HOST_GID" ]; then
    echo "ERROR: HOST_UID and HOST_GID environment variables are required"
    echo "Please set them before running Docker:"
    echo "  export HOST_UID=\$(id -u)"
    echo "  export HOST_GID=\$(id -g)"
    exit 1
fi

USER_UID=$HOST_UID
USER_GID=$HOST_GID

echo "Setting up runtime user with UID:$USER_UID, GID:$USER_GID"

# グループが存在しない場合は作成
if ! getent group $USER_GID > /dev/null 2>&1; then
    addgroup -g $USER_GID -S vibecoder
    GROUP_NAME="vibecoder"
else
    GROUP_NAME=$(getent group $USER_GID | cut -d: -f1)
    echo "Using existing group: $GROUP_NAME"
fi

# ユーザーが存在しない場合は作成
if ! getent passwd $USER_UID > /dev/null 2>&1; then
    adduser -S vibecoder -u $USER_UID -G $GROUP_NAME
    USER_NAME="vibecoder"
else
    USER_NAME=$(getent passwd $USER_UID | cut -d: -f1)
    echo "Using existing user: $USER_NAME"
fi

# ディレクトリの所有権を実行時に設定
chown -R $USER_UID:$USER_GID /app/.claude /app/logs /app/workspace /app/packages 2>/dev/null || true

echo "Starting application as $USER_NAME ($USER_UID:$USER_GID)"

# 指定されたユーザーでアプリケーションを実行
exec su-exec $USER_UID:$USER_GID "$@"