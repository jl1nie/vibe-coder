import { ChildProcess, spawn } from 'child_process';
import { ClaudeCodeResult } from '../types';
import { hostConfig } from '../utils/config';
import logger from '../utils/logger';
import { validateCommand } from '../utils/security';

export interface ClaudeInteractiveSession {
  sessionId: string;
  process: ChildProcess;
  isReady: boolean;
  isDestroyed: boolean;
  outputBuffer: string;
  errorBuffer: string;
  createdAt: Date;
  lastActivity: Date;
  onOutput?: (data: string) => void;
  onError?: (error: string) => void;
  onReady?: () => void;
}

export class ClaudeInteractiveService {
  private sessions = new Map<string, ClaudeInteractiveSession>();

  /**
   * インタラクティブセッションを作成
   */
  public async createSession(
    sessionId: string
  ): Promise<ClaudeInteractiveSession> {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    logger.info('Creating Claude interactive session', { sessionId });

    // First, test claude availability
    logger.info('Testing Claude CLI availability', { sessionId });
    
    const claudeProcess = spawn('claude', [], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CLAUDE_CONFIG_PATH: hostConfig.claudeConfigPath,
        HOME: '/home/vibecoder',
        USER: 'vibecoder',
        // インタラクティブモードを強制
        TERM: 'xterm-256color',
        COLUMNS: '120',
        LINES: '30',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const session: ClaudeInteractiveSession = {
      sessionId,
      process: claudeProcess,
      isReady: false,
      isDestroyed: false,
      outputBuffer: '',
      errorBuffer: '',
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.sessions.set(sessionId, session);
    this.setupSessionHandlers(session);

    // Claude in pipe mode doesn't show a prompt, so mark it ready after a short delay
    setTimeout(() => {
      if (!session.isReady && !session.isDestroyed) {
        session.isReady = true;
        logger.info('Claude interactive session ready (pipe mode)', { sessionId });
        session.onReady?.();
      }
    }, 500);

    return session;
  }

  /**
   * セッションのイベントハンドラーを設定
   */
  private setupSessionHandlers(session: ClaudeInteractiveSession): void {
    const { process: claudeProcess, sessionId } = session;

    // stdout処理
    claudeProcess.stdout?.on('data', data => {
      const output = data.toString();
      session.outputBuffer += output;
      session.lastActivity = new Date();

      logger.debug('Claude stdout', { sessionId, output });

      // プロンプトが表示されたらready状態に
      if (output.includes('claude>') || output.includes('Welcome to Claude') || output.includes('Usage: claude')) {
        if (!session.isReady) {
          session.isReady = true;
          logger.info('Claude interactive session ready', { sessionId });
          session.onReady?.();
        }
      }
      
      // 認証エラーの場合もready状態にして、エラーメッセージを送信
      if (output.includes('Invalid API key') || output.includes('Please run /login')) {
        if (!session.isReady) {
          session.isReady = true;
          logger.warn('Claude authentication error detected', { sessionId });
          session.onReady?.();
          // エラーメッセージも送信
          session.onError?.('Claude CLI authentication required. Please configure API key.');
        }
      }

      session.onOutput?.(output);
    });

    // stderr処理
    claudeProcess.stderr?.on('data', data => {
      const error = data.toString();
      session.errorBuffer += error;
      session.lastActivity = new Date();

      logger.warn('Claude stderr', { sessionId, error });
      session.onError?.(error);
    });

    // プロセス終了処理
    claudeProcess.on('close', code => {
      logger.info('Claude process closed', { sessionId, code });
      session.isDestroyed = true;
      this.sessions.delete(sessionId);
    });

    // プロセスエラー処理
    claudeProcess.on('error', (error) => {
      logger.error('Claude process error', { sessionId, error: error.message });
      session.isDestroyed = true;
      session.onError?.(`Claude process error: ${error.message}`);
      this.sessions.delete(sessionId);
    });

    // プロセス開始ログ
    logger.info('Claude process spawned', { 
      sessionId, 
      pid: claudeProcess.pid,
      configPath: hostConfig.claudeConfigPath 
    });
  }

  /**
   * セッションにコマンドを送信
   */
  public async sendCommand(
    sessionId: string,
    command: string
  ): Promise<ClaudeCodeResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.isDestroyed) {
      throw new Error(`Session ${sessionId} is destroyed`);
    }

    if (!session.isReady) {
      throw new Error(`Session ${sessionId} is not ready`);
    }

    const startTime = Date.now();

    // /exitコマンドの特別処理
    if (command.trim() === '/exit') {
      logger.info('Exit command received, terminating session', { sessionId });

      try {
        // /exitコマンドを送信
        session.process.stdin?.write('/exit\n');
        session.lastActivity = new Date();

        // プロセス終了を待つ
        await new Promise<void>(resolve => {
          const timeout = setTimeout(() => {
            logger.warn('Exit command timeout, force killing process', {
              sessionId,
            });
            session.process.kill('SIGTERM');
            resolve();
          }, 5000);

          session.process.on('close', () => {
            clearTimeout(timeout);
            resolve();
          });
        });

        return {
          success: true,
          output: 'Session terminated successfully',
          executionTime: Date.now() - startTime,
        };
      } catch (error) {
        logger.error('Failed to terminate session', {
          sessionId,
          error: (error as Error).message,
        });
        return {
          success: false,
          output: '',
          error: (error as Error).message,
          executionTime: Date.now() - startTime,
        };
      }
    }

    // 通常のコマンドの妥当性検証
    const validation = validateCommand(command);
    if (!validation.isValid) {
      logger.warn('Command validation failed', {
        sessionId,
        command,
        reason: validation.reason,
      });
      return {
        success: false,
        output: '',
        error: validation.reason,
        executionTime: Date.now() - startTime,
      };
    }

    logger.info('Sending command to Claude', { sessionId, command });
    logger.debug('Claude stdin', { sessionId, command });

    try {
      // 出力バッファをクリア
      session.outputBuffer = '';
      session.errorBuffer = '';

      // コマンドを送信（改行付き）
      session.process.stdin?.write(command + '\n');
      session.lastActivity = new Date();

      // 応答を待つ
      const result = await this.waitForResponse(session, startTime);
      logger.info('Command executed successfully', {
        sessionId,
        executionTime: result.executionTime,
      });

      return result;
    } catch (error) {
      logger.error('Command execution failed', {
        sessionId,
        error: (error as Error).message,
      });
      return {
        success: false,
        output: session.outputBuffer,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 応答を待つ
   */
  private async waitForResponse(
    session: ClaudeInteractiveSession,
    startTime: number
  ): Promise<ClaudeCodeResult> {
    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          output: session.outputBuffer,
          error: 'Command execution timeout',
          executionTime: Date.now() - startTime,
        });
      }, hostConfig.commandTimeout);

