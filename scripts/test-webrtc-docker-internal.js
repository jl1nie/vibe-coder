#!/usr/bin/env node

/**
 * Docker内部WebRTC接続テスト
 * Docker network内から直接接続をテストする
 */

const WebSocket = require('ws');
const speakeasy = require('speakeasy');

// Docker内部設定
const CONFIG = {
  // Host Server（Docker内部IP）
  hostUrl: 'http://172.17.0.3:8080',
  hostId: '27539093',
  
  // WebSocketシグナリングサーバー（Docker内部IP）
  signalingUrl: 'ws://172.17.0.2:5175',
  
  // TOTP認証秘密鍵
  totpSecret: 'J5SFCVC5ENUUENCMLVESKR2TOYTEUWSRJMUG4KDLPNRUGZDLLAWA',
};

async function testDockerInternalConnection() {
  console.log('🧪 Testing Docker internal WebRTC connection...');
  
  try {
    // 1. セッション作成テスト
    console.log('📡 Testing host server connection...');
    const response = await fetch(`${CONFIG.hostUrl}/api/health`);
    if (response.ok) {
      const health = await response.json();
      console.log('✅ Host server reachable:', health);
    } else {
      console.log('❌ Host server not reachable');
      return;
    }
    
    // 2. WebSocketシグナリングテスト
    console.log('📡 Testing WebSocket signaling...');
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(CONFIG.signalingUrl);
      
      ws.on('open', () => {
        console.log('✅ WebSocket signaling connected');
        
        // テストメッセージ送信
        ws.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: Date.now()
        }));
        
        setTimeout(() => {
          ws.close();
          resolve();
        }, 2000);
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        console.log('📨 Received:', message.type);
      });
      
      ws.on('error', (error) => {
        console.log('❌ WebSocket error:', error.message);
        reject(error);
      });
      
      setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// 実行
if (require.main === module) {
  testDockerInternalConnection()
    .then(() => {
      console.log('🎉 Docker internal test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Docker internal test failed:', error.message);
      process.exit(1);
    });
}