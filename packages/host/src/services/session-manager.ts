import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { createLogger, LogTimer } from '../utils/logger';
import { ClaudeService } from './claude-service';
import { ClaudeSession, TerminalOutput, WebSocketMessage } from '@vibe-coder/shared';

const logger = createLogger('session-manager');

export interface ClientConnection {
  id: string;
  ws: WebSocket;
  sessionId?: string;
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    version?: string;
    connectedAt: number;
    lastPing: number;
  };
}

export interface SessionManagerEvents {
  clientConnected: (client: ClientConnection) => void;
  clientDisconnected: (clientId: string) => void;
  sessionAssigned: (clientId: string, sessionId: string) => void;
  messageReceived: (clientId: string, message: WebSocketMessage) => void;
}

export class SessionManager extends EventEmitter {
  private clients = new Map<string, ClientConnection>();
  private wsServer: WebSocketServer;
  private claudeService: ClaudeService;
  private heartbeatInterval: NodeJS.Timeout;
  private cleanupInterval: NodeJS.Timeout;

  constructor(wsServer: WebSocketServer, claudeService: ClaudeService) {
    super();
    this.wsServer = wsServer;
    this.claudeService = claudeService;

    this.setupWebSocketHandlers();
    this.setupClaudeServiceHandlers();
    this.startHeartbeat();
    this.startCleanup();

    logger.info('Session Manager initialized');
  }

