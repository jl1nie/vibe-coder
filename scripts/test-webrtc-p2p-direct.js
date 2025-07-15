#!/usr/bin/env node

/**
 * 緊急P2P WebRTC直接接続テスト（統一アーキテクチャ対応版）
 * PWA GUI不使用、WebSocketシグナリング経由でClaude Code実行まで完全テスト
 * アーキテクチャ更新対応：Native WebRTC + WebSocketサーバー + Host ID固定値対応
 */

const WebSocket = require('ws');
const speakeasy = require('speakeasy');

// Node.js v18+ 内蔵fetch使用、fallback to node-fetch
let fetch;
if (globalThis.fetch) {
  fetch = globalThis.fetch;
} else {
  try {
    const { default: nodeFetch } = require('node-fetch');
    fetch = nodeFetch;
  } catch (error) {
    console.error('❌ fetch not available. Please use Node.js v18+ or install node-fetch');
    process.exit(1);
  }
}

// Node.js用WebRTCライブラリ
let wrtc;
try {
  wrtc = require('@roamhq/wrtc');
} catch (error) {
  console.log('⚠️ wrtc library not found. Installing...');
  console.log('Run: npm install wrtc');
  process.exit(1);
}

// 設定（現在のアーキテクチャに合わせて調整）
const CONFIG = {
  // Host Server（Docker）
  hostUrl: 'http://localhost:8080',
  hostId: '27539093', // HOST_ID.txtから取得
  
  // WebSocketシグナリングサーバー
  signalingUrl: 'ws://localhost:5175', // packages/signaling WebSocketサーバー
  
  // TOTP認証秘密鍵（固定値 - 本番では動的生成）
  totpSecret: 'J5SFCVC5ENUUENCMLVESKR2TOYTEUWSRJMUG4KDLPNRUGZDLLAWA',
  
  // WebRTC設定 (Docker環境用にローカル接続優先)
  iceServers: [],
  
  // Docker network debugging
  dockerHostIp: '172.17.0.3', // vibe-coder-host container IP
  
  // Use localhost for port-mapped Docker containers
  useLocalhostForDocker: true,
  
  // タイムアウト設定
  connectionTimeout: 60000,
  commandTimeout: 120000
};

class DirectWebRTCTest {
  constructor() {
    this.sessionId = null;
    this.jwt = null;
    this.ws = null;
    this.peerConnection = null;
    this.dataChannel = null;
    this.connectionState = 'disconnected';
    this.testResults = [];
  }

