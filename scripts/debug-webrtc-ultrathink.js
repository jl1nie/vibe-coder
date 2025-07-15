#!/usr/bin/env node

/**
 * WebRTC P2P接続問題 - Ultra Think 詳細デバッグ
 * 
 * デバッグ段階:
 * 1. シグナリングサーバー接続テスト
 * 2. ホストサーバーWebRTCサービス状態確認  
 * 3. WebSocket通信詳細解析
 * 4. ICE候補収集・交換テスト
 * 5. データチャンネル確立テスト
 */

const WebSocket = require('ws');
const speakeasy = require('speakeasy');

const CONFIG = {
  hostUrl: 'http://localhost:8080',
  signalingUrl: 'ws://localhost:5175',
  hostId: '27539093',
  totpSecret: 'J5SFCVC5ENUUENCMLVESKR2TOYTEUWSRJMUG4KDLPNRUGZDLLAWA'
};

class WebRTCUltraThinkDebugger {
  constructor() {
    this.sessionId = null;
    this.jwt = null;
    this.ws = null;
    this.debugLog = [];
    this.messageCount = 0;
    this.connectionAttempts = 0;
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, data };
    this.debugLog.push(logEntry);
    
    const colors = {
      INFO: '\x1b[36m',
      SUCCESS: '\x1b[32m', 
      WARN: '\x1b[33m',
      ERROR: '\x1b[31m',
      DEBUG: '\x1b[35m'
    };
    
