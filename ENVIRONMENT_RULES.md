# 🚫 Vibe Coder 絶対的環境設定ルール

## 📋 基本原則（永続化・厳守）

### 🚨 **絶対禁止**: ハードコーディング
- **一切のポート番号、URL、パスをコード内に直接記述してはいけない**
- **すべて環境変数で管理すること**
- **開発用・本番用で確実に切り替えること**

### ✅ **必須遵守**: 環境変数管理

```bash
# 禁止例 ❌
const PORT = 8080;
const URL = "http://localhost:5174";
const PORT2 = parseInt(process.env.PORT || '8080'); // フォールバック厳禁

# 正解例 ✅
const PORT = getRequiredEnvInt('VIBE_CODER_PORT');
const URL = getRequiredEnv('VIBE_CODER_PWA_URL');
```

### 🚫 **絶対禁止**: アドホックフォールバック
- **`|| 'default'` 形式のフォールバック厳禁**
- **設定がなければプロセスを即座に終了**
- **不正な設定での起動を一切許可しない**

## 🎯 標準化設定

### 開発環境 (.env.development)
```
VIBE_CODER_PORT=8080
VIBE_CODER_PWA_PORT=5174
VIBE_CODER_SIGNALING_URL=http://localhost:5174/api/signal
```

### 本番環境 (.env.production)
```
VIBE_CODER_PORT=8080
VIBE_CODER_PWA_URL=https://www.vibe-coder.space
VIBE_CODER_SIGNALING_URL=https://www.vibe-coder.space/api/signal
```

## ⏱️ タイムアウト設定（絶対的基準）

```
STARTUP_TIMEOUT=15    # サーバー起動チェック
API_TIMEOUT=10        # API応答
CONNECTION_TIMEOUT=30 # WebRTC接続
WEBRTC_TIMEOUT=30     # WebRTC操作
```

## 🔧 実装ルール

### 1. 設定読み込み
```typescript
// config.ts での正しい実装例
export const config = {
  port: getRequiredEnvInt('VIBE_CODER_PORT'),
  pwaPort: getRequiredEnvInt('VIBE_CODER_PWA_PORT'),
  signalingUrl: getRequiredEnv('VIBE_CODER_SIGNALING_URL')
};
```

### 2. プロセス管理
```bash
# サーバー起動前に必ず既存プロセスを終了
lsof -ti:$VIBE_CODER_PORT | xargs -r kill
```

### 3. 環境設定読み込み
```bash
# 開発環境
export $(cat .env.development | xargs)

# 本番環境
export $(cat .env.production | xargs)
```

## 📂 ファイル構成

```
/home/minoru/src/vibe-coder/
├── .env.development     # 開発環境設定
├── .env.production      # 本番環境設定
├── ENVIRONMENT_RULES.md # このルール文書
└── packages/
    ├── host/src/utils/config.ts    # 環境変数ベース設定
    └── shared/src/constants.ts     # 環境変数ベース定数
```

## 🚀 起動手順（標準化）

### 開発環境
```bash
# 1. 環境変数読み込み
export $(cat .env.development | xargs)

# 2. 既存プロセス終了
lsof -ti:$VIBE_CODER_PORT | xargs -r kill

# 3. ホストサーバー起動
pnpm --filter @vibe-coder/host start

# 4. PWA配信（簡易）
python3 -m http.server $VIBE_CODER_PWA_PORT --directory packages/signaling/public
```

### 本番環境
```bash
# 1. 環境変数読み込み
export $(cat .env.production | xargs)

# 2. Docker起動
docker compose up -d
```

## 🔍 検証コマンド

```bash
# ハードコーディング検出
grep -r "8080\|8081\|5174\|localhost" packages/ | grep -v test | grep -v node_modules

# 環境変数確認
echo "Port: $VIBE_CODER_PORT"
echo "PWA URL: $VIBE_CODER_PWA_URL"
```

## ⚠️ 違反時の対処

1. **即座にコード修正**
2. **環境変数に移行**
3. **設定ファイル更新**
4. **文書更新**

---

## 📝 更新履歴

- **2025-07-09**: 初版作成、絶対的ルール確立
- **適用対象**: 全パッケージ（host, shared, signaling）
- **管理者**: 開発チーム全員が厳守

**このルールは絶対的であり、例外は一切認めません。**