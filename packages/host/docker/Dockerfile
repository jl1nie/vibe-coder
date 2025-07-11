# Vibe Coder Host - Interactive Claude Code Environment
FROM node:18-alpine

# 基本パッケージとPythonをインストール
RUN apk add --no-cache \
    python3 \
    py3-pip \
    curl \
    bash \
    git \
    build-base \
    linux-headers

# 作業ディレクトリ設定
WORKDIR /app

# Node.jsアプリケーションの依存関係をコピー（ワークスペース全体）
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig.json ./

# パッケージ定義をコピー
COPY packages/host/package.json ./packages/host/
COPY packages/shared/package.json ./packages/shared/

# pnpmインストール
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# アプリケーションソースをコピー
COPY packages/host ./packages/host
COPY packages/shared ./packages/shared

# ワーキングディレクトリを変更
WORKDIR /app/packages/host

# ビルド
RUN pnpm build

# 実行時ユーザー（権限問題対応）
RUN addgroup -g 1001 -S nodejs && \
    adduser -S vibe-coder -u 1001 -G nodejs

# Claudeコンフィグディレクトリ作成
RUN mkdir -p /app/.claude && \
    chmod 755 /app/.claude

# ホームディレクトリ設定
ENV HOME=/app
ENV CLAUDE_CONFIG_PATH=/app/.claude

# Claude Code CLI（本物）をインストール
RUN npm install -g @anthropic-ai/claude-code

# Claudeセットアップチェック
RUN claude --version

# ポート公開
EXPOSE 8080

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

# ユーザー切り替え
USER vibe-coder

# 起動コマンド
CMD ["pnpm", "start"]