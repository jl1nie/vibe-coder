import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeService } from '../services/claude-service';
import { spawn } from 'child_process';

vi.mock('child_process');

describe('ClaudeService', () => {
  let claudeService: ClaudeService;
  let mockChild: any;

  beforeEach(() => {
    claudeService = new ClaudeService();
    
    mockChild = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    };
    
    vi.mocked(spawn).mockReturnValue(mockChild as any);
  });

  afterEach(() => {
    claudeService.destroy();
    vi.clearAllMocks();
  });

  describe('Command Validation', () => {
    it('should reject empty commands', async () => {
      const result = await claudeService.executeCommand('TEST1234', '');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Command must be a non-empty string');
    });

    it('should reject null/undefined commands', async () => {
      const result = await claudeService.executeCommand('TEST1234', null as any);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Command must be a non-empty string');
    });

    it('should accept any non-empty string commands', async () => {
      // Mock successful command execution
      mockChild.on.mockImplementation((event: string, callback: (code: number) => void) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      const result = await claudeService.executeCommand('TEST1234', 'any command');
      
      expect(result.success).toBe(true);
      expect(spawn).toHaveBeenCalledWith('any', ['command'], expect.any(Object));
    });

    it('should accept valid claude commands', async () => {
      // Mock successful command execution
      mockChild.on.mockImplementation((event: string, callback: (code: number) => void) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      const result = await claudeService.executeCommand('TEST1234', 'claude help');
      
      expect(result.success).toBe(true);
      // Claude actual command call
      expect(spawn).toHaveBeenCalledWith('claude', ['help'], expect.any(Object));
    });
  });

  describe('Command Execution', () => {
    it('should execute command and return output', async () => {
      const mockOutput = 'Command executed successfully';
      
      mockChild.stdout.on.mockImplementation((event: string, callback: (data: Buffer) => void) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(mockOutput)), 10);
        }
      });
      
      mockChild.on.mockImplementation((event: string, callback: (code: number) => void) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 20);
        }
      });

      const result = await claudeService.executeCommand('TEST1234', 'claude help');
      
      expect(result.success).toBe(true);
      expect(result.output).toBe(mockOutput);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle command errors', async () => {
      const mockError = 'Command failed';
      
      mockChild.stderr.on.mockImplementation((event: string, callback: (data: Buffer) => void) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(mockError)), 10);
        }
      });
      
      mockChild.on.mockImplementation((event: string, callback: (code: number) => void) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 20);
        }
      });

      const result = await claudeService.executeCommand('TEST1234', 'claude invalid');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError);
      expect(result.exitCode).toBe(1);
    });

    it('should handle process errors', async () => {
      mockChild.on.mockImplementation((event: string, callback: (code: number) => void) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Process error')), 10);
        }
      });

      const result = await claudeService.executeCommand('TEST1234', 'claude help');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Process error');
    });

    it('should timeout long-running commands', async () => {
      vi.useFakeTimers();
      
      // Don't trigger close event to simulate hanging command
      mockChild.on.mockImplementation(() => {});

      const resultPromise = claudeService.executeCommand('TEST1234', 'claude-code help');
      
      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(30000);
      
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
      
      vi.useRealTimers();
    }, 10000);
  });

  describe('Command Management', () => {
    it('should track running commands', () => {
      expect(claudeService.isCommandRunning('TEST1234')).toBe(false);
      expect(claudeService.getRunningCommandsCount()).toBe(0);
    });

    it('should cancel running commands', () => {
      // Simulate a running command
      claudeService.executeCommand('TEST1234', 'claude help');
      
      const cancelled = claudeService.cancelCommand('TEST1234');
      expect(cancelled).toBe(true);
      expect(mockChild.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should return false when cancelling non-existent command', () => {
      const cancelled = claudeService.cancelCommand('INVALID1');
      expect(cancelled).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      mockChild.on.mockImplementation((event: string, callback: (code: number) => void) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      });

      const isHealthy = await claudeService.healthCheck();
      
      expect(isHealthy).toBe(true);
      // Health check uses "claude --version" command
      expect(spawn).toHaveBeenCalledWith('claude', ['--version'], expect.any(Object));
    });

    it('should return false when health check fails', async () => {
      mockChild.on.mockImplementation((event: string, callback: (code: number) => void) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 10);
        }
      });

      const isHealthy = await claudeService.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('Output Sanitization', () => {
    it('should sanitize sensitive information from output', async () => {
      const sensitiveOutput = 'API Key: sk-abcdefghijklmnopqrstuvwxyz1234567890123456 Email: user@example.com';
      
      mockChild.stdout.on.mockImplementation((event: string, callback: (data: Buffer) => void) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(sensitiveOutput)), 10);
        }
      });
      
      mockChild.on.mockImplementation((event: string, callback: (code: number) => void) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 20);
        }
      });

      const result = await claudeService.executeCommand('TEST1234', 'claude help');
      
      // Since the output is sanitized, it should contain redacted markers
      expect(result.output).toContain('[REDACTED_API_KEY]');
      expect(result.output).toContain('[REDACTED_EMAIL]');
      expect(result.output).not.toContain('sk-abcdefghijklmnopqrstuvwxyz');
      expect(result.output).not.toContain('user@example.com');
    });
  });
});