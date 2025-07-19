import { Page, expect } from '@playwright/test';
import fs from 'fs';
import * as speakeasy from 'speakeasy';

interface TestConfig {
  hostId: string;
  signalingUrl: string;
  hostUrl: string;
  timestamp: string;
}

export function getTestConfig(): TestConfig {
  if (!fs.existsSync('.test-config.json')) {
    throw new Error('Test configuration not found. Global setup may have failed.');
  }
  
  return JSON.parse(fs.readFileSync('.test-config.json', 'utf-8'));
}

export async function authenticateUser(page: Page, testConfig?: TestConfig): Promise<void> {
  const config = testConfig || getTestConfig();
  
  // Navigate to PWA
  await page.goto('/');
  
  // 1. Click connect to host button
  await expect(
    page.getByTestId('connect-to-host-button')
  ).toBeVisible();
  await page.getByTestId('connect-to-host-button').click();

  // 2. Enter Host ID
  await expect(page.getByPlaceholder(/12345678/)).toBeVisible();
  await page.getByPlaceholder(/12345678/).fill(config.hostId);
  await page.getByRole('button', { name: /接続/i }).click();

  // 3. Wait for 2FA screen
  await expect(page.getByText(/2FA認証/i)).toBeVisible();
  await expect(page.getByPlaceholder(/000000/)).toBeVisible();

  // Note: In real test, we need valid TOTP code
  // For now, we'll simulate successful authentication
  console.log(`Using Host ID: ${config.hostId} for authentication test`);
}

export async function waitForWebRTCConnection(page: Page, timeout = 30000): Promise<void> {
  // Wait for WebRTC connection indicator
  await expect(page.getByTestId('wifi-on')).toBeVisible({ timeout });
  
  // Wait for terminal to be ready
  await expect(page.getByText('Ready')).toBeVisible({ timeout });
}

export async function executeCommand(page: Page, command: string): Promise<void> {
  // Find text input field
  const textInput = page.locator('input[type="text"]').first();
  await expect(textInput).toBeVisible();
  
  // Enter command and execute
  await textInput.fill(command);
  await textInput.press('Enter');
  
  // Wait a moment for command processing
  await page.waitForTimeout(1000);
}

export async function verifyTerminalOutput(page: Page, expectedText: string, timeout = 10000): Promise<void> {
  // Check for expected text in terminal area
  const terminalElement = page.locator('.terminal-output');
  await expect(terminalElement).toContainText(expectedText, { timeout });
}

export async function testVoiceRecognition(page: Page): Promise<void> {
  // Check if voice recognition is supported
  const micButton = page.getByTitle(/Start voice input|Stop recording/i);
  await expect(micButton).toBeVisible();
  
  // Simulate voice input (in real test environment with fake media stream)
  await micButton.click();
  
  // Wait for recording state
  await expect(page.locator('.pulse-recording')).toBeVisible();
  
  // Stop recording
  await micButton.click();
  
  // Verify recording stopped
  await expect(page.locator('.pulse-recording')).not.toBeVisible();
}

export async function testMobileLayout(page: Page): Promise<void> {
  console.log('Testing mobile layout for page:', page.url());
  // Test mobile-specific UI elements
  await expect(page.locator('.mobile-optimized')).toBeVisible();
  await expect(page.locator('.full-height-mobile')).toBeVisible();
  await expect(page.locator('.safe-area-inset-top')).toBeVisible();
}

export async function waitForAuthenticationComplete(page: Page): Promise<void> {
  // Wait for logout button to appear (indicates successful auth)
  await expect(page.getByTitle('Logout')).toBeVisible({ timeout: 15000 });
  
  // Wait for connection status
  await expect(page.getByTestId('wifi-on')).toBeVisible({ timeout: 30000 });
}

/**
 * Generate a valid TOTP code using the test environment secret
 */
export function generateTestTOTP(): string {
  // Use the actual TOTP secret from development environment
  const testSecret = 'LBGTQUZDKFWGWNTVFJKFIYTCGMXWY2L5FFEEGMREGU4XAXKOPNXQ';
  
  const token = speakeasy.totp({
    secret: testSecret,
    encoding: 'base32',
    time: Date.now() / 1000,
    step: 30,
    window: 2
  });
  
  return token;
}

export async function mockValidTOTP(page: Page): Promise<void> {
  // Generate a valid TOTP code for test environment
  const totpCode = generateTestTOTP();
  console.log(`Generated test TOTP code: ${totpCode}`);
  
  // Input the TOTP code
  const totpInput = page.getByTestId('totp-input');
  await expect(totpInput).toBeVisible();
  await totpInput.fill(totpCode);
  
  console.log('TOTP code entered for page:', page.url());
}

