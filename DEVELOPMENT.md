# Vibe Coder - Development Guide

## 🎯 プロジェクト概要

Vibe Coder は、スマホからワンタップで Claude Code を実行できる革新的な開発ツールです。WebRTC P2P 通信により、どこからでも安全に自宅の開発環境にアクセスできます。

## 🏗️ システム構成詳細

### 統一WebRTCアーキテクチャ (2025年7月完成)

#### **技術スタック統合完了**
- **WebRTC API**: Simple-peer削除・Native RTCPeerConnection直接使用
- **PWA**: ブラウザネイティブWebRTC API
- **Host**: wrtcライブラリ（Node.js）+ Native API統合
- **統一メッセージ**: JSON形式・DataChannel通信

#### **開発環境 (localhost)**
- **localhost:5174**: PWA静的配信（React/Vite）
- **localhost:5175**: WebSocketシグナリングサーバー（Pure WebSocket）
- **localhost:8080**: ホストサーバーDockerコンテナ（Claude Code統合）

#### **プロダクション環境**
- **https://vibe-coder.space**: PWA静的配信（Vercel）
- **wss://user-domain.com:5175**: WebSocketシグナリング（Docker）
- **ユーザローカル:8080**: ホストサーバーDockerコンテナ（Claude Code統合）

### 🔧 詳細コンポーネント構成

#### **PWA クライアント (apps/web/)**
- **React 18 + TypeScript**: 型安全なコンポーネント開発
- **Vite**: 高速ビルド・開発サーバー
- **TailwindCSS**: ユーティリティファーストCSS
- **xterm.js**: 高機能ターミナルエミュレーター
- **Native WebRTC**: RTCPeerConnection・RTCDataChannel
- **Web Speech API**: webkitSpeechRecognition音声認識

#### **ホストサーバー (packages/host/)**
- **Express.js**: RESTful API・WebSocketサーバー
- **Claude Code統合**: claude CLIプロセス管理
- **WebRTC Service**: wrtc + Native RTCPeerConnection
- **セッション管理**: JWT + TOTP (speakeasy)
- **Docker**: UID/GID動的設定・権限問題解決済み

#### **WebSocketシグナリング (packages/signaling/)**
- **Pure WebSocket**: Next.js削除・軽量WebSocketサーバー
- **セッション管理**: 8桁キー認証・メモリベースステートレス
- **P2P橋渡し**: Offer/Answer・ICE候補交換のみ
- **自動クリーンアップ**: 非アクティブセッション管理

#### **PWA初回セットアップフロー**
- PWA初回起動時: シグナリングサーバードメイン入力（例: your-domain.com）
- PWA内部構築: `wss://your-domain.com:5175/ws/signaling`
- PWAストレージ永続化: 以降の接続で自動使用

**認証・接続フロー**
1. **8桁キー認証**: Host ID生成・表示
2. **2FA認証**: TOTP認証でsessionId発行
3. **WebRTC P2P**: 同一sessionIdでシグナリング・接続管理
4. **Claude Code実行**: リアルタイムコマンド実行・出力表示

## 📁 プロジェクト構造

```
vibe-coder/
├── apps/
│   └── web/                    # PWA (React)
│       ├── src/
│       │   ├── App.tsx        # メインアプリケーション
│       │   └── main.tsx       # エントリーポイント
│       └── dist/              # ビルド成果物 → signaling/public/へ移行
├── packages/
│   ├── signaling/             # 開発用Next.js (localhost:5175で独立Dockerコンテナ）
│   │   ├── pages/api/         # API endpoints
│   │   │   └── ws/signaling.ts # WebSocket シグナリング
│   │   ├── public/            # PWA静的配信 (apps/web/dist/から移行)
│   │   └── vercel.json        # Vercel設定（PWA配信のみ）
│   ├── host/                  # ホストサーバー (Docker)
│   │   ├── src/
│   │   │   ├── index.ts       # サーバーエントリーポイント
│   │   │   ├── services/      # Claude Code統合、WebRTC管理
│   │   │   └── utils/         # セキュリティ、設定管理
│   │   └── Dockerfile         # Docker設定
│   └── shared/                # 共通型定義・ユーティリティ
└── scripts/
    └── vibe-coder             # ワンコマンド起動スクリプト
```

