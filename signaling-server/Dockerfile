FROM node:18-alpine

# セキュリティ: 非rootユーザーで実行
RUN addgroup -g 1001 -S nodejs
RUN adduser -S signaling -u 1001

WORKDIR /app

# パッケージファイルをコピー
COPY package*.json ./

# 依存関係インストール
RUN npm ci --only=production && npm cache clean --force

# アプリケーションファイルをコピー
COPY . .

# ファイル所有権を変更
RUN chown -R signaling:nodejs /app

# 非rootユーザーに切り替え
USER signaling

# ポート露出
EXPOSE 5001

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http=require('http');const req=http.request('http://localhost:5001/api/health',res=>{process.exit(res.statusCode===200?0:1)});req.on('error',()=>process.exit(1));req.end();"

# アプリケーション起動
CMD ["npm", "start"]