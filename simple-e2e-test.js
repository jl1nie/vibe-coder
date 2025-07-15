#!/usr/bin/env node

/**
 * Simple E2E test to verify core functionality
 * This tests the basic flow without Playwright overhead
 */

const http = require('http');
const https = require('https');

async function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const requestLib = url.startsWith('https://') ? https : http;
    const req = requestLib.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function testHostServer() {
  console.log('🧪 Testing Host Server...');
  
  try {
    // Test basic host info
    const response = await httpRequest('http://localhost:8080/api/health');
    console.log('✅ Host server health:', response.status === 200 ? 'OK' : 'FAIL');
    
    // Test session creation
    const sessionResp = await httpRequest('http://localhost:8080/api/auth/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId: '12345678' })
    });
    
    if (sessionResp.status === 201 && sessionResp.data.sessionId) {
      console.log('✅ Session creation: OK', sessionResp.data.sessionId);
      return sessionResp.data.sessionId;
    } else {
      console.log('❌ Session creation: FAIL', sessionResp);
      return null;
    }
  } catch (error) {
    console.log('❌ Host server test failed:', error.message);
    return null;
  }
}

async function testSignalingServer() {
  console.log('🧪 Testing Signaling Server...');
  
  try {
    // Test health endpoint
    const healthResp = await httpRequest('http://localhost:5174/api/health');
    console.log('✅ Signaling health:', healthResp.status === 200 ? 'OK' : 'FAIL');
    
    // Test WebRTC session creation
    const sessionResp = await httpRequest('http://localhost:5174/api/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'create-session',
        sessionId: 'test-' + Date.now(),
        hostId: '12345678'
      })
    });
    
    if (sessionResp.status === 200 && sessionResp.data.success) {
      console.log('✅ WebRTC session creation: OK');
      return true;
    } else {
      console.log('❌ WebRTC session creation: FAIL', sessionResp);
      return false;
    }
  } catch (error) {
    console.log('❌ Signaling server test failed:', error.message);
    return false;
  }
}

async function testPWAServing() {
  console.log('🧪 Testing PWA Serving...');
  
  try {
    const response = await httpRequest('http://localhost:5174/');
    const isHtml = typeof response.data === 'string' && 
                   (response.data.includes('<!DOCTYPE html>') || response.data.includes('<!doctype html>'));
    
    if (response.status === 200 && isHtml) {
      console.log('✅ PWA serving: OK');
      return true;
    } else {
      console.log('❌ PWA serving: FAIL - Status:', response.status, 'HTML:', isHtml);
      return false;
    }
  } catch (error) {
    console.log('❌ PWA serving test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Simple E2E Tests...\n');
  
  const hostSessionId = await testHostServer();
  console.log('');
  
  const signalingOk = await testSignalingServer();
  console.log('');
  
  const pwaOk = await testPWAServing();
  console.log('');
  
  // Summary
  console.log('📊 Test Results Summary:');
  console.log('- Host Server:', hostSessionId ? '✅ PASS' : '❌ FAIL');
  console.log('- Signaling Server:', signalingOk ? '✅ PASS' : '❌ FAIL');
  console.log('- PWA Serving:', pwaOk ? '✅ PASS' : '❌ FAIL');
  
  const allPassed = hostSessionId && signalingOk && pwaOk;
  console.log('\n🎯 Overall Result:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
  
  if (allPassed) {
    console.log('\n🎉 Core functionality is working! Ready for full E2E testing.');
  } else {
    console.log('\n⚠️ Issues found. Need to fix before user testing.');
  }
  
  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);