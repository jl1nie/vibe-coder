import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeInteractiveService } from '../services/claude-interactive-service';

describe('Claude Interactive Service', () => {
  let service: ClaudeInteractiveService;
  
  beforeEach(() => {
    service = new ClaudeInteractiveService();
  });

  afterEach(() => {
    service.destroy();
  });

  it('should create Claude interactive session', async () => {
    const session = await service.createSession('test-session');
    
    expect(session).toBeDefined();
    expect(session.sessionId).toBe('test-session');
    expect(session.process).toBeDefined();
    expect(session.isReady).toBe(false);
    expect(session.isDestroyed).toBe(false);
  });

  it('should not create duplicate sessions', async () => {
    await service.createSession('test-session');
    
    await expect(service.createSession('test-session')).rejects.toThrow('Session test-session already exists');
  });

  it('should get existing session', async () => {
    await service.createSession('test-session');
    
    const session = service.getSession('test-session');
    expect(session).toBeDefined();
    expect(session?.sessionId).toBe('test-session');
  });

  it('should destroy session', async () => {
    await service.createSession('test-session');
    
    service.destroySession('test-session');
    
    const session = service.getSession('test-session');
    expect(session).toBeUndefined();
  });

  it('should handle session cleanup', async () => {
    await service.createSession('test-session');
    
    // スパイで lastActivity を過去に設定
    const session = service.getSession('test-session');
    if (session) {
      session.lastActivity = new Date(Date.now() - 40 * 60 * 1000); // 40分前
    }
    
    service.cleanupInactiveSessions();
    
    const cleanedSession = service.getSession('test-session');
    expect(cleanedSession).toBeUndefined();
  });

  it('should reject commands for non-existent session', async () => {
    await expect(service.sendCommand('non-existent', 'test command')).rejects.toThrow('Session non-existent not found');
  });

  it('should validate commands before sending', async () => {
    const session = await service.createSession('test-session');
    
    // セッションを手動でreadyに設定
    session.isReady = true;
    
    const result = await service.sendCommand('test-session', 'rm -rf /');
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('dangerous patterns');
  });
});

// Real integration test (only run if Claude is available)
describe('Claude Interactive Integration (Real)', () => {
  let service: ClaudeInteractiveService;
  
  beforeEach(() => {
    service = new ClaudeInteractiveService();
  });

  afterEach(() => {
    service.destroy();
  });

  it('should create real Claude session and handle commands', async () => {
    const session = await service.createSession('real-test');
    
    // セッションがreadyになるまで待機
    await new Promise<void>((resolve) => {
      session.onReady = resolve;
      
      // 10秒でタイムアウト
      setTimeout(() => {
        resolve();
      }, 10000);
    });
    
    if (!session.isReady) {
      console.log('Claude session not ready, skipping test');
      return;
    }
    
    // 簡単なコマンドを送信
    const result = await service.sendCommand('real-test', '/help');
    
    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    expect(result.executionTime).toBeGreaterThan(0);
  }, 30000); // 30秒タイムアウト

  it('should handle interactive prompts', async () => {
    const session = await service.createSession('prompt-test');
    
    // セッションがreadyになるまで待機
    await new Promise<void>((resolve) => {
      session.onReady = resolve;
      setTimeout(() => resolve(), 10000);
    });
    
    if (!session.isReady) {
      console.log('Claude session not ready, skipping test');
      return;
    }
    
    // プロンプトを送信
    const result = await service.sendCommand('prompt-test', 'what is 2+2?');
    
    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    expect(result.output.length).toBeGreaterThan(0);
  }, 30000);
});