## 🚀 開発環境セットアップ

### 必要なツール

```bash
# Node.js 20以上
node --version  # v20.x.x

# pnpm
npm install -g pnpm

# Docker & Docker Compose
docker --version
docker-compose --version

# Claude Code CLI
npm install -g @anthropic-ai/claude-code
```

### 初期セットアップ

```bash
# 1. リポジトリクローン
git clone https://github.com/your-username/vibe-coder.git
cd vibe-coder

# 2. 依存関係インストール
pnpm install

# 3. 全パッケージビルド
pnpm build

# 4. 本番環境起動（推奨）
./scripts/vibe-coder start

# 5. 開発環境起動
./scripts/vibe-coder dev
```

## 🔧 開発ワークフロー

### 1. ホストサーバー開発

#### **本番起動（推奨）**
```bash
# vibe-coderスクリプト使用（自動環境設定・永続化）
./scripts/vibe-coder start    # プロダクション環境
./scripts/vibe-coder dev      # 開発環境（3コンテナ構成）
```

#### **開発・デバッグ用手動起動**
```bash
# 必要な環境変数設定
export HOST_UID=$(id -u)
export HOST_GID=$(id -g)
export VIBE_CODER_SIGNALING_URL="localhost:5175"

# Docker環境での開発
docker compose up --build -d

# 単体テスト実行
pnpm --filter @vibe-coder/host test

# ビルド確認
pnpm --filter @vibe-coder/host build
```

### 2. PWA開発

```bash
# PWA開発サーバー起動
pnpm --filter @vibe-coder/web dev

# PWAビルド
pnpm --filter @vibe-coder/web build

# signalingのpublicディレクトリに移行
cp -r apps/web/dist/* packages/signaling/public/
```

### 3. シグナリングサーバー開発

**開発環境**: localhost:5175で独立Dockerコンテナ
**プロダクション環境**: ユーザー設定ドメイン:5175でDockerコンテナ

```bash
# 開発用シグナリングサーバー起動（開発モード）
./scripts/vibe-coder dev

# プロダクション用PWA配信（Vercel）
cd packages/signaling
vercel deploy --prod

# 単体テスト実行
pnpm --filter @vibe-coder/signaling test
```

## 🧪 テスト実行

### 単体テスト

```bash
# 高速テスト（日常開発）
pnpm test:fast

# 統合テスト（コミット前）
pnpm test:integration

# 全単体テスト
pnpm test

# 個別パッケージテスト
pnpm --filter @vibe-coder/host test
pnpm --filter @vibe-coder/signaling test
```

### E2Eテスト

```bash
# E2Eテスト（自動サーバー管理）
pnpm test:e2e

# 特定テストファイル実行
pnpm test:e2e -- --grep "authentication"

# デバッグモード
pnpm test:e2e --debug
```

### 統合テスト

```bash
# 統合E2Eテスト（自動サーバー管理）
pnpm test:e2e
```

## 📱 モバイルテスト

### Chrome DevToolsでのエミュレーション

```bash
# PWA開発サーバー起動
pnpm dev:pwa

# Chrome DevTools → デバイスエミュレーション
# iPhone/Android表示での動作確認
```

### 実機テスト

```bash
# ネットワーク経由でのアクセス
# スマホから https://www.vibe-coder.space にアクセス
# 8桁Host ID入力 → 2FA認証 → Claude Code実行
```

## 🔐 認証システム

### 8桁キー認証

```typescript
// Host ID生成 (packages/host/src/utils/auth.ts)
const hostId = generateHostId(); // 8桁数字
console.log(`Host ID: ${hostId}`);

// 永続化 (.vibe-coder-host-id)
fs.writeFileSync('.vibe-coder-host-id', hostId);
```

### 2FA認証 (TOTP)

```typescript
// TOTP秘密鍵生成
const secret = speakeasy.generateSecret({
  name: 'Vibe Coder',
  issuer: 'Vibe Coder'
});

// 認証コード検証
const verified = speakeasy.totp.verify({
  secret: secret.base32,
  encoding: 'base32',
  token: totpCode
});
```

### sessionId統一管理

