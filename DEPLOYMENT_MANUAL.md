# 🚀 Vibe Coder デプロイマニュアル

## 📋 概要

このマニュアルでは、Vibe Coderの完全なデプロイプロセスを説明します。Docker、Vercel、および関連する環境設定を含む包括的な手順を提供します。

---

## 🏗️ アーキテクチャ構成

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   PWA Client    │◄──►│ Signaling Server │◄──►│   Host Server   │
│www.vibe-coder   │    │  vibe-coder.space│    │  Docker Container│
│    .space       │    │   (Vercel)       │    │   (User Machine)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### コンポーネント
1. **PWA Client**: モバイルファーストWebアプリ (Vercel)
2. **Signaling Server**: WebRTC仲介・プレイリスト管理 (Vercel Edge Functions)
3. **Host Server**: Claude Code統合サーバー (Docker)

---

## 🔧 事前準備

### 必要なアカウント・ツール

#### 1. 開発環境
```bash
# Node.js 20+
node --version  # v20.0.0+

# Docker & Docker Compose
docker --version
docker-compose --version

# Git
git --version

# 必要に応じて
pnpm --version  # v8.15.0+
```

#### 2. 外部サービス

| サービス | 用途 | 必須 |
|---------|------|------|
| **Claude API** | AI機能 | ✅ |
| **GitHub** | コード管理・認証 | ✅ |
| **Vercel** | PWA・Signaling Server | ✅ |
| **Docker Hub/GHCR** | Container Registry | ✅ |
| **Upstash (KV)** | Redis Database | ✅ |
| **Sentry** | エラー監視 | ⚠️ |
| **Slack** | 通知 | ⚠️ |

### アカウント取得

#### Claude API
```bash
# https://console.anthropic.com/
# API Key取得後:
export CLAUDE_API_KEY=sk-ant-xxxxx
```

#### GitHub
```bash
# Personal Access Token (repo, packages権限)
export GITHUB_TOKEN=ghp_xxxxx
```

#### Vercel
```bash
# https://vercel.com/
# Vercel CLI setup
npm install -g vercel
vercel login
```

---

## 📦 Docker Hub/GitHub Container Registry設定

### GitHub Container Registry (推奨)

#### 1. Personal Access Token作成
```bash
# GitHub > Settings > Developer settings > Personal access tokens
# Scopes: read:packages, write:packages, delete:packages
export GITHUB_TOKEN=ghp_xxxxx
```

#### 2. Docker Registry認証
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

#### 3. Image Build & Push
```bash
# Docker imageビルド
./scripts/docker-build.sh

# タグ付きビルド
./scripts/docker-build.sh v1.0.0

# Build only (push無し)
./scripts/docker-build.sh --build-only
```

### Docker Hub (代替)
```bash
# Docker Hub Login
docker login

# Registry変更
./scripts/docker-build.sh --registry docker.io v1.0.0
```

---

## ⚙️ 環境設定

### 1. 環境変数ファイル作成

```bash
# .envファイル作成
cp .env.example .env

# 各環境用の設定
cp .env.example .env.local      # ローカル開発
cp .env.example .env.staging    # ステージング
cp .env.example .env.production # 本番
```

### 2. 必須環境変数設定

#### .env.production
```bash
# Claude API
CLAUDE_API_KEY=sk-ant-xxxxx

# GitHub
GITHUB_TOKEN=ghp_xxxxx
GITHUB_REPOSITORY=your-username/vibe-coder

# Docker
DOCKER_REGISTRY=ghcr.io
DOCKER_IMAGE_NAME=your-username/vibe-coder-host

# Vercel
VERCEL_TOKEN=xxxxx
VERCEL_ORG_ID=xxxxx
VERCEL_PROJECT_ID=xxxxx

# Domains
PRODUCTION_DOMAIN=vibe-coder.space
WWW_DOMAIN=www.vibe-coder.space

# Upstash KV
PRODUCTION_KV_URL=redis://xxxxx
PRODUCTION_KV_REST_API_URL=https://xxxxx.upstash.io
PRODUCTION_KV_REST_API_TOKEN=xxxxx
```

---

## 🌐 Vercel設定

### 1. プロジェクト作成