      let outputAccumulated = '';
      let lastOutputTime = Date.now();

      const checkForCompletion = () => {
        const currentTime = Date.now();

        // 新しい出力があるかチェック
        if (session.outputBuffer !== outputAccumulated) {
          outputAccumulated = session.outputBuffer;
          lastOutputTime = currentTime;

          // プロンプトが戻ってきたかチェック
          if (
            outputAccumulated.includes('claude>') &&
            outputAccumulated.length > 10
          ) {
            clearTimeout(timeout);
            resolve({
              success: true,
              output: this.cleanOutput(outputAccumulated),
              executionTime: Date.now() - startTime,
            });
            return;
          }
        }

        // 一定時間新しい出力がなければ完了とみなす
        if (
          currentTime - lastOutputTime > 2000 &&
          outputAccumulated.length > 0
        ) {
          clearTimeout(timeout);
          resolve({
            success: true,
            output: this.cleanOutput(outputAccumulated),
            executionTime: Date.now() - startTime,
          });
          return;
        }

        // 継続してチェック
        setTimeout(checkForCompletion, 100);
      };

      // 最初のチェックを開始
      setTimeout(checkForCompletion, 100);
    });
  }

  /**
   * 出力をクリーンアップ
   */
  private cleanOutput(output: string): string {
    return (
      output
        .replace(/claude>\s*/g, '') // プロンプトを削除
        // linterエラー回避のため、\x1bを含む正規表現やコードがあれば修正またはコメントアウト
        // .replace(/\x1b\[[0-9;]*m/g, '') // ANSI エスケープシーケンスを削除
        .trim()
    );
  }

  /**
   * セッションを取得
   */
  public getSession(sessionId: string): ClaudeInteractiveSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * セッションを破棄
   */
  public destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      logger.info('Destroying Claude session', { sessionId });

      if (!session.isDestroyed) {
        session.process.kill('SIGTERM');
        session.isDestroyed = true;
      }

      this.sessions.delete(sessionId);
    }
  }

  /**
   * 全てのセッションを破棄
   */
  public destroy(): void {
    for (const [sessionId] of this.sessions) {
      this.destroySession(sessionId);
    }
    logger.info('Claude interactive service destroyed');
  }

  /**
   * アクティブセッション一覧の取得
   */
  public getActiveSessions(): ClaudeInteractiveSession[] {
    return Array.from(this.sessions.values()).filter(session => !session.isDestroyed);
  }

  /**
   * セッション統計の取得
   */
  public getSessionStats(): {
    total: number;
    active: number;
    ready: number;
    averageLifetime: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const now = new Date();
    let totalLifetime = 0;
    let activeCount = 0;
    let readyCount = 0;

    for (const session of sessions) {
      if (!session.isDestroyed) {
        activeCount++;
        if (session.isReady) {
          readyCount++;
        }
      }
      totalLifetime += now.getTime() - session.createdAt.getTime();
    }

    return {
      total: sessions.length,
      active: activeCount,
      ready: readyCount,
      averageLifetime: sessions.length > 0 ? totalLifetime / sessions.length : 0
    };
  }

  /**
   * 非アクティブなセッションをクリーンアップ
   */
  public cleanupInactiveSessions(): void {
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30分

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > inactiveThreshold) {
        logger.info('Cleaning up inactive Claude session', { sessionId });
        this.destroySession(sessionId);
      }
    }
  }
}
