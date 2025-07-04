/**
 * Mobile-Specific Interactions E2E Tests
 * Test Pyramid Level: E2E (Mobile-first validation)
 */

import { test, expect } from '@playwright/test';
import { connectToTestServer, executeCommand } from './helpers/test-helpers';

test.describe('Mobile Interactions', () => {
  // モバイル専用テストの設定
  test.use({ 
    ...require('@playwright/test').devices['iPhone 12'],
    hasTouch: true,
    isMobile: true
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('スワイプによるターミナルスクロール', async ({ page }) => {
    // 事前条件: 接続してターミナルにコンテンツを充填
    await connectToTestServer(page);
    
    // 大量のコンテンツを生成
    for (let i = 0; i < 20; i++) {
      await executeCommand(page, `echo "Terminal line ${i + 1}"`);
    }
    
    // ターミナル要素を取得
    const terminal = page.getByRole('region', { name: /terminal/i });
    await expect(terminal).toBeVisible();
    
    // 初期スクロール位置を記録
    const initialScrollTop = await terminal.evaluate(el => el.scrollTop);
    
    // スワイプアップ操作
    await terminal.hover();
    await page.mouse.move(200, 500);
    await page.mouse.down();
    await page.mouse.move(200, 200, { steps: 10 }); // スムーズなスワイプ
    await page.mouse.up();
    
    // スクロール位置が変更されたことを確認
    const finalScrollTop = await terminal.evaluate(el => el.scrollTop);
    expect(finalScrollTop).toBeGreaterThan(initialScrollTop);
  });

  test('タッチによるクイックコマンド操作', async ({ page }) => {
    // 事前条件: 接続済み
    await connectToTestServer(page);
    
    // クイックコマンドが表示されることを確認
    const quickCommands = page.getByRole('region', { name: /quick commands/i });
    await expect(quickCommands).toBeVisible();
    
    // タッチでコマンド実行
    const loginButton = page.getByRole('button', { name: /login/i });
    await loginButton.tap();
    
    // タッチフィードバック確認
    await expect(loginButton).toHaveClass(/active/);
    
    // コマンド実行確認
    await expect(page.getByText(/Executing.*authentication/i)).toBeVisible();
  });

  test('長押しによるコンテキストメニュー', async ({ page }) => {
    // 事前条件: 接続済み
    await connectToTestServer(page);
    
    // クイックコマンドボタンを長押し
    const styleButton = page.getByRole('button', { name: /style/i });
    await styleButton.hover();
    await page.mouse.down();
    await page.waitForTimeout(800); // 長押し時間
    
    // コンテキストメニューが表示される
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /edit command/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /duplicate/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /delete/i })).toBeVisible();
    
    await page.mouse.up();
    
    // 編集モードに入る
    await page.getByRole('menuitem', { name: /edit command/i }).tap();
    
    // 編集ダイアログが表示される
    await expect(page.getByRole('dialog', { name: /edit command/i })).toBeVisible();
    await expect(page.getByDisplayValue(/improve the UI styling/i)).toBeVisible();
  });

  test('ピンチズームによるターミナル拡大', async ({ page }) => {
    // 事前条件: 接続済み
    await connectToTestServer(page);
    
    const terminal = page.getByRole('region', { name: /terminal/i });
    
    // 初期フォントサイズを記録
    const initialFontSize = await terminal.evaluate(el => 
      parseFloat(getComputedStyle(el).fontSize)
    );
    
    // ピンチズーム操作（2本指でズーム）
    await terminal.hover();
    
    // ズームイン操作をシミュレート
    await page.touchscreen.tap(200, 300);
    await page.evaluate(() => {
      const event = new WheelEvent('wheel', {
        deltaY: -100,
        ctrlKey: true,
        bubbles: true
      });
      document.querySelector('[role="region"][aria-label*="terminal"]')?.dispatchEvent(event);
    });
    
    // フォントサイズが拡大されることを確認
    const finalFontSize = await terminal.evaluate(el => 
      parseFloat(getComputedStyle(el).fontSize)
    );
    expect(finalFontSize).toBeGreaterThan(initialFontSize);
  });

  test('スワイプによるコマンド履歴ナビゲーション', async ({ page }) => {
    // 事前条件: 接続済み、複数のコマンド実行
    await connectToTestServer(page);
    
    const commands = [
      'create a function',
      'add error handling', 
      'write unit tests'
    ];
    
    for (const command of commands) {
      await executeCommand(page, command);
    }
    
    // コマンド入力フィールドを取得
    const commandInput = page.getByPlaceholder(/enter command/i);
    await commandInput.focus();
    
    // 上スワイプで履歴を戻る
    await commandInput.hover();
    await page.mouse.move(200, 600);
    await page.mouse.down();
    await page.mouse.move(200, 500, { steps: 5 });
    await page.mouse.up();
    
    // 最後のコマンドが入力フィールドに表示される
    await expect(commandInput).toHaveValue(/write unit tests/i);
    
    // もう一度上スワイプ
    await page.mouse.move(200, 600);
    await page.mouse.down();
    await page.mouse.move(200, 500, { steps: 5 });
    await page.mouse.up();
    
    // 前のコマンドが表示される
    await expect(commandInput).toHaveValue(/add error handling/i);
  });

  test('音声入力のタッチ操作', async ({ page }) => {
    // 事前条件: 接続済み
    await connectToTestServer(page);
    
    // 音声入力ボタンをタップ
    const voiceButton = page.getByRole('button', { name: /voice input/i });
    await voiceButton.tap();
    
    // 音声入力モーダルが表示される
    const voiceModal = page.getByRole('dialog', { name: /voice input/i });
    await expect(voiceModal).toBeVisible();
    
    // マイクアイコンのアニメーション確認
    const micIcon = voiceModal.getByTestId('mic-icon');
    await expect(micIcon).toHaveClass(/recording/);
    
    // タップでキャンセル
    await voiceModal.getByRole('button', { name: /cancel/i }).tap();
    
    // モーダルが閉じる
    await expect(voiceModal).not.toBeVisible();
  });

  test('プルトゥリフレッシュ機能', async ({ page }) => {
    // 事前条件: 接続済み
    await connectToTestServer(page);
    
    // ページの上部を下に引っ張る
    await page.mouse.move(200, 100);
    await page.mouse.down();
    await page.mouse.move(200, 300, { steps: 10 });
    
    // リフレッシュインジケーターが表示される
    await expect(page.getByTestId('refresh-indicator')).toBeVisible();
    
    await page.mouse.up();
    
    // ページがリフレッシュされる
    await expect(page.getByText(/Refreshing/i)).toBeVisible();
    await expect(page.getByText(/Connection refreshed/i)).toBeVisible({ timeout: 5000 });
  });

  test('モバイルキーボードとの協調動作', async ({ page }) => {
    // 事前条件: 接続済み
    await connectToTestServer(page);
    
    // コマンド入力フィールドをタップ
    const commandInput = page.getByPlaceholder(/enter command/i);
    await commandInput.tap();
    
    // モバイルキーボードが表示される（ビューポートが変更される）
    const initialViewport = page.viewportSize();
    
    // 文字を入力
    await commandInput.fill('create a mobile-friendly component');
    
    // 入力中でもUIが正しく表示される
    await expect(page.getByRole('button', { name: /execute/i })).toBeVisible();
    
    // キーボードを閉じる
    await page.keyboard.press('Escape');
    
    // ビューポートが元に戻る
    await page.waitForTimeout(300);
    const finalViewport = page.viewportSize();
    expect(finalViewport?.height).toBe(initialViewport?.height);
  });

  test('ハプティックフィードバック対応', async ({ page }) => {
    // 事前条件: 接続済み
    await connectToTestServer(page);
    
    // 成功時のフィードバック
    const loginButton = page.getByRole('button', { name: /login/i });
    await loginButton.tap();
    
    // バイブレーション API の呼び出しを確認
    const vibrationCalled = await page.evaluate(() => {
      return 'vibrate' in navigator;
    });
    expect(vibrationCalled).toBeTruthy();
    
    // エラー時のフィードバック
    await executeCommand(page, 'rm -rf /');
    
    // エラー用のバイブレーションパターンを確認
    await expect(page.getByText(/Dangerous command/i)).toBeVisible();
  });

  test('スクロール位置の保持', async ({ page }) => {
    // 事前条件: 接続済み、大量のコンテンツ
    await connectToTestServer(page);
    
    // 大量のコンテンツを生成
    for (let i = 0; i < 30; i++) {
      await executeCommand(page, `echo "Line ${i + 1}"`);
    }
    
    const terminal = page.getByRole('region', { name: /terminal/i });
    
    // 中間位置までスクロール
    await terminal.evaluate(el => el.scrollTop = el.scrollHeight / 2);
    const scrollPosition = await terminal.evaluate(el => el.scrollTop);
    
    // 別のタブに切り替え（バックグラウンド化）
    await page.evaluate(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    
    // 再度フォアグラウンド化
    await page.evaluate(() => {
      window.dispatchEvent(new Event('pageshow'));
    });
    
    // スクロール位置が保持されている
    const restoredScrollPosition = await terminal.evaluate(el => el.scrollTop);
    expect(restoredScrollPosition).toBe(scrollPosition);
  });
});