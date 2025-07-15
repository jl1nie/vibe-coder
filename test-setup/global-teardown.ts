import { FullConfig } from '@playwright/test';
import fs from 'fs';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up test environment...');

  try {
    // Clean up test configuration file
    if (fs.existsSync('.test-config.json')) {
      fs.unlinkSync('.test-config.json');
      console.log('✅ Test configuration cleaned up');
    }

    // Log test completion
    console.log('🎯 Test environment teardown complete');
  } catch (error) {
    console.error('⚠️ Warning: Teardown cleanup failed:', error);
    // Don't throw error to avoid failing the test suite
  }
}

export default globalTeardown;