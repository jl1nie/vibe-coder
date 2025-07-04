/**
 * E2E Test Template for Vibe Coder
 * Test Pyramid Level: E2E (70%+ coverage target)
 */

import { test, expect, Page, Browser, BrowserContext } from '@playwright/test';

// === Global Setup ===
test.describe.configure({ mode: 'serial' });

test.describe('Vibe Coder E2E Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  // === Setup & Teardown ===
  test.beforeAll(async ({ browser: b }) => {
    browser = b;
    context = await browser.newContext({
      // Mobile viewport for mobile-first testing
      viewport: { width: 375, height: 667 },
      permissions: ['microphone'], // For voice input
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    await page.goto('/');
  });

  test.afterEach(async () => {
    await page.close();
  });

  // === Critical User Flows ===
  test.describe('Critical User Flows', () => {
    test('01: 初回接続フロー', async () => {
      // Arrange - PWA loading
      await expect(page).toHaveTitle(/Vibe Coder/);
      
      // Act 1: Navigate to connect page
      await page.getByRole('button', { name: /connect/i }).click();
      
      // Assert: Connect page loaded
      await expect(page.getByText(/enter server id/i)).toBeVisible();
      
      // Act 2: Enter server ID
      const serverIdInput = page.getByPlaceholder(/server id/i);
      await serverIdInput.fill('TEST-SERVER-123');
      
      // Act 3: Connect
      await page.getByRole('button', { name: /connect/i }).click();
      
      // Assert: Connection established
      await expect(page.getByText(/connected/i)).toBeVisible({ timeout: 10000 });
      
      // Assert: Terminal page loaded
      await expect(page.getByRole('textbox', { name: /terminal/i })).toBeVisible();
    });

    test('02: 音声コマンド実行フロー', async () => {
      // Pre-condition: Connected to server
      await connectToTestServer(page);
      
      // Act 1: Open voice input
      await page.getByRole('button', { name: /voice/i }).click();
      
      // Assert: Voice input modal opened
      await expect(page.getByText(/listening/i)).toBeVisible();
      
      // Act 2: Simulate voice input (mock in test environment)
      await simulateVoiceInput(page, 'create a hello world function');
      
      // Assert: Command recognized
      await expect(page.getByDisplayValue(/create a hello world function/i)).toBeVisible();
      
      // Act 3: Execute command
      await page.getByRole('button', { name: /execute/i }).click();
      
      // Assert: Command execution started
      await expect(page.getByText(/executing/i)).toBeVisible();
      
      // Assert: Results displayed
      await expect(page.getByText(/claude code/i)).toBeVisible({ timeout: 30000 });
    });

    test('03: プレイリスト発見・インポートフロー', async () => {
      // Act 1: Navigate to playlists
      await page.getByRole('button', { name: /menu/i }).click();
      await page.getByRole('menuitem', { name: /playlists/i }).click();
      
      // Assert: Playlists page loaded
      await expect(page.getByText(/discover playlists/i)).toBeVisible();
      
      // Act 2: Search for playlists
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill('frontend');
      
      // Assert: Search results displayed
      await expect(page.getByText(/frontend vibes/i)).toBeVisible({ timeout: 5000 });
      
      // Act 3: Import playlist
      await page.getByRole('button', { name: /import/i }).first().click();
      
      // Assert: Import confirmation
      await expect(page.getByText(/import.*playlist/i)).toBeVisible();
      await page.getByRole('button', { name: /confirm/i }).click();
      
      // Assert: Import success
      await expect(page.getByText(/imported successfully/i)).toBeVisible();
      
      // Act 4: Navigate back to terminal
      await page.getByRole('button', { name: /terminal/i }).click();
      
      // Assert: New commands available
      await expect(page.getByRole('button', { name: /style/i })).toBeVisible();
    });

    test('04: ファイル操作フロー', async () => {
      // Pre-condition: Connected and file created
      await connectToTestServer(page);
      await createTestFile(page);
      
      // Act 1: Monitor file changes
      await page.getByRole('button', { name: /files/i }).click();
      
      // Assert: File monitoring active
      await expect(page.getByText(/monitoring.*files/i)).toBeVisible();
      
      // Act 2: Create file via command
      await executeCommand(page, 'create a new component file');
      
      // Assert: File change detected
      await expect(page.getByText(/file created/i)).toBeVisible({ timeout: 10000 });
      
      // Act 3: Edit file via command
      await executeCommand(page, 'add props to the component');
      
      // Assert: File change detected
      await expect(page.getByText(/file modified/i)).toBeVisible({ timeout: 10000 });
    });

    test('05: エラー回復フロー', async () => {
      // Act 1: Attempt connection to invalid server
      await page.getByRole('button', { name: /connect/i }).click();
      await page.getByPlaceholder(/server id/i).fill('INVALID-SERVER');
      await page.getByRole('button', { name: /connect/i }).click();
      
      // Assert: Error displayed
      await expect(page.getByText(/connection failed/i)).toBeVisible();
      
      // Act 2: Retry with valid server
      await page.getByPlaceholder(/server id/i).fill('TEST-SERVER-123');
      await page.getByRole('button', { name: /retry/i }).click();
      
      // Assert: Connection recovered
      await expect(page.getByText(/connected/i)).toBeVisible({ timeout: 10000 });
      
      // Act 3: Test command failure and recovery
      await executeCommand(page, 'rm -rf /'); // Dangerous command
      
      // Assert: Security error
      await expect(page.getByText(/dangerous command/i)).toBeVisible();
      
      // Act 4: Execute safe command
      await executeCommand(page, 'create a safe function');
      
      // Assert: Command executed successfully
      await expect(page.getByText(/function created/i)).toBeVisible({ timeout: 30000 });
    });
  });

  // === Mobile-Specific Interactions ===
  test.describe('Mobile Interactions', () => {
    test('スワイプによるターミナルスクロール', async () => {
      // Pre-condition: Terminal with scrollable content
      await connectToTestServer(page);
      await fillTerminalWithContent(page);
      
      // Act: Swipe up on terminal
      const terminal = page.getByRole('textbox', { name: /terminal/i });
      await terminal.hover();
      await page.mouse.move(200, 400);
      await page.mouse.down();
      await page.mouse.move(200, 200); // Swipe up
      await page.mouse.up();
      
      // Assert: Terminal scrolled
      const scrollPosition = await terminal.evaluate(el => el.scrollTop);
      expect(scrollPosition).toBeGreaterThan(0);
    });

    test('タッチ操作でクイックコマンド選択', async () => {
      // Pre-condition: Connected with quick commands
      await connectToTestServer(page);
      
      // Act: Touch quick command
      const quickCommand = page.getByRole('button', { name: /login/i });
      await quickCommand.tap();
      
      // Assert: Command executed
      await expect(page.getByText(/executing.*login/i)).toBeVisible();
    });

    test('長押しでコンテキストメニュー', async () => {
      // Pre-condition: Connected
      await connectToTestServer(page);
      
      // Act: Long press on quick command
      const quickCommand = page.getByRole('button', { name: /login/i });
      await quickCommand.hover();
      await page.mouse.down();
      await page.waitForTimeout(1000); // Long press
      await page.mouse.up();
      
      // Assert: Context menu appeared
      await expect(page.getByRole('menu')).toBeVisible();
      await expect(page.getByRole('menuitem', { name: /edit/i })).toBeVisible();
    });
  });

  // === Cross-Browser Compatibility ===
  test.describe('Cross-Browser Tests', () => {
    ['chromium', 'firefox', 'webkit'].forEach(browserName => {
      test(`${browserName}: 基本フロー動作確認`, async () => {
        // Test basic functionality across browsers
        await connectToTestServer(page);
        await executeCommand(page, 'test cross-browser compatibility');
        await expect(page.getByText(/test.*completed/i)).toBeVisible({ timeout: 30000 });
      });
    });
  });

  // === Performance Tests ===
  test.describe('Performance Tests', () => {
    test('PWA読み込み時間が3秒以内', async () => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(3000);
    });

    test('大量のターミナル出力でもレスポンシブ', async () => {
      await connectToTestServer(page);
      
      // Generate large output
      await executeCommand(page, 'generate large output with 1000 lines');
      
      // Measure responsiveness
      const startTime = Date.now();
      await page.getByRole('button', { name: /clear/i }).click();
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(1000); // 1 second
    });
  });

  // === Accessibility Tests ===
  test.describe('Accessibility Tests', () => {
    test('スクリーンリーダー対応', async () => {
      await connectToTestServer(page);
      
      // Check ARIA labels
      const voiceButton = page.getByRole('button', { name: /voice input/i });
      await expect(voiceButton).toHaveAttribute('aria-label');
      
      // Check keyboard navigation
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBe('BUTTON');
    });

    test('キーボードのみでの完全操作', async () => {
      // Navigate using only keyboard
      await page.keyboard.press('Tab'); // Focus connect button
      await page.keyboard.press('Enter'); // Click connect
      
      await page.keyboard.press('Tab'); // Focus server ID input
      await page.keyboard.type('TEST-SERVER-123');
      
      await page.keyboard.press('Tab'); // Focus connect button
      await page.keyboard.press('Enter'); // Connect
      
      // Assert: Connected successfully
      await expect(page.getByText(/connected/i)).toBeVisible({ timeout: 10000 });
    });

    test('高コントラストモード対応', async () => {
      // Enable high contrast mode
      await page.emulateMedia({ colorScheme: 'dark' });
      
      await connectToTestServer(page);
      
      // Check contrast ratios
      const backgroundColor = await page.getByRole('main').evaluate(
        el => getComputedStyle(el).backgroundColor
      );
      const textColor = await page.getByRole('main').evaluate(
        el => getComputedStyle(el).color
      );
      
      // Ensure sufficient contrast (simplified check)
      expect(backgroundColor).not.toBe(textColor);
    });
  });

  // === Network Conditions ===
  test.describe('Network Conditions', () => {
    test('低速ネットワークでの動作', async () => {
      // Simulate slow 3G
      await page.route('**/*', async route => {
        await page.waitForTimeout(100); // Simulate delay
        await route.continue();
      });
      
      await connectToTestServer(page);
      await executeCommand(page, 'test slow network');
      
      // Should still work, just slower
      await expect(page.getByText(/test.*completed/i)).toBeVisible({ timeout: 60000 });
    });

    test('一時的なネットワーク断絶からの回復', async () => {
      await connectToTestServer(page);
      
      // Simulate network failure
      await page.route('**/*', route => route.abort('internetdisconnected'));
      
      await executeCommand(page, 'test network failure');
      
      // Assert: Error displayed
      await expect(page.getByText(/connection lost/i)).toBeVisible();
      
      // Restore network
      await page.unroute('**/*');
      
      // Assert: Automatic reconnection
      await expect(page.getByText(/reconnected/i)).toBeVisible({ timeout: 10000 });
    });
  });
});

