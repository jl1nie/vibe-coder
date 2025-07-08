# 💻 Vibe Coder 開発者ガイド

このドキュメントは、Vibe Coderの開発、ビルド、テスト、デプロイメントに関する詳細な技術情報を提供します。

## 🎯 プロジェクト品質状況

- **MVP機能**: 100%完成 ✅
- **テスト品質**: 113/113テスト通過 (100%) ✅  
- **E2E環境**: 完全準備済み ✅
- **コード品質**: TypeScript・ESLint・Prettier (100%) ✅

## 📋 目次

- [🛠️ 開発環境構築](#️-開発環境構築)
- [🏗️ ビルドシステム](#️-ビルドシステム)
- [🧪 テスト実行](#-テスト実行)
- [📡 シグナリングサーバー構築](#-シグナリングサーバー構築)
- [🐳 Docker イメージビルド・配布](#-docker-イメージビルド配布)
- [🚀 デプロイメント戦略](#-デプロイメント戦略)
- [🔧 トラブルシューティング](#-トラブルシューティング)

## 🛠️ 開発環境構築

### 必要な環境

```bash
# Node.js (必須)
node --version  # >= 18.19.0

# pnpm (推奨パッケージマネージャー)
npm install -g pnpm

# Docker (ホストサーバー開発用)
docker --version

# Git (必須)
git --version
```

### 1. リポジトリのセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/your-username/vibe-coder.git
cd vibe-coder

# 依存関係をインストール
pnpm install

# Husky Git hooks をセットアップ
npx husky install
```

### 2. 環境変数の設定

```bash
# 環境変数ファイルを作成
cp .env.example .env

# 必要な値を設定
vim .env
```

**.env** ファイルの設定例：

```bash
# === Claude API設定 ===
CLAUDE_API_KEY=sk-ant-your-key-here

# === 開発環境設定 ===
NODE_ENV=development
DEBUG=vibe-coder:*

# === ホストサーバー設定 ===
HOST_PORT=8080
SESSION_SECRET=your-random-secret-key

# === シグナリングサーバー設定 ===
SIGNALING_SERVER_URL=http://localhost:3001

# === データベース設定（開発用） ===
# Note: 本番環境では外部DBを使用
DATABASE_URL=sqlite:./dev.db

# === テスト設定 ===
TEST_TIMEOUT=30000
```

### 3. 開発サーバーの起動

Vibe Coderはモノレポ構成であり、各サービスを個別に、または組み合わせて起動できます。

#### ホストサーバー (バックエンド)

バックエンド開発はDockerコンテナで行います。これにより、ファイルパーミッションの問題を回避し、本番に近い環境で開発できます。

```bash
# ホストサーバーをDockerで起動
pnpm start
```
コンテナを停止するには `pnpm stop` を使用します。

#### PWA (フロントエンド)

UIの開発を行う場合、Viteの開発サーバーを起動します。

```bash
# PWAの開発サーバーを起動
pnpm --filter @vibe-coder/web dev
```

#### シグナリングサーバー

シグナリング機能の開発にはVercel CLIが必要です。

```bash
# シグナリングサーバーをローカルで起動
pnpm --filter @vibe-coder/signaling dev
```

**注意:** ルートディレクトリで `pnpm dev` を実行すると、`turbo` が全てのパッケージの `dev` スクリプトを実行しようとします。これには、Dockerで管理しているホストサーバーをコンテナ外で起動しようとする動作も含まれるため、ポートの競合など意図しない問題が発生する可能性があります。開発時は、上記のように必要なサービスを個別に起動することを推奨します。

### 4. 開発ツールの確認

```bash
# TypeScript型チェック
pnpm typecheck

# ESLintによるコード品質チェック
pnpm lint

# Prettierによるコードフォーマット
pnpm format

# 全チェックを一括実行
pnpm check-all
```

## 🏗️ ビルドシステム

### プロジェクト構成

```
vibe-coder/
├── apps/
│   └── web/                 # PWA (React + TypeScript + Vite)
├── packages/
│   ├── client/              # クライアントSDK
│   ├── host/                # ホストサーバー (Express + TypeScript)
│   ├── signaling/           # シグナリングサーバー (Vercel Edge Functions)
│   └── shared/              # 共有ライブラリ (型定義・ユーティリティ)
├── docker/                  # Docker設定
├── scripts/                 # ビルド・デプロイスクリプト
└── test/                    # E2Eテスト
```

### ビルドコマンド

```bash
# 全パッケージビルド
pnpm build

# 個別パッケージビルド
pnpm build:web         # PWA
pnpm build:host        # ホストサーバー
pnpm build:signaling   # シグナリングサーバー
pnpm build:shared      # 共有ライブラリ

# プロダクションビルド（最適化有効）
pnpm build:prod

# 型定義ファイル生成
pnpm build:types
```

### TypeScript設定

各パッケージには専用の `tsconfig.json` があります：

```typescript
// packages/host/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noEmit": false,
    "allowImportingTsExtensions": false,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.ts", "**/*.spec.ts", "src/__tests__/**/*"]
}
```

### ビルド最適化

#### PWA最適化
```bash
# サービスワーカー生成
pnpm build:sw

# バンドルサイズ分析
pnpm analyze-bundle

# Performance監査
pnpm lighthouse
```

#### ホストサーバー最適化
```bash
# Tree-shaking適用ビルド
pnpm build:host --minify

# Docker multi-stage ビルド
docker build -f docker/host/Dockerfile.prod .
```

## 🧪 テスト実行

### テスト戦略・実績

**テストピラミッド構成（総計 113+ テスト）**:
- **Unit/Integration Tests**: 113テスト (100%通過) - 高速・包括的
- **E2E Tests**: 3テストスイート - エンドツーエンド確認
- **テスト品質**: 100%達成・継続的統合対応

**パッケージ別テスト実績**:
- **@vibe-coder/host**: 46/46テスト ✅ (セッション・Claude統合・WebRTC)
- **@vibe-coder/web**: 17/17テスト ✅ (React・認証・UI/UX)
- **@vibe-coder/shared**: 40/40テスト ✅ (型定義・ユーティリティ)
- **@vibe-coder/signaling**: 10/10テスト ✅ (WebRTCシグナリング)

### 基本テスト実行

**簡単実行（推奨）**:
```bash
# 全Unit/Integrationテスト (113テスト)
./scripts/vibe-coder test

# E2Eテスト（自動環境構築）
./scripts/vibe-coder e2e
```

**個別パッケージテスト**:
```bash
# Host サーバーテスト (46テスト)
pnpm --filter @vibe-coder/host test --run

# PWA クライアントテスト (17テスト)
pnpm --filter @vibe-coder/web test --run

# 共通パッケージテスト (40テスト)  
pnpm --filter @vibe-coder/shared test --run

# シグナリングサーバーテスト (10テスト)
pnpm --filter @vibe-coder/signaling test --run

# 監視モード（開発中）
pnpm --filter @vibe-coder/web test

# カバレッジ付き実行
pnpm --filter @vibe-coder/web test:coverage
```

### E2E テスト実行

E2EテストはPlaywrightを使用し、完全なユーザーフローをテストします。

**自動実行（推奨）**:
```bash
# サーバー自動起動・テスト実行・クリーンアップ
./scripts/vibe-coder e2e
```

**手動実行**:
```bash
# 1. Host サーバー起動
pnpm build
pnpm --filter @vibe-coder/host start &

# 2. PWA サーバー起動
pnpm --filter @vibe-coder/web dev &

# 3. サーバー起動確認
curl http://localhost:8080/api/health  # Host
curl http://localhost:5173             # PWA

# 4. E2Eテスト実行
pnpm exec playwright test

# 5. ブラウザ表示付き（デバッグ用）
pnpm exec playwright test --headed
```

### テスト種別・内容

#### 1. Unit/Integration Tests (113テスト)

**Host パッケージ (46テスト)**:
- セッション管理・JWT認証
- Claude Code統合・コマンド実行・セキュリティ
- WebRTC接続・データチャネル

**Web パッケージ (17テスト)**:
- React コンポーネント・認証フロー
- WebRTC クライアント接続・UI/UX

**Shared パッケージ (40テスト)**:
- 型定義・ユーティリティ・バリデーション

**Signaling パッケージ (10テスト)**:
- WebRTC シグナリング API・Offer/Answer交換

#### 2. E2E Tests (3テストスイート)

**認証フロー (claude-authentication.spec.ts)**:
- Host ID入力・接続・2FA認証・TOTP入力
- 無効なHost ID・TOTPコードのエラーハンドリング

**Claude コマンド実行 (claude-commands.spec.ts)**:
- /help・/exit コマンド実行
- 自然言語コマンド・空コマンド処理

**レスポンシブデザイン (responsive-design.spec.ts)**:
- デスクトップ・タブレット・モバイル表示
- 画面サイズ変更・オリエンテーション対応

### テスト品質・継続的統合

**品質指標**:
- Unit/Integration: 100% (113/113テスト通過)
- Code Coverage: 高カバレッジ達成
- TypeScript: 厳格型チェック通過
- ESLint・Prettier: コード品質100%

**CI/CD統合**:
```bash
# GitHub Actions設定例
- name: Run All Tests
  run: |
    ./scripts/vibe-coder test
    ./scripts/vibe-coder e2e
```

### 詳細なテスト情報

完全なテスト実行ガイド・トラブルシューティングは [TESTING.md](./TESTING.md) を参照してください。

### テスト環境設定

#### Jest設定（Unit/Integration）
```javascript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      threshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
```

#### Playwright設定（E2E）
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### テストデータとモック

#### API モック設定
```typescript
// test/mocks/api.ts
import { setupServer } from 'msw/node';
import { rest } from 'msw';

export const server = setupServer(
  rest.post('/api/sessions', (req, res, ctx) => {
    return res(
      ctx.json({
        sessionId: 'TEST1234',
        hostId: '12345678',
        totpSecret: 'JBSWY3DPEHPK3PXP'
      })
    );
  }),
  
  rest.post('/api/sessions/:sessionId/verify', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        token: 'mock-jwt-token'
      })
    );
  })
);
```

#### WebRTC モック
```typescript
// test/mocks/webrtc.ts
Object.defineProperty(window, 'RTCPeerConnection', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
    createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
    setLocalDescription: jest.fn().mockResolvedValue(),
    setRemoteDescription: jest.fn().mockResolvedValue(),
    addIceCandidate: jest.fn().mockResolvedValue(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })),
});
```

### パフォーマンステスト

```bash
# Lighthouse パフォーマンス監査
pnpm test:performance