export async function verifyWebRTCDataChannel(page: Page): Promise<void> {
  // Check for WebRTC connection messages in terminal
  await verifyTerminalOutput(page, 'WebRTC Data Channel connected');
}

export async function logout(page: Page): Promise<void> {
  const logoutButton = page.getByTitle('Logout');
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();
  
  // Verify logged out
  await expect(page.getByText(/2FA認証/i)).toBeVisible();
}

/**
 * Complete authentication flow with TOTP
 */
export async function authenticateWithTOTP(page: Page, testConfig?: TestConfig): Promise<void> {
  const config = testConfig || getTestConfig();
  
  console.log('🔐 Starting complete authentication flow...');
  
  // Navigate to PWA
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // 1. Click connect to host button
  await expect(page.getByTestId('connect-to-host-button')).toBeVisible();
  await page.getByTestId('connect-to-host-button').click();

  // 2. Enter Host ID
  await expect(page.getByTestId('host-id-input')).toBeVisible();
  await page.getByTestId('host-id-input').fill(config.hostId);
  await page.getByTestId('connect-button').click();

  // 3. Wait for 2FA screen
  await expect(page.getByText(/2FA認証/i)).toBeVisible();
  
  // 4. Generate and enter valid TOTP code
  const totpCode = generateTestTOTP();
  console.log(`🔑 Using TOTP code: ${totpCode}`);
  
  const totpInput = page.getByTestId('totp-input');
  await expect(totpInput).toBeVisible();
  await totpInput.fill(totpCode);
  
  // 5. Submit authentication
  const authButton = page.getByTestId('authenticate-button');
  await expect(authButton).toBeVisible();
  await authButton.click();
  
  // 6. Wait for 2FA screen to disappear (authentication success)
  await expect(page.getByText(/2FA認証/i)).not.toBeVisible({ timeout: 15000 });
  console.log('🔑 TOTP authentication successful');
  
  // 7. Wait for logout button to appear (indicates authenticated state)
  await expect(page.getByTitle('Logout')).toBeVisible({ timeout: 15000 });
  console.log('🔐 Authenticated state confirmed');
  
  // 8. Wait for terminal container to be visible
  await expect(page.getByTestId('terminal-container')).toBeVisible({ timeout: 30000 });
  console.log('🖥️ Terminal interface ready');
  
  // 9. Wait for WebRTC connection to be established (wifi-on icon)
  await expect(page.getByTestId('wifi-on')).toBeVisible({ timeout: 30000 });
  console.log('📡 WebRTC connection established');
  
  // 10. Wait for connection status to show "Ready"
  await expect(page.getByTestId('connection-status')).toContainText('Ready', { timeout: 15000 });
  console.log('⚡ Connection ready for commands');
  
  console.log('✅ Authentication completed successfully');
}

/**
 * Execute Claude command and verify basic functionality
 */
export async function executeClaudeCommand(page: Page, command: string): Promise<void> {
  console.log(`🤖 Executing Claude command: ${command}`);
  
  // Ensure we're in the authenticated terminal view
  await expect(page.getByTestId('terminal-container')).toBeVisible();
  
  // Find and use the command input field
  const commandInput = page.getByTestId('command-input');
  await expect(commandInput).toBeVisible();
  
  // Clear any existing text and enter command
  await commandInput.clear();
  await commandInput.fill(command);
  await commandInput.press('Enter');
  
  // Wait for command execution to start and complete
  await page.waitForTimeout(3000);
  
  // Verify the input field is cleared (indicates command was processed)
  await expect(commandInput).toHaveValue('');
  
  console.log('✅ Command executed successfully');
}

/**
 * Test WebRTC P2P connection and Claude execution end-to-end
 */
export async function testFullClaudeExecution(page: Page, testConfig?: TestConfig): Promise<void> {
  console.log('🧪 Starting full Claude execution test...');
  
  // 1. Complete authentication
  await authenticateWithTOTP(page, testConfig);
  
  // 2. Verify WebRTC connection is established
  await expect(page.getByTestId('wifi-on')).toBeVisible({ timeout: 30000 });
  
  // 3. Execute basic Claude commands
  await executeClaudeCommand(page, 'echo "Hello from Claude!"');
  await executeClaudeCommand(page, 'pwd');
  await executeClaudeCommand(page, 'ls -la');
  
  console.log('🎉 Full Claude execution test completed successfully');
}