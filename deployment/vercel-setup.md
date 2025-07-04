# 🌐 Vercel Domain Setup Guide

## ドメイン設定手順

### 1. DNS設定確認

既に設定済みのDNSレコード:
- `www.vibe-coder.space` → `cname.vercel-dns.com` (CNAME)
- `vibe-coder.space` → Vercel IP (A record)

### 2. Vercelプロジェクト作成

#### シグナリングサーバープロジェクト
```bash
# packages/signaling ディレクトリで実行
npx vercel --prod
```

設定:
- Project Name: `vibe-coder-signaling`
- Framework: `Other`
- Root Directory: `packages/signaling`
- Build Command: `npm run build`
- Output Directory: `api`

#### PWAプロジェクト
```bash
# apps/web ディレクトリで実行
npx vercel --prod
```

設定:
- Project Name: `vibe-coder-pwa`
- Framework: `Vite`
- Root Directory: `apps/web`
- Build Command: `npm run build`
- Output Directory: `dist`

### 3. ドメイン関連付け

#### メインドメイン設定
```bash
# vibe-coder.space をシグナリングサーバーに関連付け
npx vercel domains add vibe-coder.space --project vibe-coder-signaling

# www.vibe-coder.space をPWAに関連付け
npx vercel domains add www.vibe-coder.space --project vibe-coder-pwa
```

#### リダイレクト設定
`vibe-coder.space` → シグナリングサーバー (API)
`www.vibe-coder.space` → PWA (フロントエンド)

### 4. 環境変数設定

#### Staging環境
```bash
# Signaling Server
npx vercel env add STAGING_KV_URL
npx vercel env add STAGING_KV_REST_API_URL
npx vercel env add STAGING_KV_REST_API_TOKEN
npx vercel env add NODE_ENV staging

# PWA
npx vercel env add VITE_APP_ENV staging
npx vercel env add VITE_SIGNALING_URL https://staging.vibe-coder.space
npx vercel env add VITE_SENTRY_DSN [staging-sentry-dsn]
```

#### Production環境
```bash
# Signaling Server
npx vercel env add PRODUCTION_KV_URL
npx vercel env add PRODUCTION_KV_REST_API_URL  
npx vercel env add PRODUCTION_KV_REST_API_TOKEN
npx vercel env add GITHUB_TOKEN
npx vercel env add NODE_ENV production

# PWA
npx vercel env add VITE_APP_ENV production
npx vercel env add VITE_SIGNALING_URL https://vibe-coder.space
npx vercel env add VITE_SENTRY_DSN [production-sentry-dsn]
npx vercel env add VITE_ANALYTICS_ID [analytics-id]
```

### 5. GitHub Actions Secrets

以下のSecretsをGitHubリポジトリに設定:

```bash
# Vercel認証
VERCEL_TOKEN=xxxxx
VERCEL_ORG_ID=xxxxx
VERCEL_PROJECT_ID=xxxxx (signaling server)
VERCEL_PWA_PROJECT_ID=xxxxx (PWA)

# KV Database (Staging)
STAGING_KV_URL=xxxxx
STAGING_KV_REST_API_URL=xxxxx
STAGING_KV_REST_API_TOKEN=xxxxx

# KV Database (Production)
PRODUCTION_KV_URL=xxxxx
PRODUCTION_KV_REST_API_URL=xxxxx
PRODUCTION_KV_REST_API_TOKEN=xxxxx

# 監視・通知
STAGING_SENTRY_DSN=xxxxx
PRODUCTION_SENTRY_DSN=xxxxx
ANALYTICS_ID=xxxxx
SLACK_WEBHOOK_URL=xxxxx
SENTRY_WEBHOOK_URL=xxxxx

# 通知
EMAIL_USERNAME=xxxxx
EMAIL_PASSWORD=xxxxx
STAKEHOLDER_EMAILS=xxxxx
```

### 6. SSL証明書設定

Vercelが自動的にLet's Encryptを使用してSSL証明書を発行・更新します。

確認方法:
```bash
curl -I https://vibe-coder.space
curl -I https://www.vibe-coder.space
```

### 7. CDN・キャッシュ設定

#### Static Assets
- JavaScript/CSS: `max-age=31536000, immutable`
- Images: `max-age=31536000, immutable`
- Service Worker: `max-age=0, must-revalidate`

#### API Responses
- Signal data: `s-maxage=60, stale-while-revalidate`
- Playlists: `s-maxage=300, stale-while-revalidate`
- Health checks: `max-age=60`

### 8. デプロイメント確認

#### ステージング環境
```bash
# Health check
curl https://staging.vibe-coder.space/api/health

# PWA確認
curl https://staging.vibe-coder.space/manifest.json
```

#### 本番環境
```bash
# Health check
curl https://vibe-coder.space/api/health
curl https://www.vibe-coder.space/api/health

# PWA確認
curl https://www.vibe-coder.space/manifest.json
curl https://www.vibe-coder.space/sw.js
```

### 9. 監視設定

#### Vercel Analytics
- Real User Monitoring (RUM)
- Core Web Vitals
- Error tracking

#### Sentry Integration
- Error monitoring
- Performance monitoring
- Release tracking

#### Uptime Monitoring
- Health check endpoints
- Response time monitoring
- Alert notifications

## トラブルシューティング

### よくある問題

1. **DNS Propagation Delay**
   - 最大48時間かかる場合があります
   - `dig vibe-coder.space` で確認

2. **SSL Certificate Issues**
   - Vercelの証明書発行には数分かかります
   - ドメイン検証が必要な場合があります

3. **Deployment Failures**
   - Build logs確認: `npx vercel logs`
   - 環境変数の確認

4. **CORS Issues**
   - vercel.jsonのheaders設定確認
   - Origin指定の確認

### デバッグコマンド

```bash
# Vercel project info
npx vercel info

# Deployment logs
npx vercel logs

# Domain status
npx vercel domains ls

# Environment variables
npx vercel env ls
```