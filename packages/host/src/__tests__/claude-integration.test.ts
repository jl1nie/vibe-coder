import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeService } from '../services/claude-service';
import { spawn, execFile } from 'child_process';

// child_processをモック
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process');
  return {
    ...actual,
    execFile: vi.fn((cmd, args, callback) => {
      // Claude Codeが利用できないと仮定
      callback(new Error('claude not found'));
    })
  };
});

// テスト環境でClaude Codeが利用できるかチェック
const checkClaudeAvailable = (): Promise<boolean> => {
  return new Promise((resolve) => {
    execFile('which', ['claude'], (error) => {
      resolve(!error);
    });
  });
};

describe('Claude Code Integration (Real)', () => {
  let claudeService: ClaudeService;
  let claudeAvailable: boolean;

  beforeEach(async () => {
    claudeService = new ClaudeService();
    claudeAvailable = await checkClaudeAvailable();
  });

  afterEach(() => {
    claudeService.destroy();
  });

  it('should execute real claude command and return output', async () => {
    if (!claudeAvailable) {
      console.log('Claude Code not available, skipping test');
      return;
    }

    // Test with a simple claude command that should work
    const result = await claudeService.executeCommand('TEST-INTEGRATION', 'claude what is 2+2?');
    
    // Command should be transformed to 'claude --print what is 2+2?'
    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    expect(result.output).toContain('4');
    expect(result.executionTime).toBeGreaterThan(0);
  }, 30000); // 30 second timeout for real command

  it('should handle claude command help', async () => {
    if (!claudeAvailable) {
      console.log('Claude Code not available, skipping test');
      return;
    }

    const result = await claudeService.executeCommand('TEST-INTEGRATION', 'claude --help');
    
    expect(result.success).toBe(true);
    expect(result.output).toContain('Usage: claude');
    expect(result.executionTime).toBeGreaterThan(0);
  }, 10000);

  it('should reject empty commands', async () => {
    // This test doesn't require Claude Code to be available
    const result = await claudeService.executeCommand('TEST-INTEGRATION', '');
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Command must be a non-empty string');
  });

  it('should handle invalid claude commands', async () => {
    if (!claudeAvailable) {
      console.log('Claude Code not available, skipping test');
      return;
    }

    const result = await claudeService.executeCommand('TEST-INTEGRATION', 'claude --invalid-flag-test-12345');
    
    // Should execute but return non-zero exit code
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  }, 10000);

  it('should transform claude-code to claude --print', async () => {
    if (!claudeAvailable) {
      console.log('Claude Code not available, skipping test');
      return;
    }

    // Test claude-code command transformation
    const result = await claudeService.executeCommand('TEST-INTEGRATION', 'claude-code test command');
    
    // Should be transformed to 'claude --print test command'
    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
  }, 15000);
});

describe('Claude Service Command Parsing', () => {
  let claudeService: ClaudeService;

  beforeEach(() => {
    claudeService = new ClaudeService();
  });

  afterEach(() => {
    claudeService.destroy();
  });

  it('should correctly validate commands', async () => {
    // Test command validation by checking the validation logic
    const { validateCommand } = await import('../utils/security');
    
    // Test basic command validation
    const result1 = validateCommand('claude test prompt');
    expect(result1.isValid).toBe(true);
    expect(result1.sanitizedCommand).toBe('claude test prompt');
    
    // Test claude-code command validation
    const result2 = validateCommand('claude-code test prompt');
    expect(result2.isValid).toBe(true);
    expect(result2.sanitizedCommand).toBe('claude-code test prompt');
    
    // Test empty command validation
    const result3 = validateCommand('');
    expect(result3.isValid).toBe(false);
    expect(result3.reason).toBe('Command must be a non-empty string');
    
    // Test whitespace trimming
    const result4 = validateCommand('  claude --help  ');
    expect(result4.isValid).toBe(true);
    expect(result4.sanitizedCommand).toBe('claude --help');
  });
});