# バンドルサイズチェック
pnpm test:bundle-size

# メモリリークテスト
pnpm test:memory

# ロードテスト
pnpm test:load
```

### テスト品質保証

#### Pre-commit hooks
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "pnpm test:verify"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "pnpm lint --fix",
      "pnpm format",
      "pnpm test:related"
    ]
  }
}
```

#### CI/CD テスト
```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18.19.0, 20.0.0]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test:coverage
      - run: pnpm test:e2e
```

## 📡 シグナリングサーバー構築

### アーキテクチャ

シグナリングサーバーは Vercel Edge Functions で構築され、WebRTC接続の仲介を行います。

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│   PWA Client    │◄──►│ Signaling Server     │◄──►│   Host Server   │
│                 │    │ (Vercel Edge)        │    │                 │
│ WebRTC Peer     │    │                      │    │ WebRTC Peer     │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
         │                                                   │
         └─────────────► WebRTC P2P Connection ◄─────────────┘
                         (Direct, Encrypted)
```

### ローカル開発環境

```bash
# シグナリングサーバーを開発モードで起動
cd packages/signaling
pnpm dev

# Vercel CLI でローカルテスト
vercel dev --listen 3001
```

### API エンドポイント

## 📡 実際のAPI仕様とテスト方法

### 基本情報確認

#### ルート情報取得
```bash
GET http://localhost:8080/
```
**レスポンス例:**
```json
{
  "name": "Vibe Coder Host",
  "version": "0.1.0",
  "hostId": "53815375",
  "status": "running", 
  "timestamp": "2025-07-06T15:20:02.062Z"
}
```

#### ヘルスチェック
```bash
GET http://localhost:8080/api/health
```
**レスポンス例:**
```json
{
  "status": "degraded",
  "timestamp": "2025-07-06T15:20:07.939Z",
  "uptime": 1434.040062984,
  "sessions": {
    "active": 0,
    "total": 1
  },
  "memory": {
    "used": 12845280,
    "total": 14680064,
    "percentage": 88
  },
  "claude": {
    "available": false,
    "lastCheck": "2025-07-06T15:20:07.939Z"
  },
  "responseTime": 1
}
```

### 認証フロー（8桁キー + TOTP 2FA）

#### 1. セッション作成とTOTP秘密鍵取得
```bash
POST http://localhost:8080/api/auth/sessions
Content-Type: application/json
```
**レスポンス例:**
```json
{
  "sessionId": "SPW49IEP",
  "hostId": "53815375",
  "totpSecret": "OJSGYVRSONID65SIMZ6VMVBPHQ2TUVB7OIWDYLDIGYWECYSALZDQ",
  "message": "Enter the TOTP secret in your authenticator app, then provide TOTP code"
}
```

#### 2. TOTP認証とJWTトークン取得
```bash
POST http://localhost:8080/api/auth/sessions/SPW49IEP/verify
Content-Type: application/json

