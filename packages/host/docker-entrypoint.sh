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

# 既存のユーザー/グループを削除（UID/GID重複を避けるため）
# まず、指定されたUIDのユーザーが存在する場合は削除
if getent passwd $USER_UID > /dev/null 2>&1; then
    EXISTING_USER=$(getent passwd $USER_UID | cut -d: -f1)
    echo "Removing existing user: $EXISTING_USER (UID: $USER_UID)"
    deluser $EXISTING_USER 2>/dev/null || true
fi

# 指定されたGIDのグループが存在する場合は削除
if getent group $USER_GID > /dev/null 2>&1; then
    EXISTING_GROUP=$(getent group $USER_GID | cut -d: -f1)
    echo "Removing existing group: $EXISTING_GROUP (GID: $USER_GID)"
    delgroup $EXISTING_GROUP 2>/dev/null || true
fi

# 新しいグループを作成
echo "Creating group: vibecoder (GID: $USER_GID)"
addgroup -g $USER_GID -S vibecoder

# 新しいユーザーを作成
echo "Creating user: vibecoder (UID: $USER_UID, GID: $USER_GID)"
adduser -S vibecoder -u $USER_UID -G vibecoder

echo "Starting application as vibecoder ($USER_UID:$USER_GID)"

# 指定されたユーザーでアプリケーションを実行
exec su-exec $USER_UID:$USER_GID "$@"