```typescript
// 2FA認証成功時
const sessionId = generateSessionId(); // 8桁英数字

// WebRTCシグナリングで同じsessionIdを使用
const signalMessage = {
  type: 'create-session',
  sessionId: sessionId, // 同一ID
  hostId: hostId
};
```

## 🌐 WebRTC P2P通信

### シグナリングフロー

```typescript
// 1. セッション作成
POST /api/signal
{
  "type": "create-session",
  "sessionId": "ABC12345",
  "hostId": "12345678"
}

// 2. Offer送信
POST /api/signal
{
  "type": "offer",
  "sessionId": "ABC12345",
  "hostId": "12345678",
  "offer": { "type": "offer", "sdp": "..." }
}

// 3. Answer送信
POST /api/signal
{
  "type": "answer",
  "sessionId": "ABC12345",
  "hostId": "12345678",
  "answer": { "type": "answer", "sdp": "..." }
}
```

### Edge Function Stateless対応

```typescript
// グローバル永続化
declare global {
  var vibeCoderSessions: Map<string, SessionData> | undefined;
}

const sessions = globalThis.vibeCoderSessions || new Map();
if (!globalThis.vibeCoderSessions) {
  globalThis.vibeCoderSessions = sessions;
}
```

## 🐳 Docker運用

### 開発環境

```bash
# Docker Compose起動
docker-compose up -d

# ログ確認
docker-compose logs -f vibe-coder-host

# 停止
docker-compose down
```

### 本番環境

```bash
# 推奨：vibe-coderスクリプト使用
./scripts/vibe-coder start

# 手動起動の場合（デバッグ用）
export HOST_UID=$(id -u)
export HOST_GID=$(id -g)
docker compose up -d
```

## 🚀 デプロイ

### Vercelデプロイ（PWA配信専用）

```bash
# PWA静的配信のみ（シグナリング機能なし）
cd packages/signaling
vercel deploy --prod

# PWAビルド成果物を事前に配置
pnpm --filter @vibe-coder/web build
cp -r apps/web/dist/* packages/signaling/public/
```

### Dockerデプロイ

```bash
# Docker Hubへのプッシュ
docker build -t jl1nie/vibe-coder:latest .
docker push jl1nie/vibe-coder:latest

# ユーザー環境での実行（推奨）
./scripts/vibe-coder start

# 手動Docker実行（デバッグ用）
docker run -d -p 8080:8080 \
  -e HOST_UID=$(id -u) \
  -e HOST_GID=$(id -g) \
  -v ~/.claude:/app/.claude \
  -v $(pwd):/app/workspace \
  jl1nie/vibe-coder:latest
```

## 🧪 テスト手順・実行方法

### 📊 最新テスト状況 (2025年7月12日)

**✅ 完全通過パッケージ:**
- **shared**: 40/40テスト通過 (100%)
- **signaling**: 9/9テスト通過 (100%)
- **web (App.test.tsx)**: 18/18テスト通過 (100%)
- **host (WebRTC部分)**: 5/5テスト通過 (100%)

### 🔧 パッケージ別テスト実行

**1. 全パッケージテスト実行**
```bash
# ルートディレクトリから全テスト実行
pnpm test

# カバレッジ付きテスト
pnpm test:coverage
```

**2. パッケージ別テスト実行**
```bash
# Shared パッケージ（完全通過：40/40）
cd packages/shared && npm test

# Signaling パッケージ（完全通過：9/9）
cd packages/signaling && npm test

# Host パッケージ（WebRTC重要部分通過）
cd packages/host && export HOST_UID=$(id -u) && export HOST_GID=$(id -g) && npm test

# Web アプリケーション（UI部分通過：18/18）
cd apps/web && npm test src/__tests__/App.test.tsx
```

### 🎯 WebRTC最重要機能テスト

**WebRTC統合テスト（完全通過：5/5）**
```bash
cd packages/host
export HOST_UID=$(id -u) && export HOST_GID=$(id -g)
npx vitest run src/__tests__/webrtc-claude-integration.test.ts --reporter=verbose
```

**期待される結果:**
```
✓ src/__tests__/webrtc-claude-integration.test.ts (5 tests) 532ms
✓ should handle WebRTC claude-command messages
✓ should handle Claude service errors gracefully  
✓ should handle ping/pong messages
✓ should handle malformed messages gracefully
✓ should handle multiple concurrent commands

Tests: 5 passed (5)
```

