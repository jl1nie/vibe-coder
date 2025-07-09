# 🧪 Vibe Coder - ユーザー向けテスト実行ガイド

## ⚡ 高速テスト実行

### 3段階テスト戦略

開発効率を最大化するために、3段階のテスト戦略を採用しています：

#### 🟢 **Level 1: 基本テスト（3秒）**
```bash
# 最も高速 - 開発中の継続的テスト
./scripts/test-quick.sh fast
```
- **対象**: shared + signaling パッケージ
- **テスト数**: 52テスト
- **実行時間**: 約3秒
- **用途**: 開発中の継続的確認

#### 🟡 **Level 2: 統合テスト（30秒）**
```bash
# 中程度 - コミット前確認
./scripts/test-quick.sh integration
```
- **対象**: Level 1 + host パッケージ
- **テスト数**: 99テスト
- **実行時間**: 約30秒
- **用途**: コミット前の確認

#### 🔴 **Level 3: 完全テスト（60秒）**
```bash
# 最も完全 - リリース前確認
./scripts/test-quick.sh full
```
- **対象**: 全テスト + E2E
- **テスト数**: 99テスト + E2E
- **実行時間**: 約60秒
- **用途**: リリース前の最終確認

## 🚀 実行コマンド

### 基本的な使い方

```bash
# 最も高速（推奨）
./scripts/test-quick.sh fast

# pnpmコマンドでも可能
pnpm test:fast

# 従来の高機能版
./scripts/fast-test.sh fast
```

### 開発フロー別の推奨テスト

```bash
# 🔄 開発中（継続的テスト）
./scripts/test-quick.sh fast

# 📝 コミット前確認
./scripts/test-quick.sh integration

# 🚀 リリース前確認
./scripts/test-quick.sh full

# 🔍 E2Eテストのみ
pnpm test:e2e
```

## 📊 テスト結果の見方

### 成功例
```
🚀 Running quick tests...
⚡ Level 1: Basic tests (shared + signaling)
✓ packages/shared: 40/40 tests passed
✓ packages/signaling: 12/12 tests passed
✅ Tests completed in 3s
```

### Claude Code関連のスキップ（正常）
```
stdout | Claude Code not available, skipping test
```
→ これは正常です。Claude Code未設定環境では自動的にスキップされます。

### 実際のエラー例
```
FAIL src/__tests__/utils.test.ts
Error: FATAL: Required environment variable VIBE_CODER_SIGNALING_URL is not set
```
→ 環境変数設定に問題があります。

## 🔧 トラブルシューティング

### 1. 環境変数エラー
```bash
# 問題: 環境変数が設定されていない
# 解決: test-quick.sh スクリプトが自動設定するので、直接実行してください
./scripts/test-quick.sh fast
```

### 2. ポート使用中エラー
```bash
# 問題: ポート8080が使用中
# 解決: 既存プロセスを停止
./scripts/vibe-coder stop
pkill -f "node.*vibe-coder"
```

### 3. 権限エラー
```bash
# 問題: Claude Code権限エラー
# 解決: 正常動作（テストは自動的にスキップされます）
# 実際にClaude Codeを使用する場合は: claude auth login
```

## 💡 パフォーマンス最適化

### 並列実行の活用
```bash
# 複数パッケージを並列実行
pnpm test:fast    # shared + signaling 並列実行
pnpm test:integration  # 全パッケージ並列実行
```

### キャッシュ活用
```bash
# キャッシュを使用した高速実行
pnpm test:fast    # 通常実行（キャッシュ利用）
pnpm test:clean   # キャッシュクリア後実行
```

## 📋 推奨開発フロー

### 1. 日常開発
```bash
# 変更を加えた後、即座に確認
./scripts/test-quick.sh fast
```

### 2. 機能追加後
```bash
# 統合テストで影響範囲を確認
./scripts/test-quick.sh integration
```

### 3. リリース前
```bash
# 完全テストで最終確認
./scripts/test-quick.sh full
```

### 4. CI/CD環境
```bash
# GitHub Actionsでの実行
pnpm test:integration  # 高速で確実
```

## 🎯 品質基準

### 必須基準
- **Level 1**: 100%通過必須
- **Level 2**: 95%通過必須（Claude Code関連スキップは正常）
- **Level 3**: 90%通過必須

### 許容される警告
- `Claude Code not available, skipping test` - 正常
- `TOTP verification failed` - テスト環境では正常
- `WebRTC connection timeout` - テスト環境では正常

## 🔍 デバッグ方法

### 詳細ログ付き実行
```bash
# 詳細ログを確認
DEBUG=vibe-coder:* ./scripts/test-quick.sh fast

# 特定パッケージのみ
pnpm --filter @vibe-coder/shared test --run
```

### エラー調査
```bash
# 失敗したテストの詳細確認
pnpm --filter @vibe-coder/host test --run --reporter=verbose
```

## 📱 実機テスト

### PWAテスト
```bash
# 1. ローカルサーバー起動
./scripts/vibe-coder dev --local

# 2. 別ターミナルでE2Eテスト
pnpm test:e2e
```

### モバイルテスト
```bash
# 1. ホストサーバー起動
./scripts/vibe-coder start

# 2. スマホでアクセス
# https://www.vibe-coder.space
# Host ID: 27539093 (HOST_ID.txtで確認)
```

## 🚀 高速化のポイント

### 1. 並列実行
- 複数パッケージを同時実行
- 実行時間を大幅短縮

### 2. 適切なレベル選択
- 開発中はLevel 1で十分
- コミット前はLevel 2
- リリース前のみLevel 3

### 3. 環境変数最適化
- `test-quick.sh`が自動設定
- 手動設定不要

### 4. キャッシュ活用
- Turbo Repoキャッシュ
- Vitestキャッシュ

---

**最終更新**: 2025-07-09  
**対応バージョン**: v0.2.11-alpha  
**推奨環境**: Node.js 22.17.0, pnpm 9.x

**💡 Tips**: まずは `./scripts/test-quick.sh fast` から始めてください！