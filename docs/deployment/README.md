# Vibe Coder デプロイメントガイド

## 🚀 概要

Vibe Coder は以下の3つのコンポーネントで構成されています：

1. **PWA クライアント** - Vercel でホスティング
2. **ホストサーバー** - Docker でセルフホスティング
3. **シグナリングサーバー** - Vercel Edge Functions

## 📋 事前準備

### 必要なアカウント

- **Anthropic Claude API**: ホストサーバー用
- **Vercel**: PWA とシグナリングサーバー用
- **GitHub**: ソースコード管理とプレイリスト発見用（オプション）
- **Docker**: ホストサーバー実行環境

### 環境変数の準備

`.env.example` をコピーして `.env` を作成し、適切な値を設定してください。

## 🔧 1. シグナリングサーバーのデプロイ

### Vercel KV の設定

1. Vercel ダッシュボードで新しいプロジェクトを作成
2. Storage タブから KV データベースを作成
3. 接続情報をメモ

### デプロイ手順

```bash
cd packages/signaling

# Vercel CLI インストール（未インストールの場合）
npm install -g vercel

# ログイン
vercel login

# 初回デプロイ
vercel

# 環境変数の設定
vercel env add KV_REST_API_URL
vercel env add KV_REST_API_TOKEN
vercel env add GITHUB_TOKEN  # オプション

# 本番デプロイ
vercel --prod
```

### 動作確認

```bash
curl https://your-signaling-server.vercel.app/api/stats?type=health
```

## 🏠 2. ホストサーバーのデプロイ

### Docker Compose でのデプロイ

```bash
# リポジトリルートで実行
cd /path/to/vibe-coder

# 環境変数の設定
cp .env.example .env
# .env ファイルを編集して適切な値を設定

# 必須環境変数の確認
echo $CLAUDE_API_KEY  # Claude API キーが設定されていること

# Docker イメージのビルドと起動
docker-compose up -d host

# ログの確認
docker-compose logs -f host

# ヘルスチェック
curl http://localhost:8080/api/health
```

### 手動 Docker デプロイ

```bash
# イメージのビルド
docker build -t vibe-coder-host -f docker/host/Dockerfile .

# コンテナの実行
docker run -d \
  --name vibe-coder-host \
  -p 8080:8080 \
  -e CLAUDE_API_KEY=your_key_here \
  -e SIGNALING_SERVER_URL=https://your-signaling-server.vercel.app \
  -v $(pwd)/workspace:/app/workspace \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  vibe-coder-host
```

### Kubernetes デプロイ（オプション）

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibe-coder-host
spec:
  replicas: 1
  selector:
    matchLabels:
      app: vibe-coder-host
  template:
    metadata:
      labels:
        app: vibe-coder-host
    spec:
      containers:
      - name: vibe-coder-host
        image: vibe-coder-host:latest
        ports:
        - containerPort: 8080
        env:
        - name: CLAUDE_API_KEY
          valueFrom:
            secretKeyRef:
              name: vibe-coder-secrets
              key: claude-api-key
        - name: SIGNALING_SERVER_URL
          value: "https://your-signaling-server.vercel.app"
        volumeMounts:
        - name: workspace
          mountPath: /app/workspace
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: vibe-coder-workspace
      - name: logs
        persistentVolumeClaim:
          claimName: vibe-coder-logs
```

## 🌐 3. PWA クライアントのデプロイ

### Vercel でのデプロイ

```bash
cd apps/web

# 環境変数の設定（Vercel ダッシュボードまたは CLI）
vercel env add VITE_API_BASE_URL
vercel env add VITE_WS_URL
vercel env add VITE_SIGNALING_URL

# デプロイ
vercel --prod
```

### 静的ホスティング（Netlify/Cloudflare Pages）

```bash
cd apps/web

# ビルド
npm run build

# dist フォルダを静的ホスティングサービスにアップロード
```

## 🔒 4. セキュリティ設定

### SSL証明書の設定

```bash
# Let's Encrypt を使用する場合
sudo certbot --nginx -d your-domain.com

# 証明書の自動更新
sudo crontab -e
# 以下を追加：
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### ファイアウォール設定

```bash
# UFW を使用する場合
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 8080  # Vibe Coder Host
sudo ufw enable
```

### Nginx リバースプロキシ（オプション）

```nginx
# /etc/nginx/sites-available/vibe-coder
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📊 5. 監視とメンテナンス

### ヘルスチェック

```bash
# ホストサーバー
curl http://localhost:8080/api/health/detailed

# シグナリングサーバー
curl https://your-signaling-server.vercel.app/api/stats?type=health
```

### ログ監視

```bash
# Docker Compose の場合
docker-compose logs -f host

# 手動 Docker の場合
docker logs -f vibe-coder-host

# ログファイル（コンテナ内）
tail -f /app/logs/app.log
```

### バックアップ

```bash
# ワークスペースデータのバックアップ
docker run --rm \
  -v vibe-coder_workspace_data:/source:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/workspace-backup-$(date +%Y%m%d).tar.gz -C /source .

# セッションデータのバックアップ
docker run --rm \
  -v vibe-coder_session_data:/source:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/sessions-backup-$(date +%Y%m%d).tar.gz -C /source .
```

### アップデート

```bash
# 最新コードの取得
git pull origin main

# 新しいイメージのビルド
docker-compose build host

# ローリングアップデート
docker-compose up -d host

# 古いイメージのクリーンアップ
docker image prune -f
```

## 🚨 トラブルシューティング

### よくある問題

1. **Claude API キーエラー**
   ```bash
   # 環境変数の確認
   docker-compose exec host env | grep CLAUDE
   ```

2. **WebSocket 接続エラー**
   ```bash
   # ファイアウォール確認
   sudo ufw status
   
   # ポート確認
   netstat -tulpn | grep :8080
   ```

3. **ディスク容量不足**
   ```bash
   # ディスク使用量確認
   df -h
   
   # Docker ボリュームのクリーンアップ
   docker volume prune
   ```

4. **メモリ不足**
   ```bash
   # メモリ使用量確認
   free -h
   
   # コンテナのメモリ制限
   docker-compose exec host cat /proc/meminfo
   ```

### ログレベルの調整

```bash
# デバッグログを有効にする
docker-compose exec host sh -c 'echo "LOG_LEVEL=debug" >> /app/.env'
docker-compose restart host
```

### パフォーマンス最適化

```yaml
# docker-compose.override.yml
version: '3.8'
services:
  host:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
          cpus: '0.25'
```

## 📚 関連リンク

- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Vercel Deployment](https://vercel.com/docs/deployments)
- [Claude API Documentation](https://docs.anthropic.com/)
- [WebRTC Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)