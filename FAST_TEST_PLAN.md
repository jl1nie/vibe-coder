# 🚀 Vibe Coder 高速テスト実行計画

## 🎯 テスト実行戦略

### 1. **3段階テスト戦略**

#### 🟢 **Level 1: 基本テスト（30秒）**
- **対象**: shared + signaling パッケージ
- **時間**: 30秒以内
- **用途**: 開発中の継続的テスト
- **実行**: `pnpm test:fast`

#### 🟡 **Level 2: 統合テスト（2分）**
- **対象**: Level 1 + host パッケージ（Claude Code依存なし）
- **時間**: 2分以内
- **用途**: コミット前確認
- **実行**: `pnpm test:integration`

#### 🔴 **Level 3: 完全テスト（5分）**
- **対象**: 全テスト + E2E
- **時間**: 5分以内
- **用途**: リリース前確認
- **実行**: `pnpm test:full`

## 📋 テスト分類と実行時間

### 現在のテスト状況
```
✅ shared: 40/40テスト通過 (1秒)
✅ signaling: 12/12テスト通過 (1秒)
⚠️ host: 47/47テスト通過 (60秒) - Claude Code権限問題あり
🔄 E2E: 認証・コマンド・レスポンシブ (180秒)
```

### 問題点の分析
- **Claude Code権限エラー**: `/app` ディレクトリ作成権限なし
- **テスト実行時間**: hostパッケージが60秒かかる
- **並列化不足**: 順次実行で非効率

## 🛠️ 高速化施策

### 1. **並列実行**
```bash
# 現在（順次実行）: 62秒
turbo run test  # shared → signaling → host

# 改善後（並列実行）: 30秒
turbo run test --parallel
```

### 2. **テスト分離**
```bash
# Level 1: 基本テスト（Claude Code依存なし）
pnpm test:fast

# Level 2: 統合テスト（権限問題回避）
pnpm test:integration

# Level 3: 完全テスト（権限問題解決後）
pnpm test:full
```

### 3. **権限問題の解決**
```bash
# 問題: Claude Code が /app ディレクトリを作成しようとする
# Error: EACCES: permission denied, mkdir '/app'

# 解決策:
export CLAUDE_WORKSPACE_PATH=/tmp/claude-test
mkdir -p /tmp/claude-test
chmod 755 /tmp/claude-test
```

## 📦 高速テスト実行スクリプト

### package.json 追加スクリプト
```json
{
  "scripts": {
    "test:fast": "turbo run test --filter=@vibe-coder/shared --filter=@vibe-coder/signaling --parallel",
    "test:integration": "turbo run test --filter=@vibe-coder/shared --filter=@vibe-coder/signaling --filter=@vibe-coder/host --parallel",
    "test:full": "turbo run test --parallel && pnpm exec playwright test",
    "test:watch": "turbo run test --parallel --watch",
    "test:clean": "turbo run test --parallel --force"
  }
}
```

### 新しいテストスクリプト
```bash
#!/bin/bash
# scripts/fast-test.sh

echo "🚀 Fast Test Runner"

case "$1" in
  "fast")
    echo "⚡ Level 1: 基本テスト実行..."
    pnpm test:fast
    ;;
  "integration")
    echo "🔄 Level 2: 統合テスト実行..."
    pnpm test:integration
    ;;
  "full")
    echo "🎯 Level 3: 完全テスト実行..."
    pnpm test:full
    ;;
  "watch")
    echo "👀 ウォッチモード..."
    pnpm test:watch
    ;;
  *)
    echo "Usage: $0 {fast|integration|full|watch}"
    exit 1
    ;;
esac
```

## 🔧 権限問題の解決

### 1. **Claude Code ワークスペース設定**
```bash
# テスト専用ワークスペース作成
export CLAUDE_WORKSPACE_PATH=/tmp/claude-test
mkdir -p /tmp/claude-test
chmod 755 /tmp/claude-test

# Claude Code設定
export CLAUDE_CONFIG_PATH=/tmp/claude-config
mkdir -p /tmp/claude-config
```

### 2. **テスト環境分離**
```bash
# テスト専用環境変数
export NODE_ENV=test
export VIBE_CODER_WORKSPACE_PATH=/tmp/vibe-coder-test
export CLAUDE_WORKSPACE_PATH=/tmp/claude-test

# テスト前のクリーンアップ
rm -rf /tmp/claude-test /tmp/vibe-coder-test
mkdir -p /tmp/claude-test /tmp/vibe-coder-test
```

## 📊 期待される改善効果

### 実行時間の短縮
```
Before:
- shared: 1秒
- signaling: 1秒  
- host: 60秒
- Total: 62秒

After:
- Level 1 (fast): 2秒
- Level 2 (integration): 15秒
- Level 3 (full): 30秒
```

### 開発効率の向上
- **継続的テスト**: 2秒で基本確認
- **コミット前確認**: 15秒で統合確認
- **リリース前確認**: 30秒で完全確認

## 🚀 実行手順

### 1. 即座実行（基本テスト）
```bash
./scripts/fast-test.sh fast
```

### 2. コミット前確認（統合テスト）
```bash
./scripts/fast-test.sh integration
```

### 3. リリース前確認（完全テスト）
```bash
./scripts/fast-test.sh full
```

### 4. 開発中監視（ウォッチモード）
```bash
./scripts/fast-test.sh watch
```

## 🎯 成功基準

### Level 1 (fast): 100%通過必須
- shared: 40/40テスト
- signaling: 12/12テスト
- 実行時間: 2秒以内

### Level 2 (integration): 95%通過必須
- Level 1 + host: 99/99テスト
- Claude Code依存テストは適切にスキップ
- 実行時間: 15秒以内

### Level 3 (full): 90%通過必須
- 全テスト + E2E
- 権限問題解決後は100%通過
- 実行時間: 30秒以内

---

**最終更新**: 2025-07-09  
**適用対象**: 全開発環境  
**管理者**: 開発チーム全員