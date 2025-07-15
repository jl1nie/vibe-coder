#!/usr/bin/env node

/**
 * Claude実行REST API統合テスト
 * WebRTC不使用、直接REST API経由でホストサーバのClaude実行をテスト
 */

const speakeasy = require('speakeasy');
// Node.js 18以降では fetch は組み込まれています

// 設定
const CONFIG = {
  hostUrl: 'http://localhost:8080',
  hostId: '27539093',
  totpSecret: 'J5SFCVC5ENUUENCMLVESKR2TOYTEUWSRJMUG4KDLPNRUGZDLLAWA'
};

class ClaudeRestApiTest {
  constructor() {
    this.sessionId = null;
    this.jwt = null;
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

  // 1. ホストサーバーヘルスチェック
  async checkHostHealth() {
    this.log('🏥 Checking host server health...');
    
    try {
      const response = await fetch(`${CONFIG.hostUrl}/api/health`);
      
      // 503でもJSONレスポンスがある場合は処理を続行
      const data = await response.json();
      
      if (data.status === 'healthy' || data.status === 'degraded') {
        this.success('Host server is running:', data);
        if (data.status === 'degraded') {
          this.log('⚠️ Server is in degraded state, but continuing test...');
        }
        if (!data.claude?.available) {
          this.log('⚠️ Claude is not available, but continuing test...');
        }
        return data;
      } else {
        throw new Error(`Unexpected health status: ${data.status}`);
      }
    } catch (error) {
      this.error('Host health check failed:', error.message);
      throw error;
    }
  }

  // 2. セッション作成
  async createSession() {
    this.log('🚀 Creating session with host server...');
    
    try {
      const response = await fetch(`${CONFIG.hostUrl}/api/auth/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: CONFIG.hostId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Session creation failed: ${response.status} ${response.statusText} - ${errorText}`);
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

  // 3. TOTP認証実行
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
      this.log('JWT token obtained');
      return data;
    } catch (error) {
      this.error('TOTP authentication failed:', error.message);
      throw error;
    }
  }

  // 4. Claude実行コマンド送信（REST API経由）
  async executeClaudeCommand(command) {
    this.log(`🤖 Executing Claude command via REST API: ${command}`);

    try {
      const response = await fetch(`${CONFIG.hostUrl}/api/claude/execute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.jwt}`
        },
        body: JSON.stringify({ command })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Claude execution failed: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      this.success(`Command executed successfully:`, data);
      return data;
    } catch (error) {
      this.error(`Claude command execution failed:`, error.message);
      throw error;
    }
  }

  // 5. セッション情報確認
  async getSessionInfo() {
    this.log('📊 Getting session info...');

    try {
      const response = await fetch(`${CONFIG.hostUrl}/api/auth/sessions/${this.sessionId}`, {
        headers: { 
          'Authorization': `Bearer ${this.jwt}`
        }
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Session info failed: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      this.success('Session info:', data);
      return data;
    } catch (error) {
      this.error('Session info failed:', error.message);
      throw error;
    }
  }

  // メインテスト実行
  async runTest() {
    try {
      this.log('🧪 Starting Claude REST API Test...');

      // 1. ヘルスチェック
      await this.checkHostHealth();

      // 2. セッション作成
      await this.createSession();

      // 3. TOTP認証
      await this.authenticateWithTOTP();

      // 4. セッション情報確認（スキップ - エンドポイント不存在）
      // await this.getSessionInfo();

      // 5. Claude実行テスト（複数コマンド）
      const commands = [
        'echo "Hello from Claude via REST API!"',
        'pwd',
        'ls -la',
        'echo "Testing Claude Code integration"'
      ];

      for (const command of commands) {
        await this.executeClaudeCommand(command);
        // 少し間隔を空ける
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.success('🎉 All Claude commands executed successfully via REST API!');

    } catch (error) {
      this.error('Test failed:', error.message);
      process.exit(1);
    }
  }
}

// テスト実行
if (require.main === module) {
  const test = new ClaudeRestApiTest();
  test.runTest();
}