{
  "totpCode": "123456"
}
```
**成功レスポンス:**
```json
{
  "success": true,
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "message": "Authentication successful"
}
```

#### 3. セッション状態確認
```bash
GET http://localhost:8080/api/auth/sessions/SPW49IEP/status
```

#### 4. セッション更新
```bash
POST http://localhost:8080/api/auth/sessions/SPW49IEP/refresh
Authorization: Bearer {jwt_token}
```

#### 5. セッション削除（ログアウト）
```bash
DELETE http://localhost:8080/api/auth/sessions/SPW49IEP
Authorization: Bearer {jwt_token}
```

### Claude Code実行

#### コマンド実行
```bash
POST http://localhost:8080/api/claude/execute
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "command": "create a hello world script in Python"
}
```

#### 実行中コマンドの中止
```bash
POST http://localhost:8080/api/claude/cancel
Authorization: Bearer {jwt_token}
```

### WebRTC P2P通信

#### シグナリング（Offer/Answer交換）
```bash
POST http://localhost:8080/api/webrtc/signal
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "type": "offer",
  "sessionId": "SPW49IEP",
  "sdp": "v=0...",
  "timestamp": 1672531200000
}
```

### 完全なテストシナリオ例

```bash
# 1. サーバー状態確認
curl -s http://localhost:8080/ | jq .

