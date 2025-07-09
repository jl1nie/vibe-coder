# 🔍 プロセス確認・終了の絶対的ルール

## 📋 基本原則（永続化・厳守）

### ✅ **必須チェック順序**
1. **Docker内プロセス** - 最優先
2. **ホスト内プロセス** - ps aux使用
3. **ポート使用状況** - ss使用（非root）

### 🚫 **絶対禁止**
- **lsof使用** - root権限必要で使用不可
- **プロセス確認の省略** - 必ず全チェック実行
- **Docker確認の省略** - 最重要チェック

## 🔧 標準チェック手順

### 1. Docker内プロセス確認（最優先）
```bash
# Docker コンテナ状況確認
docker ps -a

# 該当コンテナ確認
docker ps | grep vibe-coder-host
docker ps | grep 8080
```

### 2. ホスト内プロセス確認
```bash
# Node.js関連プロセス確認
ps aux | grep node | grep -v grep

# 特定ポート関連プロセス確認
ps aux | grep 8080 | grep -v grep
ps aux | grep 5174 | grep -v grep

# Vibe Coder関連プロセス確認
ps aux | grep vibe-coder | grep -v grep
```

### 3. ポート使用状況確認（非root）
```bash
# ss使用（非root対応）
ss -tulpn | grep :8080
ss -tulpn | grep :5174

# netstat代替（利用可能な場合）
netstat -tulpn | grep :8080 2>/dev/null || ss -tulpn | grep :8080
```

## 🚨 プロセス終了手順

### 1. Docker プロセス終了
```bash
# 該当コンテナ停止
docker stop vibe-coder-host

# 全Vibe Coderコンテナ停止
docker ps | grep vibe-coder | awk '{print $1}' | xargs -r docker stop
```

### 2. ホスト内プロセス終了
```bash
# PID取得後に終了
ps aux | grep "node.*vibe-coder" | grep -v grep | awk '{print $2}' | xargs -r kill

# 特定ポートプロセス終了（fuserが利用可能な場合）
fuser -k 8080/tcp 2>/dev/null || echo "fuser not available"
```

### 3. 強制終了（最終手段）
```bash
# SIGKILL使用
ps aux | grep "node.*8080" | grep -v grep | awk '{print $2}' | xargs -r kill -9
```

## 📝 完全チェックスクリプト

```bash
#!/bin/bash
# complete-process-check.sh

echo "=== Vibe Coder プロセス完全チェック ==="

echo "1. Docker内プロセス確認:"
docker ps -a | grep -E "(vibe-coder|8080)"

echo "2. ホスト内Node.jsプロセス確認:"
ps aux | grep -E "(node|vibe-coder)" | grep -v grep

echo "3. ポート使用状況確認:"
ss -tulpn | grep -E ":(8080|5174)"

echo "4. 終了対象プロセス:"
echo "Docker: $(docker ps -q --filter 'name=vibe-coder')"
echo "Host: $(ps aux | grep 'node.*vibe-coder' | grep -v grep | awk '{print $2}')"
```

## 🔄 標準起動前チェック

```bash
# 必須実行コマンド（起動前）
# 1. Docker確認・停止
docker ps | grep vibe-coder-host && docker stop vibe-coder-host

# 2. ホスト内プロセス確認・終了
ps aux | grep "node.*vibe-coder" | grep -v grep | awk '{print $2}' | xargs -r kill

# 3. ポート確認
ss -tulpn | grep :8080 && echo "WARNING: Port 8080 still in use"
```

## 💡 トラブルシューティング

### Docker関連
```bash
# Docker daemon確認
docker info

# コンテナログ確認
docker logs vibe-coder-host

# 強制削除
docker rm -f vibe-coder-host
```

### ポート関連
```bash
# ポート使用プロセス特定
ss -tulpn | grep :8080
ps aux | grep $(ss -tulpn | grep :8080 | awk '{print $7}' | cut -d'/' -f1)
```

---

## 📚 更新履歴

- **2025-07-09**: 初版作成
- **適用対象**: 全開発環境
- **管理者**: 開発チーム全員が厳守

**このルールは絶対的であり、例外は一切認めません。**