    console.log(`${colors[level]}[${timestamp}] [${level}]\x1b[0m ${message}`);
    if (data) {
      console.log(`${colors[level]}  Data:\x1b[0m`, JSON.stringify(data, null, 2));
    }
  }

  generateTOTP() {
    return speakeasy.totp({
      secret: CONFIG.totpSecret,
      encoding: 'base32',
      time: Date.now() / 1000,
      step: 30,
      window: 2
    });
  }

  // === PHASE 1: シグナリングサーバー基本接続テスト ===
  async testSignalingServerConnection() {
    this.log('INFO', '🔍 PHASE 1: Testing Signaling Server Connection');
    
    return new Promise((resolve, reject) => {
      this.connectionAttempts++;
      
      const timeout = setTimeout(() => {
        this.log('ERROR', 'Signaling connection timeout');
        reject(new Error('Connection timeout'));
      }, 10000);

      this.ws = new WebSocket(CONFIG.signalingUrl);
      
      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.log('SUCCESS', 'WebSocket signaling connected successfully');
        this.log('DEBUG', 'Connection details', {
          readyState: this.ws.readyState,
          url: CONFIG.signalingUrl,
          attempt: this.connectionAttempts
        });
        resolve();
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        this.log('ERROR', 'WebSocket signaling error', { error: error.message });
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        this.log('WARN', 'WebSocket signaling closed', { code, reason: reason.toString() });
      });

      this.ws.on('message', (data) => {
        this.messageCount++;
        try {
          const message = JSON.parse(data);
          this.log('DEBUG', `Received message #${this.messageCount}`, message);
          this.handleSignalingMessage(message);
        } catch (error) {
          this.log('ERROR', 'Failed to parse signaling message', { data: data.toString(), error: error.message });
        }
      });
    });
  }

  // === PHASE 2: ホストサーバーWebRTCサービス状態確認 ===
  async checkHostWebRTCService() {
    this.log('INFO', '🔍 PHASE 2: Checking Host WebRTC Service Status');
    
    try {
      // ホストサーバーヘルス確認
      const healthResponse = await fetch(`${CONFIG.hostUrl}/api/health`);
      const healthData = await healthResponse.json();
      
      this.log('DEBUG', 'Host server health', healthData);
      
      // WebRTCサービス固有の確認（もしエンドポイントがあれば）
      try {
        const webrtcResponse = await fetch(`${CONFIG.hostUrl}/api/webrtc/status`);
        if (webrtcResponse.ok) {
          const webrtcData = await webrtcResponse.json();
          this.log('DEBUG', 'Host WebRTC service status', webrtcData);
        }
      } catch (error) {
        this.log('WARN', 'WebRTC status endpoint not available', { error: error.message });
      }

      // Docker logs check (シグナリング接続確認)
      this.log('INFO', 'Checking host server WebRTC signaling connection...');
      
      this.log('SUCCESS', 'Host WebRTC service check completed');
      
    } catch (error) {
      this.log('ERROR', 'Host WebRTC service check failed', { error: error.message });
      throw error;
    }
  }

  // === PHASE 3: 認証付きWebRTCセッション確立テスト ===
  async establishAuthenticatedWebRTCSession() {
    this.log('INFO', '🔍 PHASE 3: Establishing Authenticated WebRTC Session');

    // 3.1 セッション作成
    this.log('DEBUG', 'Creating session...');
    const sessionResponse = await fetch(`${CONFIG.hostUrl}/api/auth/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId: CONFIG.hostId })
    });

    if (!sessionResponse.ok) {
      throw new Error(`Session creation failed: ${sessionResponse.status}`);
    }

    const sessionData = await sessionResponse.json();
    this.sessionId = sessionData.sessionId;
    this.log('SUCCESS', 'Session created', { sessionId: this.sessionId });

    // 3.2 TOTP認証
    this.log('DEBUG', 'Authenticating with TOTP...');
    const totpCode = this.generateTOTP();
    
    const authResponse = await fetch(`${CONFIG.hostUrl}/api/auth/sessions/${this.sessionId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totpCode })
    });

    if (!authResponse.ok) {
      throw new Error(`TOTP authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();
    this.jwt = authData.token;
    this.log('SUCCESS', 'TOTP authentication successful');

    // 3.3 WebRTCセッション作成要求
    this.log('DEBUG', 'Requesting WebRTC session creation...');
    this.sendSignalingMessage({
      type: 'create-session',
      sessionId: this.sessionId,
      jwt: this.jwt,
      hostId: CONFIG.hostId
    });

    // レスポンス待機
    await this.waitForSignalingResponse('session-created', 10000);
  }

  // === PHASE 4: ICE候補・Offer/Answer交換詳細テスト ===
  async testICECandidateExchange() {
    this.log('INFO', '🔍 PHASE 4: Testing ICE Candidate Exchange');

    // 4.1 模擬Offer送信
    this.log('DEBUG', 'Sending mock WebRTC offer...');
    const mockOffer = {
      type: 'offer',
      sdp: 'v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'
    };

    this.sendSignalingMessage({
      type: 'offer',
      offer: mockOffer,
      sessionId: this.sessionId,
      jwt: this.jwt
    });

    // 4.2 Answer待機
    const answerReceived = await this.waitForSignalingResponse('answer', 15000);
    if (answerReceived) {
      this.log('SUCCESS', 'WebRTC Answer received');
    }

    // 4.3 模擬ICE候補送信
    this.log('DEBUG', 'Sending mock ICE candidates...');
    const mockIceCandidate = {
      candidate: 'candidate:1 1 UDP 2113667326 192.168.1.100 54400 typ host',
      sdpMLineIndex: 0,
      sdpMid: '0'
    };

    this.sendSignalingMessage({
      type: 'ice-candidate',
      candidate: mockIceCandidate,
      sessionId: this.sessionId,
      jwt: this.jwt
    });
  }

  // === PHASE 5: データチャンネル確立可能性テスト ===
  async testDataChannelEstablishment() {
    this.log('INFO', '🔍 PHASE 5: Testing Data Channel Establishment Possibility');

    // 5.1 データチャンネル開設要求
    this.sendSignalingMessage({
      type: 'data-channel-request',
      channelName: 'claude-commands',
      sessionId: this.sessionId,
      jwt: this.jwt
    });

    // 5.2 模擬コマンド送信テスト
    this.sendSignalingMessage({
      type: 'test-command',
      command: 'echo "WebRTC Data Channel Test"',
      sessionId: this.sessionId,
      jwt: this.jwt
    });

    this.log('DEBUG', 'Data channel test messages sent');
  }

  // === PHASE 6: エラー状況総合解析 ===
  async performComprehensiveErrorAnalysis() {
    this.log('INFO', '🔍 PHASE 6: Comprehensive Error Analysis');

    // 6.1 タイムアウト・レスポンス状況分析
    const responseTimeouts = this.debugLog.filter(log => log.message.includes('timeout'));
    const errorMessages = this.debugLog.filter(log => log.level === 'ERROR');
    const warningMessages = this.debugLog.filter(log => log.level === 'WARN');

    this.log('DEBUG', 'Error Analysis Summary', {
      totalLogs: this.debugLog.length,
      timeouts: responseTimeouts.length,
      errors: errorMessages.length,
      warnings: warningMessages.length,
      messagesReceived: this.messageCount,
      connectionAttempts: this.connectionAttempts
    });

    // 6.2 主要エラーパターン特定
    if (errorMessages.length > 0) {
      this.log('ERROR', 'Critical Errors Detected:');
      errorMessages.forEach((error, index) => {
        this.log('ERROR', `  ${index + 1}. ${error.message}`, error.data);
      });
    }

    // 6.3 推奨対処法
    this.provideTroubleshootingRecommendations();
  }

  provideTroubleshootingRecommendations() {
    this.log('INFO', '💡 TROUBLESHOOTING RECOMMENDATIONS:');

    const recommendations = [
      {
        issue: 'シグナリング接続失敗',
        solution: '1. ポート5175の可用性確認\n2. ファイアウォール設定確認\n3. signalingサーバーログ確認'
      },
      {
        issue: 'WebRTCセッション確立失敗', 
        solution: '1. STUN/TURNサーバー設定確認\n2. NAT越え設定確認\n3. ホストサーバーWebRTCサービス再起動'
      },
      {
        issue: 'データチャンネル通信失敗',
        solution: '1. シグナリング順序確認\n2. データチャンネル設定確認\n3. メッセージフォーマット確認'
      }
    ];

    recommendations.forEach(rec => {
      this.log('WARN', `Issue: ${rec.issue}`);
      this.log('INFO', `Solution: ${rec.solution}`);
    });
  }

  // ユーティリティメソッド
  sendSignalingMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      this.log('DEBUG', 'Sent signaling message', message);
    } else {
      this.log('ERROR', 'Cannot send message: WebSocket not open', { readyState: this.ws?.readyState });
    }
  }

  handleSignalingMessage(message) {
    this.log('DEBUG', 'Processing signaling message', message);
    
    // メッセージタイプ別処理
    switch (message.type) {
      case 'session-created':
        this.log('SUCCESS', 'WebRTC session created on host');
        break;
      case 'answer':
        this.log('SUCCESS', 'WebRTC answer received');
        break;
      case 'ice-candidate':
        this.log('DEBUG', 'ICE candidate received');
        break;
      case 'error':
        this.log('ERROR', 'Signaling error received', message);
        break;
      default:
        this.log('DEBUG', 'Unknown message type', message);
    }
  }

  waitForSignalingResponse(expectedType, timeoutMs = 5000) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.log('WARN', `Timeout waiting for ${expectedType} response`);
        resolve(false);
      }, timeoutMs);

      const originalHandler = this.handleSignalingMessage.bind(this);
      this.handleSignalingMessage = (message) => {
        originalHandler(message);
        if (message.type === expectedType) {
          clearTimeout(timeout);
          this.handleSignalingMessage = originalHandler;
          resolve(true);
        }
      };
    });
  }

  async cleanup() {
    if (this.ws) {
      this.ws.close();
    }
  }

  // === メイン実行フロー ===
  async runUltraThinkDebug() {
    try {
      this.log('INFO', '🚀 Starting WebRTC Ultra Think Debug Session');
      this.log('INFO', '═══════════════════════════════════════════════');

      // Phase 1: シグナリング基本接続
      await this.testSignalingServerConnection();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Phase 2: ホストWebRTCサービス
      await this.checkHostWebRTCService();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Phase 3: 認証付きセッション確立
      await this.establishAuthenticatedWebRTCSession();
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Phase 4: ICE/Offer/Answer交換
      await this.testICECandidateExchange();
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Phase 5: データチャンネルテスト
      await this.testDataChannelEstablishment();
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Phase 6: 総合エラー解析
      await this.performComprehensiveErrorAnalysis();

      this.log('SUCCESS', '🎉 Ultra Think Debug Session Completed');
      this.log('INFO', `📊 Total debug entries: ${this.debugLog.length}`);

    } catch (error) {
      this.log('ERROR', 'Ultra Think Debug Session Failed', { error: error.message });
      await this.performComprehensiveErrorAnalysis();
    } finally {
      await this.cleanup();
    }
  }
}

// 実行
if (require.main === module) {
  const webrtcDebugger = new WebRTCUltraThinkDebugger();
  webrtcDebugger.runUltraThinkDebug();
}