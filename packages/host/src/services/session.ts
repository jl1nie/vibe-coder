import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import * as path from 'path';
import { 
  createLogger, 
  generateId, 
  createError,
  ERROR_CODES,
  TerminalOutput,
  WEBSOCKET_EVENTS,
  SECURITY_LIMITS
} from '@vibe-coder/shared';
import { ClaudeService, ClaudeSession, CommandExecution } from './claude';

const logger = createLogger('session-manager');

export interface ClientConnection {
  id: string;
  websocket: WebSocket;
  claudeSession: ClaudeSession | null;
  connectedAt: string;
  lastPing: string;
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    version?: string;
  };
}

export interface SessionStartRequest {
  workspaceDir: string;
  projectName?: string;
  metadata?: Record<string, any>;
}

export interface CommandRequest {
  command: string;
  sessionId: string;
  options?: {
    timeout?: number;
    env?: Record<string, string>;
  };
}

export class SessionManager extends EventEmitter {
  private clients = new Map<string, ClientConnection>();
  private claudeService: ClaudeService;
  private heartbeatInterval: NodeJS.Timeout;
  private readonly maxClients = SECURITY_LIMITS.MAX_CONCURRENT_SESSIONS;

  constructor(claudeService: ClaudeService) {
    super();
    this.claudeService = claudeService;

    // ハートビート監視（30秒ごと）
    this.heartbeatInterval = setInterval(() => {
      this.checkClientHeartbeats();
    }, 30000);

    logger.info('SessionManager initialized', { maxClients: this.maxClients });
  }

  public async handleConnection(ws: WebSocket, clientId: string, metadata?: any): Promise<void> {
    // 接続数制限チェック
    if (this.clients.size >= this.maxClients) {
      logger.warn('Max client connections reached', { 
        current: this.clients.size, 
        max: this.maxClients,
        newClientId: clientId 
      });

      ws.close(1013, 'Server overloaded');
      return;
    }

    // 既存接続の重複チェック
    if (this.clients.has(clientId)) {
      logger.info('Replacing existing client connection', { clientId });
      await this.disconnectClient(clientId);
    }

    // クライアント登録
    const client: ClientConnection = {
      id: clientId,
      websocket: ws,
      claudeSession: null,
      connectedAt: new Date().toISOString(),
      lastPing: new Date().toISOString(),
      metadata: metadata || {},
    };

    this.clients.set(clientId, client);

    logger.info('Client connected', { 
      clientId, 
      totalClients: this.clients.size,
      metadata: client.metadata 
    });

    // WebSocketイベント設定
    this.setupWebSocketHandlers(client);

    // 接続確認送信
    this.sendToClient(clientId, {
      type: 'connection-established',
      data: {
        clientId,
        serverId: process.env.HOST_ID || 'vibe-coder-host',
        serverVersion: process.env.npm_package_version || '0.1.0',
        capabilities: ['claude-code', 'file-upload', 'voice-recognition'],
      },
    });

    this.emit('client-connected', client);
  }

