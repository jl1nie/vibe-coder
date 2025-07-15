import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    // 日常開発用：高速タイムアウト
    testTimeout: 10000, // 10秒（WebRTC接続テスト考慮）
    hookTimeout: 10000, // 10秒
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@vibe-coder/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});