# 2. セッション作成
RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/sessions)
SESSION_ID=$(echo $RESPONSE | jq -r '.sessionId')
TOTP_SECRET=$(echo $RESPONSE | jq -r '.totpSecret')
HOST_ID=$(echo $RESPONSE | jq -r '.hostId')

echo "Session ID: $SESSION_ID"
echo "TOTP Secret: $TOTP_SECRET"
echo "Host ID: $HOST_ID"

# 3. Authenticatorアプリで TOTP_SECRET を設定し、6桁コードを取得

# 4. TOTP認証（実際のコードに置き換える）
TOTP_CODE="123456"
AUTH_RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/sessions/$SESSION_ID/verify \
  -H "Content-Type: application/json" \
  -d "{\"totpCode\": \"$TOTP_CODE\"}")

JWT_TOKEN=$(echo $AUTH_RESPONSE | jq -r '.token')
echo "JWT Token: $JWT_TOKEN"

# 5. Claude Codeコマンド実行テスト
curl -X POST http://localhost:8080/api/claude/execute \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "echo hello world"}' | jq .
```

### WebSocket接続テスト

```javascript
// ブラウザまたはNode.jsでのWebSocket接続
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = function() {
  console.log('WebSocket connected');
  
  // Ping送信
  ws.send(JSON.stringify({type: 'ping'}));
  
  // ハートビート送信
  ws.send(JSON.stringify({
    type: 'heartbeat',
    sessionId: 'SPW49IEP'
  }));
};

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### 環境変数

