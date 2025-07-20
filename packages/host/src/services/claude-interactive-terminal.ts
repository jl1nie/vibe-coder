import { hostConfig } from '../utils/config';
import logger from '../utils/logger';

// Import node-pty dynamically to avoid TypeScript issues
const ptySpawn = require('node-pty').spawn;

/**
 * インタラクティブClaude CLIターミナルサービス
 * ホストサーバー起動時に一度だけClaude CLIプロセスを起動し、
 * PWAのxtermからのキー入力を即座にClaude CLIに送信
 */
export class ClaudeInteractiveTerminal {
  private static instance: ClaudeInteractiveTerminal;
  private claudePty: any | null = null; // Using any to avoid TypeScript issues with node-pty
  private isReady: boolean = false;
  private isInitializing: boolean = false;
  private sessionCallbacks = new Map<string, {
    onOutput: (data: string) => void;
    onError?: (error: string) => void;
  }>();

  private constructor() {}

  public static getInstance(): ClaudeInteractiveTerminal {
    if (!ClaudeInteractiveTerminal.instance) {
      ClaudeInteractiveTerminal.instance = new ClaudeInteractiveTerminal();
    }
    return ClaudeInteractiveTerminal.instance;
  }

  /**
   * インタラクティブClaude CLIプロセスを初期化（サーバー起動時に一度だけ実行）
   */
  public async initialize(): Promise<void> {
    if (this.isReady || this.isInitializing) {
      logger.info('Claude interactive terminal already initialized or initializing');
      return;
    }

    this.isInitializing = true;
    logger.info('Initializing Claude CLI interactive terminal');

    try {
      // Claude CLIプロセスをPTY（疑似ターミナル）モードで起動
      // これによりClaude CLIがRaw mode inputを正常に処理できる
      this.claudePty = ptySpawn('claude', [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: '/app/workspace', // プロジェクトのワークスペースディレクトリで起動
        env: {
          // Explicitly override inherited environment variables
          PATH: process.env.PATH,
          NODE_ENV: process.env.NODE_ENV,
          // Claude CLI specific environment
          CLAUDE_CONFIG_PATH: hostConfig.claudeConfigPath,
          HOME: '/home/vibecoder',
          USER: 'vibecoder',
          // インタラクティブターミナル設定
          TERM: 'xterm-256color',
          COLUMNS: '120',
          LINES: '30',
          // TTYエミュレーション
          FORCE_COLOR: '1',
        },
      });

      // PTYデータ処理 - 全セッションにリアルタイム出力を送信
      this.claudePty.onData((data: string) => {
        logger.info('Claude terminal output via PTY', { 
          output: data.substring(0, 200),
          outputLength: data.length,
          sessionCount: this.sessionCallbacks.size,
          outputHex: Buffer.from(data.substring(0, 50), 'utf8').toString('hex')
        });
        
        // 認証エラーまたは特定の問題をチェック
        if (data.includes('Invalid API key') || data.includes('Please run /login')) {
          logger.warn('Claude CLI authentication issue detected', {
            authError: data.substring(0, 500)
          });
        }
        
        // 全アクティブセッションに出力を即座に送信
        this.sessionCallbacks.forEach(({ onOutput }, sessionId) => {
          try {
            onOutput(data);
            logger.debug('Output sent to session', { 
              sessionId, 
              outputLength: data.length 
            });
          } catch (error) {
            logger.error('Error sending output to session', { 
              sessionId, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
        });
      });

      // PTY終了処理
      this.claudePty.onExit((event: any) => {
        const { exitCode, signal } = event;
        logger.warn('Claude terminal PTY closed', { exitCode, signal });
        this.isReady = false;
        this.claudePty = null;
        
        // 全セッションに終了通知
        const exitMessage = `\r\n[Claude CLI process terminated with code ${exitCode}]\r\n`;
        this.sessionCallbacks.forEach(({ onOutput }) => {
          onOutput(exitMessage);
        });
      });

      // PTY準備完了を待機
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Claude terminal initialization timeout'));
        }, 10000);

        // Claude CLI PTYの初期出力を待機
        let hasInitialOutput = false;
        const initialOutputHandler = (data: string) => {
          logger.info('Claude CLI initial output received', { 
            output: data.substring(0, 500),
            dataLength: data.length,
            hasInitialOutput
          });
          
          if (!hasInitialOutput) {
            hasInitialOutput = true;
            clearTimeout(timeout);
            this.isReady = true;
            this.isInitializing = false;
            logger.info('Claude CLI interactive terminal ready (PTY mode)', {
              initialData: data.substring(0, 200)
            });
            resolve();
          }
        };

        // PTYから初期出力を待機
        this.claudePty.onData(initialOutputHandler);
        
        // 3秒後に初期化完了とみなす（PTYモードでは通常すぐに準備完了）
        setTimeout(() => {
          if (!hasInitialOutput) {
            hasInitialOutput = true;
            clearTimeout(timeout);
            this.isReady = true;
            this.isInitializing = false;
            logger.info('Claude CLI interactive terminal ready (PTY timeout fallback)');
            resolve();
          }
        }, 3000);
      });

      logger.info('Claude CLI interactive terminal initialized successfully');

    } catch (error) {
      this.isInitializing = false;
      logger.error('Failed to initialize Claude terminal', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * セッションを登録してClaude CLI出力を受信
   */
  public registerSession(
    sessionId: string, 
    onOutput: (data: string) => void, 
    onError?: (error: string) => void
  ): void {
    this.sessionCallbacks.set(sessionId, { onOutput, onError });
    logger.info('Session registered for Claude terminal', { 
      sessionId, 
      totalSessions: this.sessionCallbacks.size 
    });

    // セッション登録時にClaude CLIの実際の状態を送信
    if (this.isReady) {
      // Claude CLIが準備完了 - 実際の出力をそのまま表示
      // 偽のプロンプトは送信しない
      logger.debug('Session registered for ready Claude terminal', { sessionId });
    } else {
      // Claude CLIがまだ準備中の場合のみ、状態メッセージを送信
      logger.warn('Session registered but Claude terminal not ready', { sessionId });
      onOutput('\r\n⏳ Claude CLI starting...\r\n');
    }
  }

  /**
   * セッションの登録を解除
   */
  public unregisterSession(sessionId: string): void {
    this.sessionCallbacks.delete(sessionId);
    logger.info('Session unregistered from Claude terminal', { 
      sessionId, 
      remainingSessions: this.sessionCallbacks.size 
    });
  }

  /**
   * PWAからのキー入力をClaude CLIに即座に送信
   */
  public sendKeyInput(sessionId: string, keyData: string): boolean {
    if (!this.isReady || !this.claudePty) {
      logger.warn('Cannot send key input - Claude terminal not ready', { sessionId });
      return false;
    }

    try {
      // キー入力をPTY経由でClaude CLIに送信
      this.claudePty.write(keyData);
      
      logger.debug('Key input sent to Claude terminal via PTY', { 
        sessionId, 
        keyData: keyData.replace(/\r?\n/g, '\\n').substring(0, 50) 
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to send key input to Claude terminal', { 
        sessionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  /**
   * 直接コマンドを送信（必要に応じて）
   */
  public sendCommand(sessionId: string, command: string): boolean {
    if (!this.isReady || !this.claudePty) {
      logger.warn('Cannot send command - Claude terminal not ready', { sessionId });
      return false;
    }

    try {
      // コマンドを改行付きでPTY経由で送信
      this.claudePty.write(`${command}\n`);
      
      logger.info('Command sent to Claude terminal via PTY', { 
        sessionId, 
        command: command.substring(0, 100) 
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to send command to Claude terminal', { 
        sessionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  /**
   * Claude CLIターミナルの状態を取得
   */
  public getStatus(): { 
    isReady: boolean; 
    isInitializing: boolean; 
    activeSessions: number;
    processId?: number;
  } {
    return {
      isReady: this.isReady,
      isInitializing: this.isInitializing,
      activeSessions: this.sessionCallbacks.size,
      processId: this.claudePty?.pid,
    };
  }

  /**
   * Claude CLIプロセスを終了
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down Claude CLI interactive terminal');
    
    if (this.claudePty) {
      // 全セッションに終了通知
      const shutdownMessage = '\r\n[Host server shutting down...]\r\n';
      this.sessionCallbacks.forEach(({ onOutput }) => {
        onOutput(shutdownMessage);
      });

      // PTYを終了
      try {
        this.claudePty.kill();
        logger.info('Claude PTY terminated');
      } catch (error) {
        logger.warn('Failed to terminate Claude PTY gracefully', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    this.isReady = false;
    this.claudePty = null;
    this.sessionCallbacks.clear();
    logger.info('Claude CLI interactive terminal shutdown completed');
  }
}