  log(message, ...args) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, ...args);
  }

  error(message, ...args) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ ${message}`, ...args);
  }

  success(message, ...args) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ✅ ${message}`, ...args);
  }

  warn(message, ...args) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] ⚠️ ${message}`, ...args);
  }

  // テスト結果記録
  recordTest(testName, status, details = {}) {
    this.testResults.push({
      test: testName,
      status,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // TOTP認証コード生成
  generateTOTP() {
    return speakeasy.totp({
      secret: CONFIG.totpSecret,
      encoding: 'base32',
      time: Date.now() / 1000,
      step: 30,
      window: 2
    });
  }

  // 1. ホストサーバー接続・セッション作成
  async createSession() {
    this.log('🚀 Step 1: Creating session with host server...');
    
    try {
      const response = await fetch(`${CONFIG.hostUrl}/api/auth/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: CONFIG.hostId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      this.sessionId = data.sessionId;
      this.success(`Session created: ${this.sessionId}`);
      this.recordTest('session_creation', 'success', { sessionId: this.sessionId });
      return data;
    } catch (error) {
      this.error('Failed to create session:', error.message);
      this.recordTest('session_creation', 'failed', { error: error.message });
      throw error;
    }
  }

  // 2. TOTP認証実行
  async authenticateWithTOTP() {
    this.log('🔐 Step 2: Authenticating with TOTP...');
    
    const totpCode = this.generateTOTP();
    this.log(`Generated TOTP code: ${totpCode}`);

    try {
      const response = await fetch(`${CONFIG.hostUrl}/api/auth/sessions/${this.sessionId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totpCode })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      this.jwt = data.token;
      this.success('TOTP authentication successful');
      this.recordTest('totp_authentication', 'success', { hasToken: !!this.jwt });
      return data;
    } catch (error) {
      this.error('TOTP authentication failed:', error.message);
      this.recordTest('totp_authentication', 'failed', { error: error.message });
      throw error;
    }
  }

  // 3. WebSocketシグナリング接続
  async connectSignaling() {
    return new Promise((resolve, reject) => {
      this.log('📡 Step 3: Connecting to WebSocket signaling server...');
      
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, CONFIG.connectionTimeout);

      this.ws = new WebSocket(CONFIG.signalingUrl);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.success('WebSocket signaling connected');
        this.recordTest('websocket_connection', 'success', { url: CONFIG.signalingUrl });
        resolve();
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        this.error('WebSocket signaling error:', error.message);
        this.recordTest('websocket_connection', 'failed', { error: error.message });
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        this.warn('WebSocket signaling closed:', code, reason.toString());
      });

      this.ws.on('message', (data) => {
        try {
          const rawMessage = data.toString();
          this.log('🔍 Raw message received:', rawMessage.substring(0, 200) + (rawMessage.length > 200 ? '...' : ''));
          const message = JSON.parse(rawMessage);
          this.handleSignalingMessage(message);
        } catch (parseError) {
          this.error('Invalid signaling message format:', parseError.message);
        }
      });
    });
  }

  // 4. WebRTC P2P接続確立
  async establishWebRTCConnection() {
    this.log('🔗 Step 4: Establishing WebRTC P2P connection...');

    try {
      // Native WebRTC PeerConnection初期化
      this.peerConnection = new wrtc.RTCPeerConnection({
        iceServers: CONFIG.iceServers,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all', // 'relay' for TURN only, 'all' for all candidates
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require'
      });

      // データチャンネル作成（クライアント側）
      this.dataChannel = this.peerConnection.createDataChannel('claude-commands', {
        ordered: true
      });

      this.setupDataChannelHandlers();
      this.setupPeerConnectionHandlers();

      // セッションに参加
      this.sendSignalingMessage({
        type: 'join-session',
        sessionId: this.sessionId,
        clientId: `test-client-${Date.now()}`,
        jwt: this.jwt,
        timestamp: Date.now()
      });

      // 少し待機してからOfferを送信
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Offer作成・送信
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.sendSignalingMessage({
        type: 'offer',
        offer: offer,
        sessionId: this.sessionId,
        clientId: `test-client-${Date.now()}`,
        jwt: this.jwt,
        timestamp: Date.now()
      });

      this.log('WebRTC offer sent, waiting for answer...');
      this.recordTest('webrtc_offer_sent', 'success', { offerType: offer.type });

    } catch (error) {
      this.error('Failed to establish WebRTC connection:', error.message);
      this.recordTest('webrtc_connection_setup', 'failed', { error: error.message });
      throw error;
    }
  }

  // データチャンネルイベントハンドラー設定
  setupDataChannelHandlers() {
    this.dataChannel.onopen = () => {
      this.success('WebRTC Data Channel opened');
      this.connectionState = 'connected';
      this.recordTest('data_channel_open', 'success');
      
      // 接続確立後すぐにping送信
      this.sendPing();
    };

    this.dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data);
    };

    this.dataChannel.onerror = (error) => {
      this.error('Data Channel error:', error);
      this.recordTest('data_channel_error', 'failed', { error: error.message });
    };

    this.dataChannel.onclose = () => {
      this.warn('Data Channel closed');
      this.connectionState = 'disconnected';
    };
  }

  // PeerConnectionイベントハンドラー設定
  setupPeerConnectionHandlers() {
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // @roamhq/wrtc では toJSON() が利用可能
        this.sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
          sessionId: this.sessionId,
          clientId: `test-client-${Date.now()}`,
          timestamp: Date.now()
        });
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      this.log('🧊 ICE connection state:', this.peerConnection.iceConnectionState);
      
      if (this.peerConnection.iceConnectionState === 'connected' || 
          this.peerConnection.iceConnectionState === 'completed') {
        this.success('🎉 WebRTC P2P connection established!');
        this.recordTest('ice_connection_established', 'success', {
          state: this.peerConnection.iceConnectionState
        });
      } else if (this.peerConnection.iceConnectionState === 'failed') {
        this.error('❌ ICE connection failed');
        this.logConnectionDetails();
        this.recordTest('ice_connection_failed', 'failed', {
          state: this.peerConnection.iceConnectionState
        });
      } else if (this.peerConnection.iceConnectionState === 'checking') {
        this.log('🔍 ICE connectivity checks in progress...');
        // Docker環境では時間がかかることがあるため、詳細ログ
        setTimeout(() => {
          if (this.peerConnection.iceConnectionState === 'checking') {
            this.warn('⚠️ ICE still checking after 10s - may indicate network issues');
            this.logConnectionDetails();
          }
        }, 10000);
      } else if (this.peerConnection.iceConnectionState === 'disconnected') {
        this.warn('⚠️ ICE connection disconnected');
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      this.log('Connection state:', this.peerConnection.connectionState);
    };
  }

  // シグナリングメッセージ処理
  handleSignalingMessage(message) {
    this.log('📨 Received signaling message:', message.type);

    switch (message.type) {
      case 'answer':
      case 'answer-received':
        this.handleAnswer(message.answer);
        break;
      
      case 'ice-candidate':
      case 'candidate-received':
        this.handleIceCandidate(message.candidate);
        break;
      
      case 'error':
        this.error('Signaling error:', message.error);
        this.recordTest('signaling_error', 'failed', { error: message.error });
        break;

      case 'host-registered':
        this.log('Host registered successfully');
        break;

      default:
        this.log('Unknown signaling message type:', message.type);
    }
  }

  // Answer処理
  async handleAnswer(answer) {
    try {
      await this.peerConnection.setRemoteDescription(new wrtc.RTCSessionDescription(answer));
      this.success('WebRTC answer received and applied');
      this.recordTest('webrtc_answer_processed', 'success');
    } catch (error) {
      this.error('Failed to process answer:', error.message);
      this.recordTest('webrtc_answer_failed', 'failed', { error: error.message });
    }
  }

  // ICE候補処理
  async handleIceCandidate(candidate) {
    try {
      await this.peerConnection.addIceCandidate(new wrtc.RTCIceCandidate(candidate));
      this.log('ICE candidate processed');
    } catch (error) {
      this.error('Failed to process ICE candidate:', error.message);
    }
  }

  // シグナリングメッセージ送信
  sendSignalingMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.error('WebSocket not ready for sending message');
    }
  }

  // データチャンネルメッセージ処理
  handleDataChannelMessage(data) {
    try {
      const message = JSON.parse(data);
      this.log(`📦 Received: ${message.type}`);

      switch (message.type) {
        case 'pong':
          this.success('🏓 Pong received - Data Channel is working!');
          this.recordTest('ping_pong_success', 'success');
          break;
        case 'output':
          console.log('📤 Claude Output:', message.data);
          break;
        case 'error':
          console.log('⚠️ Claude Error:', message.data);
          break;
        case 'completed':
          console.log('🏁 Claude Command Completed');
          this.recordTest('claude_command_completed', 'success');
          break;
        default:
          this.log('📨 Unknown message type:', message.type);
      }
    } catch (error) {
      this.log('📥 Raw message:', data);
    }
  }

  // 5. Claude実行コマンド送信
  async executeClaudeCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
        const error = new Error('Data channel not ready');
        this.recordTest('claude_command_failed', 'failed', { 
          command, 
          error: error.message,
          channelState: this.dataChannel?.readyState 
        });
        reject(error);
        return;
      }

      this.log(`🤖 Executing Claude command: ${command}`);

      const message = {
        type: 'claude-command', // 最新アーキテクチャに合わせてメッセージタイプ調整
        command: command,
        timestamp: Date.now()
      };

      this.dataChannel.send(JSON.stringify(message));
      this.recordTest('claude_command_sent', 'success', { command });

      // タイムアウト設定
      const timeout = setTimeout(() => {
        this.recordTest('claude_command_timeout', 'failed', { command });
        reject(new Error(`Command execution timeout: ${command}`));
      }, CONFIG.commandTimeout);

      // コマンド完了待機
      const originalHandler = this.handleDataChannelMessage.bind(this);
      this.handleDataChannelMessage = (data) => {
        originalHandler(data);
        try {
          const message = JSON.parse(data);
          if (message.type === 'completed') {
            clearTimeout(timeout);
            this.handleDataChannelMessage = originalHandler;
            resolve();
          }
        } catch (e) {
          // Raw messageの場合は無視
        }
      };
    });
  }

  // Ping送信テスト
  sendPing() {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      const pingMessage = {
        type: 'ping',
        timestamp: Date.now()
      };
      this.log('🏓 Sending ping message');
      this.dataChannel.send(JSON.stringify(pingMessage));
    }
  }

  // 接続完了待機（詳細デバッグ付き）
  async waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.error('❌ Connection failed or timeout');
        this.logConnectionDetails();
        reject(new Error('Connection establishment timeout'));
      }, CONFIG.connectionTimeout);

      let checkCount = 0;
      const checkConnection = () => {
        checkCount++;
        const iceState = this.peerConnection?.iceConnectionState;
        const connState = this.peerConnection?.connectionState;
        const dcState = this.dataChannel?.readyState;
        
        this.log(`🔍 Check ${checkCount}: ICE=${iceState}, Conn=${connState}, DC=${dcState}`);
        
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
          clearTimeout(timeout);
          this.success('🎉 WebRTC Data Channel successfully opened!');
          resolve();
        } else if (iceState === 'failed' || connState === 'failed') {
          clearTimeout(timeout);
          this.error('❌ Connection permanently failed');
          this.logConnectionDetails();
          reject(new Error('WebRTC connection failed'));
        } else {
          setTimeout(checkConnection, 2000); // 2秒ごとにチェック
        }
      };
      
      checkConnection();
    });
  }

  // 接続詳細ログ
  logConnectionDetails() {
    if (this.peerConnection) {
      this.log('🔍 Connection Details:', {
        iceConnectionState: this.peerConnection.iceConnectionState,
        connectionState: this.peerConnection.connectionState,
        signalingState: this.peerConnection.signalingState,
        iceGatheringState: this.peerConnection.iceGatheringState
      });
    }
    
    if (this.dataChannel) {
      this.log('📡 Data Channel Details:', {
        readyState: this.dataChannel.readyState,
        label: this.dataChannel.label,
        id: this.dataChannel.id
      });
    }
  }

  // テスト結果サマリー表示
  displayTestSummary() {
    this.log('\n🧪 Test Summary:');
    console.log('=' * 50);
    
    const passedTests = this.testResults.filter(t => t.status === 'success');
    const failedTests = this.testResults.filter(t => t.status === 'failed');
    
    console.log(`✅ Passed: ${passedTests.length}`);
    console.log(`❌ Failed: ${failedTests.length}`);
    console.log(`📊 Total: ${this.testResults.length}`);
    
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(test => {
        console.log(`  - ${test.test}: ${test.details.error || 'Unknown error'}`);
      });
    }
    
    const successRate = (passedTests.length / this.testResults.length * 100).toFixed(1);
    console.log(`\n🎯 Success Rate: ${successRate}%`);
  }

  // メインテスト実行
  async runTest() {
    try {
      this.log('🧪 Starting Direct WebRTC P2P Test (Architecture Update Compatible)...');
      console.log('=' * 70);

      // 1. セッション作成
      await this.createSession();

      // 2. TOTP認証
      await this.authenticateWithTOTP();

      // 3. シグナリング接続
      await this.connectSignaling();

      // 4. WebRTC P2P接続確立
      await this.establishWebRTCConnection();

      // 5. 接続完了待機
      await this.waitForConnection();
      this.success('🎉 WebRTC P2P connection established successfully!');

      // 6. Claude実行テスト（段階的）
      const commands = [
        'echo "Hello from Claude via WebRTC P2P!"',
        'pwd',
        'ls -la',
        'echo "WebRTC P2P connection working perfectly!"'
      ];

      for (const command of commands) {
        await this.executeClaudeCommand(command);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機
      }

      this.success('🎉 All Claude commands executed successfully!');
      this.recordTest('full_integration_test', 'success');

    } catch (error) {
      this.error('Test failed:', error.message);
      this.recordTest('full_integration_test', 'failed', { error: error.message });
      process.exit(1);
    } finally {
      // テスト結果表示
      this.displayTestSummary();
      
      // クリーンアップ
      this.cleanup();
    }
  }

  // リソースクリーンアップ
  cleanup() {
    this.log('🧹 Cleaning up resources...');
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.success('Cleanup completed');
  }
}

// テスト実行
if (require.main === module) {
  const test = new DirectWebRTCTest();
  test.runTest().then(() => {
    console.log('\n🏆 Direct WebRTC P2P Test Completed Successfully!');
    process.exit(0);
  }).catch((error) => {
    console.error('\n💥 Direct WebRTC P2P Test Failed:', error.message);
    process.exit(1);
  });
}

module.exports = DirectWebRTCTest;