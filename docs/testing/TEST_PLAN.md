# Vibe Coder 総合テスト計画

## 🏗️ Test Pyramid 戦略

```
                    ┌─────────────────┐
                    │   E2E Tests     │  ← 少数（10-20個）
                    │  (Playwright)   │    高価値・高コスト
                    └─────────────────┘
                ┌───────────────────────┐
                │ Integration Tests     │  ← 中程度（50-100個）
                │ (Component + API)     │    中価値・中コスト
                └───────────────────────┘
        ┌─────────────────────────────────┐
        │      Unit Tests               │  ← 多数（200-500個）
        │  (Functions + Components)     │    高速・低コスト
        └─────────────────────────────────┘
```

## 📊 テスト分類と目標カバレッジ

| テストレベル | 目標カバレッジ | 実行時間目標 | 責任範囲 |
|-------------|-------------|-------------|----------|
| **Unit Tests** | 90%+ | < 10秒 | 単一関数・コンポーネント |
| **Integration Tests** | 80%+ | < 2分 | API・コンポーネント間連携 |
| **E2E Tests** | 70%+ | < 10分 | フルユーザーワークフロー |

## 🎯 テスト戦略詳細

### 1. Unit Tests（単体テスト）

#### PWA クライアント
```typescript
// テスト対象コンポーネント例
describe('QuickCommands', () => {
  describe('基本機能', () => {
    it('コマンドボタンが正しくレンダリングされる')
    it('クリック時にonExecuteが呼び出される')
    it('無効なコマンドでエラーが表示される')
    it('キーボードナビゲーションが動作する')
  })
  
  describe('アクセシビリティ', () => {
    it('ARIA属性が正しく設定される')
    it('スクリーンリーダーで読み上げ可能')
    it('キーボードのみで操作可能')
  })
})
```

#### ホストサーバー
```typescript
// テスト対象サービス例
describe('ClaudeService', () => {
  describe('セッション管理', () => {
    it('セッションが正常に作成される')
    it('同時セッション制限が機能する')
    it('セッションが適切にクリーンアップされる')
  })
  
  describe('コマンド実行', () => {
    it('有効なコマンドが実行される')
    it('危険なコマンドがブロックされる')
    it('タイムアウト時に適切に終了される')
  })
})
```

#### シグナリングサーバー
```typescript
// テスト対象API例
describe('Signal API', () => {
  describe('データ保存', () => {
    it('有効なシグナルデータが保存される')
    it('不正なデータが拒否される')
    it('TTLが正しく設定される')
  })
  
  describe('レート制限', () => {
    it('制限内リクエストが通る')
    it('制限超過時に429が返される')
    it('IPごとに制限が適用される')
  })
})
```

### 2. Integration Tests（統合テスト）

#### API統合テスト
```typescript
describe('Host Server API Integration', () => {
  describe('セッション管理フロー', () => {
    it('セッション作成→コマンド実行→終了の完全フロー')
    it('WebSocket接続→メッセージ送受信→切断フロー')
    it('ファイル監視→変更検知→通知フロー')
  })
})
```

#### コンポーネント統合テスト
```typescript
describe('PWA Component Integration', () => {
  describe('TerminalPage統合', () => {
    it('VoiceInput + Terminal + QuickCommands連携')
    it('WebRTC接続状態の反映')
    it('エラー境界での適切な処理')
  })
})
```

### 3. E2E Tests（エンドツーエンドテスト）

#### 重要ユーザーフロー
1. **初回接続フロー**
2. **音声コマンド実行フロー** 
3. **プレイリスト管理フロー**
4. **エラー回復フロー**

## 🏃‍♂️ Phase 1: Unit Tests 実装

### 優先度1（Critical Path）

#### PWA クライアント
- [ ] `QuickCommands.test.tsx` - コマンド実行ロジック
- [ ] `VoiceInput.test.tsx` - 音声認識機能
- [ ] `Terminal.test.tsx` - ターミナル表示・操作
- [ ] `useSpeechRecognition.test.ts` - 音声認識フック
- [ ] `useWebRTC.test.ts` - WebRTC通信フック