#### Signaling Server
```bash
cd packages/signaling
vercel --prod

# Project settings:
# Project Name: vibe-coder-signaling
# Framework: Other
# Root Directory: packages/signaling
# Build Command: npm run build
# Output Directory: api
```

#### PWA
```bash
cd apps/web
vercel --prod

# Project settings:
# Project Name: vibe-coder-pwa
# Framework: Vite
# Root Directory: apps/web
# Build Command: npm run build
# Output Directory: dist
```

### 2. ドメイン設定

```bash
# メインドメイン (Signaling)
vercel domains add vibe-coder.space --project vibe-coder-signaling

# WWWドメイン (PWA)
vercel domains add www.vibe-coder.space --project vibe-coder-pwa
```

### 3. 環境変数設定

#### Signaling Server
```bash
# Production環境変数
vercel env add PRODUCTION_KV_URL production
vercel env add PRODUCTION_KV_REST_API_URL production
vercel env add PRODUCTION_KV_REST_API_TOKEN production
vercel env add GITHUB_TOKEN production
vercel env add NODE_ENV production

# Staging環境変数
vercel env add STAGING_KV_URL preview
vercel env add STAGING_KV_REST_API_URL preview
vercel env add STAGING_KV_REST_API_TOKEN preview
vercel env add NODE_ENV preview
```

#### PWA
```bash
# Production環境変数
vercel env add VITE_APP_ENV production
vercel env add VITE_SIGNALING_URL https://vibe-coder.space
vercel env add VITE_API_BASE_URL https://vibe-coder.space/api

# Staging環境変数
vercel env add VITE_APP_ENV staging
vercel env add VITE_SIGNALING_URL https://staging.vibe-coder.space
vercel env add VITE_API_BASE_URL https://staging.vibe-coder.space/api
```

---

## 🐳 Docker Host Server デプロイ

### 1. イメージビルド

```bash
# マルチプラットフォームビルド
./scripts/docker-build.sh

# 特定バージョン
./scripts/docker-build.sh v1.0.0

# ARM64 only (M1 Mac等)
./scripts/docker-build.sh --platform linux/arm64

# Build確認
docker images | grep vibe-coder
```

### 2. 本番サーバーでの実行

#### Docker Compose使用 (推奨)
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  vibe-coder-host:
    image: ghcr.io/your-username/vibe-coder-host:latest
    container_name: vibe-coder-host
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - LOG_LEVEL=info
    volumes:
      - ./workspace:/app/workspace
      - ./sessions:/app/sessions
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 1g
          cpus: '1'
```

```bash
# 起動
docker-compose -f docker-compose.prod.yml up -d

# ログ確認
docker-compose -f docker-compose.prod.yml logs -f

# 停止
docker-compose -f docker-compose.prod.yml down
```

#### 直接実行
```bash
# Pull latest image
docker pull ghcr.io/your-username/vibe-coder-host:latest

# Run container
docker run -d \
  --name vibe-coder-host \
  --restart unless-stopped \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e CLAUDE_API_KEY=$CLAUDE_API_KEY \
  -v $(pwd)/workspace:/app/workspace \
  -v $(pwd)/sessions:/app/sessions \
  -v $(pwd)/logs:/app/logs \
  ghcr.io/your-username/vibe-coder-host:latest
```

---

## 🔄 CI/CD設定

### GitHub Actions設定

#### 1. Repository Secrets
```bash
# GitHub Repository > Settings > Secrets and variables > Actions

# Vercel
VERCEL_TOKEN=xxxxx
VERCEL_ORG_ID=xxxxx
VERCEL_PROJECT_ID=xxxxx (signaling)
VERCEL_PWA_PROJECT_ID=xxxxx (PWA)

# Docker
GITHUB_TOKEN=xxxxx (packages permission)

# Database
PRODUCTION_KV_URL=xxxxx
PRODUCTION_KV_REST_API_URL=xxxxx
PRODUCTION_KV_REST_API_TOKEN=xxxxx
STAGING_KV_URL=xxxxx
STAGING_KV_REST_API_URL=xxxxx
STAGING_KV_REST_API_TOKEN=xxxxx

# Monitoring
PRODUCTION_SENTRY_DSN=xxxxx
STAGING_SENTRY_DSN=xxxxx
SLACK_WEBHOOK_URL=xxxxx
```

#### 2. Workflow実行

```bash
# Stagingデプロイ (develop/stagingブランチ)
git push origin staging