  private setupWebSocketHandlers(client: ClientConnection): void {
    const { websocket, id: clientId } = client;

    // メッセージ受信
    websocket.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(clientId, message);
      } catch (error) {
        logger.error('Failed to parse WebSocket message', { 
          clientId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });

        this.sendToClient(clientId, {
          type: 'error',
          error: 'Invalid message format',
        });
      }
    });

    // 接続切断
    websocket.on('close', (code: number, reason: Buffer) => {
      logger.info('Client disconnected', { 
        clientId, 
        code, 
        reason: reason.toString() 
      });
      this.disconnectClient(clientId);
    });

    // エラー処理
    websocket.on('error', (error: Error) => {
      logger.error('WebSocket error', { clientId, error: error.message });
      this.disconnectClient(clientId);
    });

    // Pong受信（ハートビート）
    websocket.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.lastPing = new Date().toISOString();
      }
    });
  }

  private async handleMessage(clientId: string, message: any): Promise<void> {
    const { type, data } = message;

    logger.debug('Received message', { clientId, type });

    try {
      switch (type) {
        case WEBSOCKET_EVENTS.SESSION_START:
          await this.handleSessionStart(clientId, data);
          break;

        case WEBSOCKET_EVENTS.SESSION_END:
          await this.handleSessionEnd(clientId);
          break;

        case WEBSOCKET_EVENTS.COMMAND:
          await this.handleCommand(clientId, data);
          break;

        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
          break;

        case 'interrupt':
          await this.handleInterrupt(clientId);
          break;

        default:
          logger.warn('Unknown message type', { clientId, type });
          this.sendToClient(clientId, {
            type: 'error',
            error: `Unknown message type: ${type}`,
          });
      }
    } catch (error) {
      logger.error('Error handling message', { 
        clientId, 
        type, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });

      this.sendToClient(clientId, {
        type: 'error',
        error: error instanceof Error ? error.message : 'Internal server error',
        code: (error as any).code || ERROR_CODES.INTERNAL_ERROR,
      });
    }
  }

  private async handleSessionStart(clientId: string, data: SessionStartRequest): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw createError(ERROR_CODES.SESSION_NOT_FOUND, 'Client not found');
    }

    // 既存セッションがある場合は終了
    if (client.claudeSession) {
      await client.claudeSession.cleanup();
    }

    // ワークスペースディレクトリの設定
    const workspaceDir = this.resolveWorkspaceDir(data.workspaceDir);

    // 新しいClaudeセッション作成
    const claudeSession = await this.claudeService.createSession(workspaceDir);
    client.claudeSession = claudeSession;

    // セッションイベント監視
    this.setupClaudeSessionHandlers(claudeSession, clientId);

    logger.info('Claude session started', { 
      clientId, 
      sessionId: claudeSession.id,
      workspaceDir,
      projectName: data.projectName 
    });

    this.sendToClient(clientId, {
      type: WEBSOCKET_EVENTS.SESSION_START,
      data: {
        sessionId: claudeSession.id,
        workspaceDir,
        status: 'ready',
      },
    });

    this.emit('session-started', { clientId, session: claudeSession });
  }

  private async handleSessionEnd(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.claudeSession) {
      return;
    }

    const sessionId = client.claudeSession.id;
    
    await client.claudeSession.cleanup();
    await this.claudeService.removeSession(sessionId);
    client.claudeSession = null;

    logger.info('Claude session ended', { clientId, sessionId });

    this.sendToClient(clientId, {
      type: WEBSOCKET_EVENTS.SESSION_END,
      data: { sessionId },
    });

    this.emit('session-ended', { clientId, sessionId });
  }

  private async handleCommand(clientId: string, data: CommandRequest): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.claudeSession) {
      throw createError(ERROR_CODES.SESSION_NOT_FOUND, 'No active session');
    }

    const { command, options } = data;
    const sessionId = client.claudeSession.id;

    logger.info('Executing command', { 
      clientId, 
      sessionId, 
      command: command.substring(0, 100) 
    });

    // コマンド実行開始通知
    this.sendToClient(clientId, {
      type: 'command-started',
      data: { command, sessionId },
    });

    try {
      const execution = await this.claudeService.executeCommand(
        sessionId,
        command,
        clientId,
        options
      );

      // 実行完了通知
      this.sendToClient(clientId, {
        type: 'command-completed',
        data: {
          executionId: execution.id,
          exitCode: execution.exitCode,
          duration: (execution.endTime || Date.now()) - execution.startTime,
        },
      });

    } catch (error) {
      // エラー通知
      this.sendToClient(clientId, {
        type: 'command-error',
        error: error instanceof Error ? error.message : 'Command execution failed',
        code: (error as any).code || ERROR_CODES.COMMAND_FAILED,
      });
    }
  }

  private async handleInterrupt(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.claudeSession) {
      return;
    }

    await client.claudeSession.interrupt();

    this.sendToClient(clientId, {
      type: 'command-interrupted',
      data: { sessionId: client.claudeSession.id },
    });
  }

  private setupClaudeSessionHandlers(session: ClaudeSession, clientId: string): void {
    // リアルタイム出力転送
    session.on('output', (output: TerminalOutput) => {
      this.sendToClient(clientId, {
        type: WEBSOCKET_EVENTS.OUTPUT,
        data: output,
      });
    });

    // 実行状態変更通知
    session.on('execution-started', (execution: CommandExecution) => {
      this.sendToClient(clientId, {
        type: 'execution-status',
        data: {
          executionId: execution.id,
          status: execution.status,
          command: execution.command,
        },
      });
    });

    session.on('execution-completed', (execution: CommandExecution) => {
      this.sendToClient(clientId, {
        type: 'execution-status',
        data: {
          executionId: execution.id,
          status: execution.status,
          exitCode: execution.exitCode,
          error: execution.error,
        },
      });
    });
  }

  public sendToClient(clientId: string, message: any): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.websocket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.websocket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Failed to send message to client', { clientId, error });
      return false;
    }
  }

  public broadcast(message: any, excludeClientId?: string): void {
    for (const [clientId, client] of this.clients.entries()) {
      if (excludeClientId && clientId === excludeClientId) {
        continue;
      }

      this.sendToClient(clientId, message);
    }
  }

  public async disconnectClient(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    // Claudeセッション終了
    if (client.claudeSession) {
      await client.claudeSession.cleanup();
      await this.claudeService.removeSession(client.claudeSession.id);
    }

    // WebSocket切断
    if (client.websocket.readyState === WebSocket.OPEN) {
      client.websocket.close();
    }

    this.clients.delete(clientId);

    logger.info('Client disconnected and cleaned up', { 
      clientId, 
      remainingClients: this.clients.size 
    });

    this.emit('client-disconnected', { clientId });
  }

  public getClientInfo(clientId: string): ClientConnection | undefined {
    return this.clients.get(clientId);
  }

  public getAllClients(): ClientConnection[] {
    return Array.from(this.clients.values());
  }

  public getStats(): {
    totalClients: number;
    activeSessions: number;
    uptime: number;
  } {
    const activeSessions = Array.from(this.clients.values())
      .filter(client => client.claudeSession !== null).length;

    return {
      totalClients: this.clients.size,
      activeSessions,
      uptime: process.uptime(),
    };
  }

  private resolveWorkspaceDir(requestedDir: string): string {
    // セキュリティ: 相対パスやパストラバーサル攻撃を防ぐ
    const baseWorkspaceDir = process.env.WORKSPACE_DIR || '/app/workspace';
    const resolvedPath = path.resolve(baseWorkspaceDir, requestedDir.replace(/\.\./g, ''));
    
    // ベースディレクトリ外へのアクセスを防ぐ
    if (!resolvedPath.startsWith(baseWorkspaceDir)) {
      throw createError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid workspace directory path'
      );
    }

    return resolvedPath;
  }

  private checkClientHeartbeats(): void {
    const now = Date.now();
    const heartbeatTimeout = 60000; // 1分

    for (const [clientId, client] of this.clients.entries()) {
      const lastPingTime = new Date(client.lastPing).getTime();
      
      if (now - lastPingTime > heartbeatTimeout) {
        logger.warn('Client heartbeat timeout', { 
          clientId, 
          lastPing: client.lastPing 
        });
        this.disconnectClient(clientId);
      } else {
        // Pingを送信してハートビートチェック
        client.websocket.ping();
      }
    }
  }

  public async cleanup(): Promise<void> {
    logger.info('Cleaning up SessionManager');

    clearInterval(this.heartbeatInterval);

    // 全クライアントの切断
    const disconnectPromises = Array.from(this.clients.keys()).map(
      clientId => this.disconnectClient(clientId)
    );

    await Promise.all(disconnectPromises);
    this.clients.clear();
    this.removeAllListeners();
  }
}