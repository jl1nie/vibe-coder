# 🔧 設定ファイル仕様書

## 📋 設定ファイル一覧と目的

### 🧪 テスト設定

#### `vitest.config.ts` - メインテスト設定
**目的**: 全テストレベル（Unit/Integration/E2E）の統合設定

**主要機能**:
- **環境**: `jsdom` (ブラウザAPI模擬)
- **セットアップ**: `./test/setup.ts` (React Testing Library等)
- **カバレッジ**: Test Pyramid基準の階層的閾値
  - Global: 80-90%
  - Critical Path: 85-95%
- **レポート**: HTML, LCOV, JSON
- **並列実行**: 4プロセス並行

**使用場面**:
```bash
npm test              # 全テスト実行
npm run test:unit     # Unit tests
npm run test:watch    # Watch mode
```

#### `playwright.config.ts` - E2Eテスト設定
**目的**: エンドツーエンドテストの実行設定

**主要機能**:
- **ブラウザ**: Chromium, Firefox, WebKit
- **デバイス**: Desktop, Mobile, Tablet
- **並列実行**: 複数ワーカー
- **レポート**: HTML, JUnit
- **スクリーンショット**: 失敗時自動取得

### 🏗️ ビルド設定

#### `vite.config.ts` (apps/web/) - PWAビルド設定
**目的**: PWAアプリケーションのビルド設定

**主要機能**:
- **React**: TypeScript + JSX
- **PWA**: Service Worker + Manifest
- **最適化**: Tree shaking, Code splitting
- **開発サーバー**: HMR対応

#### `tsconfig.json` - TypeScript設定
**目的**: TypeScript コンパイル設定

**主要機能**:
- **モジュール**: ES2022 + Node16解決
- **厳密性**: strict mode + 型安全性
- **パス**: エイリアス設定 (@shared, @host, etc.)

### 🎨 スタイル設定

#### `tailwind.config.js` (apps/web/) - CSS設定
**目的**: TailwindCSS の設定

**主要機能**:
- **レスポンシブ**: 7段階ブレークポイント
- **テーマ**: ダークモード対応
- **コンポーネント**: カスタムユーティリティ

### 📦 パッケージ管理

#### `package.json` - ルートパッケージ設定
**目的**: プロジェクト全体の依存関係とスクリプト

**スクリプト分類**:
```bash
# 開発・実行
npm run vibe-coder     # 全サービス起動
npm run terminal       # PWAのみ起動

# テスト
npm run test           # Unit tests
npm run test:e2e       # E2E tests
npm run test:ux-suite  # UX test suite
npm run preview-ux     # User testing

# 品質チェック
npm run lint           # ESLint
npm run typecheck      # TypeScript
npm run format         # Prettier

# ビルド・デプロイ
npm run build          # Production build
npm run deploy         # Deployment
```

#### `pnpm-workspace.yaml` - ワークスペース設定
**目的**: モノレポ構成の管理

**構成**:
```yaml
packages:
  - 'packages/*'    # Shared libraries
  - 'apps/*'        # Applications
```

### 🐳 コンテナ設定

#### `docker-compose.yml` - 開発環境
**目的**: ローカル開発用のマルチコンテナ設定

#### `docker/*/Dockerfile` - コンテナビルド
**目的**: 本番環境用のコンテナイメージ

### ☁️ デプロイ設定

#### `vercel.json` (apps/web/, packages/signaling/) - Vercel設定
**目的**: PWAとSignaling ServerのVercelデプロイ設定

#### `.github/workflows/*.yml` - CI/CD設定
**目的**: 自動テスト・デプロイパイプライン

### 🔒 セキュリティ設定

#### `.env.example` - 環境変数テンプレート
**目的**: 必要な環境変数の文書化

**カテゴリ**:
- Claude API認証
- GitHub統合
- Docker Registry
- Vercel設定
- 監視・通知

---

## 🔄 設定の使い分け

### テスト設定の使い分け

| 用途 | 設定ファイル | 環境 | 対象 |
|------|-------------|------|------|
| Unit Tests | `vitest.config.ts` | jsdom | React components, utils |
| Integration Tests | `vitest.config.ts` | jsdom | Service integration |
| E2E Tests | `playwright.config.ts` | browser | Full user workflow |

### 環境別設定

| 環境 | 設定ファイル | 目的 |
|------|-------------|------|
| Local | `.env.local` | 開発環境 |
| Staging | `.env.staging` | ステージング |
| Production | `.env.production` | 本番環境 |

---

## 📐 設定の設計原則

### 1. **単一責任原則**
- 各設定ファイルは明確な単一目的を持つ
- 機能別に分離（テスト/ビルド/デプロイ）

### 2. **環境別分離**
- 開発/ステージング/本番環境の明確な分離
- 環境変数による設定値切り替え

### 3. **型安全性**
- TypeScript設定による型チェック
- 設定値の型定義

### 4. **再利用性**
- 共通設定の基底クラス化
- 環境固有設定の継承

### 5. **保守性**
- 設定の意図を明確にコメント記載
- 設定変更の影響範囲を文書化

---

## 🔧 設定の保守・更新

### 定期的な見直し
- **月次**: 依存関係の更新確認
- **四半期**: 設定の最適化レビュー
- **リリース前**: 全設定の検証

### 変更管理
- **設定変更時**: この文書の更新
- **新機能追加時**: 関連設定の追加
- **廃止時**: 不要設定の削除

### 検証方法
```bash
# 設定ファイルの構文チェック
npm run typecheck

# テスト設定の検証
npm test

# ビルド設定の検証
npm run build

# リント設定の検証
npm run lint
```

---

## ⚠️ 注意事項

### セキュリティ
- **機密情報**: `.env` ファイルはgit管理外
- **API Key**: 環境変数で管理
- **権限**: 最小権限の原則

### パフォーマンス
- **ビルド時間**: 設定最適化で短縮
- **テスト実行**: 並列化で高速化
- **開発体験**: HMRで即座反映

### 互換性
- **Node.js**: 20+ 必須
- **ブラウザ**: ES2022対応
- **依存関係**: 定期的な更新

---

この文書は設定ファイルの**Single Source of Truth**として機能し、設定変更時は必ず更新することで、陳腐化を防止します。