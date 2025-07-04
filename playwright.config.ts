import { defineConfig, devices } from '@playwright/test';

/**
 * E2E Test Configuration for Vibe Coder
 * Test Pyramid Level: E2E (Top layer - 70%+ critical path coverage)
 */
export default defineConfig({
  // テストディレクトリ
  testDir: './e2e',
  
  // 基本設定
  timeout: 30 * 1000, // 30秒
  expect: {
    timeout: 5 * 1000, // 5秒
  },
  
  // CI/CD設定
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0, // CI時は2回リトライ
  workers: process.env.CI ? 1 : 2, // CI時は1プロセス、ローカルは2プロセス
  
  // レポーター設定
  reporter: [
    ['html', { outputFolder: './test-results/playwright-html' }],
    ['junit', { outputFile: './test-results/playwright-junit.xml' }],
    ['github'], // GitHub Actions用
    ['list'], // コンソール出力
  ],
  
  // デフォルト設定
  use: {
    // ベースURL
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    
    // トレース設定（失敗時のデバッグ用）
    trace: 'on-first-retry',
    
    // スクリーンショット設定
    screenshot: 'only-on-failure',
    
    // ビデオ録画設定
    video: process.env.CI ? 'on' : 'retain-on-failure',
    
    // ブラウザ設定
    headless: !!process.env.CI,
    
    // ネットワーク設定
    launchOptions: {
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
    },
    
    // 権限設定（音声入力テスト用）
    permissions: ['microphone'],
    
    // ロケール設定
    locale: 'ja-JP',
    
    // タイムゾーン設定
    timezoneId: 'Asia/Tokyo',
  },
  
  // テストプロジェクト（ブラウザ別・デバイス別）
  projects: [
    // === Desktop Tests ===
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        // PWA テスト用カスタム設定
        launchOptions: {
          args: [
            '--enable-features=WebAssembly',
            '--enable-web-bluetooth',
          ],
        },
      },
    },
    
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'] },
    },
    
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] },
    },
    
    // === Mobile Tests (モバイルファースト設計の検証) ===
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        // モバイル特有の設定
        hasTouch: true,
        isMobile: true,
      },
    },
    
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12'],
        hasTouch: true,
        isMobile: true,
      },
    },
    
    // === Tablet Tests ===
    {
      name: 'tablet-ipad',
      use: { 
        ...devices['iPad Pro'],
        hasTouch: true,
      },
    },
    
    // === Network Condition Tests ===
    {
      name: 'slow-network',
      use: {
        ...devices['Desktop Chrome'],
        // 低速ネットワークのシミュレーション
        launchOptions: {
          args: ['--disable-background-networking'],
        },
      },
    },
    
    // === Accessibility Tests ===
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        // アクセシビリティテスト用設定
        reducedMotion: 'reduce',
        forcedColors: 'active',
      },
    },
  ],
  
  // サーバー設定（テスト時の自動起動）
  webServer: [
    // PWA開発サーバー
    {
      command: 'pnpm -F web dev',
      port: 3000,
      timeout: 120 * 1000, // 2分
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        VITE_API_BASE_URL: 'http://localhost:8080/api',
        VITE_WS_URL: 'ws://localhost:8080/ws',
        VITE_SIGNALING_URL: 'http://localhost:8081/api',
      },
    },
    
    // ホストサーバー（テスト用）
    {
      command: 'pnpm -F host dev',
      port: 8080,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        CLAUDE_API_KEY: process.env.TEST_CLAUDE_API_KEY || 'test-key',
        LOG_LEVEL: 'error', // テスト時はエラーログのみ
      },
    },
    
    // シグナリングサーバー（モック）
    {
      command: 'node ./test/mock-signaling-server.js',
      port: 8081,
      timeout: 30 * 1000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  
  // グローバル設定
  globalSetup: './test/e2e-global-setup.ts',
  globalTeardown: './test/e2e-global-teardown.ts',
  
  // テストファイルパターン
  testMatch: [
    './e2e/**/*.spec.ts',
    './e2e/**/*.test.ts',
  ],
  
  // テスト結果ディレクトリ
  outputDir: './test-results/playwright-output',
  
  // 並列実行の最大数（デバイス別）
  maxFailures: process.env.CI ? 5 : 0,
  
  // テストデータディレクトリ
  snapshotDir: './test/e2e-snapshots',
  
  // カスタムマッチャー
  expect: {
    // スクリーンショット比較の閾値
    threshold: 0.2,
    
    // アニメーション無効化
    toHaveScreenshot: { 
      threshold: 0.2, 
      animations: 'disabled' 
    },
    
    // 要素の表示待ち時間
    toBeVisible: { timeout: 10000 },
  },
  
  // メタデータ
  metadata: {
    project: 'Vibe Coder',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'test',
    testType: 'e2e',
  },
});

// === 環境別設定のオーバーライド ===
if (process.env.CI) {
  // CI環境での設定
  module.exports.use = {
    ...module.exports.use,
    video: 'on',
    screenshot: 'on',
    trace: 'on',
  };
} else if (process.env.DEBUG) {
  // デバッグ環境での設定
  module.exports.use = {
    ...module.exports.use,
    headless: false,
    slowMo: 100,
    video: 'on',
    screenshot: 'on',
  };
}