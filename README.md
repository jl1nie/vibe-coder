# 🎯 Vibe Coder

**スマホから Claude Code を直感的に操作できるモバイル最適化リモート開発環境**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)

## 🌟 概要

Vibe Coder は、スマートフォンから Claude Code を実行できる開発ツールです。8桁キー認証とTOTP 2FA認証により、安全に自宅の開発環境にアクセスできます。

### 💡 主要機能

- **🔒 セキュア認証**: 8桁キー + TOTP 2FA による多層認証
- **📱 REST API**: Claude Code実行のための完備されたAPI
- **🐳 Docker化**: 簡単デプロイメントと環境分離
- **⚡ 軽量**: メモリ使用量150MB以下の高効率設計
- **🔧 本番対応**: プロダクション環境での安定稼働

## 🏗️ アーキテクチャ

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│   Client        │◄──►│ Vibe Coder Host      │◄──►│   Claude Code   │
│                 │    │ (Docker Container)   │    │                 │
│ REST API Client │    │ • 8桁キー認証       │    │ • コマンド実行   │
│ • TOTP 2FA      │    │ • TOTP 2FA          │    │ • 出力取得      │
│ • JWT認証       │    │ • JWT発行           │    │ • エラー処理    │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
```

## 🚀 クイックスタート

### 📋 必要な環境

- **Node.js**: 20.0.0以上
- **Docker**: 最新版
- **pnpm**: パッケージマネージャー

### 1️⃣ リポジトリのクローン

```bash
git clone https://github.com/your-username/vibe-coder.git
cd vibe-coder
```

### 2️⃣ 依存関係のインストール

```bash
pnpm install
```

### 3️⃣ Claude Code のセットアップ

```bash
# Claude Code CLIをインストール
npm install -g @anthropic-ai/claude-code

# Claude Codeにログイン
claude auth login

# 設定を確認
ls -la ~/.claude/
```

### 4️⃣ 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して必要な値を設定：

```bash
# セッション暗号化設定（必須）
SESSION_SECRET=development-secret-key-for-testing-minimum-32-characters-required

# シグナリングサーバー設定
SIGNALING_SERVER_URL=https://vibe-coder.space/api/signal

# オプション設定
ENABLE_SECURITY=false
LOG_LEVEL=debug

# Docker UID/GID設定（自動検出される）
HOST_UID=1000
HOST_GID=1000
```

### 5️⃣ Vibe Coder の起動

```bash
# Vibe Coder を起動
./scripts/vibe-coder start
```

**起動確認**:
- ホストサーバーが http://localhost:8080 で利用可能
- 8桁のHost IDがターミナルに表示される（例：`53815375`）

### 6️⃣ サーバー状態確認

```bash
# サーバー情報確認
curl http://localhost:8080/

# ヘルスチェック
curl http://localhost:8080/api/health

# サービス状態確認
./scripts/vibe-coder status
```

## 📡 API使用方法

### 🔑 認証フロー

#### 1. セッション作成
```bash
curl -X POST http://localhost:8080/api/auth/sessions
```
**レスポンス:**
```json
{
  "sessionId": "SPW49IEP",
  "hostId": "53815375",
  "totpSecret": "OJSGYVRSONID65SIMZ6VMVBPHQ2TUVB7OIWDYLDIGYWECYSALZDQ",
  "message": "Enter the TOTP secret in your authenticator app, then provide TOTP code"
}
```

#### 2. TOTP認証
1. Google AuthenticatorなどでTOTP秘密鍵を登録
2. 6桁コードを取得
3. 認証APIで確認：

```bash
curl -X POST http://localhost:8080/api/auth/sessions/SPW49IEP/verify \
  -H "Content-Type: application/json" \
  -d '{"totpCode": "123456"}'
```

**成功レスポンス:**
```json
{
  "success": true,
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "message": "Authentication successful"
}
```

### 🤖 Claude Code実行

```bash
# JWTトークンを使用してコマンド実行
curl -X POST http://localhost:8080/api/claude/execute \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "create a hello world script in Python"}'
```

### 📊 その他のAPI

```bash
# セッション状態確認
curl http://localhost:8080/api/auth/sessions/SPW49IEP/status

# セッション更新
curl -X POST http://localhost:8080/api/auth/sessions/SPW49IEP/refresh \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# セッション削除
curl -X DELETE http://localhost:8080/api/auth/sessions/SPW49IEP \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔧 開発・管理コマンド

### 基本操作

```bash
# Vibe Coder の操作
./scripts/vibe-coder start      # 開発環境を起動
./scripts/vibe-coder stop       # 開発環境を停止
./scripts/vibe-coder logs       # ログを確認
./scripts/vibe-coder status     # 状態を確認
./scripts/vibe-coder clean      # 環境をクリーンアップ
./scripts/vibe-coder setup      # 環境設定確認
```

### コード品質とテスト

