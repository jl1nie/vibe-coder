import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { 
  createLogger, 
  validateCommand, 
  checkRateLimit,
  sanitizeCommand,
  isClaudeCodeCommand,
  TerminalOutput,
  ClaudeSession as IClaudeSession,
  SessionCommand,
  generateId,
  createError,
  ERROR_CODES,
  SECURITY_LIMITS
} from '@vibe-coder/shared';

const logger = createLogger('claude-service');

export interface ClaudeExecutionOptions {
  workspaceDir: string;
  sessionId: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface CommandExecution {
  id: string;
  command: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  output: TerminalOutput[];
  startTime: number;
  endTime?: number;
  exitCode?: number;
  error?: string;
}

export class ClaudeSession extends EventEmitter {
  public readonly id: string;
  public readonly workspaceDir: string;
  public readonly createdAt: string;
  
  private process: ChildProcess | null = null;
  private isExecuting = false;
  private currentExecution: CommandExecution | null = null;
  private commandHistory: SessionCommand[] = [];
  private lastActivity: string;

  constructor(id: string, workspaceDir: string) {
    super();
    this.id = id;
    this.workspaceDir = workspaceDir;
    this.createdAt = new Date().toISOString();
    this.lastActivity = this.createdAt;

    logger.info('Claude session created', { 
      sessionId: this.id, 
      workspaceDir: this.workspaceDir 
    });
  }

  public async executeCommand(
    command: string, 
    clientId: string,
    options: Partial<ClaudeExecutionOptions> = {}
  ): Promise<CommandExecution> {
    // セキュリティ検証
    validateCommand(command);
    checkRateLimit(clientId);

    // 同時実行チェック
    if (this.isExecuting) {
      throw createError(
        ERROR_CODES.COMMAND_FAILED,
        'Another command is already executing in this session'
      );
    }

    // 実行準備
    const executionId = generateId();
    const execution: CommandExecution = {
      id: executionId,
      command,
      status: 'pending',
      output: [],
      startTime: Date.now(),
    };

    this.currentExecution = execution;
    this.isExecuting = true;
    this.updateLastActivity();

    logger.info('Starting command execution', {
      sessionId: this.id,
      executionId,
      command: sanitizeCommand(command),
      clientId,
    });

    try {
      execution.status = 'running';
      this.emit('execution-started', execution);

      await this.spawnClaudeProcess(command, execution, options);

      // 正常完了
      execution.status = 'completed';
      execution.endTime = Date.now();
      
      this.addToHistory(execution);
      logger.info('Command execution completed', {
        sessionId: this.id,
        executionId,
        duration: execution.endTime - execution.startTime,
        exitCode: execution.exitCode,
      });

    } catch (error) {
      // エラー処理
      execution.status = 'failed';
      execution.endTime = Date.now();
      execution.error = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Command execution failed', {
        sessionId: this.id,
        executionId,
        error: execution.error,
        command: sanitizeCommand(command),
      });

      this.addToHistory(execution);
    } finally {
      this.isExecuting = false;
      this.currentExecution = null;
      this.emit('execution-completed', execution);
    }

