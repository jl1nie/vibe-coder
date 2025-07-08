# Vibe Coder テストガイド

## 🧪 テスト概要

Vibe Coderは3層のテスト戦略で品質を保証しています：

1. **Unit/Integration Tests** (113テスト) - コンポーネント・API・機能テスト
2. **E2E Tests** (Playwright) - エンドツーエンドユーザーフロー
3. **Manual Tests** - 実機・実環境での動作確認

## 📋 テスト実行方法

### 1. 全テスト実行（推奨）

```bash
# Unit/Integration テスト
./scripts/vibe-coder test

# E2E テスト（自動でサーバー起動）
./scripts/vibe-coder e2e
```

### 2. 個別パッケージテスト

```bash
# Host サーバーテスト（46テスト）
pnpm --filter @vibe-coder/host test --run

# PWA クライアントテスト（17テスト）
pnpm --filter @vibe-coder/web test --run

# 共通パッケージテスト（40テスト）
pnpm --filter @vibe-coder/shared test --run

# シグナリングサーバーテスト（10テスト）
pnpm --filter @vibe-coder/signaling test --run
```

### 3. 手動でE2Eテスト実行

```bash
# 1. サーバー起動
pnpm build
pnpm --filter @vibe-coder/host start &
pnpm --filter @vibe-coder/web dev &

# 2. サーバー起動確認
curl http://localhost:8080/api/health  # Host server
curl http://localhost:5173             # PWA server

# 3. E2Eテスト実行
pnpm exec playwright test

# 4. ブラウザ付きで実行（デバッグ用）
pnpm exec playwright test --headed

# 5. 特定テストのみ実行
pnpm exec playwright test claude-authentication.spec.ts
```

## 🎯 テスト内容

### Unit/Integration Tests

**Host パッケージ (46テスト):**
- セッション管理・JWT認証
- Claude Code統合・コマンド実行
- WebRTC接続・データチャネル
- セキュリティ・入力検証

**Web パッケージ (17テスト):**
- React コンポーネント
- 認証フロー・状態管理
- WebRTC クライアント接続
- UI/UX 動作確認

**Shared パッケージ (40テスト):**
- 型定義・共通関数
- ユーティリティ・バリデーション

**Signaling パッケージ (10テスト):**
- WebRTC シグナリング API
- Offer/Answer 交換
- ICE Candidate 管理

### E2E Tests

**認証フロー (claude-authentication.spec.ts):**
- Host ID入力・接続
- 2FA認証・TOTP入力
- エラーハンドリング

**Claude コマンド実行 (claude-commands.spec.ts):**
- /help・/exit コマンド
- 自然言語コマンド
- 空コマンド処理

**レスポンシブデザイン (responsive-design.spec.ts):**
- デスクトップ・タブレット・モバイル
- 画面サイズ変更・オリエンテーション
- 機能維持確認

## 🔧 トラブルシューティング

### よくある問題

**1. テスト失敗「Claude Code not available」**
```bash
# Claude Code インストール確認
claude auth login
which claude

# テストスキップは正常（Claude未設定環境）
```

**2. E2Eテスト「サーバー起動失敗」**
```bash
# ポートが使用中か確認
lsof -i :8080  # Host server
lsof -i :5173  # PWA server

# プロセス終了
pkill -f "node.*vibe-coder"
pkill -f "vite"
```

**3. WebRTCテスト失敗**
```bash
# ブラウザでテスト実行（エラー詳細確認）
pnpm exec playwright test --headed

# ネットワーク確認
curl http://localhost:8080/api/health
```

### テスト環境リセット

```bash
# 全停止・クリーンアップ
./scripts/vibe-coder stop
./scripts/vibe-coder clean

# 依存関係再インストール
pnpm install

# 再ビルド
pnpm build

# テスト再実行
./scripts/vibe-coder test
```

## 📈 テスト品質指標

### 現在の達成状況
- **Unit/Integration**: 113/113テスト通過 (100%)
- **E2E Coverage**: 認証・コマンド・レスポンシブ (3テストスイート)
- **Code Quality**: TypeScript・ESLint・Prettier (100%)

### 品質基準
- **必須**: Unit/Integration 100%通過
- **推奨**: E2E 95%以上通過
- **リリース前**: 全テスト通過 + 実機確認

## 🚀 継続的インテグレーション

### CI/CDでの実行

```yaml
# GitHub Actions設定例
- name: Run Tests
  run: |
    pnpm install
    pnpm build
    ./scripts/vibe-coder test

- name: Run E2E Tests
  run: |
    ./scripts/vibe-coder e2e
```

### 開発フロー

```bash
# 1. 開発開始
git checkout -b feature/new-feature

# 2. 開発中のテスト実行
./scripts/vibe-coder test

# 3. E2Eテスト確認
./scripts/vibe-coder e2e

# 4. コミット前確認
pnpm run lint
pnpm run typecheck
./scripts/vibe-coder test

# 5. PR作成
git push origin feature/new-feature
```

## 📚 参考情報

- **Vitest Documentation**: https://vitest.dev/
- **Playwright Documentation**: https://playwright.dev/
- **WebRTC Testing**: https://webrtc.org/getting-started/testing
- **React Testing Library**: https://testing-library.com/docs/react-testing-library/intro/

---

**最終更新**: 2025-07-08  
**テスト環境**: Node.js 22.17.0, pnpm 9.x  
**ブラウザ**: Chrome (Playwright)