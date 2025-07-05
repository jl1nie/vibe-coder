/**
 * Visual Regression Tests
 * UIコンポーネントの視覚的一貫性とデザインシステム準拠テスト
 */

import { test, expect, devices } from '@playwright/test';

// デバイス設定
const testDevices = [
  { name: 'mobile', device: devices['iPhone 13 Pro'] },
  { name: 'tablet', device: devices['iPad Pro'] },
  { name: 'desktop', device: devices['Desktop Chrome'] }
];

// テーマ設定
const themes = ['light', 'dark'];

// テストケース
const testCases = [
  {
    name: 'landing-page',
    url: '/',
    description: 'ランディングページの表示'
  },
  {
    name: 'connection-screen',
    url: '/connect',
    description: '接続画面の表示'
  },
  {
    name: 'terminal-interface',
    url: '/terminal',
    description: 'ターミナル画面の表示'
  },
  {
    name: 'settings-page',
    url: '/settings',
    description: '設定画面の表示'
  }
];

// コンポーネント別テスト
const componentTests = [
  {
    name: 'quick-commands',
    selector: '[data-testid="quick-commands"]',
    description: 'クイックコマンドUIの表示'
  },
  {
    name: 'terminal-output',
    selector: '[data-testid="terminal-output"]',
    description: 'ターミナル出力の表示'
  },
  {
    name: 'voice-input-modal',
    selector: '[data-testid="voice-input-modal"]',
    description: '音声入力モーダルの表示'
  },
  {
    name: 'feedback-widget',
    selector: '[data-testid="feedback-widget"]',
    description: 'フィードバックウィジェットの表示'
  }
];

// 各デバイスでのページ全体テスト
testDevices.forEach(({ name: deviceName, device }) => {
  test.describe(`Visual Regression - ${deviceName}`, () => {
    test.use(device);

    themes.forEach(theme => {
      test.describe(`${theme} theme`, () => {
        testCases.forEach(testCase => {
          test(`${testCase.name} - ${theme} theme`, async ({ page }) => {
            // テーマ設定
            await page.emulateMedia({ colorScheme: theme as 'light' | 'dark' });
            
            // ページに移動
            await page.goto(testCase.url);
            
            // 要素が読み込まれるまで待機
            await page.waitForLoadState('networkidle');
            
            // アニメーションを無効化
            await page.addStyleTag({
              content: `
                *, *::before, *::after {
                  animation-duration: 0.01ms !important;
                  animation-delay: 0ms !important;
                  transition-duration: 0.01ms !important;
                  transition-delay: 0ms !important;
                }
              `
            });
            
            // スクリーンショット撮影
            await expect(page).toHaveScreenshot(
              `${testCase.name}-${deviceName}-${theme}.png`,
              {
                fullPage: true,
                threshold: 0.2,
                animations: 'disabled'
              }
            );
          });
        });
      });
    });
  });
});

// コンポーネント別テスト
test.describe('Component Visual Regression', () => {
  componentTests.forEach(component => {
    test(`${component.name} component`, async ({ page }) => {
      await page.goto('/');
      
      // コンポーネントが表示されるまで待機
      const element = page.locator(component.selector);
      await expect(element).toBeVisible();
      
      // コンポーネントのスクリーンショット
      await expect(element).toHaveScreenshot(
        `${component.name}-component.png`,
        {
          threshold: 0.2,
          animations: 'disabled'
        }
      );
    });
  });
});

// 状態別テスト
test.describe('State-based Visual Tests', () => {
  test('接続状態の表示', async ({ page }) => {
    await page.goto('/');
    
    // 接続前の状態
    await expect(page.locator('[data-testid="connection-status"]')).toHaveScreenshot(
      'connection-disconnected.png'
    );
    
    // 接続中の状態をシミュレート
    await page.evaluate(() => {
      const event = new CustomEvent('connectionStateChange', {
        detail: { state: 'connecting' }
      });
      window.dispatchEvent(event);
    });
    
    await expect(page.locator('[data-testid="connection-status"]')).toHaveScreenshot(
      'connection-connecting.png'
    );
    
    // 接続完了の状態をシミュレート
    await page.evaluate(() => {
      const event = new CustomEvent('connectionStateChange', {
        detail: { state: 'connected' }
      });
      window.dispatchEvent(event);
    });
    
    await expect(page.locator('[data-testid="connection-status"]')).toHaveScreenshot(
      'connection-connected.png'
    );
  });

  test('エラー状態の表示', async ({ page }) => {
    await page.goto('/');
    
    // エラー状態をシミュレート
    await page.evaluate(() => {
      const event = new CustomEvent('error', {
        detail: { 
          type: 'connection',
          message: 'Failed to connect to server'
        }
      });
      window.dispatchEvent(event);
    });
    
    await expect(page.locator('[data-testid="error-message"]')).toHaveScreenshot(
      'error-connection.png'
    );
  });

  test('ローディング状態の表示', async ({ page }) => {
    await page.goto('/');
    
    // ローディング状態をシミュレート
    await page.evaluate(() => {
      const event = new CustomEvent('loadingStateChange', {
        detail: { isLoading: true, message: 'Executing command...' }
      });
      window.dispatchEvent(event);
    });
    
    await expect(page.locator('[data-testid="loading-indicator"]')).toHaveScreenshot(
      'loading-state.png'
    );
  });
});