    return execution;
  }

  private async spawnClaudeProcess(
    command: string,
    execution: CommandExecution,
    options: Partial<ClaudeExecutionOptions>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = options.timeout || SECURITY_LIMITS.MAX_SESSION_TIME;
      let timeoutId: NodeJS.Timeout;

      // Claude Codeプロセス起動
      this.process = spawn('claude-code', {
        cwd: this.workspaceDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...options.env,
          CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
          CLAUDE_SESSION_DIR: path.join(this.workspaceDir, '.claude-sessions', this.id),
          NODE_ENV: process.env.NODE_ENV || 'production',
        },
      });

      // タイムアウト設定
      timeoutId = setTimeout(() => {
        if (this.process && !this.process.killed) {
          logger.warn('Command execution timeout', {
            sessionId: this.id,
            executionId: execution.id,
            timeout,
          });

          this.process.kill('SIGTERM');
          execution.status = 'timeout';
          execution.error = `Command execution timeout after ${timeout}ms`;
          reject(createError(ERROR_CODES.COMMAND_TIMEOUT, execution.error));
        }
      }, timeout);

      // 標準出力処理
      this.process.stdout?.on('data', (data: Buffer) => {
        const output: TerminalOutput = {
          type: 'stdout',
          data: data.toString(),
          timestamp: Date.now(),
          sessionId: this.id,
        };

        execution.output.push(output);
        this.emit('output', output);
        this.updateLastActivity();
      });

      // 標準エラー処理
      this.process.stderr?.on('data', (data: Buffer) => {
        const output: TerminalOutput = {
          type: 'stderr',
          data: data.toString(),
          timestamp: Date.now(),
          sessionId: this.id,
        };

        execution.output.push(output);
        this.emit('output', output);
        this.updateLastActivity();
      });

      // プロセス終了処理
      this.process.on('close', (code: number | null) => {
        clearTimeout(timeoutId);
        
        execution.exitCode = code || 0;
        
        const output: TerminalOutput = {
          type: 'exit',
          data: `Process exited with code ${execution.exitCode}`,
          timestamp: Date.now(),
          sessionId: this.id,
        };

        execution.output.push(output);
        this.emit('output', output);

        if (execution.exitCode === 0) {
          resolve();
        } else {
          reject(createError(
            ERROR_CODES.COMMAND_FAILED, 
            `Command failed with exit code ${execution.exitCode}`
          ));
        }
      });

      // プロセスエラー処理
      this.process.on('error', (error: Error) => {
        clearTimeout(timeoutId);
        logger.error('Claude process error', {
          sessionId: this.id,
          executionId: execution.id,
          error: error.message,
        });

        reject(createError(ERROR_CODES.COMMAND_FAILED, error.message));
      });

      // コマンド送信
      try {
        this.process.stdin?.write(command + '\n');
        this.process.stdin?.end();
      } catch (error) {
        clearTimeout(timeoutId);
        reject(createError(
          ERROR_CODES.COMMAND_FAILED, 
          'Failed to write command to process'
        ));
      }
    });
  }

  public async interrupt(): Promise<void> {
    if (this.process && this.isExecuting) {
      logger.info('Interrupting command execution', { sessionId: this.id });

      this.process.kill('SIGINT');
      
      if (this.currentExecution) {
        this.currentExecution.status = 'failed';
        this.currentExecution.endTime = Date.now();
        this.currentExecution.error = 'Interrupted by user';
        
        this.addToHistory(this.currentExecution);
        this.emit('execution-completed', this.currentExecution);
      }

      this.isExecuting = false;
      this.currentExecution = null;
    }
  }

  public getStatus(): IClaudeSession {
    return {
      id: this.id,
      workspaceDir: this.workspaceDir,
      isActive: this.isExecuting,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      commands: this.commandHistory.slice(-50), // 最新50件
    };
  }

  public getCommandHistory(): SessionCommand[] {
    return [...this.commandHistory];
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up Claude session', { sessionId: this.id });

    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      
      // 強制終了の猶予時間
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!this.process.killed) {
        this.process.kill('SIGKILL');
      }
    }

    this.isExecuting = false;
    this.currentExecution = null;
    this.removeAllListeners();
  }

  private addToHistory(execution: CommandExecution): void {
    const sessionCommand: SessionCommand = {
      id: execution.id,
      command: execution.command,
      output: execution.output.map(o => o.data).join(''),
      exitCode: execution.exitCode || -1,
      timestamp: new Date(execution.startTime).toISOString(),
      duration: (execution.endTime || Date.now()) - execution.startTime,
    };

    this.commandHistory.push(sessionCommand);

    // 履歴の上限管理
    if (this.commandHistory.length > 1000) {
      this.commandHistory = this.commandHistory.slice(-500);
    }
  }

  private updateLastActivity(): void {
    this.lastActivity = new Date().toISOString();
  }
}

export class ClaudeService {
  private sessions = new Map<string, ClaudeSession>();
  private sessionCleanupInterval: NodeJS.Timeout;

  constructor() {
    logger.info('ClaudeService initialized');

    // セッションクリーンアップ（1時間ごと）
    this.sessionCleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 3600000);
  }

  public async createSession(workspaceDir: string): Promise<ClaudeSession> {
    // ワークスペースディレクトリの検証
    await this.validateWorkspaceDir(workspaceDir);

    const sessionId = generateId();
    const session = new ClaudeSession(sessionId, workspaceDir);

    this.sessions.set(sessionId, session);

    logger.info('New Claude session created', { 
      sessionId, 
      workspaceDir,
      totalSessions: this.sessions.size 
    });

    return session;
  }

  public getSession(sessionId: string): ClaudeSession | undefined {
    return this.sessions.get(sessionId);
  }

  public getAllSessions(): ClaudeSession[] {
    return Array.from(this.sessions.values());
  }

  public async executeCommand(
    sessionId: string, 
    command: string, 
    clientId: string,
    options?: Partial<ClaudeExecutionOptions>
  ): Promise<CommandExecution> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw createError(
        ERROR_CODES.SESSION_NOT_FOUND,
        `Session not found: ${sessionId}`
      );
    }

    return session.executeCommand(command, clientId, options);
  }

  public async removeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      await session.cleanup();
      this.sessions.delete(sessionId);
      
      logger.info('Claude session removed', { 
        sessionId,
        remainingSessions: this.sessions.size 
      });
    }
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up ClaudeService');

    clearInterval(this.sessionCleanupInterval);

    // 全セッションのクリーンアップ
    const cleanupPromises = Array.from(this.sessions.values()).map(
      session => session.cleanup()
    );

    await Promise.all(cleanupPromises);
    this.sessions.clear();
  }

  private async validateWorkspaceDir(workspaceDir: string): Promise<void> {
    try {
      const stats = await fs.stat(workspaceDir);
      
      if (!stats.isDirectory()) {
        throw createError(
          ERROR_CODES.VALIDATION_ERROR,
          `Workspace path is not a directory: ${workspaceDir}`
        );
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // ディレクトリが存在しない場合は作成
        await fs.mkdir(workspaceDir, { recursive: true });
        logger.info('Created workspace directory', { workspaceDir });
      } else {
        throw createError(
          ERROR_CODES.VALIDATION_ERROR,
          `Invalid workspace directory: ${workspaceDir}`
        );
      }
    }
  }

  private cleanupInactiveSessions(): void {
    const now = Date.now();
    const maxInactiveTime = 2 * 60 * 60 * 1000; // 2時間

    for (const [sessionId, session] of this.sessions.entries()) {
      const lastActivityTime = new Date(session.getStatus().lastActivity).getTime();
      
      if (now - lastActivityTime > maxInactiveTime) {
        logger.info('Cleaning up inactive session', { 
          sessionId,
          inactiveTime: now - lastActivityTime 
        });
        
        this.removeSession(sessionId);
      }
    }
  }
}