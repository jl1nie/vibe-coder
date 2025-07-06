# 🎯 Vibe Coder

**スマホから Claude Code を直感的に操作できるモバイル最適化リモート開発環境**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue)](https://www.typescriptlang.org/)
[![PWA](https://img.shields.io/badge/PWA-Ready-orange)](https://web.dev/progressive-web-apps/)

## 🌟 概要

Vibe Coder は、スマートフォンから Claude Code を瞬時に実行できる革新的な開発ツールです。WebRTC P2P 通信により、どこからでも安全に自宅の開発環境にアクセスし、音声コマンドやワンタップ操作で効率的な開発が可能です。

### 💡 主要な価値提案

- **🔒 完全プライベート**: WebRTC P2P通信でコードが外部に漏れない
- **📱 モバイルファースト**: スマホに最適化された直感的なUI
- **🎤 音声操作**: 自然言語での音声コマンド入力
- **⚡ ワンタップ実行**: よく使うコマンドをアイコンで瞬時実行
- **🎵 プレイリスト**: コマンドセットの作成・共有・管理

## 🏗️ アーキテクチャ

```mermaid
graph TB
    subgraph "📱 Client (PWA)"
        PWA[React PWA<br/>モバイル最適化UI]
        Voice[音声認識<br/>Web Speech API]
        Commands[クイックコマンド<br/>プレイリスト管理]
    end
    
    subgraph "🌐 公式シグナリングサーバー"
        SignalOfficial[signal.vibe-coder.space<br/>Vercel Edge Functions]
        Gist[GitHub Gist<br/>プレイリスト発見]
        KV[(Vercel KV<br/>セッション管理)]
    end
    
    subgraph "🖥️ Host (ユーザー環境)"
        Claude[Claude Code統合<br/>セキュアプロセス実行]
        WebRTC[WebRTC P2P<br/>直接接続]
        Security[セキュリティ<br/>コマンド検証]
    end
    
    PWA <==> SignalOfficial
    SignalOfficial <==> Claude
    PWA -.->|WebRTC P2P<br/>暗号化接続| Claude
    SignalOfficial --> KV
    Gist --> Commands
    
    style SignalOfficial fill:#e1f5fe
    style PWA fill:#f3e5f5
    style Claude fill:#e8f5e8
```

## 🚀 クイックスタート

### 📋 必要な環境

- **Node.js**: 20.0.0以上
- **Docker**: 最新版 (ホストサーバー用)
- **Claude API Key**: Anthropic アカウントが必要

### 1️⃣ リポジトリのクローン

```bash
git clone https://github.com/your-username/vibe-coder.git
cd vibe-coder
```

### 2️⃣ 依存関係のインストール

```bash
npm install
```

### 3️⃣ Claude Code のセットアップ

```bash
# Claude Code CLIをインストール
npm install -g @anthropic/claude-code

# Claude Codeにログイン（APIキーを設定）
claude-code auth login

# 設定を確認
ls -la ~/.claude/
```

### 4️⃣ 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して必要な値を設定：

```bash
# === セッション暗号化設定（必須） ===
# 32文字以上のランダム文字列を生成
SESSION_SECRET=$(openssl rand -hex 32)

# === シグナリングサーバー設定 ===
# 公式サーバーを利用（推奨・デフォルト）
SIGNALING_SERVER_URL=https://signal.vibe-coder.space

# === オプション設定 ===
# DEBUG=vibe-coder:*  # デバッグログ（開発時のみ）
```

**📡 シグナリングサーバーについて**:
- **一般ユーザー**: 公式サーバー（`https://signal.vibe-coder.space`）を利用
- **エンタープライズ**: 必要に応じて独自サーバーを構築

### 5️⃣ Vibe Coder の起動

```bash
# Vibe Coder を起動（公式Dockerイメージを自動利用）
npm run vibe-coder
```

**これだけで完了！** 🎉
- 公式Dockerイメージを自動でプル・起動
- ホストサーバーが http://localhost:8080 で利用可能
- PWAは https://vibe-coder.space でアクセス

### 6️⃣ アクセス

- **PWA**: https://vibe-coder.space （推奨）
- **ホストサーバー**: http://localhost:8080
- **API**: http://localhost:8080/api-docs
- **ヘルス**: http://localhost:8080/health

## 📱 使い方

### 🔌 接続方法

1. **PWAを開く**: スマートフォンでPWAにアクセス
2. **サーバーIDを入力**: ホストサーバーのIDを入力
3. **接続**: WebRTC P2P接続が自動で確立

### 🎤 音声コマンド

マイクボタンをタップして自然言語で指示：

```
「認証機能を追加して」
「バグを修正して」  
「テストを実行して」
「デプロイの準備をして」
```

### ⚡ クイックコマンド

よく使うコマンドをワンタップで実行：

| アイコン | 機能 | コマンド例 |
|---------|------|----------|
| 🔐 | ログイン機能 | `claude-code add authentication` |
| 🐛 | バグ修正 | `claude-code fix the bug` |
| 🧪 | テスト実行 | `npm test` |
| 🚀 | デプロイ | `npm run deploy` |
| 📦 | ビルド | `npm run build` |

### 🎵 プレイリスト管理

#### プレイリストの作成

```json
{
  "schema": "vibe-coder-playlist-v1",
  "metadata": {
    "name": "Frontend Development",
    "description": "フロントエンド開発用コマンド集",
    "author": "your-name",
    "version": "1.0.0",
    "tags": ["frontend", "react", "typescript"]
  },
  "commands": [
    {
      "icon": "🎨",
      "label": "UI Polish",
      "command": "claude-code improve the UI design",
      "description": "UIデザインの改善"
    },
    {
      "icon": "🔍",
      "label": "Code Review", 
      "command": "claude-code review this code",
      "description": "コードレビューの実行"
    }
  ]
}
```

#### 共有方法

1. GitHub Gist に `vibe-coder-playlist.json` として保存
2. 自動的にプレイリスト発見システムで収集
3. 他のユーザーがインポート可能

## 🧪 テスト

### テストの実行

```bash
# 全テスト実行
npm test

# UXテストスイート
npm run test:ux-suite

# E2Eテスト
npm run test:e2e

# パフォーマンステスト
npm run test:ux

# アクセシビリティ監査
npm run test:accessibility
```

### ユーザテスト

```bash
# ローカル環境でのユーザテスト（推奨）
npm run test:local

# ユーザーフィードバック収集
npm run feedback

# プレビュー環境でのユーザテスト
npm run preview-ux
```

#### 🧪 ローカルユーザーテスト手順

1. **環境起動**:
   ```bash
   npm run test:local
   ```

2. **テスト実施**:
   - Chrome で自動的に開く PWA または https://vibe-coder.space
   - 表示される Server ID を PWA に入力
   - 音声コマンドやクイックコマンドを試用

3. **フィードバック収集**:
   ```bash
   npm run feedback
   ```

4. **テスト終了**: Ctrl+C でサービス停止

## 🔧 開発

### 📁 プロジェクト構成

```
vibe-coder/
├── apps/
│   └── web/                 # PWA (React + TypeScript)
├── packages/
│   ├── client/              # クライアントライブラリ
│   ├── host/                # ホストサーバー (Node.js)
│   ├── signaling/           # シグナリングサーバー (Vercel)
│   └── shared/              # 共有ライブラリ
├── scripts/                 # ビルド・デプロイスクリプト
├── test/                    # テストファイル
└── docker/                  # Docker設定
```

### 🛠️ 開発コマンド

```bash
# Vibe Coder 起動・操作
npm run vibe-coder          # 起動
npm run vibe-coder stop     # 停止
npm run vibe-coder restart  # 再起動
npm run vibe-coder status   # 状態確認
npm run vibe-coder logs     # ログ確認
npm run vibe-coder build    # ローカルビルド

# 開発・テスト
npm run lint                # ESLint
npm run format              # Prettier
npm run typecheck           # TypeScript
npm test                    # Unit tests

# Docker (上級者・メンテナー用)
npm run docker:build        # ローカルイメージビルド
npm run docker:push         # Docker Hub プッシュ（メンテナー専用）
```

### 🔍 デバッグ

```bash
# デバッグログの有効化
export DEBUG=vibe-coder:*
npm run vibe-coder restart

# サービス状態確認
npm run vibe-coder status

# ログ確認
npm run vibe-coder logs

# API確認
curl http://localhost:8080/health
curl http://localhost:8080/api/connection/status
```

## 🐳 デプロイ

### 📦 本番デプロイ

**ユーザーが構築する必要があるのはホストサーバーのみです。**

#### 🖥️ ホストサーバー（必須）
```bash
# 公式Dockerイメージで起動（推奨）
docker run -d \
  --name vibe-coder-host \
  -p 8080:8080 \
  -e CLAUDE_API_KEY=your-key \
  -v $(pwd)/workspace:/app/workspace \
  --restart unless-stopped \
  jl1nie/vibe-coder:latest

# または統合コマンドで起動
npm run vibe-coder
```

#### 📱 PWA（オプション・カスタマイズ時）
```bash
# Vercel にPWAをデプロイ（カスタマイズする場合のみ）
npm run deploy:pwa
```

#### 📡 シグナリングサーバー（不要）
**一般ユーザーは公式サーバー（`https://signal.vibe-coder.space`）を利用するため、独自構築は不要です。**

エンタープライズで独自構築が必要な場合のみ：
```bash
# カスタムシグナリングサーバーのデプロイ
cd packages/signaling
npm run deploy
```

### 🔐 CI/CDシークレット（メンテナー用）

GitHub Actionsで自動デプロイを行うには、以下のシークレットが必要：

```bash
# Docker Hub
DOCKER_USERNAME=jl1nie
DOCKER_PASSWORD=your-docker-token

# Vercel
VERCEL_TOKEN=your-vercel-token
VERCEL_ORG_ID=your-org-id
VERCEL_PWA_PROJECT_ID=pwa-project-id
VERCEL_SIGNALING_PROJECT_ID=signaling-project-id
```

詳細は [DEPLOYMENT_MANUAL.md](./DEPLOYMENT_MANUAL.md) を参照

### 🔧 設定

詳細は [CONFIG_DOCUMENTATION.md](./CONFIG_DOCUMENTATION.md) を参照

## 📊 パフォーマンス

### ベンチマーク結果

| 指標 | 目標値 | 実測値 |
|------|--------|--------|
| **First Contentful Paint** | < 1.5s | 1.2s |
| **Largest Contentful Paint** | < 2.5s | 2.1s |
| **Cumulative Layout Shift** | < 0.1 | 0.05 |
| **Time to Interactive** | < 3s | 2.8s |
| **PWA Score** | > 90 | 95 |

### リソース使用量

- **メモリ使用量**: ~150MB (ホストサーバー)
- **CPU使用率**: < 5% (アイドル時)
- **ネットワーク**: P2P接続で最小限

## 🔒 セキュリティ

セキュリティについては [SECURITY.md](./SECURITY.md) を参照

### 主要なセキュリティ機能

- **プロンプトインジェクション防止**: 危険なパターンの検出・ブロック
- **ファイルアクセス制御**: パス検証とサンドボックス実行
- **WebRTC P2P**: エンドツーエンド暗号化
- **レート制限**: API abuse防止
- **セキュリティヘッダー**: XSS, CSRF対策

## 🤝 コントリビューション

### 貢献方法

1. **Fork** このリポジトリ
2. **Feature Branch** を作成: `git checkout -b feature/amazing-feature`
3. **Commit** 変更: `git commit -m 'Add amazing feature'`
4. **Push** ブランチ: `git push origin feature/amazing-feature`
5. **Pull Request** を作成

### 開発ガイドライン

- **コミットメッセージ**: [Conventional Commits](https://www.conventionalcommits.org/) 形式
- **コードスタイル**: ESLint + Prettier設定に従う
- **テスト**: 新機能には必ずテストを追加
- **文書**: 変更時は関連文書も更新

### Issue報告

バグレポートや機能要求は [GitHub Issues](https://github.com/your-username/vibe-coder/issues) で受け付けています。

## 📚 関連文書

### ユーザー向け
- **[🚀 クイックスタート](#-クイックスタート)** - すぐに始める方法
- **[📱 使い方](#-使い方)** - 基本的な操作方法
- **[🎵 プレイリスト管理](#-プレイリスト管理)** - カスタムコマンドの作成

### 開発者向け
- **[💻 DEVELOPMENT.md](./DEVELOPMENT.md)** - 開発環境構築・ビルド・テスト実行の詳細手順
- **[📋 CONFIG_DOCUMENTATION.md](./CONFIG_DOCUMENTATION.md)** - 設定ファイルの詳細
- **[🚀 DEPLOYMENT_MANUAL.md](./DEPLOYMENT_MANUAL.md)** - デプロイメント手順
- **[🔒 SECURITY.md](./SECURITY.md)** - セキュリティガイド
- **[🧪 UX_TEST_SUMMARY.md](./UX_TEST_SUMMARY.md)** - UXテスト結果

## 📄 ライセンス

このプロジェクトは Apache 2.0 ライセンスの下で公開されています。詳細は [LICENSE](./LICENSE) を参照してください。

## 🙏 謝辞

- **Anthropic**: Claude API の提供
- **React**: モダンなUI開発フレームワーク
- **WebRTC**: P2P通信技術
- **Vercel**: エッジコンピューティングプラットフォーム

---

**Vibe Coder で、どこでも直感的な開発体験を。** 🚀✨