// インタラクティブ要素のテスト
test.describe('Interactive Elements Visual Tests', () => {
  test('ボタンのホバー状態', async ({ page }) => {
    await page.goto('/');
    
    const button = page.locator('[data-testid="connect-button"]');
    
    // 通常状態
    await expect(button).toHaveScreenshot('button-normal.png');
    
    // ホバー状態
    await button.hover();
    await expect(button).toHaveScreenshot('button-hover.png');
    
    // フォーカス状態
    await button.focus();
    await expect(button).toHaveScreenshot('button-focus.png');
    
    // アクティブ状態
    await button.click();
    await expect(button).toHaveScreenshot('button-active.png');
  });

  test('フォーム要素の状態', async ({ page }) => {
    await page.goto('/');
    
    const input = page.locator('[data-testid="server-id-input"]');
    
    // 空の状態
    await expect(input).toHaveScreenshot('input-empty.png');
    
    // 入力状態
    await input.fill('test-server-id');
    await expect(input).toHaveScreenshot('input-filled.png');
    
    // フォーカス状態
    await input.focus();
    await expect(input).toHaveScreenshot('input-focus.png');
    
    // エラー状態
    await input.fill('invalid');
    await page.keyboard.press('Tab'); // フォーカスを外してバリデーション発火
    await expect(input).toHaveScreenshot('input-error.png');
  });
});

// アニメーション状態のテスト
test.describe('Animation Visual Tests', () => {
  test('音声入力のアニメーション', async ({ page }) => {
    await page.goto('/');
    
    // 音声入力を開始
    await page.click('[data-testid="voice-input-button"]');
    
    // 音声入力モーダルが表示される
    await expect(page.locator('[data-testid="voice-input-modal"]')).toBeVisible();
    
    // 音声波形のアニメーション状態
    await expect(page.locator('[data-testid="voice-waveform"]')).toHaveScreenshot(
      'voice-waveform-active.png'
    );
  });

  test('ターミナル出力のアニメーション', async ({ page }) => {
    await page.goto('/');
    
    // ターミナル出力をシミュレート
    await page.evaluate(() => {
      const event = new CustomEvent('terminalOutput', {
        detail: { 
          data: 'Command executed successfully!',
          type: 'stdout'
        }
      });
      window.dispatchEvent(event);
    });
    
    // 新しい出力行のハイライト
    await expect(page.locator('[data-testid="terminal-output"] .line:last-child')).toHaveScreenshot(
      'terminal-new-line.png'
    );
  });
});

// レスポンシブデザインのテスト
test.describe('Responsive Design Visual Tests', () => {
  const viewports = [
    { width: 320, height: 568, name: 'mobile-s' },
    { width: 375, height: 667, name: 'mobile-m' },
    { width: 414, height: 896, name: 'mobile-l' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1024, height: 768, name: 'tablet-landscape' },
    { width: 1440, height: 900, name: 'desktop' },
    { width: 1920, height: 1080, name: 'desktop-large' }
  ];

  viewports.forEach(viewport => {
    test(`レスポンシブデザイン - ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // レイアウトが安定するまで待機
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot(
        `responsive-${viewport.name}.png`,
        {
          fullPage: true,
          threshold: 0.2
        }
      );
    });
  });
});

// ダークモード vs ライトモードの比較テスト
test.describe('Theme Comparison Tests', () => {
  test('テーマ切り替えの一貫性', async ({ page }) => {
    await page.goto('/');
    
    // ライトモード
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('[data-testid="theme-toggle"]')).toHaveScreenshot(
      'theme-toggle-light.png'
    );
    
    // ダークモード
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('[data-testid="theme-toggle"]')).toHaveScreenshot(
      'theme-toggle-dark.png'
    );
  });

  test('アクセシビリティ: 高コントラストモード', async ({ page }) => {
    await page.goto('/');
    
    // 高コントラストモードをシミュレート
    await page.addStyleTag({
      content: `
        @media (prefers-contrast: high) {
          * {
            filter: contrast(1.5);
          }
        }
      `
    });
    
    await page.emulateMedia({ 
      colorScheme: 'dark',
      forcedColors: 'active'
    });
    
    await expect(page).toHaveScreenshot('high-contrast-mode.png', {
      fullPage: true,
      threshold: 0.3
    });
  });
});

// エラーハンドリングの視覚的テスト
test.describe('Error Handling Visual Tests', () => {
  test('404ページの表示', async ({ page }) => {
    await page.goto('/non-existent-page');
    
    await expect(page).toHaveScreenshot('404-page.png', {
      fullPage: true
    });
  });

  test('JavaScript無効時の表示', async ({ page, context }) => {
    await context.setExtraHTTPHeaders({
      'Content-Security-Policy': "script-src 'none'"
    });
    
    await page.goto('/');
    
    // JavaScript無効時のフォールバック表示
    await expect(page).toHaveScreenshot('no-javascript.png', {
      fullPage: true
    });
  });
});

// パフォーマンス関連の視覚的テスト
test.describe('Performance Visual Tests', () => {
  test('低速接続での表示', async ({ page }) => {
    // 低速接続をシミュレート
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), 2000);
    });
    
    await page.goto('/');
    
    // ローディング状態の表示
    await expect(page.locator('[data-testid="loading-skeleton"]')).toHaveScreenshot(
      'loading-skeleton.png'
    );
  });

  test('オフライン時の表示', async ({ page, context }) => {
    await page.goto('/');
    
    // オフライン状態に設定
    await context.setOffline(true);
    
    // オフライン通知の表示
    await expect(page.locator('[data-testid="offline-banner"]')).toHaveScreenshot(
      'offline-banner.png'
    );
  });
});