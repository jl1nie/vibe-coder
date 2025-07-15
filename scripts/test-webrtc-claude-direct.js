#!/usr/bin/env node

/**
 * WebRTC P2P直接接続 + Claude実行統合テスト
 * PWA GUI不使用、シグナリングサーバ経由でホストサーバと直接P2P接続確立
 */

const WebSocket = require('ws');
const fetch = require('node-fetch');
const speakeasy = require('speakeasy');

// Node.js用WebRTCライブラリ
let wrtc;
try {
  wrtc = require('wrtc');
} catch (error) {
  console.log('⚠️ wrtc library not found. Installing...');
  console.log('Run: npm install wrtc');
  process.exit(1);
}

// 設定
const CONFIG = {
  hostUrl: 'http://localhost:8080',
  signalingUrl: 'ws://localhost:5175',
  hostId: '27539093',
  totpSecret: 'J5SFCVC5ENUUENCMLVESKR2TOYTEUWSRJMUG4KDLPNRUGZDLLAWA'
};

class WebRTCClaudeTest {
  constructor() {
    this.sessionId = null;
    this.jwt = null;
    this.ws = null;
    this.peerConnection = null;
    this.dataChannel = null;
  }

  log(message, ...args) {
    console.log(`[${new Date().toISOString()}] ${message}`, ...args);
  }

  error(message, ...args) {
    console.error(`[${new Date().toISOString()}] ❌ ${message}`, ...args);
  }

  success(message, ...args) {
    console.log(`[${new Date().toISOString()}] ✅ ${message}`, ...args);
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

  // 1. ホストサーバーからセッション作成
  async createSession() {
    this.log('🚀 Creating session with host server...');
    
    try {
      const response = await fetch(`${CONFIG.hostUrl}/api/auth/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: CONFIG.hostId })
      });

      if (!response.ok) {
        throw new Error(`Session creation failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.sessionId = data.sessionId;
      this.success(`Session created: ${this.sessionId}`);
      return data;
    } catch (error) {
      this.error('Failed to create session:', error.message);
      throw error;
    }
  }

  // 2. TOTP認証実行
  async authenticateWithTOTP() {
    this.log('🔐 Authenticating with TOTP...');
    
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
        throw new Error(`TOTP authentication failed: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      this.jwt = data.token;
      this.success('TOTP authentication successful');
      return data;
    } catch (error) {
      this.error('TOTP authentication failed:', error.message);
      throw error;
    }
  }

  // 3. WebSocketシグナリング接続
  async connectSignaling() {
    return new Promise((resolve, reject) => {
      this.log('📡 Connecting to WebSocket signaling server...');
      
      this.ws = new WebSocket(CONFIG.signalingUrl);

      this.ws.on('open', () => {
        this.success('WebSocket signaling connected');
        resolve();
      });

      this.ws.on('error', (error) => {
        this.error('WebSocket signaling error:', error);
        reject(error);
      });

      this.ws.on('message', (data) => {
        this.handleSignalingMessage(JSON.parse(data));
      });
    });
  }

  // 4. WebRTC P2P接続確立
  async establishWebRTCConnection() {
    this.log('🔗 Establishing WebRTC P2P connection...');

    // RTCPeerConnection初期化（Node.js用）
    this.peerConnection = new wrtc.RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // データチャンネル作成
    this.dataChannel = this.peerConnection.createDataChannel('claude-commands', {
      ordered: true
    });

    this.dataChannel.onopen = () => {
      this.success('WebRTC Data Channel opened');
    };

    this.dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data);
    };

    this.dataChannel.onerror = (error) => {
      this.error('Data Channel error:', error);
    };

    // ICE候補送信
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
          sessionId: this.sessionId
        });
      }
    };

    // Offer作成・送信
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.sendSignalingMessage({
      type: 'offer',
      offer: offer,
      sessionId: this.sessionId,
      jwt: this.jwt
    });

    this.log('WebRTC offer sent to host');
  }

  // シグナリングメッセージ処理
  handleSignalingMessage(message) {
    this.log('📨 Received signaling message:', message.type);

    switch (message.type) {
      case 'answer':
        this.peerConnection.setRemoteDescription(new wrtc.RTCSessionDescription(message.answer));
        this.success('WebRTC answer received and applied');
        break;
      
      case 'ice-candidate':
        this.peerConnection.addIceCandidate(new wrtc.RTCIceCandidate(message.candidate));
        break;
      
      case 'error':
        this.error('Signaling error:', message.error);
        break;
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
      this.log('📦 Received data channel message:', message.type);

      switch (message.type) {
        case 'output':
          console.log('📤 Claude Output:', message.data);
          break;
        case 'error':
          console.log('⚠️ Claude Error:', message.data);
          break;
        case 'completed':
          console.log('🏁 Claude Command Completed');
          break;
      }
    } catch (error) {
      this.log('📥 Raw data channel message:', data);
    }
  }

  // 5. Claude実行コマンド送信
  async executeClaudeCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
        reject(new Error('Data channel not ready'));
        return;
      }

      this.log(`🤖 Executing Claude command: ${command}`);

      const message = {
        type: 'execute',
        command: command,
        timestamp: Date.now()
      };

      this.dataChannel.send(JSON.stringify(message));

      // タイムアウト設定
      const timeout = setTimeout(() => {
        reject(new Error('Command execution timeout'));
      }, 30000);

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

  // メインテスト実行
  async runTest() {
    try {
      this.log('🧪 Starting WebRTC Claude Direct Test...');

      // 1. セッション作成
      await this.createSession();

      // 2. TOTP認証
      await this.authenticateWithTOTP();

      // 3. シグナリング接続
      await this.connectSignaling();

      // 4. WebRTC P2P接続確立
      await this.establishWebRTCConnection();

      // 接続完了待機
      await new Promise(resolve => {
        const checkConnection = () => {
          if (this.dataChannel && this.dataChannel.readyState === 'open') {
            resolve();
          } else {
            setTimeout(checkConnection, 1000);
          }
        };
        checkConnection();
      });

      this.success('🎉 WebRTC P2P connection established successfully!');

      // 5. Claude実行テスト
      await this.executeClaudeCommand('echo "Hello from Claude via WebRTC P2P!"');
      await this.executeClaudeCommand('pwd');
      await this.executeClaudeCommand('ls -la');

      this.success('🎉 All Claude commands executed successfully!');

    } catch (error) {
      this.error('Test failed:', error.message);
      process.exit(1);
    } finally {
      // クリーンアップ
      if (this.ws) this.ws.close();
      if (this.peerConnection) this.peerConnection.close();
    }
  }
}

// テスト実行
if (require.main === module) {
  const test = new WebRTCClaudeTest();
  test.runTest();
}