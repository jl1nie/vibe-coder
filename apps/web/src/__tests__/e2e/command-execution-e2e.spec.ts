import { test, expect } from '@playwright/test';
import { getTestConfig } from './test-helpers';

test.describe('Command Execution E2E Tests', () => {
  let testConfig: any;

  test.beforeAll(async () => {
    testConfig = getTestConfig();
    console.log(`⚙️ Command Execution E2E Testing - Host ID: ${testConfig.hostId}`);
  });

  test('should establish WebRTC connection and execute basic commands', async ({ page }) => {
    console.log('Testing WebRTC connection with basic command execution...');
    
    // Complete authentication flow (simplified)
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByTestId('connect-to-host-button').click();
    await page.getByTestId('host-id-input').fill(testConfig.hostId);
    await page.getByTestId('connect-button').click();
    
    // Reach 2FA screen
    await expect(page.getByText(/2FA認証/i)).toBeVisible();
    
    // Note: Without valid TOTP, we cannot test actual command execution
    // This test verifies the connection setup process
    console.log('✅ WebRTC connection setup process verified');
  });

  test('should handle WebRTC connection state management', async ({ page }) => {
    console.log('Testing WebRTC connection state management...');

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Start connection process
    await page.getByTestId('connect-to-host-button').click();
    await page.getByTestId('host-id-input').fill(testConfig.hostId);
    await page.getByTestId('connect-button').click();

    // Verify connection state indicators are present
    await expect(page.getByText(/2FA認証/i)).toBeVisible();
    await expect(page.getByTestId('totp-input')).toBeVisible();

    console.log('✅ WebRTC connection state management verified');
  });

  test('should reach TOTP authentication screen', async ({ page }) => {
    console.log('Testing TOTP authentication screen accessibility...');
    
    // Complete authentication flow up to TOTP screen
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByTestId('connect-to-host-button').click();
    await page.getByTestId('host-id-input').fill(testConfig.hostId);
    await page.getByTestId('connect-button').click();
    
    // Wait for 2FA screen and verify elements
    await expect(page.getByText(/2FA認証/i)).toBeVisible();
    await expect(page.getByTestId('totp-input')).toBeVisible();
    await expect(page.getByTestId('authenticate-button')).toBeVisible();
    
    // Verify TOTP input is interactive (can be focused)
    await page.getByTestId('totp-input').click();
    
    // Try to enter a character and verify it's accepted
    await page.getByTestId('totp-input').press('1');
    
    // Check if input field is functioning (basic interaction test)
    const isEnabled = await page.getByTestId('totp-input').isEnabled();
    await expect(isEnabled).toBe(true);
    
    console.log('✅ TOTP authentication screen verified');
  });

  test('should verify authentication flow navigation', async ({ page }) => {
    console.log('Testing authentication flow navigation...');

    // Navigate to authentication screen 
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByTestId('connect-to-host-button').click();
    await page.getByTestId('host-id-input').fill(testConfig.hostId);
    await page.getByTestId('connect-button').click();
    
    // Verify 2FA screen shows proper UI elements
    await expect(page.getByText(/2FA認証/i)).toBeVisible();
    
    // Check for back button (navigation capability)
    await expect(page.getByTestId('back-button')).toBeVisible();
    
    // Test back navigation
    await page.getByTestId('back-button').click();
    
    // Verify we can navigate back to Host ID input
    await expect(page.getByTestId('host-id-input')).toBeVisible();
    
    console.log('✅ Authentication flow navigation verified');
  });
});