```bash
# テスト実行
pnpm test                     # ユニットテスト
pnpm test:coverage            # カバレッジ付きテスト
pnpm test:e2e                 # E2Eテスト

# コード品質チェック
pnpm lint                     # ESLint
pnpm format                   # Prettier
pnpm typecheck                # TypeScript型チェック
```

### デバッグ

```bash
# デバッグログの有効化
export DEBUG=vibe-coder:*
./scripts/vibe-coder restart

# コンテナログ確認
docker logs vibe-coder-host

# API確認
curl http://localhost:8080/api/health
```

## 🐳 プロダクション デプロイ

### Docker Composeを使用

```bash
# プロダクション設定で起動
docker-compose -f docker-compose.prod.yml up -d

# または統合コマンドで起動
./scripts/vibe-coder start
```

### 手動Docker実行

```bash
docker run -d \
  --name vibe-coder-host \
  -p 8080:8080 \
  -e SESSION_SECRET=your-secret-key \
  -e HOST_UID=$(id -u) \
  -e HOST_GID=$(id -g) \
  -v ~/.claude:/app/.claude:ro \
  --restart unless-stopped \
  jl1nie/vibe-coder:latest
```

## 📁 プロジェクト構成

```
vibe-coder/
├── packages/
│   ├── host/                 # ホストサーバー (Express + TypeScript)
│   │   ├── src/
│   │   │   ├── routes/       # API ルート
│   │   │   ├── services/     # ビジネスロジック
│   │   │   ├── middleware/   # 認証・エラーハンドリング
│   │   │   └── utils/        # ユーティリティ
│   │   └── Dockerfile        # Docker設定
│   └── shared/               # 共有ライブラリ (型定義・ユーティリティ)
├── scripts/                  # ビルド・デプロイスクリプト
├── .env.example              # 環境変数テンプレート
├── docker-compose.yml        # Docker Compose設定
└── API.md                    # API詳細ドキュメント
```

## 🧪 テスト

### 基本テスト実行

```bash
# 全テスト実行
pnpm test

# 特定パッケージのテスト
pnpm --filter @vibe-coder/host test
pnpm --filter @vibe-coder/shared test

# E2Eテスト
pnpm test:e2e
```

### APIテスト例

```bash
# 完全な認証フローテスト
scripts/test-api.sh

# 個別APIテスト
curl -s http://localhost:8080/api/health | jq .
```

## 📊 パフォーマンス

### 実測値

| 指標 | 値 |
|------|-----|
| **メモリ使用量** | ~12-15MB (アイドル時) |
| **CPU使用率** | < 1% (アイドル時) |
| **起動時間** | < 5秒 |
| **レスポンス時間** | < 10ms (API) |

### 監視

```bash
# リソース使用量確認
docker stats vibe-coder-host

# ヘルスチェック
curl http://localhost:8080/api/health
```

## 🔒 セキュリティ

### 実装済みセキュリティ機能

- **多層認証**: 8桁キー + TOTP 2FA
- **JWT認証**: セッション管理とトークンベース認証
- **セキュリティヘッダー**: Helmet.js による XSS/CSRF 対策
- **入力検証**: Zod による厳密な型チェック
- **コンテナ分離**: Dockerによる環境分離
- **最小権限**: 非rootユーザーでの実行

### セキュリティ設定

```bash
# 本番環境では必ずセキュリティを有効化
ENABLE_SECURITY=true

# 強力なセッション秘密鍵を使用
SESSION_SECRET=$(openssl rand -hex 32)
```

## 🤝 コントリビューション

### 貢献方法

1. Fork このリポジトリ
2. Feature Branch を作成: `git checkout -b feature/amazing-feature`
3. 変更をコミット: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Pull Request を作成

### 開発ガイドライン

- コミットメッセージ: [Conventional Commits](https://www.conventionalcommits.org/) 形式
- コードスタイル: ESLint + Prettier設定に従う
- テスト: 新機能には必ずテストを追加
- 文書: 変更時は関連文書も更新

## 📚 関連文書

### 開発者向け
- **[💻 DEVELOPMENT.md](./DEVELOPMENT.md)** - 開発環境構築・API仕様・テスト実行の詳細
- **[📋 CLAUDE.md](./CLAUDE.md)** - プロジェクト仕様とチェックポイント
- **[🔧 API.md](./API.md)** - API エンドポイント詳細ドキュメント

### 運用者向け
- **[🚀 Docker Hub](https://hub.docker.com/r/jl1nie/vibe-coder)** - 公式Dockerイメージ
- **[📊 ヘルスチェック](http://localhost:8080/api/health)** - サービス状態監視

## 📄 ライセンス

このプロジェクトは Apache 2.0 ライセンスの下で公開されています。詳細は [LICENSE](./LICENSE) を参照してください。

---

**Vibe Coder - セキュアで効率的なリモート開発環境** 🚀✨