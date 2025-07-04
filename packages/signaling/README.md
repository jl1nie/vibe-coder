# Vibe Coder Signaling Server

WebRTC シグナリングとプレイリスト発見サービス for Vibe Coder

## 🌟 概要

Vibe Coder Signaling Server は Vercel Edge Functions で動作する軽量なシグナリングサーバーです。

### 主要機能

- **WebRTC シグナリング**: Offer/Answer/ICE Candidate の中継
- **プレイリスト発見**: GitHub からのプレイリスト自動収集
- **レート制限**: IP ベースの制限とセキュリティ
- **統計情報**: リアルタイム利用統計と分析

## 🚀 デプロイ

### Vercel へのデプロイ

```bash
# 依存関係のインストール
npm install

# Vercel CLI でデプロイ
npm run deploy

# プレビューデプロイ
npm run deploy:preview
```

### 環境変数の設定

Vercel ダッシュボードで以下の環境変数を設定：

```bash
# 必須: Vercel KV
KV_REST_API_URL=https://your-kv-store.vercel-storage.com
KV_REST_API_TOKEN=your_token_here

# オプション: GitHub プレイリスト発見
GITHUB_TOKEN=ghp_your_github_token
```

## 📡 API エンドポイント

### 1. WebRTC シグナリング

**POST /api/signal**
```json
{
  "type": "offer|answer|ice-candidate",
  "serverId": "server_id",
  "data": { "sdp": "...", "type": "offer" }
}
```

**GET /api/signal?type=offer&serverId=server_123**
```json
{
  "data": { "sdp": "...", "type": "offer" },
  "timestamp": 1704067200000,
  "age": 1234
}
```

### 2. プレイリスト発見

**GET /api/playlists**
```json
{
  "playlists": [
    {
      "schema": "vibe-coder-playlist-v1",
      "metadata": {
        "name": "Frontend Vibes",
        "author": "ui_ninja",
        "description": "フロントエンド開発用コマンド集"
      },
      "commands": [
        {
          "icon": "🎨",
          "label": "Style Fix",
          "command": "claude-code \"fix CSS styling issues\"",
          "description": "CSS スタイリングの問題を修正"
        }
      ]
    }
  ],
  "total": 15,
  "fromCache": true
}
```

### 3. 統計情報

**GET /api/stats**
```json
{
  "signaling": {
    "today": { "total": 245, "offer": 89, "answer": 87 },
    "yesterday": { "total": 189, "offer": 67, "answer": 65 }
  },
  "playlists": {
    "lastUpdated": 1704067200000,
    "cacheAge": 1800000
  }
}
```

## 🔒 セキュリティ機能

### レート制限
- IP あたり 1分間に 30リクエスト
- 違反時は 429 ステータスで応答

### データ制限
- シグナリングデータ: 最大 100KB
- TTL: 60秒で自動削除

### CORS
- 全オリジンに対応
- プリフライトリクエスト対応

## 📊 監視とメトリクス

### 利用可能な統計
- シグナリング利用量（日別・サーバー別）
- プレイリストアクセス統計
- レート制限状況
- システムヘルス情報

### ヘルスチェック
```bash
curl https://your-signaling-server.vercel.app/api/stats?type=health
```

## 🏗️ アーキテクチャ

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Vibe Coder PWA │    │  Signaling API   │    │  Vibe Coder     │
│     (Client)    │◄──►│  (Vercel Edge)   │◄──►│  Host Server    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Vercel KV      │
                       │  (Redis Store)   │
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   GitHub API     │
                       │  (Playlists)     │
                       └──────────────────┘
```

## 🔧 開発

### ローカル開発

```bash
# 開発サーバー起動
npm run dev

# 型チェック
npm run typecheck

# Lint
npm run lint
```

### テスト

```bash
# 単体テスト
npm test

# E2E テスト
curl -X POST http://localhost:3000/api/signal \
  -H "Content-Type: application/json" \
  -d '{"type":"offer","serverId":"test","data":{"sdp":"test"}}'
```

## 📋 プレイリスト仕様

プレイリストは GitHub Gist または リポジトリの `vibe-coder-playlist.json` で配布：

```json
{
  "schema": "vibe-coder-playlist-v1",
  "metadata": {
    "name": "My Awesome Playlist",
    "description": "説明文",
    "author": "github_username",
    "version": "1.0.0",
    "tags": ["frontend", "react", "typescript"]
  },
  "commands": [
    {
      "icon": "🚀",
      "label": "Start Dev",
      "command": "claude-code \"start development server\"",
      "description": "開発サーバーを起動",
      "category": "dev"
    }
  ]
}
```

## 🚨 トラブルシューティング

### よくある問題

1. **KV_REST_API_TOKEN が無効**
   - Vercel ダッシュボードで正しいトークンを確認

2. **GitHub API 制限**
   - GITHUB_TOKEN を設定して認証制限を回避

3. **レート制限に達した**
   - 1分待機するか、IP を変更

### ログの確認

Vercel ダッシュボードの Functions タブでリアルタイムログを確認可能。

## 📚 関連リンク

- [Vibe Coder Host Server](../host/README.md)
- [Vibe Coder PWA](../web/README.md)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)
- [WebRTC Signaling](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling)