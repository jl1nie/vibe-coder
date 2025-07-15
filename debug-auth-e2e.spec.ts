import { test, expect } from '@playwright/test';
import { generateTestTOTP } from './apps/web/src/__tests__/e2e/test-helpers';

test('debug authentication flow', async ({ page }) => {
  console.log('🔍 Starting debug authentication flow...');
  
  // Navigate to PWA
  await page.goto('http://localhost:5174/');
  await page.waitForLoadState('networkidle');
  
  console.log('1. ✅ Page loaded');
  
  // 1. Click connect to host button
  await expect(page.getByTestId('connect-to-host-button')).toBeVisible();
  await page.getByTestId('connect-to-host-button').click();
  
  console.log('2. ✅ Connect button clicked');

  // 2. Enter Host ID
  await expect(page.getByTestId('host-id-input')).toBeVisible();
  await page.getByTestId('host-id-input').fill('27539093');
  await page.getByTestId('connect-button').click();
  
  console.log('3. ✅ Host ID entered and submitted');

  // 3. Wait for 2FA screen
  await expect(page.getByText(/2FA認証/i)).toBeVisible();
  
  console.log('4. ✅ 2FA screen appeared');
  
  // 4. Generate and enter valid TOTP code
  const totpCode = generateTestTOTP();
  console.log(`5. 🔑 Generated TOTP code: ${totpCode}`);
  
  const totpInput = page.getByTestId('totp-input');
  await expect(totpInput).toBeVisible();
  await totpInput.fill(totpCode);
  
  console.log('6. ✅ TOTP code entered');
  
  // 5. Submit authentication
  const authButton = page.getByTestId('authenticate-button');
  await expect(authButton).toBeVisible();
  await authButton.click();
  
  console.log('7. ✅ Authentication button clicked');
  
  // Wait for some response (either success or error)
  await page.waitForTimeout(5000);
  
  // Check what happened after authentication
  const is2FAVisible = await page.getByText(/2FA認証/i).isVisible().catch(() => false);
  const isLogoutVisible = await page.getByTitle('Logout').isVisible().catch(() => false);
  const isTerminalVisible = await page.getByTestId('terminal-container').isVisible().catch(() => false);
  const isErrorVisible = await page.locator('.text-red-400').isVisible().catch(() => false);
  
  console.log(`8. 📊 Current state:
    - 2FA still visible: ${is2FAVisible}
    - Logout button visible: ${isLogoutVisible}
    - Terminal visible: ${isTerminalVisible}
    - Error visible: ${isErrorVisible}`);
    
  // Take a screenshot for debugging
  await page.screenshot({ path: 'debug-auth-state.png', fullPage: true });
  console.log('9. 📸 Screenshot saved as debug-auth-state.png');
});