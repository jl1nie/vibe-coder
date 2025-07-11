import SimplePeer from 'simple-peer';
import logger from '../utils/logger';
import { SessionManager } from './session-manager';
import { ClaudeService } from './claude-service';
import { ClaudeInteractiveService } from './claude-interactive-service';

export interface WebRTCConnection {
  id: string;
  peer: SimplePeer.Instance;
  sessionId: string;
  isConnected: boolean;
  createdAt: Date;
  lastActivity: Date;
}

export class WebRTCService {
  private connections = new Map<string, WebRTCConnection>();
  private claudeInteractiveService: ClaudeInteractiveService;

  constructor(_sessionManager: SessionManager, _claudeService: ClaudeService) {
    this.claudeInteractiveService = new ClaudeInteractiveService();
  }

  /**
   * WebRTC接続を開始（ホスト側）
   */
  public async createConnection(sessionId: string): Promise<WebRTCConnection> {
    const connectionId = `${sessionId}-${Date.now()}`;
    
    logger.info('Creating WebRTC connection', { sessionId, connectionId });

    // Import wrtc dynamically to avoid TypeScript module resolution issues
    let wrtc: any;
    try {
      wrtc = require('wrtc');
    } catch (error) {
      logger.warn('wrtc module not available, WebRTC may not work in Node.js environment', {
        error: (error as Error).message
      });
    }

    // Simple Peer インスタンスを作成（ホスト側はinitiator: false - クライアントがofferを送る）
    const peer = new SimplePeer({
      initiator: false,
      trickle: true,
      wrtc: wrtc, // Node.js WebRTC implementation
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }
    });

    const connection: WebRTCConnection = {
      id: connectionId,
      peer,
      sessionId,
      isConnected: false,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.connections.set(connectionId, connection);

    // WebRTC イベントハンドラー設定
    this.setupPeerEventHandlers(connection);

    return connection;
  }

  /**
   * WebRTC Peer のイベントハンドラー設定
   */
  private setupPeerEventHandlers(connection: WebRTCConnection): void {
    const { peer, sessionId, id } = connection;

    peer.on('signal', async (data: any) => {
      logger.info('WebRTC signal generated (answer)', { sessionId, connectionId: id, signalType: data.type });
      
      // ホスト側から生成されるアンサーやICE candidateをログ出力
      // 実際のシグナリングは /signal エンドポイントで処理される
      if (data.type === 'answer') {
        logger.info('WebRTC answer generated for client', { sessionId, connectionId: id });
      }
    });

    peer.on('connect', () => {
      logger.info('WebRTC peer connected', { sessionId, connectionId: id });
      connection.isConnected = true;
      connection.lastActivity = new Date();
    });

    peer.on('data', (data: any) => {
      logger.info('WebRTC data received', { sessionId, connectionId: id });
      connection.lastActivity = new Date();
      
      try {
        const message = JSON.parse(data.toString());
        this.handleDataChannelMessage(connection, message);
      } catch (error) {
        logger.error('Invalid WebRTC data format', {
          sessionId,
          error: (error as Error).message
        });
      }
    });

    peer.on('close', () => {
      logger.info('WebRTC peer closed', { sessionId, connectionId: id });
      connection.isConnected = false;
      this.connections.delete(id);
    });

    peer.on('error', (error: any) => {
      logger.error('WebRTC peer error', {
        sessionId,
        connectionId: id,
        error: error.message
      });
      connection.isConnected = false;
      this.connections.delete(id);
    });
  }

  /**
   * データチャネルメッセージのハンドリング
   */
  private async handleDataChannelMessage(connection: WebRTCConnection, message: any): Promise<void> {
    const { sessionId, id } = connection;
    
    switch (message.type) {
      case 'ping':
        this.sendToPeer(connection, { type: 'pong', timestamp: Date.now() });
        break;
        
      case 'claude-command':
        logger.info('Claude command received via WebRTC', {
          sessionId,
          connectionId: id,
          command: message.command
        });
        
        try {
          // インタラクティブセッションが存在しない場合は作成
          let session = this.claudeInteractiveService.getSession(sessionId);
          if (!session) {
            session = await this.claudeInteractiveService.createSession(sessionId);
            
            // セッション作成通知
            this.sendToPeer(connection, {
              type: 'output',
              data: 'Creating Claude interactive session...\r\n'
            });
            
            // セッションがreadyになるまで待機
            await new Promise<void>((resolve) => {
              session!.onReady = () => {
                this.sendToPeer(connection, {
                  type: 'output',
                  data: 'Claude session ready! You can now send commands.\r\n'
                });
                resolve();
              };
              
              // タイムアウト設定
              setTimeout(() => {
                this.sendToPeer(connection, {
                  type: 'error',
                  error: 'Claude session startup timeout'
                });
                resolve();
              }, 10000);
            });
          }
          
          if (!session.isReady) {
            this.sendToPeer(connection, {
              type: 'error',
              error: 'Claude session is not ready'
            });
            break;
          }
          
          // リアルタイム出力のハンドラーを設定
          session.onOutput = (data: string) => {
            this.sendToPeer(connection, {
              type: 'output',
              data: data
            });
          };
          
          session.onError = (error: string) => {
            this.sendToPeer(connection, {
              type: 'error',
              error: error
            });
          };
          
          // コマンドを送信
          const result = await this.claudeInteractiveService.sendCommand(sessionId, message.command);
          
          // 最終結果を送信
          if (result.output) {
            this.sendToPeer(connection, {
              type: 'output',
              data: result.output + '\r\n'
            });
          }
          
          if (result.error) {
            this.sendToPeer(connection, {
              type: 'error',
              error: result.error
            });
          }
          
          // コマンド実行完了通知
          this.sendToPeer(connection, {
            type: 'completed',
            timestamp: Date.now()
          });
          
        } catch (error) {
          logger.error('Failed to execute Claude command via WebRTC', {
            sessionId,
            connectionId: id,
            command: message.command,
            error: (error as Error).message
          });
          
          this.sendToPeer(connection, {
            type: 'error',
            error: `Command execution failed: ${(error as Error).message}`
          });
        }
        break;
        
      case 'response':
        // ユーザーからの応答（プロンプト対応用）
        logger.info('User response received via WebRTC', {
          sessionId,
          connectionId: id,
          response: message.response
        });
        
        // TODO: プロンプト対応機能の実装
        this.sendToPeer(connection, {
          type: 'output',
          data: `Received response: ${message.response}\r\n`
        });
        break;
        
      default:
        logger.warn('Unknown WebRTC message type', {
          sessionId,
          connectionId: id,
          type: message.type
        });
    }
  }

