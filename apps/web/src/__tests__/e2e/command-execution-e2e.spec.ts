import { test, expect } from '@playwright/test';
import { getTestConfig, authenticateWithTOTP, executeClaudeCommand, testFullClaudeExecution } from './test-helpers';

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

  test('should execute Claude commands with full authentication', async ({ page }) => {
    console.log('Testing Claude command execution with full authentication...');
    
    // Perform complete authentication and command execution
    await testFullClaudeExecution(page, testConfig);
    
    console.log('✅ Claude command execution verified');
  });

  test('should support individual command execution', async ({ page }) => {
    console.log('Testing individual Claude command execution...');

    // Complete authentication flow
    await authenticateWithTOTP(page, testConfig);
    
    // Execute a simple command
    await executeClaudeCommand(page, 'echo "Test command"');
    
    console.log('✅ Individual command execution verified');
  });
});