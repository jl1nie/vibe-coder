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
    userdel $EXISTING_USER 2>/dev/null || true
fi

# 指定されたGIDのグループが存在する場合は削除
if getent group $USER_GID > /dev/null 2>&1; then
    EXISTING_GROUP=$(getent group $USER_GID | cut -d: -f1)
    echo "Removing existing group: $EXISTING_GROUP (GID: $USER_GID)"
    groupdel $EXISTING_GROUP 2>/dev/null || true
fi

# 新しいグループを作成
echo "Creating group: vibecoder (GID: $USER_GID)"
groupadd -g $USER_GID vibecoder || true

# 新しいユーザーを作成
echo "Creating user: vibecoder (UID: $USER_UID, GID: $USER_GID)"
useradd -u $USER_UID -g $USER_GID -d /home/vibecoder -m -s /bin/bash vibecoder || true

# ユーザーにディレクトリ所有権を付与
echo "Setting ownership of application directories for vibecoder"
chown -R $USER_UID:$USER_GID /app/.claude /app/logs /app/workspace
# Claude CLIがルートディレクトリにアクセスする場合があるため、/appも所有権を設定
chown $USER_UID:$USER_GID /app

# ホームディレクトリを作成・設定
mkdir -p /home/vibecoder
chown -R $USER_UID:$USER_GID /home/vibecoder

echo "Starting application as vibecoder ($USER_UID:$USER_GID)"

# Claude CLIのインストール・パス・権限チェック
if ! claude --version > /dev/null 2>&1; then
  echo "ERROR: Claude CLI (claude) が見つかりません。インストールまたはパス・権限を確認してください。"
  exit 1
fi

# Claude CLIに必要な環境変数を設定（公式仕様に準拠）
export SHELL=/bin/zsh
export USER=vibecoder
export HOME=/home/vibecoder

# 指定されたユーザーでアプリケーションを実行
exec gosu $USER_UID:$USER_GID "$@"