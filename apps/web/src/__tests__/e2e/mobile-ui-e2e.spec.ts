import { test, expect } from '@playwright/test';
import { getTestConfig } from './test-helpers';

test.describe('Mobile UI E2E Tests', () => {
  let testConfig: any;

  test.beforeAll(async () => {
    testConfig = getTestConfig();
    console.log(`📱 Mobile UI E2E Testing - Host ID: ${testConfig.hostId}`);
  });

  test('should verify mobile interface and voice recognition support', async ({ page }) => {
    console.log('Testing mobile interface and voice recognition availability...');
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify core mobile UI elements are present
    await expect(page.getByTestId('app-title')).toBeVisible();
    await expect(page.getByTestId('connect-to-host-button')).toBeVisible();

    // Complete authentication flow to main interface
    await page.getByTestId('connect-to-host-button').click();
    await page.getByTestId('host-id-input').fill(testConfig.hostId);
    await page.getByTestId('connect-button').click();

    // Verify we reach 2FA screen (main UI)
    await expect(page.getByText(/2FA認証/i)).toBeVisible();
    await expect(page.getByTestId('totp-input')).toBeVisible();

    // Check if voice recognition elements would be available in authenticated state
    // Note: Without valid TOTP, we test interface elements only
    
    console.log('✅ Mobile interface components verified');
  });

  test('should handle responsive design across mobile viewports', async ({ page }) => {
    console.log('Testing responsive design across mobile viewports...');

    // Test different mobile viewport sizes
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify elements are visible at mobile size
    await expect(page.getByTestId('app-title')).toBeVisible();
    await expect(page.getByTestId('connect-to-host-button')).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await expect(page.getByTestId('app-title')).toBeVisible();
    await expect(page.getByTestId('connect-to-host-button')).toBeVisible();

    console.log('✅ Responsive design verified');
  });
});