  /**
   * Peerにメッセージを送信
   */
  public sendToPeer(connection: WebRTCConnection, message: any): void {
    if (!connection.isConnected) {
      logger.warn('Cannot send message to disconnected peer', {
        sessionId: connection.sessionId,
        connectionId: connection.id
      });
      return;
    }

    try {
      connection.peer.send(JSON.stringify(message));
      connection.lastActivity = new Date();
    } catch (error) {
      logger.error('Failed to send message to peer', {
        sessionId: connection.sessionId,
        connectionId: connection.id,
        error: (error as Error).message
      });
    }
  }

  /**
   * シグナリングサーバーからのAnswerを処理
   */
  public async handleAnswer(sessionId: string, answer: string): Promise<void> {
    const connection = this.findConnectionBySessionId(sessionId);
    if (!connection) {
      logger.error('Connection not found for answer', { sessionId });
      return;
    }

    try {
      const answerData = JSON.parse(answer);
      connection.peer.signal(answerData);
      logger.info('Answer processed successfully', { sessionId, connectionId: connection.id });
    } catch (error) {
      logger.error('Failed to process answer', {
        sessionId,
        error: (error as Error).message
      });
    }
  }

  /**
   * シグナリングサーバーからのICE Candidateを処理
   */
  public async handleIceCandidate(sessionId: string, candidate: any): Promise<void> {
    const connection = this.findConnectionBySessionId(sessionId);
    if (!connection) {
      logger.error('Connection not found for ICE candidate', { sessionId });
      return;
    }

    try {
      // candidate is already a JavaScript object, not a JSON string
      connection.peer.signal(candidate);
      logger.info('ICE candidate processed successfully', { sessionId, connectionId: connection.id });
    } catch (error) {
      logger.error('Failed to process ICE candidate', {
        sessionId,
        error: (error as Error).message
      });
    }
  }


  /**
   * セッションIDで接続を検索
   */
  private findConnectionBySessionId(sessionId: string): WebRTCConnection | undefined {
    for (const connection of this.connections.values()) {
      if (connection.sessionId === sessionId) {
        return connection;
      }
    }
    return undefined;
  }

  /**
   * 全ての接続を取得
   */
  public getConnections(): WebRTCConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * 特定のセッションの接続を取得
   */
  public getConnectionBySessionId(sessionId: string): WebRTCConnection | undefined {
    return this.findConnectionBySessionId(sessionId);
  }

  /**
   * 接続を削除
   */
  public removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      if (connection.isConnected) {
        connection.peer.destroy();
      }
      this.connections.delete(connectionId);
      logger.info('Connection removed', { connectionId, sessionId: connection.sessionId });
    }
  }

  /**
   * 全ての接続を削除
   */
  public destroy(): void {
    for (const connection of this.connections.values()) {
      if (connection.isConnected) {
        connection.peer.destroy();
      }
    }
    this.connections.clear();
    
    // インタラクティブセッションも破棄
    this.claudeInteractiveService.destroy();
    
    logger.info('WebRTC service destroyed');
  }

  /**
   * 非アクティブな接続をクリーンアップ
   */
  public cleanupInactiveConnections(): void {
    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5分

    for (const [connectionId, connection] of this.connections.entries()) {
      if (now.getTime() - connection.lastActivity.getTime() > inactiveThreshold) {
        logger.info('Cleaning up inactive connection', {
          connectionId,
          sessionId: connection.sessionId,
          lastActivity: connection.lastActivity
        });
        this.removeConnection(connectionId);
      }
    }
  }
}