# Productionデプロイ (タグベース)
git tag v1.0.0
git push origin v1.0.0

# 手動デプロイ
./scripts/deploy.sh production
```

---

## 🧪 デプロイメント検証

### 1. ヘルスチェック

```bash
# Signaling Server
curl https://vibe-coder.space/api/health

# PWA
curl https://www.vibe-coder.space/manifest.json

# Host Server (local)
curl http://localhost:8080/api/health
```

### 2. エンドツーエンドテスト

```bash
# UXテストスイート実行
npm run test:ux-suite

# E2Eテスト実行
npm run test:e2e

# Visual回帰テスト
npm run test:visual
```

### 3. パフォーマンス確認

```bash
# Lighthouse監査
npm run test:ux

# アクセシビリティ監査
npm run test:accessibility
```

---

## 🔧 トラブルシューティング

### よくある問題

#### 1. Docker Build失敗
```bash
# キャッシュクリア
docker system prune -a

# Platform指定
./scripts/docker-build.sh --platform linux/amd64 --no-cache
```

#### 2. Vercel Deployment失敗
```bash
# ログ確認
vercel logs

# 環境変数確認
vercel env ls

# 手動デプロイ
vercel --prod
```

#### 3. DNS propagation問題
```bash
# DNS確認
dig vibe-coder.space
dig www.vibe-coder.space

# TTL待機 (最大48時間)
```

#### 4. SSL証明書問題
```bash
# 証明書確認
curl -I https://vibe-coder.space

# Vercelで自動更新 (数分)
```

### デバッグコマンド

```bash
# Docker debug
docker logs vibe-coder-host
docker exec -it vibe-coder-host /bin/bash

# Vercel debug
vercel logs --project vibe-coder-signaling
vercel logs --project vibe-coder-pwa

# Network debug
curl -v https://vibe-coder.space/api/signal
```

---

## 📊 監視・運用

### 1. ログ監視

```bash
# Docker logs
docker-compose logs -f

# Vercel logs
vercel logs --follow

# Application logs
tail -f logs/app.log
```

### 2. メトリクス

```bash
# Health endpoints
curl https://vibe-coder.space/api/health
curl https://www.vibe-coder.space/api/health

# Container metrics
docker stats vibe-coder-host
```

### 3. アラート設定

#### Sentry
- Error monitoring
- Performance monitoring
- Release tracking

#### Slack/Discord
- Deployment notifications
- Error alerts
- Performance alerts

---

## 🔒 セキュリティ

### SSL/TLS
- Vercel自動SSL (Let's Encrypt)
- HSTS有効
- Security Headers設定

### API認証
- Claude API Key rotation
- GitHub Token permissions
- Rate limiting

### Docker Security
- Non-root user
- Resource limits
- Health checks

---

## 📚 参考資料

### 公式ドキュメント
- [Vercel Documentation](https://vercel.com/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Claude API Documentation](https://docs.anthropic.com/)

### プロジェクト資料
- `deployment/vercel-setup.md` - Vercel詳細設定
- `docker/README.md` - Docker設定詳細
- `scripts/deploy.sh` - デプロイスクリプト
- `.env.example` - 環境変数テンプレート

---

## ✅ デプロイメントチェックリスト

### 事前準備
- [ ] 必要なアカウント取得完了
- [ ] ドメイン設定完了
- [ ] 環境変数設定完了
- [ ] Docker Registry認証完了

### Docker
- [ ] Dockerfileテスト完了
- [ ] Imageビルド成功
- [ ] Registry push成功
- [ ] Container起動確認

### Vercel
- [ ] Signaling Server デプロイ完了
- [ ] PWA デプロイ完了
- [ ] ドメイン設定完了
- [ ] 環境変数設定完了

### テスト
- [ ] ヘルスチェック成功
- [ ] E2Eテスト成功
- [ ] UXテスト成功
- [ ] パフォーマンステスト成功

### 監視
- [ ] ログ監視設定完了
- [ ] エラー監視設定完了
- [ ] 通知設定完了

---

**🎯 デプロイメント完了後、すべてのコンポーネントが連携して動作し、モバイルからClaude Codeを直感的に操作できる環境が完成します。**