#### ホストサーバー
- [ ] `claude-service.test.ts` - Claude Code統合
- [ ] `session-manager.test.ts` - セッション管理
- [ ] `webrtc-signaling.test.ts` - WebRTCシグナリング
- [ ] `file-watcher.test.ts` - ファイル監視
- [ ] `security.test.ts` - セキュリティミドルウェア

#### シグナリングサーバー
- [ ] `signal.test.ts` - シグナリングAPI
- [ ] `playlists.test.ts` - プレイリストAPI
- [ ] `stats.test.ts` - 統計API

### 優先度2（Important Features）

#### ユーティリティ・ヘルパー
- [ ] `logger.test.ts` - ロギング機能
- [ ] `env.test.ts` - 環境変数検証
- [ ] `error.test.ts` - エラーハンドリング
- [ ] `pwa.test.ts` - PWA機能

## 🔗 Phase 2: Integration Tests 実装

### API統合テスト
- [ ] `host-api-integration.test.ts`
- [ ] `signaling-api-integration.test.ts`
- [ ] `webrtc-connection.test.ts`

### コンポーネント統合テスト
- [ ] `terminal-voice-integration.test.tsx`
- [ ] `playlist-management.test.tsx`
- [ ] `error-boundary.test.tsx`

## 🎬 Phase 3: E2E Tests 実装

### 重要ワークフロー
- [ ] `01-initial-connection.spec.ts`
- [ ] `02-voice-command-execution.spec.ts`
- [ ] `03-playlist-discovery.spec.ts`
- [ ] `04-file-operations.spec.ts`
- [ ] `05-error-recovery.spec.ts`
- [ ] `06-mobile-interactions.spec.ts`

## 🛠️ テスト環境構築

### 必要な依存関係

```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/user-event": "^14.5.0",
    "vitest": "^1.2.0",
    "jsdom": "^23.0.0",
    "supertest": "^6.3.0",
    "playwright": "^1.40.0",
    "msw": "^2.0.0",
    "@types/supertest": "^6.0.0",
    "c8": "^8.0.0"
  }
}
```

### テスト設定ファイル

#### Vitest設定
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
})
```

#### Playwright設定
```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
    { name: 'Mobile Chrome', use: devices['Pixel 5'] },
    { name: 'Mobile Safari', use: devices['iPhone 12'] },
  ],
})
```

## 📈 継続的テスト戦略

### CI/CD パイプライン
```yaml
# .github/workflows/test.yml
name: Test Pipeline
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm test:unit
      - run: pnpm test:coverage
      
  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - run: docker-compose up -d host
      - run: pnpm test:integration
      
  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - run: docker-compose up -d
      - run: pnpm test:e2e
```

### 品質ゲート
- [ ] Unit Tests: 90%+ カバレッジ必須
- [ ] Integration Tests: すべてパス必須
- [ ] E2E Tests: Critical Path すべてパス必須
- [ ] Performance: バンドルサイズ < 500KB
- [ ] Accessibility: WCAG 2.1 AA準拠

## 🎯 成功指標

### 定量的指標
- **テスト実行時間**: 全体 < 15分
- **テストカバレッジ**: Lines 90%+、Branches 80%+
- **テスト安定性**: Flaky率 < 1%
- **バグ検出率**: 本番バグの90%+をテストで事前検出

### 定性的指標
- **開発者体験**: テスト実行が開発フローを妨げない
- **メンテナンス性**: テストコードが分かりやすい
- **信頼性**: テスト結果に基づいてリリース判断可能

## 🚨 リスク分析と対策

### 高リスク領域
1. **WebRTC P2P通信** - ネットワーク環境依存
2. **音声認識機能** - ブラウザ・デバイス依存  
3. **Claude API統合** - 外部サービス依存
4. **ファイル操作** - OS・権限依存

### 対策
- **Mock/Stub** を活用した独立性確保
- **Contract Testing** による外部依存の管理
- **Visual Regression Testing** による UI変更検出
- **Performance Testing** による性能劣化防止

---

## ✅ 実装確認事項

この計画について確認をお願いします：

1. **Test Pyramid の妥当性** - 各レベルの比率と責任分担
2. **優先順位** - Critical Path の選定
3. **技術選択** - Vitest + Playwright の組み合わせ
4. **カバレッジ目標** - 90%/80%/70% の妥当性
5. **実装スケジュール** - Phase分けの妥当性

承認いただければ、Phase 1 から順次実装を開始します！