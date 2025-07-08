# Vibe Coder - Development Guide

## 🎯 プロジェクト概要

Vibe Coder は、スマホからワンタップで Claude Code を実行できる革新的な開発ツールです。WebRTC P2P 通信により、どこからでも安全に自宅の開発環境にアクセスできます。

## 🏗️ アーキテクチャ概要

### 2025年7月仕様変更後の統合アーキテクチャ

**PWA + シグナリングサーバー統合 (Vercel)**
- **URL**: `https://www.vibe-coder.space`
- **PWA配信**: `/` → `packages/signaling/public/` (静的配信)
- **API**: `/api/*` → `packages/signaling/pages/api/*` (Edge Functions)
- **統合管理**: PWAとAPIが同一プロジェクトで運用

**ホストサーバー (Docker)**
- **ポート**: 8080
- **機能**: Claude Code統合、WebRTC P2P接続、認証管理
- **永続化**: Host ID、セッション情報、TOTP秘密鍵

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
│   ├── signaling/             # シグナリングサーバー (Vercel)
│   │   ├── pages/api/         # API endpoints
│   │   │   ├── signal.ts      # WebRTC シグナリング
│   │   │   ├── session.ts     # セッション管理
│   │   │   └── health.ts      # ヘルスチェック
│   │   ├── public/            # PWA静的配信 (apps/web/dist/から移行)
│   │   └── vercel.json        # Vercel設定
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

# 4. ワンコマンド起動
./scripts/vibe-coder start
```

## 🔧 開発ワークフロー

### 1. ホストサーバー開発

```bash
# Docker環境での開発
pnpm --filter @vibe-coder/host dev

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

```bash
# Vercel開発サーバー起動
cd packages/signaling
vercel dev

# 単体テスト実行
pnpm --filter @vibe-coder/signaling test

# ビルド確認
pnpm --filter @vibe-coder/signaling build
```

## 🧪 テスト実行

### 単体テスト

```bash
# 全パッケージテスト
pnpm test

# 個別パッケージテスト
pnpm --filter @vibe-coder/host test
pnpm --filter @vibe-coder/signaling test
pnpm --filter @vibe-coder/web test
```

### E2Eテスト

```bash
# Playwrightテスト
pnpm test:e2e

# 特定テストファイル実行
pnpm test:e2e -- --grep "authentication"
```

### 統合テスト

```bash
# サーバー起動後のテスト
pnpm start  # 別ターミナル
pnpm test-full
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
# 本番用Docker設定
docker-compose -f docker-compose.prod.yml up -d

# UID/GID同期
export HOST_UID=$(id -u)
export HOST_GID=$(id -g)
docker-compose up -d
```

## 🚀 デプロイ

### Vercelデプロイ

```bash
# signalingサーバーデプロイ
cd packages/signaling
vercel deploy --prod

# PWAビルド成果物も同時デプロイ
# (public/ディレクトリが静的配信される)
```

### Dockerデプロイ

```bash
# Docker Hubへのプッシュ
docker build -t jl1nie/vibe-coder:latest .
docker push jl1nie/vibe-coder:latest

# ユーザー環境での実行
docker run -d -p 8080:8080 \
  -e HOST_UID=$(id -u) \
  -e HOST_GID=$(id -g) \
  -v ~/.claude:/app/.claude \
  -v $(pwd):/app/workspace \
  jl1nie/vibe-coder:latest
```

## 🔍 トラブルシューティング

### よくある問題

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

**3. PWA更新が反映されない**
```bash
# キャッシュクリア
pnpm --filter @vibe-coder/web build
cp -r apps/web/dist/* packages/signaling/public/
```

### デバッグ方法

```bash
# 詳細ログ出力
DEBUG=vibe-coder:* pnpm start

# テスト実行時のログ
pnpm test -- --verbose

# WebRTC接続状態確認
chrome://webrtc-internals/
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
- [TESTING.md](./TESTING.md) - テスト戦略・手法
- [API Documentation](./packages/signaling/pages/api/) - API仕様

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