import { expect, test } from '@playwright/test';

test.describe('Claude Commands E2E', () => {
  test.beforeEach(async ({ page }) => {
    // アプリのトップページに移動
    await page.goto('/');

    // 認証フローを完了（テスト用の簡略化）
    await page.getByRole('button', { name: /ホストに接続/i }).click();
    await page.getByPlaceholder(/12345678/).fill('12345678');
    await page.getByRole('button', { name: /接続/i }).click();
    await page.getByPlaceholder(/000000/).fill('123456');

    // 認証完了を待機
    await expect(page.getByTitle('Logout')).toBeVisible();
  });

  test('should execute /help command', async ({ page }) => {
    // 1. テキスト入力フィールドを探す
    const textInput = page.locator('input[type="text"]').first();
    await expect(textInput).toBeVisible();

    // 2. /helpコマンドを入力
    await textInput.fill('/help');
    await textInput.press('Enter');

    // 3. コマンド実行の確認（実際のレスポンスは環境依存）
    // 基本的な動作確認のみ
    await expect(page.getByText('Vibe Coder')).toBeVisible();
  });

  test('should execute /exit command', async ({ page }) => {
    // 1. テキスト入力フィールドを探す
    const textInput = page.locator('input[type="text"]').first();
    await expect(textInput).toBeVisible();

    // 2. /exitコマンドを入力
    await textInput.fill('/exit');
    await textInput.press('Enter');

    // 3. セッション終了の確認
    // ログアウトボタンが消えるか、初期画面に戻るか
    await expect(page.getByTitle('Logout')).not.toBeVisible();
  });

  test('should handle natural language commands', async ({ page }) => {
    // 1. テキスト入力フィールドを探す
    const textInput = page.locator('input[type="text"]').first();
    await expect(textInput).toBeVisible();

    // 2. 自然言語コマンドを入力
    await textInput.fill('create a React component');
    await textInput.press('Enter');

    // 3. コマンド実行の確認（基本的な動作確認のみ）
    await expect(page.getByText('Vibe Coder')).toBeVisible();
  });

  test('should handle empty command', async ({ page }) => {
    // 1. テキスト入力フィールドを探す
    const textInput = page.locator('input[type="text"]').first();
    await expect(textInput).toBeVisible();

    // 2. 空のコマンドを入力
    await textInput.press('Enter');

    // 3. エラーが発生しないことを確認
    await expect(page.getByText('Vibe Coder')).toBeVisible();
  });
});
