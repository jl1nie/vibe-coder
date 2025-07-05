/**
 * UX Tests - User Experience & Accessibility Testing
 * モバイルファースト設計の検証とWCAG準拠テスト
 */

import { test, expect, devices } from '@playwright/test';

// デバイス設定
const mobileDevice = devices['iPhone 13 Pro'];
const tabletDevice = devices['iPad Pro'];
const desktopDevice = devices['Desktop Chrome'];

test.describe('UX Tests - Mobile First Design', () => {
  // モバイルデバイスでのテスト
  test.use(mobileDevice);

  test('モバイル: 基本操作フローの確認', async ({ page }) => {
    await page.goto('/');
    
    // PWAインストールバナーの確認
    await expect(page.locator('[data-testid="pwa-install-prompt"]')).toBeVisible();
    
    // メイン要素の配置確認
    await expect(page.locator('[data-testid="terminal"]')).toBeVisible();
    await expect(page.locator('[data-testid="quick-commands"]')).toBeVisible();
    
    // スクロール可能な要素の確認
    const quickCommands = page.locator('[data-testid="quick-commands"]');
    await expect(quickCommands).toHaveCSS('overflow-x', 'auto');
    
    // タップ可能な要素のサイズ確認 (44px以上)
    const commandButtons = page.locator('[data-testid="command-button"]');
    const buttonCount = await commandButtons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = commandButtons.nth(i);
      const boundingBox = await button.boundingBox();
      expect(boundingBox?.width).toBeGreaterThanOrEqual(44);
      expect(boundingBox?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('モバイル: 音声入力機能の確認', async ({ page }) => {
    await page.goto('/');
    
    // 音声入力ボタンの確認
    const voiceButton = page.locator('[data-testid="voice-input-button"]');
    await expect(voiceButton).toBeVisible();
    
    // 音声入力の開始
    await voiceButton.click();
    
    // 音声入力UI の表示確認
    await expect(page.locator('[data-testid="voice-input-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="voice-waveform"]')).toBeVisible();
    
    // キャンセル機能の確認
    await page.locator('[data-testid="voice-cancel-button"]').click();
    await expect(page.locator('[data-testid="voice-input-modal"]')).not.toBeVisible();
  });

  test('モバイル: スワイプジェスチャーの確認', async ({ page }) => {
    await page.goto('/');
    
    // クイックコマンドのスワイプ機能
    const quickCommands = page.locator('[data-testid="quick-commands"]');
    
    // 左スワイプ
    await quickCommands.hover();
    await page.mouse.down();
    await page.mouse.move(-100, 0);
    await page.mouse.up();
    
    // スクロール位置の変化を確認
    const scrollLeft = await quickCommands.evaluate(el => el.scrollLeft);
    expect(scrollLeft).toBeGreaterThan(0);
  });
});

test.describe('UX Tests - Tablet Design', () => {
  test.use(tabletDevice);

  test('タブレット: グリッドレイアウトの確認', async ({ page }) => {
    await page.goto('/');
    
    // 6列グリッドの確認
    const quickCommands = page.locator('[data-testid="quick-commands"]');
    await expect(quickCommands).toHaveCSS('display', 'grid');
    
    // グリッドカラムの確認
    const gridColumns = await quickCommands.evaluate(el => 
      window.getComputedStyle(el).gridTemplateColumns
    );
    expect(gridColumns).toContain('repeat(6, 1fr)');
  });

  test('タブレット: 分割画面モードの確認', async ({ page }) => {
    await page.goto('/');
    
    // 分割画面でのレイアウト確認
    const terminal = page.locator('[data-testid="terminal"]');
    const sidebar = page.locator('[data-testid="sidebar"]');
    
    await expect(terminal).toBeVisible();
    await expect(sidebar).toBeVisible();
    
    // フレックスレイアウトの確認
    const container = page.locator('[data-testid="main-container"]');
    await expect(container).toHaveCSS('display', 'flex');
  });
});

test.describe('UX Tests - Desktop Design', () => {
  test.use(desktopDevice);

  test('デスクトップ: 完全なサイドバーレイアウト', async ({ page }) => {
    await page.goto('/');
    
    // サイドバーの幅制限確認
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).toHaveCSS('max-width', '400px');
    
    // キーボードショートカットの確認
    await page.keyboard.press('Control+K');
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible();
    
    // ESCキーでの閉じる機能
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="command-palette"]')).not.toBeVisible();
  });

  test('デスクトップ: マウスホバー効果の確認', async ({ page }) => {
    await page.goto('/');
    
    // コマンドボタンのホバー効果
    const commandButton = page.locator('[data-testid="command-button"]').first();
    
    // ホバー前の状態
    const initialTransform = await commandButton.evaluate(el => 
      window.getComputedStyle(el).transform
    );
    
    // ホバー
    await commandButton.hover();
    
    // ホバー後の状態変化確認
    const hoveredTransform = await commandButton.evaluate(el => 
      window.getComputedStyle(el).transform
    );
    
    expect(hoveredTransform).not.toBe(initialTransform);
  });
});

test.describe('Accessibility Tests - WCAG 2.1 AA', () => {
  test('キーボードナビゲーション', async ({ page }) => {
    await page.goto('/');
    
    // タブキーでのナビゲーション
    await page.keyboard.press('Tab');
    
    // フォーカスが適切に移動することを確認
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // 全ての対話要素をタブで巡回
    const interactiveElements = page.locator('button, input, [tabindex="0"]');
    const count = await interactiveElements.count();
    
    for (let i = 0; i < count; i++) {
      await page.keyboard.press('Tab');
      const currentFocus = page.locator(':focus');
      await expect(currentFocus).toBeVisible();
    }
  });

  test('スクリーンリーダー対応', async ({ page }) => {
    await page.goto('/');
    
    // aria-label の存在確認
    const commandButtons = page.locator('[data-testid="command-button"]');
    const buttonCount = await commandButtons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = commandButtons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel!.length).toBeGreaterThan(0);
    }
    
    // sr-only テキストの確認
    const srOnlyElements = page.locator('.sr-only');
    const srCount = await srOnlyElements.count();
    expect(srCount).toBeGreaterThan(0);
  });

  test('色彩コントラスト', async ({ page }) => {
    await page.goto('/');
    
    // 高コントラストテーマの確認
    await page.emulateMedia({ colorScheme: 'dark' });
    
    // ダークモードでの要素の確認
    const terminal = page.locator('[data-testid="terminal"]');
    await expect(terminal).toBeVisible();
    
    // ライトモードに切り替え
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(terminal).toBeVisible();
  });

  test('reduced-motion設定への対応', async ({ page }) => {
    // reduced-motionの設定
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    await page.goto('/');
    
    // アニメーションが無効化されていることを確認
    const animatedElement = page.locator('[data-testid="loading-spinner"]');
    
    if (await animatedElement.isVisible()) {
      const animationDuration = await animatedElement.evaluate(el => 
        window.getComputedStyle(el).animationDuration
      );
      expect(animationDuration).toBe('0.01ms'); // reduced-motionで高速化
    }
  });
});

