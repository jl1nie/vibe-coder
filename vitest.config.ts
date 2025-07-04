/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // 環境設定
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    
    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/*.d.ts',
        'test/',
        'e2e/',
        'docker/',
        'docs/',
        '**/*.config.{ts,js}',
        '**/types/**',
      ],
      
      // Test Pyramid に基づくカバレッジ閾値
      thresholds: {
        global: {
          branches: 80,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        // クリティカルパス（より高い閾値）
        './packages/host/src/services/': {
          branches: 85,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        './packages/shared/src/': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95,
        },
      },
    },
    
    // テストファイルパターン
    include: [
      '**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      'e2e/**',
      'node_modules/**',
      'dist/**',
    ],
    
    // パフォーマンス設定
    testTimeout: 10000, // 10秒
    hookTimeout: 30000, // setup/teardown用
    maxConcurrency: 4, // 並行実行数
    
    // レポーター設定
    reporter: process.env.CI 
      ? ['junit', 'github-actions']
      : ['verbose', 'html'],
    
    outputFile: {
      junit: './test-results/junit.xml',
      html: './test-results/html/index.html',
    },
    
    // Watch設定
    watch: !process.env.CI,
    
    // 並列実行設定
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
      },
    },
  },
  
  // エイリアス設定
  resolve: {
    alias: {
      '@': resolve(__dirname, './packages'),
      '@shared': resolve(__dirname, './packages/shared/src'),
      '@host': resolve(__dirname, './packages/host/src'),
      '@web': resolve(__dirname, './apps/web/src'),
      '@test': resolve(__dirname, './test'),
    },
  },
  
  // 外部依存の処理
  define: {
    'import.meta.vitest': false,
  },
});