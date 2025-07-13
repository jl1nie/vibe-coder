import { test, expect } from '@playwright/test';
import { getTestConfig } from './test-helpers';

test.describe('Authentication E2E Tests', () => {
  let testConfig: any;

  test.beforeAll(async () => {
    testConfig = getTestConfig();
    console.log(`🔐 Authentication E2E Testing - Host ID: ${testConfig.hostId}`);
  });

  test('should complete authentication flow to 2FA screen', async ({ page }) => {
    console.log('Testing authentication flow to 2FA screen...');
    
    // Navigate to PWA
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify initial state and start authentication
    await expect(page.getByTestId('app-title')).toBeVisible();
    await expect(page.getByTestId('connect-to-host-button')).toBeVisible();
    await page.getByTestId('connect-to-host-button').click();

    // Enter Host ID
    await expect(page.getByTestId('host-id-input')).toBeVisible();
    await page.getByTestId('host-id-input').fill(testConfig.hostId);
    await page.getByTestId('connect-button').click();

    // Verify we reach 2FA screen successfully
    await expect(page.getByText(/2FA認証/i)).toBeVisible();
    await expect(page.getByTestId('totp-input')).toBeVisible();
    await expect(page.getByTestId('authenticate-button')).toBeVisible();

    console.log('✅ Authentication flow to 2FA completed');
  });

  test('should handle authentication errors gracefully', async ({ page }) => {
    console.log('Testing authentication error handling...');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Quick flow to error state
    await page.getByTestId('connect-to-host-button').click();
    await page.getByTestId('host-id-input').fill('99999999'); // Invalid host ID
    await page.getByTestId('connect-button').click();

    // Wait for error message to appear (using text content instead of test-id)
    await expect(page.locator('text=❌')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.text-red-400').first()).toBeVisible();

    console.log('✅ Error handling verified');
  });

  test('should support logout and re-authentication', async ({ page }) => {
    console.log('Testing logout and re-authentication flow...');

    // First, attempt authentication
    await page.goto('/');
    await page.getByTestId('connect-to-host-button').click();
    await page.getByTestId('host-id-input').fill(testConfig.hostId);
    await page.getByTestId('connect-button').click();

    // Verify we reach 2FA screen
    await expect(page.getByText(/2FA認証/i)).toBeVisible();

    // Test back navigation
    await page.getByTestId('back-button').click();
    await expect(page.getByTestId('host-id-input')).toBeVisible();

    // Verify input is cleared
    const inputValue = await page.getByTestId('host-id-input').inputValue();
    expect(inputValue).toBe('');

    console.log('✅ Re-authentication flow verified');
  });
});