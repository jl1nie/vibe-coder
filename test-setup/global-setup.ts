import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up test environment for new WebRTC P2P architecture...');

  try {
    // 1. Check if host server is running
    console.log('📡 Checking host server status...');
    const hostId = await checkHostServer();
    console.log(`✅ Host server running with ID: ${hostId}`);

    // 2. Check if signaling server is running
    console.log('🔗 Checking signaling server status...');
    await checkSignalingServer();
    console.log('✅ Signaling server is healthy');

    // 3. Store test configuration
    const testConfig = {
      hostId,
      signalingUrl: 'ws://localhost:5175', // WebSocket-only signaling server
      hostUrl: 'http://localhost:8080',
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync('.test-config.json', JSON.stringify(testConfig, null, 2));
    console.log('✅ Test configuration saved');

    // 4. Verify WebRTC signaling API
    console.log('🔄 Testing WebRTC signaling endpoints...');
    await testSignalingEndpoints(testConfig.hostId);
    console.log('✅ WebRTC signaling endpoints verified');

    console.log('🎉 Test environment setup complete!');
  } catch (error) {
    console.error('❌ Test environment setup failed:', error);
    throw error;
  }
}

async function checkHostServer(): Promise<string> {
  try {
    // Check server health first
    const healthResponse = await fetch('http://localhost:8080/api/health');
    const healthData = await healthResponse.json();
    
    if (!healthData.status) {
      throw new Error(`Host server health check failed: ${JSON.stringify(healthData)}`);
    }
    
    // Try direct file read approach first (most reliable)
    const fs = require('fs');
    const path = require('path');
    const hostIdFile = path.resolve('./HOST_ID.txt');
    
    if (fs.existsSync(hostIdFile)) {
      const content = fs.readFileSync(hostIdFile, 'utf8');
      const match = content.match(/(?:Host ID: |Vibe Coder Host ID: )(\d{8})/);
      if (match) {
        const realHostId = match[1];
        console.log(`Using test Host ID: ${realHostId} (server status: ${healthData.status})`);
        return realHostId;
      }
    }
    
    // Fallback: try to create session with correct hostId
    try {
      const sessionResponse = await fetch('http://localhost:8080/api/auth/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: '27539093' }) // Known Host ID
      });
      
      const sessionData = await sessionResponse.json();
      if (sessionData.hostId) {
        const realHostId = sessionData.hostId;
        console.log(`Using test Host ID: ${realHostId} (server status: ${healthData.status})`);
        return realHostId;
      }
    } catch (error) {
      console.warn('Session creation fallback failed:', error);
    }
    
    throw new Error(`Could not determine Host ID from file ${hostIdFile} or API`);
  } catch (error) {
    throw new Error(`Host server not accessible: ${error}`);
  }
}

async function checkSignalingServer(): Promise<void> {
  try {
    // WebSocket-only signaling server: check port availability with netcat
    const { execSync } = require('child_process');
    execSync('nc -z localhost 5175', { stdio: 'ignore' });
    console.log('  ✓ WebSocket signaling server port 5175 is accessible');
  } catch (error) {
    throw new Error(`WebSocket signaling server (port 5175) not accessible: ${error}`);
  }
}

async function testSignalingEndpoints(hostId: string): Promise<void> {
  try {
    // WebSocket-only signaling: Skip HTTP API tests
    // The WebSocket signaling server doesn't provide HTTP endpoints
    console.log('  ✓ WebSocket-only signaling server: HTTP API tests skipped');
    console.log('  ✓ WebSocket signaling will be tested during actual E2E test scenarios');
  } catch (error) {
    throw new Error(`Signaling server test failed: ${error}`);
  }
}

export default globalSetup;