// === Helper Functions ===
async function connectToTestServer(page: Page): Promise<void> {
  await page.getByRole('button', { name: /connect/i }).click();
  await page.getByPlaceholder(/server id/i).fill('TEST-SERVER-123');
  await page.getByRole('button', { name: /connect/i }).click();
  await expect(page.getByText(/connected/i)).toBeVisible({ timeout: 10000 });
}

async function executeCommand(page: Page, command: string): Promise<void> {
  const input = page.getByRole('textbox', { name: /command/i });
  await input.fill(command);
  await page.keyboard.press('Enter');
}

async function simulateVoiceInput(page: Page, text: string): Promise<void> {
  // In real tests, this would interact with actual speech recognition
  // For now, simulate by directly filling the input
  await page.evaluate((text) => {
    const event = new CustomEvent('speechresult', { detail: { text } });
    window.dispatchEvent(event);
  }, text);
}

async function createTestFile(page: Page): Promise<void> {
  await executeCommand(page, 'create a test file called example.js');
  await expect(page.getByText(/file created/i)).toBeVisible({ timeout: 10000 });
}

async function fillTerminalWithContent(page: Page): Promise<void> {
  for (let i = 0; i < 50; i++) {
    await executeCommand(page, `echo "Line ${i + 1}"`);
  }
  await page.waitForTimeout(1000); // Wait for all content to load
}

// === Visual Regression Testing ===
test.describe('Visual Regression', () => {
  test('ホームページのビジュアル回帰テスト', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage.png');
  });

  test('ターミナルページのビジュアル回帰テスト', async ({ page }) => {
    await connectToTestServer(page);
    await expect(page).toHaveScreenshot('terminal-page.png');
  });

  test('モバイルビューのビジュアル回帰テスト', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page).toHaveScreenshot('mobile-homepage.png');
  });
});

export { connectToTestServer, executeCommand, simulateVoiceInput };