```bash
# packages/signaling/.env
# === Vercel設定 ===
VERCEL_TOKEN=your-vercel-token
VERCEL_ORG_ID=your-org-id
VERCEL_PROJECT_ID=your-project-id

# === データベース設定 ===
# 注意: Vercel KVは使用しない（セキュリティ上の理由）
# 一時的なメモリストレージを使用

# === セキュリティ設定 ===
ALLOWED_ORIGINS=https://vibe-coder.space,http://localhost:3000
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000  # 15分

# === ログ設定 ===
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
```

### デプロイメント

```bash
# 本番環境へデプロイ
cd packages/signaling
pnpm deploy

# ステージング環境へデプロイ
pnpm deploy:staging

# デプロイ状況確認
vercel ls
```

### セキュリティ設定

```typescript
// packages/signaling/api/middleware/security.ts
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; connect-src 'self' wss:",
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

export const rateLimiter = new Map();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - (15 * 60 * 1000); // 15分
  
  if (!rateLimiter.has(ip)) {
    rateLimiter.set(ip, []);
  }
  
  const requests = rateLimiter.get(ip)!
    .filter((time: number) => time > windowStart);
  
  requests.push(now);
  rateLimiter.set(ip, requests);
  
  return requests.length <= 100; // 15分間で100リクエストまで
}
```

## 🐳 Docker イメージビルド・配布

### Multi-stage Dockerfile

```dockerfile
# docker/host/Dockerfile
FROM node:18-alpine AS base
WORKDIR /app

# 依存関係のインストール
FROM base AS deps
COPY package*.json pnpm-lock.yaml ./
RUN npm ci --only=production

# ビルドステージ
FROM base AS builder
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build:host

# プロダクションステージ
FROM node:18-alpine AS production
WORKDIR /app

# 実行時ユーザーを作成
RUN addgroup -g 1001 -S nodejs
RUN adduser -S vibe-coder -u 1001

# 必要なファイルのみコピー
COPY --from=builder --chown=vibe-coder:nodejs /app/packages/host/dist ./dist
COPY --from=deps --chown=vibe-coder:nodejs /app/node_modules ./node_modules
COPY --chown=vibe-coder:nodejs package.json ./

# セキュリティ設定
USER vibe-coder
EXPOSE 8080

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["node", "dist/index.js"]
```

### ローカルビルド

```bash
# Docker イメージをローカルでビルド
pnpm docker:build

# マルチアーキテクチャビルド（AMD64 + ARM64）
pnpm docker:build:multi

# ビルドしたイメージでテスト実行
pnpm docker:test

# イメージサイズ確認
docker images | grep vibe-coder
```

### CI/CDパイプライン

```yaml
# .github/workflows/docker.yml
name: Docker Build & Push

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: jl1nie/vibe-coder
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./docker/host/Dockerfile
          platforms: linux/amd64,linux/arm64
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 配布戦略

#### Docker Hub公開
```bash
# 手動プッシュ（緊急時）
docker tag vibe-coder:latest jl1nie/vibe-coder:v1.0.0
docker push jl1nie/vibe-coder:v1.0.0
docker push jl1nie/vibe-coder:latest

# タグ付きリリース
git tag v1.0.0
git push origin v1.0.0  # 自動的にCI/CDがトリガー
```

#### GitHub Container Registry
```bash
# 代替レジストリとしてGHCRも利用
echo $GITHUB_TOKEN | docker login ghcr.io -u username --password-stdin
docker tag vibe-coder:latest ghcr.io/username/vibe-coder:latest
docker push ghcr.io/username/vibe-coder:latest
```

### セキュリティ考慮事項

#### イメージスキャニング
```bash
# Trivy によるセキュリティスキャン
trivy image jl1nie/vibe-coder:latest

