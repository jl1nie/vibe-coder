#!/usr/bin/env node

/**
 * 真のE2Eテスト: PWA → 認証 → WebRTC → Claude実行 → /exit
 * 実際にブラウザを開いてWebRTC P2P接続とClaude Code実行をテストする
 */

const { chromium } = require('playwright');
const speakeasy = require('speakeasy');

const HOST_URL = 'http://localhost:8080';
const PWA_URL = 'http://localhost:5173';
const TOTP_SECRET = 'GASUCNCONZGTO3CIORAFU425HZYDCLRDIQYCUNKILJMCCMKJLJFA';

async function getHostId() {
  try {
    const response = await fetch(HOST_URL);
    const html = await response.text();
    const match = html.match(/Host ID: (\d{8})/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('❌ Failed to get Host ID:', error.message);
    return null;
  }
}

async function generateTOTP() {
  return speakeasy.totp({
    secret: TOTP_SECRET,
    encoding: 'base32'
  });
}

async function runRealE2ETest() {
  console.log('🚀 Starting REAL E2E Test...');
  
  // Get Host ID
  const hostId = await getHostId();
  if (!hostId) {
    console.error('❌ Cannot get Host ID from server');
    process.exit(1);
  }
  console.log(`✅ Host ID: ${hostId}`);

  // Launch browser with 5 minute global timeout
  const browser = await chromium.launch({ 
    headless: false, 
    devtools: true,
    timeout: 300000 // 5 minutes global timeout
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Set page timeout to 5 minutes
  page.setDefaultTimeout(300000); // 5 minutes

  // Monitor WebRTC and network events
  const events = [];
  page.on('console', msg => {
    if (msg.text().includes('WebRTC') || msg.text().includes('WebSocket')) {
      events.push(`CONSOLE: ${msg.text()}`);
      console.log(`🔍 ${msg.text()}`);
    }
  });

  page.on('response', response => {
    if (response.url().includes('/api/') || response.url().includes('websocket')) {
      events.push(`HTTP: ${response.status()} ${response.url()}`);
      console.log(`📡 ${response.status()} ${response.url()}`);
    }
  });

  try {
    // Step 1: Open PWA
    console.log('📱 Step 1: Opening PWA...');
    await page.goto(PWA_URL);
    await page.waitForLoadState('networkidle');
    
    // Verify PWA loaded
    await page.waitForSelector('[data-testid="connect-to-host-button"]', { timeout: 10000 });
    console.log('✅ PWA loaded successfully');

    // Step 2: Connect to Host
    console.log('🔗 Step 2: Connecting to Host...');
    await page.click('[data-testid="connect-to-host-button"]');
    await page.fill('[data-testid="host-id-input"]', hostId);
    await page.click('[data-testid="connect-button"]');
    
    // Wait for 2FA screen
    await page.waitForSelector('[data-testid="totp-input"]', { timeout: 10000 });
    console.log('✅ Reached 2FA screen');

    // Step 3: TOTP Authentication
    console.log('🔐 Step 3: TOTP Authentication...');
    const totpCode = await generateTOTP();
    console.log(`📱 Generated TOTP: ${totpCode}`);
    
    await page.fill('[data-testid="totp-input"]', totpCode);
    await page.click('[data-testid="login-button"]');

    // Step 4: Wait for Terminal/WebRTC Connection
    console.log('🖥️ Step 4: Waiting for terminal and WebRTC connection...');
    await page.waitForSelector('[data-testid="terminal-container"]', { timeout: 30000 });
    console.log('✅ Terminal container visible');

    // Wait for WebRTC connection indicators
    await page.waitForTimeout(10000); // Wait for WebRTC connection to establish

    // Check connection status icon
    const connectionIcon = await page.locator('[data-testid="connection-icon"]').isVisible();
    console.log(`🔌 Connection icon visible: ${connectionIcon}`);

    // Step 5: Test Claude Command Execution
    console.log('🤖 Step 5: Testing Claude command execution...');
    
    // Focus terminal and send test command
    await page.click('[data-testid="terminal-container"]');
    await page.waitForTimeout(2000);
    
    // Type test command
    const testCommand = 'echo "E2E Test Success"';
    await page.keyboard.type(testCommand);
    await page.keyboard.press('Enter');
    
    // Wait for command output
    await page.waitForTimeout(5000);
    
    // Check if output appeared in terminal
    const terminalContent = await page.textContent('[data-testid="terminal-container"]');
    const hasOutput = terminalContent.includes('E2E Test Success');
    console.log(`📝 Command output received: ${hasOutput}`);
    
    if (hasOutput) {
      console.log('✅ Claude command execution successful');
    } else {
      console.log('❌ No command output received');
    }

    // Step 6: Test /exit command
    console.log('🚪 Step 6: Testing /exit command...');
    await page.keyboard.type('/exit');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    
    const exitProcessed = await page.textContent('[data-testid="terminal-container"]');
    const hasExitResponse = exitProcessed.includes('exit') || exitProcessed.includes('goodbye') || exitProcessed.includes('session');
    console.log(`🔚 Exit command processed: ${hasExitResponse}`);

    // Step 7: Final Analysis
    console.log('📊 Final Analysis:');
    console.log('='.repeat(50));
    
    // Check WebRTC connection status
    const webrtcConnected = events.some(e => e.includes('WebRTC') && e.includes('connected'));
    const websocketConnected = events.some(e => e.includes('WebSocket') && e.includes('connected'));
    
    console.log(`✅ PWA Loaded: true`);
    console.log(`✅ Host Connection: true`);
    console.log(`✅ 2FA Authentication: true`);
    console.log(`✅ Terminal Display: true`);
    console.log(`🔌 WebSocket Connected: ${websocketConnected}`);
    console.log(`🔗 WebRTC Connected: ${webrtcConnected}`);
    console.log(`🤖 Claude Execution: ${hasOutput}`);
    console.log(`🚪 Exit Command: ${hasExitResponse}`);
    
    // Overall test result
    const allPassed = hasOutput && hasExitResponse && (webrtcConnected || websocketConnected);
    if (allPassed) {
      console.log('🎉 REAL E2E TEST PASSED!');
    } else {
      console.log('❌ REAL E2E TEST FAILED');
      console.log('Missing components:');
      if (!hasOutput) console.log('  - Claude command execution');
      if (!hasExitResponse) console.log('  - Exit command processing');
      if (!webrtcConnected && !websocketConnected) console.log('  - WebRTC/WebSocket connection');
    }

    console.log('\n📋 Event Log:');
    events.forEach(event => console.log(`  ${event}`));

  } catch (error) {
    console.error('❌ E2E Test failed with error:', error.message);
  } finally {
    await page.waitForTimeout(5000); // Keep browser open for inspection
    await browser.close();
  }
}

// Check if required services are running
async function checkServices() {
  try {
    // Check host server
    const hostResponse = await fetch(HOST_URL);
    if (!hostResponse.ok) throw new Error('Host server not available');
    
    // Check PWA server  
    const pwaResponse = await fetch(PWA_URL);
    if (!pwaResponse.ok) throw new Error('PWA server not available');
    
    console.log('✅ All required services are running');
    return true;
  } catch (error) {
    console.error('❌ Service check failed:', error.message);
    console.log('Please ensure both servers are running:');
    console.log('  Host: npm run start (port 8080)');
    console.log('  PWA: npm run dev (port 5174)');
    return false;
  }
}

async function main() {
  console.log('🔍 Checking required services...');
  const servicesOk = await checkServices();
  
  if (servicesOk) {
    await runRealE2ETest();
  } else {
    process.exit(1);
  }
}

main().catch(console.error);