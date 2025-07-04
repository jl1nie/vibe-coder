import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createLogger, LogTimer } from '../utils/logger';
import { Environment } from '../utils/env';
import { ClaudeSession, TerminalOutput, Command } from '@vibe-coder/shared';

const logger = createLogger('claude-service');

export interface ClaudeExecutionResult {
  id: string;
  command: string;
  output: TerminalOutput[];
  exitCode: number | null;
  duration: number;
  error?: string;
}

export interface ClaudeServiceEvents {
  output: (sessionId: string, output: TerminalOutput) => void;
  sessionCreated: (session: ClaudeSession) => void;
  sessionEnded: (sessionId: string, exitCode: number | null) => void;
  error: (sessionId: string, error: Error) => void;
}

export class ClaudeService extends EventEmitter {
  private sessions = new Map<string, ClaudeSession>();
  private processes = new Map<string, ChildProcess>();
  private env: Environment;
  private cleanupInterval: NodeJS.Timeout;

  constructor(env: Environment) {
    super();
    this.env = env;
    
    // 定期的なセッションクリーンアップ
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions();
    }, this.env.SESSION_CLEANUP_INTERVAL_MS);

    logger.info('Claude Service initialized', {
      maxSessions: this.env.MAX_CONCURRENT_SESSIONS,
      commandTimeout: this.env.COMMAND_TIMEOUT_MS,
      workspaceDir: this.env.WORKSPACE_DIR,
    });
  }

  // セッションの作成
  async createSession(sessionId: string, workspaceDir?: string): Promise<ClaudeSession> {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    if (this.sessions.size >= this.env.MAX_CONCURRENT_SESSIONS) {
      throw new Error('Maximum concurrent sessions limit reached');
    }

    const timer = new LogTimer(logger, 'createSession', { sessionId });
    
    try {
      // ワークスペースディレクトリの準備
      const sessionWorkspace = workspaceDir || path.join(this.env.WORKSPACE_DIR, sessionId);
      await this.ensureWorkspaceDirectory(sessionWorkspace);

      const session: ClaudeSession = {
        id: sessionId,
        workspaceDir: sessionWorkspace,
        isActive: true,
        createdAt: Date.now(),
        lastUsed: Date.now(),
      };

      this.sessions.set(sessionId, session);
      this.emit('sessionCreated', session);
      
      timer.finish({ workspaceDir: sessionWorkspace });
      logger.info('Session created successfully', { sessionId, workspaceDir: sessionWorkspace });

      return session;
    } catch (error) {
      timer.error(error as Error);
      throw error;
    }
  }

  // コマンドの実行
  async executeCommand(sessionId: string, command: string): Promise<ClaudeExecutionResult> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // コマンドの検証
    this.validateCommand(command);

    const executionId = uuidv4();
    const timer = new LogTimer(logger, 'executeCommand', { 
      sessionId, 
      executionId,
      command: this.sanitizeCommand(command)
    });

    try {
      const result = await this.runClaudeCode(session, command, executionId);
      
      session.lastUsed = Date.now();
      this.sessions.set(sessionId, session);

      timer.finish({ 
        exitCode: result.exitCode,
        outputLines: result.output.length,
        duration: result.duration 
      });

      return result;
    } catch (error) {
      timer.error(error as Error);
      throw error;
    }
  }

  // セッションの取得
  getSession(sessionId: string): ClaudeSession | undefined {
    return this.sessions.get(sessionId);
  }

  // アクティブセッション一覧
  getActiveSessions(): ClaudeSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  // セッションの終了
  async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Attempted to terminate non-existent session', { sessionId });
      return;
    }

    const timer = new LogTimer(logger, 'terminateSession', { sessionId });

    try {
      // 実行中のプロセスを終了
      const process = this.processes.get(sessionId);
      if (process && !process.killed) {
        process.kill('SIGTERM');
        
        // 5秒後に強制終了
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);
      }

      session.isActive = false;
      this.sessions.delete(sessionId);
      this.processes.delete(sessionId);

      this.emit('sessionEnded', sessionId, null);
      timer.finish();
      
      logger.info('Session terminated', { sessionId });
    } catch (error) {
      timer.error(error as Error);
      throw error;
    }
  }

  // クリーンアップ
  async cleanup(): Promise<void> {
    logger.info('Starting Claude Service cleanup');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // すべてのセッションを終了
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map(id => this.terminateSession(id)));

    logger.info('Claude Service cleanup completed');
  }

  // Claude Code プロセスの実行
  private async runClaudeCode(
    session: ClaudeSession, 
    command: string, 
    executionId: string
  ): Promise<ClaudeExecutionResult> {
    const output: TerminalOutput[] = [];
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const args = this.buildClaudeArgs(command);
      
      logger.debug('Spawning Claude Code process', {
        sessionId: session.id,
        executionId,
        args: args.join(' '),
        workspaceDir: session.workspaceDir,
      });

      const process = spawn('claude-code', args, {
        cwd: session.workspaceDir,
        env: this.buildEnvironment(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.processes.set(session.id, process);

      // タイムアウト設定
      const timeout = setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGTERM');
          setTimeout(() => {
            if (!process.killed) {
              process.kill('SIGKILL');
            }
          }, 5000);
        }
      }, this.env.COMMAND_TIMEOUT_MS);

      // 標準出力の処理
      process.stdout?.on('data', (data) => {
        const outputData: TerminalOutput = {
          type: 'stdout',
          data: data.toString(),
          timestamp: Date.now(),
          sessionId: session.id,
        };
        
        output.push(outputData);
        this.emit('output', session.id, outputData);
      });

      // 標準エラーの処理
      process.stderr?.on('data', (data) => {
        const outputData: TerminalOutput = {
          type: 'stderr',
          data: data.toString(),
          timestamp: Date.now(),
          sessionId: session.id,
        };
        
        output.push(outputData);
        this.emit('output', session.id, outputData);
      });

      // プロセス終了の処理
      process.on('close', (code, signal) => {
        clearTimeout(timeout);
        this.processes.delete(session.id);

        const duration = Date.now() - startTime;
        
        const result: ClaudeExecutionResult = {
          id: executionId,
          command,
          output,
          exitCode: code,
          duration,
        };

        if (signal) {
          result.error = `Process terminated by signal: ${signal}`;
        }

        logger.debug('Claude Code process completed', {
          sessionId: session.id,
          executionId,
          exitCode: code,
          signal,
          duration,
          outputLines: output.length,
        });

        resolve(result);
      });

      // プロセスエラーの処理
      process.on('error', (error) => {
        clearTimeout(timeout);
        this.processes.delete(session.id);

        logger.error('Claude Code process error', {
          sessionId: session.id,
          executionId,
          error,
        });

        this.emit('error', session.id, error);
        reject(error);
      });

      // プロセススポーンエラーの処理
      process.on('spawn', () => {
        logger.debug('Claude Code process spawned successfully', {
          sessionId: session.id,
          executionId,
          pid: process.pid,
        });
      });
    });
  }

  // Claude Code の引数構築
  private buildClaudeArgs(command: string): string[] {
    const args: string[] = [];

    // APIキーが設定されている場合
    if (this.env.CLAUDE_API_KEY) {
      args.push('--api-key', this.env.CLAUDE_API_KEY);
    }

    // モデル指定
    if (this.env.CLAUDE_MODEL) {
      args.push('--model', this.env.CLAUDE_MODEL);
    }

    // 最大トークン数
    args.push('--max-tokens', this.env.CLAUDE_MAX_TOKENS.toString());

    // コマンド本体
    args.push(command);

    return args;
  }

  // 環境変数の構築
  private buildEnvironment(): NodeJS.ProcessEnv {
    const env = { ...process.env };

    if (this.env.CLAUDE_API_KEY) {
      env.CLAUDE_API_KEY = this.env.CLAUDE_API_KEY;
    }

    if (this.env.CLAUDE_API_URL) {
      env.CLAUDE_API_URL = this.env.CLAUDE_API_URL;
    }

    return env;
  }

  // コマンドの検証
  private validateCommand(command: string): void {
    if (!command || command.trim().length === 0) {
      throw new Error('Command cannot be empty');
    }

    if (command.length > this.env.MAX_COMMAND_LENGTH) {
      throw new Error(`Command too long (max ${this.env.MAX_COMMAND_LENGTH} characters)`);
    }

    // 危険なパターンのチェック
    const dangerousPatterns = [
      /rm\s+-rf?\s*[\/\*]/,
      /sudo\s+(?!claude-code)/,
      /eval\s*\(/,
      /exec\s*\(/,
      /system\s*\(/,
      /curl.*\|\s*sh/,
      /wget.*\|\s*sh/,
      />\s*\/dev\/sd[a-z]/,
      /dd\s+if=/,
      /mkfs/,
      /fdisk/,
      /parted/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        throw new Error(`Dangerous command pattern detected: ${pattern.source}`);
      }
    }

    // ASCII文字のみ許可
    if (!/^[\x20-\x7E\s]*$/.test(command)) {
      throw new Error('Non-ASCII characters not allowed in commands');
    }
  }

  // ワークスペースディレクトリの準備
  private async ensureWorkspaceDirectory(workspaceDir: string): Promise<void> {
    try {
      await fs.access(workspaceDir);
    } catch (error) {
      // ディレクトリが存在しない場合は作成
      await fs.mkdir(workspaceDir, { recursive: true });
      logger.debug('Workspace directory created', { workspaceDir });
    }

    // パーミッションとサイズチェック
    const stats = await fs.stat(workspaceDir);
    if (!stats.isDirectory()) {
      throw new Error(`Workspace path is not a directory: ${workspaceDir}`);
    }

    // ディスク使用量チェック（簡易版）
    const usage = await this.getDirectorySize(workspaceDir);
    if (usage > this.env.MAX_WORKSPACE_SIZE) {
      throw new Error(`Workspace directory too large: ${usage} bytes`);
    }
  }

  // ディレクトリサイズの計算
  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isDirectory()) {
          totalSize += await this.getDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      logger.warn('Failed to calculate directory size', { dirPath, error });
    }

    return totalSize;
  }

  // 古いセッションのクリーンアップ
  private cleanupStaleSessions(): void {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30分

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastUsed > staleThreshold) {
        logger.info('Cleaning up stale session', { 
          sessionId, 
          lastUsed: new Date(session.lastUsed).toISOString(),
          ageMinutes: Math.round((now - session.lastUsed) / 60000)
        });
        
        this.terminateSession(sessionId).catch(error => {
          logger.error('Failed to cleanup stale session', { sessionId, error });
        });
      }
    }
  }

  // コマンドのサニタイズ（ログ用）
  private sanitizeCommand(command: string): string {
    // 長いコマンドは省略
    if (command.length > 100) {
      return command.substring(0, 97) + '...';
    }
    return command;
  }
}

// ファクトリー関数
export function setupClaudeService(env: Environment): ClaudeService {
  return new ClaudeService(env);
}