# Docker Scout による脆弱性チェック
docker scout cves jl1nie/vibe-coder:latest
```

#### 最小権限の原則
```dockerfile
# ルートユーザーを使用しない
FROM node:18-alpine
RUN addgroup -g 1001 -S nodejs
RUN adduser -S vibe-coder -u 1001
USER vibe-coder

# 不要なパッケージを削除
RUN apk del .build-deps

# 読み取り専用ルートファイルシステム
docker run --read-only --tmpfs /tmp --tmpfs /app/logs vibe-coder:latest
```

## 🚀 デプロイメント戦略

### 本番環境のアーキテクチャ

```
┌─────────────────────┐
│ Vercel (Global CDN) │
│ ┌─────────────────┐ │
│ │ PWA Application │ │  ← https://vibe-coder.space
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ Signaling Server│ │  ← https://signal.vibe-coder.space
│ └─────────────────┘ │
└─────────────────────┘
          │
          │ WebRTC Signaling
          │
┌─────────────────────┐
│ User's Environment  │
│ ┌─────────────────┐ │
│ │ Docker Host     │ │  ← jl1nie/vibe-coder:latest
│ │ ┌─────────────┐ │ │
│ │ │Claude Code  │ │ │
│ │ └─────────────┘ │ │
│ └─────────────────┘ │
└─────────────────────┘
```

### 自動デプロイパイプライン

#### 1. PWA デプロイ（Vercel）
```bash
# 自動デプロイ設定
# main ブランチへのpush → 本番デプロイ
# PR作成 → プレビューデプロイ

# 手動デプロイ
cd apps/web
vercel --prod
```

#### 2. Docker イメージ配布
```bash
# GitHub Actionsによる自動ビルド・プッシュ
# git tag v1.0.0 → 自動的にDocker Hubへプッシュ

# レジストリ確認
curl -s https://hub.docker.com/v2/repositories/jl1nie/vibe-coder/tags/
```

#### 3. シグナリングサーバーデプロイ
```bash
# Vercel への自動デプロイ
cd packages/signaling
vercel --prod

# カスタムドメイン設定
vercel domains add signal.vibe-coder.space
```

### 環境別設定

#### Production
```bash
# docker-compose.prod.yml
version: '3.8'
services:
  vibe-coder-host:
    image: jl1nie/vibe-coder:latest
    environment:
      - NODE_ENV=production
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - SIGNALING_SERVER_URL=https://signal.vibe-coder.space
    ports:
      - "8080:8080"
    volumes:
      - ./workspace:/app/workspace:ro
      - ~/.claude:/app/.claude:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

#### Staging
```bash
# docker-compose.staging.yml
version: '3.8'
services:
  vibe-coder-host:
    image: jl1nie/vibe-coder:staging
    environment:
      - NODE_ENV=staging
      - CLAUDE_API_KEY=${CLAUDE_API_KEY_STAGING}
      - SIGNALING_SERVER_URL=https://staging-signal.vibe-coder.space
      - DEBUG=vibe-coder:*
    ports:
      - "8081:8080"
```

### ロールバック戦略

```bash
# Docker イメージのロールバック
docker pull jl1nie/vibe-coder:v1.0.0  # 前のバージョン
docker tag jl1nie/vibe-coder:v1.0.0 jl1nie/vibe-coder:latest
docker-compose up -d

# Vercel デプロイのロールバック
vercel rollback  # 前のデプロイに戻す

# 緊急時のメンテナンスモード
vercel env add MAINTENANCE_MODE true  # メンテナンス画面を表示
```

### 監視・ログ

#### アプリケーション監視
```bash
# ヘルスチェック
curl -f http://localhost:8080/health

# メトリクス収集
curl http://localhost:8080/metrics

# ログ確認
docker logs vibe-coder-host -f
```

#### Vercel監視
```bash
# Vercel Analytics
vercel analytics  

# Function logs
vercel logs

# Performance monitoring
vercel inspect https://vibe-coder.space
```

## 🔧 トラブルシューティング

### 開発環境のトラブル

