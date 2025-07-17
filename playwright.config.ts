import { defineConfig, devices } from '@playwright/test';

// New architecture: Signaling server port
const SIGNALING_PORT = process.env.SIGNALING_PORT || 5174;
const HOST_PORT = process.env.HOST_PORT || 8080;

export default defineConfig({
  // Timeout per test (optimized for development vs CI)
  timeout: process.env.CI ? 120 * 1000 : 60 * 1000, // CI: 2分、Local: 1分
  // Global timeout for all tests
  globalTimeout: process.env.CI ? 5 * 60 * 1000 : 4 * 60 * 1000, // CI: 5分、Local: 4分
  // Test directory
  testDir: './apps/web/src/__tests__/e2e',
  // If a test fails, retry it additional 2 times
  retries: 2,
  // Artifacts folder where screenshots, videos, and traces are stored.
  outputDir: 'test-results/',

  // Reporter to use
  reporter: [['list'], ['html']],

  // Global setup for test environment
  globalSetup: require.resolve('./test-setup/global-setup.ts'),
  globalTeardown: require.resolve('./test-setup/global-teardown.ts'),

  // Servers are expected to be already running
  // webServer is commented out since we manually start servers
  /*
  webServer: [
    {
      command: 'cd packages/signaling-ws && pnpm dev',
      url: `http://localhost:${SIGNALING_PORT}`,
      timeout: 60 * 1000,
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'cd packages/host && NODE_ENV=test pnpm start',
      url: `http://localhost:${HOST_PORT}/api/health`,
      timeout: 60 * 1000,
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
  */

  use: {
    // Use signaling server as baseURL
    baseURL: `http://localhost:${SIGNALING_PORT}`,

    // Retry a test if its failing with enabled tracing
    trace: 'retry-with-trace',

    // Enable video recording for debugging
    video: 'retain-on-failure',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Context options for WebRTC testing
    contextOptions: {
      // Safari doesn't support microphone permission in test context
      ignoreHTTPSErrors: true,
    },
  },

  projects: [
    {
      name: 'Desktop Chrome',
      use: { 
        ...devices['Desktop Chrome'],
        // Chrome-specific flags for WebRTC testing
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
        // Chrome-specific context options
        contextOptions: {
          permissions: ['microphone'], // For voice recognition tests
        },
      },
    },
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        // Mobile-specific settings
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
          ],
        },
        // Mobile Chrome-specific context options
        contextOptions: {
          permissions: ['microphone'], // For voice recognition tests
        },
      },
    },
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        // Safari may have different WebRTC behavior
      },
    },
    {
      name: 'Tablet iPad',
      use: { 
        ...devices['iPad Pro'],
      },
    },
  ],
});