### 🚀 E2Eテスト実行

**Playwright E2Eテスト**
```bash
cd apps/web

# E2Eテスト環境準備
npm run build
npm run preview &  # ポート4173でプレビューサーバー起動

# E2Eテスト実行
npx playwright test

# 特定テストファイル実行
npx playwright test src/__tests__/e2e/auth-e2e.spec.ts
npx playwright test src/__tests__/e2e/command-execution-e2e.spec.ts
```

### 🔍 トラブルシューティング

#### よくあるテスト問題

**1. WebRTC接続失敗**
```bash
# STUN/TURNサーバー確認
# Chrome DevTools → Network → WebRTC Internals
```

**2. Docker権限エラー**
```bash
# UID/GID設定確認
echo $HOST_UID $HOST_GID
export HOST_UID=$(id -u) && export HOST_GID=$(id -g)
```

**3. wrtcモジュールエラー**
```bash
# wrtc プリビルトバイナリ確認
ls -la /home/minoru/src/vibe-coder/node_modules/.pnpm/wrtc@0.4.7/node_modules/wrtc/build/Release/
# wrtc.node (17.7MB) が存在することを確認
```

**4. PWA更新が反映されない**
```bash
# キャッシュクリア
pnpm --filter @vibe-coder/web build
cp -r apps/web/dist/* packages/signaling/public/
```

### デバッグ方法

```bash
# 詳細ログ出力
DEBUG=vibe-coder:* pnpm start

# テスト実行時の詳細ログ
pnpm test -- --verbose

# WebRTC接続状態確認
chrome://webrtc-internals/

# wrtc モジュール動作確認
cd packages/host && node -e "console.log(require('wrtc'))"
```

## 📊 パフォーマンス最適化

### PWA最適化

```typescript
// Service Worker設定
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    runtimeCaching: [{
      urlPattern: /^https:\/\/vibe-coder\.space\/api\/.*/,
      handler: 'NetworkFirst'
    }]
  }
})
```

### Docker最適化

```dockerfile
# マルチステージビルド
FROM node:20-alpine AS builder
# ... ビルド処理 ...

FROM node:20-alpine AS production
# ... 本番環境設定 ...
```

## 🔒 セキュリティ

### 入力検証

```typescript
// packages/host/src/utils/security.ts
export function validateCommand(command: string) {
  if (!command || typeof command !== 'string') {
    return { isValid: false, reason: 'Invalid command' };
  }
  return { isValid: true, sanitizedCommand: command.trim() };
}
```

### 出力サニタイゼーション

```typescript
export function sanitizeOutput(output: string): string {
  return output
    .replace(/sk-[a-zA-Z0-9]{48}/g, '[REDACTED_API_KEY]')
    .replace(/ghp_[a-zA-Z0-9]{36}/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]');
}
```

## 🎨 UI/UX開発

### レスポンシブデザイン

```css
/* Tailwind CSS - モバイルファースト */
.glass-morphism {
  @apply backdrop-blur-sm bg-white/10 border border-white/20;
}

.touch-friendly {
  @apply min-h-[44px] min-w-[44px] p-2;
}
```

### アニメーション

```css
.pulse-recording {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

## 📚 関連ドキュメント

- [README.md](./README.md) - ユーザー向け使用ガイド
- [CLAUDE.md](./CLAUDE.md) - プロジェクト仕様書
- [Host Test Suite](./packages/host/src/__tests__/README.md) - ホストサーバーテスト仕様

## 🤝 コントリビューション

### 開発ガイドライン

1. **コード品質**: TypeScript厳格モード、ESLint、Prettier
2. **テスト**: 単体テスト、統合テスト、E2Eテスト
3. **セキュリティ**: 入力検証、出力サニタイゼーション
4. **パフォーマンス**: モバイル最適化、PWA対応

### プルリクエスト

```bash
# 開発ブランチ作成
git checkout -b feature/new-feature

# 変更・テスト・コミット
pnpm test
pnpm lint
git commit -m "feat: add new feature"

# プルリクエスト作成
git push origin feature/new-feature
```

---

**Vibe Coder** - スマホでClaude Codeを直感的に操作する革新的開発ツール 🚀