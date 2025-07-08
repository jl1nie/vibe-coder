import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClaudeService } from '../services/claude-service';
import { spawn } from 'child_process';

describe('Claude Code Integration (Real)', () => {
  let claudeService: ClaudeService;

  beforeEach(() => {
    claudeService = new ClaudeService();
  });

  afterEach(() => {
    claudeService.destroy();
  });

  it('should execute real claude command and return output', async () => {
    // Test with a simple claude command that should work
    const result = await claudeService.executeCommand('TEST-INTEGRATION', 'claude what is 2+2?');
    
    // Command should be transformed to 'claude --print what is 2+2?'
    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    expect(result.output).toContain('4');
    expect(result.executionTime).toBeGreaterThan(0);
  }, 30000); // 30 second timeout for real command

  it('should handle claude command help', async () => {
    const result = await claudeService.executeCommand('TEST-INTEGRATION', 'claude --help');
    
    expect(result.success).toBe(true);
    expect(result.output).toContain('Usage: claude');
    expect(result.executionTime).toBeGreaterThan(0);
  }, 10000);

  it('should reject non-claude commands', async () => {
    const result = await claudeService.executeCommand('TEST-INTEGRATION', 'echo hello');
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('dangerous patterns');
  });

  it('should handle invalid claude commands', async () => {
    const result = await claudeService.executeCommand('TEST-INTEGRATION', 'claude --invalid-flag-test-12345');
    
    // Should execute but return non-zero exit code
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  }, 10000);

  it('should transform claude-code to claude --print', async () => {
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

  it('should correctly transform and parse claude commands', async () => {
    // Test command transformation by checking the validation logic
    const { validateCommand } = await import('../utils/security');
    
    // Test claude command transformation
    const result1 = validateCommand('claude test prompt');
    expect(result1.isValid).toBe(true);
    expect(result1.sanitizedCommand).toBe('claude --print test prompt');
    
    // Test claude-code transformation
    const result2 = validateCommand('claude-code test prompt');
    expect(result2.isValid).toBe(true);
    expect(result2.sanitizedCommand).toBe('claude --print test prompt');
    
    // Test --help should not be transformed
    const result3 = validateCommand('claude --help');
    expect(result3.isValid).toBe(true);
    expect(result3.sanitizedCommand).toBe('claude --help');
  });
});