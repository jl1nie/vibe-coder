import { expect, test } from '@playwright/test';

test.describe('Claude Authentication E2E', () => {
  test.beforeEach(async ({ page }) => {
    // アプリのトップページに移動
    await page.goto('/');
  });

  test('should complete authentication flow', async ({ page }) => {
    // 1. 初期画面の確認
    await expect(
      page.getByRole('button', { name: /ホストに接続/i })
    ).toBeVisible();
    await expect(page.getByText('Vibe Coder')).toBeVisible();

    // 2. ホストに接続ボタンをクリック
    await page.getByRole('button', { name: /ホストに接続/i }).click();

    // 3. Host ID入力画面の確認
    await expect(page.getByPlaceholder(/12345678/)).toBeVisible();
    await expect(page.getByRole('button', { name: /接続/i })).toBeVisible();

    // 4. Host IDを入力
    await page.getByPlaceholder(/12345678/).fill('12345678');

    // 5. 接続ボタンをクリック
    await page.getByRole('button', { name: /接続/i }).click();

    // 6. 2FA認証画面の確認
    await expect(page.getByText(/2FA認証/i)).toBeVisible();
    await expect(page.getByPlaceholder(/000000/)).toBeVisible();

    // 7. TOTPコードを入力（テスト用の6桁）
    await page.getByPlaceholder(/000000/).fill('123456');

    // 8. 認証完了後の画面確認
    await expect(page.getByTitle('Logout')).toBeVisible();
    await expect(page.getByText('Vibe Coder')).toBeVisible();
  });

  test('should handle authentication error', async ({ page }) => {
    // 1. ホストに接続ボタンをクリック
    await page.getByRole('button', { name: /ホストに接続/i }).click();

    // 2. 無効なHost IDを入力
    await page.getByPlaceholder(/12345678/).fill('99999999');

    // 3. 接続ボタンをクリック
    await page.getByRole('button', { name: /接続/i }).click();

    // 4. エラーメッセージの確認
    await expect(page.getByText(/Host IDが見つかりません/i)).toBeVisible();
  });

  test('should handle invalid TOTP code', async ({ page }) => {
    // 1. 認証フローを開始
    await page.getByRole('button', { name: /ホストに接続/i }).click();
    await page.getByPlaceholder(/12345678/).fill('12345678');
    await page.getByRole('button', { name: /接続/i }).click();

    // 2. 無効なTOTPコードを入力
    await page.getByPlaceholder(/000000/).fill('000000');

    // 3. エラーメッセージの確認
    await expect(page.getByText(/認証コードが正しくありません/i)).toBeVisible();
  });
});
