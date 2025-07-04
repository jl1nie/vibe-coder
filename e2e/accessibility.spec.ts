/**
 * Accessibility E2E Tests
 * Test Pyramid Level: E2E (WCAG 2.1 AA compliance)
 */

import { test, expect } from '@playwright/test';
import { connectToTestServer, executeCommand, checkAccessibility } from './helpers/test-helpers';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('スクリーンリーダー対応', async ({ page }) => {
    // 基本的なランドマークの確認
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('banner')).toBeVisible();

    // 接続後のアクセシビリティ
    await connectToTestServer(page);

    // ターミナル領域のアクセシビリティ
    const terminal = page.getByRole('region', { name: /terminal/i });
    await expect(terminal).toBeVisible();
    await expect(terminal).toHaveAttribute('aria-label');

    // コマンド入力のアクセシビリティ
    const commandInput = page.getByRole('textbox', { name: /command/i });
    await expect(commandInput).toBeVisible();
    await expect(commandInput).toHaveAttribute('aria-label');
    await expect(commandInput).toHaveAttribute('aria-describedby');

    // クイックコマンドのアクセシビリティ
    const quickCommands = page.getByRole('list', { name: /quick commands/i });
    await expect(quickCommands).toBeVisible();

    const commandButtons = quickCommands.getByRole('button');
    const buttonCount = await commandButtons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = commandButtons.nth(i);
      await expect(button).toHaveAttribute('aria-label');
      await expect(button).toHaveAttribute('role', 'button');
    }
  });

  test('キーボードナビゲーション完全対応', async ({ page }) => {
    // Tab キーでのナビゲーション
    await page.keyboard.press('Tab');
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBe('BUTTON');

    // 接続ボタンにフォーカス
    let connectButton = page.getByRole('button', { name: /connect/i });
    await expect(connectButton).toBeFocused();

    // Enter キーで接続画面へ
    await page.keyboard.press('Enter');
    
    // サーバーID入力フィールドに自動フォーカス
    const serverIdInput = page.getByPlaceholder(/server id/i);
    await expect(serverIdInput).toBeFocused();

    // キーボードでサーバーID入力
    await page.keyboard.type('TEST-SERVER-123');
    
    // Tab で接続ボタンへ
    await page.keyboard.press('Tab');
    connectButton = page.getByRole('button', { name: /connect/i });
    await expect(connectButton).toBeFocused();
    
    // Enter で接続
    await page.keyboard.press('Enter');
    
    // 接続完了後のキーボードナビゲーション
    await expect(page.getByText(/connected/i)).toBeVisible({ timeout: 15000 });
    
    // コマンド入力フィールドに自動フォーカス
    const commandInput = page.getByRole('textbox', { name: /command/i });
    await expect(commandInput).toBeFocused();
    
    // Tab でクイックコマンドへ
    await page.keyboard.press('Tab');
    const firstQuickCommand = page.getByRole('button', { name: /login/i });
    await expect(firstQuickCommand).toBeFocused();
    
    // 矢印キーでクイックコマンド間移動
    await page.keyboard.press('ArrowRight');
    const secondQuickCommand = page.getByRole('button', { name: /fix bug/i });
    await expect(secondQuickCommand).toBeFocused();
    
    // Enter でコマンド実行
    await page.keyboard.press('Enter');
    await expect(page.getByText(/executing/i)).toBeVisible();
  });

  test('ARIA属性とセマンティクス', async ({ page }) => {
    await connectToTestServer(page);

    // アプリケーション全体のARIA構造
    const main = page.getByRole('main');
    await expect(main).toHaveAttribute('aria-label', /vibe coder/i);

    // ターミナル領域
    const terminal = page.getByRole('region', { name: /terminal/i });
    await expect(terminal).toHaveAttribute('aria-live', 'polite');
    await expect(terminal).toHaveAttribute('aria-atomic', 'false');

    // コマンド入力
    const commandInput = page.getByRole('textbox', { name: /command/i });
    await expect(commandInput).toHaveAttribute('aria-required', 'true');
    await expect(commandInput).toHaveAttribute('aria-autocomplete', 'list');

    // クイックコマンド
    const quickCommandsList = page.getByRole('list', { name: /quick commands/i });
    await expect(quickCommandsList).toHaveAttribute('aria-orientation', 'horizontal');

    // 音声入力ボタン
    const voiceButton = page.getByRole('button', { name: /voice input/i });
    await expect(voiceButton).toHaveAttribute('aria-pressed');
    await expect(voiceButton).toHaveAttribute('aria-expanded', 'false');

    // 音声入力を開く
    await voiceButton.click();
    await expect(voiceButton).toHaveAttribute('aria-expanded', 'true');

    // 音声入力モーダル
    const voiceModal = page.getByRole('dialog', { name: /voice input/i });
    await expect(voiceModal).toHaveAttribute('aria-modal', 'true');
    await expect(voiceModal).toHaveAttribute('aria-labelledby');
    await expect(voiceModal).toHaveAttribute('aria-describedby');
  });

  test('色覚多様性対応', async ({ page }) => {
    await connectToTestServer(page);

    // 成功状態の色以外での表現
    await executeCommand(page, 'create a test function');
    
    // 成功メッセージにアイコンが含まれている
    const successMessage = page.getByText(/function created/i);
    await expect(successMessage).toBeVisible({ timeout: 20000 });
    
    // 成功アイコン確認
    const successIcon = page.getByTestId('success-icon');
    await expect(successIcon).toBeVisible();
    
    // エラー状態の色以外での表現
    await executeCommand(page, 'rm -rf /');
    
    // エラーメッセージにアイコンが含まれている
    const errorMessage = page.getByText(/dangerous command/i);
    await expect(errorMessage).toBeVisible();
    
    // エラーアイコン確認
    const errorIcon = page.getByTestId('error-icon');
    await expect(errorIcon).toBeVisible();
    
    // 警告状態の色以外での表現
    await executeCommand(page, 'this is a very long command that might take some time to execute');
    
    // 警告メッセージにアイコンが含まれている
    const warningMessage = page.getByText(/long execution/i);
    if (await warningMessage.isVisible()) {
      const warningIcon = page.getByTestId('warning-icon');
      await expect(warningIcon).toBeVisible();
    }
  });

  test('高コントラストモード対応', async ({ page }) => {
    // 高コントラストモードを有効化
    await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' });
    
    await connectToTestServer(page);
    
    // 主要要素のコントラスト確認
    const elements = [
      page.getByRole('button', { name: /connect/i }),
      page.getByRole('textbox', { name: /command/i }),
      page.getByRole('button', { name: /login/i }),
      page.getByRole('region', { name: /terminal/i })
    ];
    
    for (const element of elements) {
      if (await element.isVisible()) {
        // 背景色と文字色の取得
        const styles = await element.evaluate(el => {
          const computed = getComputedStyle(el);
          return {
            backgroundColor: computed.backgroundColor,
            color: computed.color,
            borderColor: computed.borderColor
          };
        });
        
        // 色が適切に設定されていることを確認
        expect(styles.backgroundColor).toBeTruthy();
        expect(styles.color).toBeTruthy();
        expect(styles.backgroundColor).not.toBe(styles.color);
      }
    }
  });

  test('動きの削減対応', async ({ page }) => {
    // 動きの削減を有効化
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    await connectToTestServer(page);
    
    // アニメーション時間の確認
    const quickCommand = page.getByRole('button', { name: /login/i });
    const transitionDuration = await quickCommand.evaluate(el => {
      const computed = getComputedStyle(el);
      return computed.transitionDuration;
    });
    
    // 削減モードでは短時間またはアニメーションなし
    expect(transitionDuration).toMatch(/^(0s|0\.1s|0\.2s)$/);
    
    // 音声入力モーダルのアニメーション
    const voiceButton = page.getByRole('button', { name: /voice input/i });
    await voiceButton.click();
    
    const voiceModal = page.getByRole('dialog', { name: /voice input/i });
    const modalTransition = await voiceModal.evaluate(el => {
      const computed = getComputedStyle(el);
      return computed.transitionDuration;
    });
    
    expect(modalTransition).toMatch(/^(0s|0\.1s|0\.2s)$/);
  });

  test('スクリーン拡大対応', async ({ page }) => {
    // 200% ズーム
    await page.setViewportSize({ width: 960, height: 540 }); // 1920x1080の50%
    await page.evaluate(() => {
      document.body.style.zoom = '2';
    });
    
    await connectToTestServer(page);
    
    // 主要要素が適切に表示される
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /command/i })).toBeVisible();
    
    // クイックコマンドが適切に配置される
    const quickCommands = page.getByRole('list', { name: /quick commands/i });
    await expect(quickCommands).toBeVisible();
    
    // スクロールが適切に動作する
    const terminal = page.getByRole('region', { name: /terminal/i });
    await expect(terminal).toBeVisible();
    
    // 400% ズーム
    await page.evaluate(() => {
      document.body.style.zoom = '4';
    });
    
    // 基本機能が維持される
    await expect(page.getByRole('main')).toBeVisible();
    const commandInput = page.getByRole('textbox', { name: /command/i });
    await expect(commandInput).toBeVisible();
    
    // 文字入力が可能
    await commandInput.fill('test zoom functionality');
    await expect(commandInput).toHaveValue('test zoom functionality');
  });

  test('音声ガイダンス対応', async ({ page }) => {
    await connectToTestServer(page);
    
    // 音声ガイダンス用のaria-live領域
    const announcements = page.getByRole('status', { name: /announcements/i });
    await expect(announcements).toBeVisible();
    
    // コマンド実行時のアナウンス
    await executeCommand(page, 'create a test function');
    
    // 実行開始のアナウンス
    await expect(announcements).toContainText(/executing.*test function/i);
    
    // 完了のアナウンス
    await expect(announcements).toContainText(/completed.*test function/i, { timeout: 20000 });
    
    // エラー時のアナウンス
    await executeCommand(page, 'rm -rf /');
    await expect(announcements).toContainText(/error.*dangerous command/i);
    
    // 音声入力時のアナウンス
    const voiceButton = page.getByRole('button', { name: /voice input/i });
    await voiceButton.click();
    
    await expect(announcements).toContainText(/voice input.*activated/i);
  });

  test('タブレット・モバイルのアクセシビリティ', async ({ page }) => {
    // タブレットビューポート
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await connectToTestServer(page);
    
    // タッチターゲットのサイズ確認 (最小44px)
    const touchTargets = await page.getByRole('button').all();
    
    for (const target of touchTargets) {
      if (await target.isVisible()) {
        const boundingBox = await target.boundingBox();
        expect(boundingBox?.width).toBeGreaterThanOrEqual(44);
        expect(boundingBox?.height).toBeGreaterThanOrEqual(44);
      }
    }
    
    // モバイルビューポート
    await page.setViewportSize({ width: 375, height: 667 });
    
    // フォーカス可能要素のサイズ確認
    const focusableElements = await page.locator('[tabindex="0"], button, input, textarea, select').all();
    
    for (const element of focusableElements) {
      if (await element.isVisible()) {
        const boundingBox = await element.boundingBox();
        expect(boundingBox?.width).toBeGreaterThanOrEqual(44);
        expect(boundingBox?.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('言語・地域対応', async ({ page }) => {
    // 日本語ロケール
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP' });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 基本的な日本語対応
    await expect(page.getByText(/接続/)).toBeVisible();
    
    // 右から左への言語（アラビア語）
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ar-SA' });
    await page.reload();
    
    // RTL対応確認
    const body = page.locator('body');
    const direction = await body.evaluate(el => getComputedStyle(el).direction);
    expect(direction).toBe('rtl');
    
    // 英語に戻す
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US' });
    await page.reload();
    
    await expect(page.getByText(/connect/i)).toBeVisible();
  });

  test('代替テキストと画像説明', async ({ page }) => {
    await connectToTestServer(page);
    
    // アイコンの代替テキスト
    const icons = await page.locator('[data-testid$="-icon"]').all();
    
    for (const icon of icons) {
      if (await icon.isVisible()) {
        const altText = await icon.getAttribute('alt');
        const ariaLabel = await icon.getAttribute('aria-label');
        
        // アイコンには適切な代替テキストまたはaria-labelが必要
        expect(altText || ariaLabel).toBeTruthy();
      }
    }
    
    // 装飾的な画像は適切に隠される
    const decorativeImages = await page.locator('[aria-hidden="true"] img').all();
    
    for (const img of decorativeImages) {
      const altText = await img.getAttribute('alt');
      expect(altText).toBe('');
    }
  });

  test('フォームのアクセシビリティ', async ({ page }) => {
    await page.getByRole('button', { name: /connect/i }).click();
    
    // フォームラベルの関連付け
    const serverIdInput = page.getByPlaceholder(/server id/i);
    const labelId = await serverIdInput.getAttribute('aria-labelledby');
    
    if (labelId) {
      const label = page.locator(`#${labelId}`);
      await expect(label).toBeVisible();
    }
    
    // 必須フィールドの表示
    await expect(serverIdInput).toHaveAttribute('aria-required', 'true');
    
    // エラーメッセージの関連付け
    await page.getByRole('button', { name: /connect/i }).click(); // 空の入力で接続試行
    
    const errorMessage = page.getByText(/server id.*required/i);
    if (await errorMessage.isVisible()) {
      const errorId = await errorMessage.getAttribute('id');
      const describedBy = await serverIdInput.getAttribute('aria-describedby');
      
      expect(describedBy).toContain(errorId);
    }
  });
});