#### Node.js バージョン問題
```bash
# 現在のバージョン確認
node --version

# nvmを使用したバージョン管理
nvm install 18.19.0
nvm use 18.19.0

# package.json で固定
{
  "engines": {
    "node": ">=18.19.0",
    "npm": ">=9.0.0"
  }
}
```

#### パッケージ依存関係エラー
```bash
# キャッシュクリア
pnpm store prune
rm -rf node_modules
rm -rf .pnpm-store

# 依存関係再インストール
pnpm install

# 依存関係の問題を調査
pnpm why package-name
pnpm outdated
```

#### TypeScript コンパイルエラー
```bash
# 型チェック
pnpm typecheck

# 型定義を再生成
pnpm build:types

# TypeScript設定確認
npx tsc --showConfig

# モジュール解決の確認
npx tsc --traceResolution
```

### ビルド・デプロイのトラブル

#### Docker ビルドエラー
```bash
# ビルドログの詳細表示
docker build --no-cache --progress=plain .

# マルチステージビルドのデバッグ
docker build --target deps .
docker build --target builder .

# イメージのレイヤー確認
docker history vibe-coder:latest
```

#### Vercel デプロイエラー
```bash
# ローカルでVercel環境をテスト
vercel dev

# デプロイログ確認
vercel logs

# 環境変数確認
vercel env ls

# ビルド設定確認
vercel inspect
```

### 実行時のトラブル

#### WebRTC接続エラー
```bash
# STUN/TURNサーバー確認
curl -v stun:stun.l.google.com:19302

# ファイアウォール設定確認
netstat -tuln | grep 8080

# WebRTC debug logs
export DEBUG=simple-peer
```

#### Claude API エラー
```bash
# API キー確認
echo $CLAUDE_API_KEY | cut -c1-10  # 最初の10文字のみ表示

# API接続テスト
curl -H "Authorization: Bearer $CLAUDE_API_KEY" \
     https://api.anthropic.com/v1/messages

# レート制限確認
curl -I https://api.anthropic.com/v1/messages
```

#### パフォーマンス問題
```bash
# メモリ使用量監視
docker stats vibe-coder-host

# CPU使用率確認
top -p $(docker inspect -f '{{.State.Pid}}' vibe-coder-host)

# ネットワーク監視
iftop

# アプリケーションプロファイリング
node --inspect dist/index.js
```

### ログ分析

#### アプリケーションログ
```bash
# 構造化ログの確認
docker logs vibe-coder-host | jq '.'

# エラーログのフィルタリング
docker logs vibe-coder-host 2>&1 | grep ERROR

# ログレベル調整
export LOG_LEVEL=debug
```

#### ネットワークログ
```bash
# WebRTC接続ログ
export DEBUG=simple-peer

# HTTP リクエストログ
export DEBUG=express:*

# WebSocket接続ログ
export DEBUG=ws:*
```

### デバッグツール

#### ブラウザ開発者ツール
```javascript
// WebRTC接続状態確認
navigator.mediaDevices.getUserMedia({audio: true})
  .then(stream => console.log('Audio access:', stream))
  .catch(err => console.error('Audio error:', err));

// PWA状態確認
navigator.serviceWorker.getRegistrations()
  .then(registrations => console.log('SW:', registrations));

// ネットワーク状態確認
navigator.connection && console.log('Network:', navigator.connection);
```

#### Node.js デバッグ
```bash
# デバッガーで起動
node --inspect-brk dist/index.js

# Chrome DevTools で接続
chrome://inspect

# ヒープダンプ取得
node --heapdump dist/index.js
```

---

このドキュメントで開発・デプロイメントの全プロセスがカバーされています。問題が発生した場合は、該当するセクションを参照してください。

さらなる技術的詳細は以下のドキュメントを参照：
- [📋 CONFIG_DOCUMENTATION.md](./CONFIG_DOCUMENTATION.md) - 設定ファイルの詳細
- [🚀 DEPLOYMENT_MANUAL.md](./DEPLOYMENT_MANUAL.md) - デプロイメント手順
- [🔒 SECURITY.md](./SECURITY.md) - セキュリティガイド