import { expect, test } from '@playwright/test';

test.describe('Responsive Design E2E', () => {
  test.beforeEach(async ({ page }) => {
    // アプリのトップページに移動
    await page.goto('/');
  });

  test('should display correctly on desktop', async ({ page }) => {
    // デスクトップサイズに設定
    await page.setViewportSize({ width: 1920, height: 1080 });

    // 1. 初期画面の確認
    await expect(page.getByText('Vibe Coder')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /ホストに接続/i })
    ).toBeVisible();

    // 2. レイアウトの確認
    await expect(page.locator('.h-screen')).toBeVisible();
    await expect(page.locator('.bg-gradient-to-br')).toBeVisible();
  });

  test('should display correctly on tablet', async ({ page }) => {
    // タブレットサイズに設定
    await page.setViewportSize({ width: 768, height: 1024 });

    // 1. 初期画面の確認
    await expect(page.getByText('Vibe Coder')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /ホストに接続/i })
    ).toBeVisible();

    // 2. レスポンシブクラスの確認
    await expect(page.locator('.mobile-optimized')).toBeVisible();
  });

  test('should display correctly on mobile', async ({ page }) => {
    // モバイルサイズに設定
    await page.setViewportSize({ width: 375, height: 667 });

    // 1. 初期画面の確認
    await expect(page.getByText('Vibe Coder')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /ホストに接続/i })
    ).toBeVisible();

    // 2. モバイル最適化クラスの確認
    await expect(page.locator('.mobile-optimized')).toBeVisible();
    await expect(page.locator('.full-height-mobile')).toBeVisible();
  });

  test('should handle orientation change', async ({ page }) => {
    // 1. 縦向きで開始
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByText('Vibe Coder')).toBeVisible();

    // 2. 横向きに変更
    await page.setViewportSize({ width: 667, height: 375 });
    await expect(page.getByText('Vibe Coder')).toBeVisible();

    // 3. 縦向きに戻す
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByText('Vibe Coder')).toBeVisible();
  });

  test('should maintain functionality across screen sizes', async ({
    page,
  }) => {
    const screenSizes = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 1024, height: 768, name: 'Tablet' },
      { width: 768, height: 1024, name: 'Tablet Portrait' },
      { width: 375, height: 667, name: 'Mobile' },
      { width: 320, height: 568, name: 'Small Mobile' },
    ];

    for (const size of screenSizes) {
      // 1. 画面サイズを設定
      await page.setViewportSize(size);

      // 2. 基本機能の確認
      await expect(page.getByText('Vibe Coder')).toBeVisible();
      await expect(
        page.getByRole('button', { name: /ホストに接続/i })
      ).toBeVisible();

      // 3. ボタンがクリック可能であることを確認
      await expect(
        page.getByRole('button', { name: /ホストに接続/i })
      ).toBeEnabled();
    }
  });
});