  // WebSocketハンドラーの設定
  private setupWebSocketHandlers(): void {
    this.wsServer.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });
  }

  // Claude Serviceイベントハンドラーの設定
  private setupClaudeServiceHandlers(): void {
    this.claudeService.on('output', (sessionId: string, output: TerminalOutput) => {
      this.broadcastToSession(sessionId, {
        type: 'terminal-output',
        payload: output,
      });
    });

    this.claudeService.on('sessionCreated', (session: ClaudeSession) => {
      this.broadcastToSession(session.id, {
        type: 'session-created',
        payload: session,
      });
    });

    this.claudeService.on('sessionEnded', (sessionId: string, exitCode: number | null) => {
      this.broadcastToSession(sessionId, {
        type: 'session-ended',
        payload: { sessionId, exitCode },
      });
    });

    this.claudeService.on('error', (sessionId: string, error: Error) => {
      this.broadcastToSession(sessionId, {
        type: 'error',
        payload: {
          message: error.message,
          sessionId,
        },
      });
    });
  }

  // WebSocket接続の処理
  public async handleConnection(ws: WebSocket, request: any): Promise<void> {
    const clientId = this.generateClientId();
    const timer = new LogTimer(logger, 'handleConnection', { clientId });

    try {
      const client: ClientConnection = {
        id: clientId,
        ws,
        metadata: {
          userAgent: request.headers['user-agent'],
          ipAddress: request.socket.remoteAddress,
          version: request.headers['x-client-version'],
          connectedAt: Date.now(),
          lastPing: Date.now(),
        },
      };

      this.clients.set(clientId, client);
      this.setupClientHandlers(client);
      this.emit('clientConnected', client);

      // 接続確認メッセージ
      this.sendToClient(clientId, {
        type: 'connection-established',
        payload: {
          clientId,
          serverId: this.generateServerId(),
          serverTime: Date.now(),
        },
      });

      timer.finish({
        clientCount: this.clients.size,
        userAgent: client.metadata.userAgent,
      });

      logger.info('Client connected', {
        clientId,
        clientCount: this.clients.size,
        userAgent: client.metadata.userAgent,
        ipAddress: client.metadata.ipAddress,
      });

    } catch (error) {
      timer.error(error as Error);
      ws.close(1011, 'Internal server error');
      throw error;
    }
  }

  // クライアント用ハンドラーの設定
  private setupClientHandlers(client: ClientConnection): void {
    const { id: clientId, ws } = client;

    ws.on('message', async (data) => {
      try {
        const message = this.parseMessage(data);
        await this.handleMessage(clientId, message);
      } catch (error) {
        logger.error('Failed to handle client message', {
          clientId,
          error,
        });

        this.sendToClient(clientId, {
          type: 'error',
          payload: {
            message: 'Invalid message format',
            details: error instanceof Error ? error.message : String(error),
          },
        });
      }
    });

    ws.on('close', (code, reason) => {
      this.handleDisconnection(clientId, code, reason);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error', { clientId, error });
      this.handleDisconnection(clientId, 1011, 'WebSocket error');
    });

    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.metadata.lastPing = Date.now();
      }
    });
  }

  // メッセージの処理
  private async handleMessage(clientId: string, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      logger.warn('Message from unknown client', { clientId });
      return;
    }

    this.emit('messageReceived', clientId, message);

    const timer = new LogTimer(logger, `handleMessage:${message.type}`, {
      clientId,
      messageType: message.type,
    });

    try {
      switch (message.type) {
        case 'create-session':
          await this.handleCreateSession(clientId, message.payload);
          break;

        case 'execute-command':
          await this.handleExecuteCommand(clientId, message.payload);
          break;

        case 'terminate-session':
          await this.handleTerminateSession(clientId, message.payload);
          break;

        case 'ping':
          this.handlePing(clientId);
          break;

        case 'get-sessions':
          this.handleGetSessions(clientId);
          break;

        default:
          logger.warn('Unknown message type', {
            clientId,
            messageType: message.type,
          });
          
          this.sendToClient(clientId, {
            type: 'error',
            payload: {
              message: `Unknown message type: ${message.type}`,
            },
          });
      }

      timer.finish();
    } catch (error) {
      timer.error(error as Error);
      
      this.sendToClient(clientId, {
        type: 'error',
        payload: {
          message: error instanceof Error ? error.message : String(error),
          messageType: message.type,
        },
      });
    }
  }

  // セッション作成の処理
  private async handleCreateSession(clientId: string, payload: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const sessionId = payload.sessionId || uuidv4();
    const workspaceDir = payload.workspaceDir;

    const session = await this.claudeService.createSession(sessionId, workspaceDir);
    
    client.sessionId = sessionId;
    this.clients.set(clientId, client);
    this.emit('sessionAssigned', clientId, sessionId);

    this.sendToClient(clientId, {
      type: 'session-created',
      payload: session,
    });

    logger.info('Session created for client', {
      clientId,
      sessionId,
      workspaceDir: session.workspaceDir,
    });
  }

  // コマンド実行の処理
  private async handleExecuteCommand(clientId: string, payload: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) {
      throw new Error('No active session for command execution');
    }

    const { command } = payload;
    if (!command || typeof command !== 'string') {
      throw new Error('Invalid command payload');
    }

    // 実行開始の通知
    this.sendToClient(clientId, {
      type: 'command-started',
      payload: {
        command,
        sessionId: client.sessionId,
        timestamp: Date.now(),
      },
    });

    try {
      const result = await this.claudeService.executeCommand(client.sessionId, command);
      
      this.sendToClient(clientId, {
        type: 'command-completed',
        payload: result,
      });

      logger.info('Command executed successfully', {
        clientId,
        sessionId: client.sessionId,
        command: command.substring(0, 100),
        duration: result.duration,
        exitCode: result.exitCode,
      });

    } catch (error) {
      this.sendToClient(clientId, {
        type: 'command-failed',
        payload: {
          command,
          error: error instanceof Error ? error.message : String(error),
          sessionId: client.sessionId,
        },
      });

      throw error;
    }
  }

  // セッション終了の処理
  private async handleTerminateSession(clientId: string, payload: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) {
      throw new Error('No active session to terminate');
    }

    await this.claudeService.terminateSession(client.sessionId);
    
    client.sessionId = undefined;
    this.clients.set(clientId, client);

    this.sendToClient(clientId, {
      type: 'session-terminated',
      payload: {
        sessionId: client.sessionId,
      },
    });

    logger.info('Session terminated for client', {
      clientId,
      sessionId: client.sessionId,
    });
  }

  // Pingの処理
  private handlePing(clientId: string): void {
    this.sendToClient(clientId, {
      type: 'pong',
      payload: {
        timestamp: Date.now(),
      },
    });
  }

  // セッション一覧の処理
  private handleGetSessions(clientId: string): void {
    const sessions = this.claudeService.getActiveSessions();
    
    this.sendToClient(clientId, {
      type: 'sessions-list',
      payload: {
        sessions,
        count: sessions.length,
      },
    });
  }

  // クライアント切断の処理
  private handleDisconnection(clientId: string, code: number, reason: Buffer): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // セッションがあれば終了
    if (client.sessionId) {
      this.claudeService.terminateSession(client.sessionId).catch(error => {
        logger.error('Failed to terminate session on disconnect', {
          clientId,
          sessionId: client.sessionId,
          error,
        });
      });
    }

    this.clients.delete(clientId);
    this.emit('clientDisconnected', clientId);

    logger.info('Client disconnected', {
      clientId,
      sessionId: client.sessionId,
      code,
      reason: reason.toString(),
      duration: Date.now() - client.metadata.connectedAt,
      clientCount: this.clients.size,
    });
  }

  // セッションへのブロードキャスト
  private broadcastToSession(sessionId: string, message: WebSocketMessage): void {
    for (const client of this.clients.values()) {
      if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(client.id, message);
      }
    }
  }

  // クライアントへのメッセージ送信
  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      logger.debug('Cannot send message to client', {
        clientId,
        readyState: client?.ws.readyState,
        messageType: message.type,
      });
      return;
    }

    try {
      const data = JSON.stringify(message);
      client.ws.send(data);
      
      logger.debug('Message sent to client', {
        clientId,
        messageType: message.type,
        dataSize: data.length,
      });
    } catch (error) {
      logger.error('Failed to send message to client', {
        clientId,
        messageType: message.type,
        error,
      });
    }
  }

  // メッセージのパース
  private parseMessage(data: any): WebSocketMessage {
    try {
      const parsed = JSON.parse(data.toString());
      
      if (!parsed.type) {
        throw new Error('Message must have a type field');
      }

      return {
        type: parsed.type,
        payload: parsed.payload || {},
      };
    } catch (error) {
      throw new Error(`Invalid JSON message: ${error.message}`);
    }
  }

  // ハートビートの開始
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, client] of this.clients) {
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.ping();
          } catch (error) {
            logger.error('Failed to send ping', { clientId, error });
            this.handleDisconnection(clientId, 1011, Buffer.from('Ping failed'));
          }
        }
      }
    }, 30000); // 30秒間隔

    logger.debug('Heartbeat started');
  }

  // クリーンアップの開始
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 120000; // 2分

      for (const [clientId, client] of this.clients) {
        // 長時間Pongがないクライアントを切断
        if (now - client.metadata.lastPing > timeout) {
          logger.info('Disconnecting inactive client', {
            clientId,
            lastPing: new Date(client.metadata.lastPing).toISOString(),
            inactiveMinutes: Math.round((now - client.metadata.lastPing) / 60000),
          });
          
          this.handleDisconnection(clientId, 1001, Buffer.from('Inactive client'));
        }
      }
    }, 60000); // 1分間隔

    logger.debug('Cleanup monitor started');
  }

  // クライアントID生成
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // サーバーID生成
  private generateServerId(): string {
    return `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 統計情報の取得
  public getStats(): Record<string, any> {
    const activeSessions = this.claudeService.getActiveSessions();
    
    return {
      connectedClients: this.clients.size,
      activeSessions: activeSessions.length,
      clientsWithSessions: Array.from(this.clients.values())
        .filter(client => client.sessionId).length,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  // クリーンアップ
  public async cleanup(): Promise<void> {
    logger.info('Starting Session Manager cleanup');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // すべてのクライアントを切断
    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(1001, 'Server shutdown');
      }
    }

    this.clients.clear();
    logger.info('Session Manager cleanup completed');
  }
}

// ファクトリー関数
export function setupSessionManager(
  wsServer: WebSocketServer, 
  claudeService: ClaudeService
): SessionManager {
  return new SessionManager(wsServer, claudeService);
}