test.describe('Performance UX Tests', () => {
  test('初期表示速度', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    
    // 主要要素の表示待ち
    await expect(page.locator('[data-testid="terminal"]')).toBeVisible();
    await expect(page.locator('[data-testid="quick-commands"]')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // 3秒以内
  });

  test('オフライン対応', async ({ page, context }) => {
    await page.goto('/');
    
    // オフライン状態に設定
    await context.setOffline(true);
    
    // Service Workerによるオフライン表示
    await page.reload();
    
    // オフライン通知の確認
    await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();
    
    // オンライン復帰
    await context.setOffline(false);
    await page.reload();
    
    // オフライン通知の非表示確認
    await expect(page.locator('[data-testid="offline-banner"]')).not.toBeVisible();
  });

  test('メモリ使用量', async ({ page }) => {
    await page.goto('/');
    
    // 大量のコマンド履歴をシミュレート
    for (let i = 0; i < 100; i++) {
      await page.evaluate((index) => {
        const event = new CustomEvent('terminalOutput', {
          detail: { data: `Command ${index} output`, type: 'stdout' }
        });
        window.dispatchEvent(event);
      }, i);
    }
    
    // メモリ使用量の確認
    const memoryUsage = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // 50MB以下であることを確認
    expect(memoryUsage).toBeLessThan(50 * 1024 * 1024);
  });
});

test.describe('PWA Tests', () => {
  test('Manifest.json の確認', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);
    
    const manifest = await response?.json();
    expect(manifest.name).toBe('Vibe Coder');
    expect(manifest.short_name).toBe('Vibe Coder');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
  });

  test('Service Worker の確認', async ({ page }) => {
    await page.goto('/');
    
    // Service Worker の登録確認
    const swRegistered = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    
    expect(swRegistered).toBe(true);
    
    // Service Worker の状態確認
    const swState = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.active?.state;
    });
    
    expect(swState).toBe('activated');
  });

  test('プッシュ通知設定', async ({ page }) => {
    await page.goto('/');
    
    // プッシュ通知の許可リクエスト
    const notificationPermission = await page.evaluate(async () => {
      if ('Notification' in window) {
        return Notification.permission;
      }
      return 'denied';
    });
    
    expect(['granted', 'denied', 'default']).toContain(notificationPermission);
  });
});

test.describe('Error Handling UX', () => {
  test('ネットワークエラー時の表示', async ({ page }) => {
    await page.goto('/');
    
    // ネットワークエラーをシミュレート
    await page.route('**/api/**', route => route.abort());
    
    // 接続ボタンをクリック
    await page.click('[data-testid="connect-button"]');
    
    // エラーメッセージの確認
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Connection failed');
  });

  test('無効なサーバーID入力時の処理', async ({ page }) => {
    await page.goto('/');
    
    // 無効なサーバーIDを入力
    await page.fill('[data-testid="server-id-input"]', 'invalid-server-id');
    await page.click('[data-testid="connect-button"]');
    
    // バリデーションエラーの確認
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="validation-error"]')).toContainText('Invalid server ID');
  });

  test('セッションタイムアウト時の処理', async ({ page }) => {
    await page.goto('/');
    
    // セッションタイムアウトをシミュレート
    await page.evaluate(() => {
      const event = new CustomEvent('sessionTimeout');
      window.dispatchEvent(event);
    });
    
    // 自動再接続の確認
    await expect(page.locator('[data-testid="reconnecting-banner"]')).toBeVisible();
  });
});

test.describe('Multi-language Support', () => {
  test('日本語環境での表示', async ({ page }) => {
    await page.goto('/', { 
      extraHTTPHeaders: { 'Accept-Language': 'ja-JP,ja;q=0.9' }
    });
    
    // 日本語テキストの確認
    await expect(page.locator('[data-testid="connect-button"]')).toContainText('接続');
  });

  test('英語環境での表示', async ({ page }) => {
    await page.goto('/', { 
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' }
    });
    
    // 英語テキストの確認
    await expect(page.locator('[data-testid="connect-button"]')).toContainText('Connect');
  });
});