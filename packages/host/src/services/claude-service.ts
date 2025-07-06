import { spawn, ChildProcess } from 'child_process';
import { ClaudeCodeResult } from '../types';
import { validateCommand } from '../utils/security';
import { hostConfig } from '../utils/config';
import logger from '../utils/logger';

export class ClaudeService {
  private runningCommands = new Map<string, ChildProcess>();

  public async executeCommand(
    sessionId: string,
    command: string
  ): Promise<ClaudeCodeResult> {
    const startTime = Date.now();
    
    // Validate command security
    const validation = validateCommand(command);
    if (!validation.isValid) {
      logger.warn('Command validation failed', { 
        sessionId, 
        command, 
        reason: validation.reason 
      });
      
      return {
        success: false,
        output: '',
        error: validation.reason,
        executionTime: Date.now() - startTime,
      };
    }

    logger.info('Executing Claude Code command', { sessionId, command });

    try {
      const result = await this.runClaudeCodeCommand(
        sessionId,
        validation.sanitizedCommand!
      );
      
      logger.info('Command execution completed', { 
        sessionId, 
        success: result.success,
        executionTime: result.executionTime 
      });
      
      return result;
    } catch (error) {
      const errorMessage = (error as Error).message;
      logger.error('Command execution failed', { 
        sessionId, 
        command, 
        error: errorMessage 
      });
      
      return {
        success: false,
        output: '',
        error: errorMessage,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async runClaudeCodeCommand(
    sessionId: string,
    command: string
  ): Promise<ClaudeCodeResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let output = '';
      let errorOutput = '';
      
      // Split command into parts for spawn
      const parts = command.split(' ');
      const cmd = parts[0]; // 'claude-code'
      const args = parts.slice(1);

      const child = spawn(cmd, args, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CLAUDE_API_KEY: hostConfig.claudeApiKey,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Track running command
      this.runningCommands.set(sessionId, child);

      // Collect stdout
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      // Collect stderr
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Handle process completion
      child.on('close', (code) => {
        this.runningCommands.delete(sessionId);
        
        const executionTime = Date.now() - startTime;
        const sanitizedOutput = sanitizeOutput(output);
        const sanitizedError = sanitizeOutput(errorOutput);
        
        resolve({
          success: code === 0,
          output: sanitizedOutput,
          error: sanitizedError || undefined,
          exitCode: code || undefined,
          executionTime,
        });
      });

      // Handle process errors
      child.on('error', (error) => {
        this.runningCommands.delete(sessionId);
        
        resolve({
          success: false,
          output: '',
          error: (error as Error).message,
          executionTime: Date.now() - startTime,
        });
      });

      // Set command timeout
      setTimeout(() => {
        if (this.runningCommands.has(sessionId)) {
          child.kill('SIGTERM');
          this.runningCommands.delete(sessionId);
          
          resolve({
            success: false,
            output: sanitizeOutput(output),
            error: 'Command execution timeout',
            executionTime: Date.now() - startTime,
          });
        }
      }, hostConfig.commandTimeout);
    });
  }

  public cancelCommand(sessionId: string): boolean {
    const child = this.runningCommands.get(sessionId);
    if (child) {
      child.kill('SIGTERM');
      this.runningCommands.delete(sessionId);
      logger.info('Command cancelled', { sessionId });
      return true;
    }
    return false;
  }

  public isCommandRunning(sessionId: string): boolean {
    return this.runningCommands.has(sessionId);
  }

  public getRunningCommandsCount(): number {
    return this.runningCommands.size;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      // Simple health check by running claude-code --version
      const result = await this.runClaudeCodeCommand('health-check', 'claude-code --version');
      return result.success;
    } catch (error) {
      logger.error('Claude Code health check failed', { error: (error as Error).message });
      return false;
    }
  }

  public destroy(): void {
    // Kill all running commands
    for (const [sessionId, child] of this.runningCommands.entries()) {
      child.kill('SIGTERM');
      logger.info('Terminated running command during shutdown', { sessionId });
    }
    this.runningCommands.clear();
  }
}

// Utility function to sanitize sensitive information from output
function sanitizeOutput(output: string): string {
  if (!output) return output;
  
  // Replace API keys (Claude API keys start with sk-)
  const apiKeyRegex = /sk-[a-zA-Z0-9]{32,}/g;
  output = output.replace(apiKeyRegex, '[REDACTED_API_KEY]');
  
  // Replace email addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  output = output.replace(emailRegex, '[REDACTED_EMAIL]');
  
  // Replace potential tokens
  const tokenRegex = /[a-zA-Z0-9]{32,}/g;
  output = output.replace(tokenRegex, (match) => {
    // Only redact if it looks like a token (contains mixed case and numbers)
    if (/[a-z]/.test(match) && /[A-Z]/.test(match) && /[0-9]/.test(match)) {
      return '[REDACTED_TOKEN]';
    }
    return match;
  });
  
  return output;
}