import SimplePeer from 'simple-peer';
import { SignalMessage, SignalResponse } from '@vibe-coder/shared';
import logger from '../utils/logger';
import { hostConfig } from '../utils/config';
import { SessionManager } from './session-manager';

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
  private signalingUrl: string;
  private sessionManager: SessionManager;

  constructor(sessionManager: SessionManager) {
    this.signalingUrl = hostConfig.signalingUrl;
    this.sessionManager = sessionManager;
  }

  /**
   * WebRTC接続を開始（ホスト側）
   */
  public async createConnection(sessionId: string): Promise<WebRTCConnection> {
    const connectionId = `${sessionId}-${Date.now()}`;
    
    logger.info('Creating WebRTC connection', { sessionId, connectionId });

    // Simple Peer インスタンスを作成（ホスト側はinitiator: true）
    const peer = new SimplePeer({
      initiator: true,
      trickle: true,
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
      logger.info('WebRTC signal generated', { sessionId, connectionId: id });
      
      try {
        // シグナリングサーバーにofferを送信
        await this.sendToSignalingServer({
          type: 'offer',
          sessionId,
          hostId: this.sessionManager.getHostId(),
          offer: {
            type: 'offer',
            sessionId,
            sdp: JSON.stringify(data),
            timestamp: Date.now()
          }
        });
      } catch (error) {
        logger.error('Failed to send signal to signaling server', {
          sessionId,
          error: (error as Error).message
        });
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
  private handleDataChannelMessage(connection: WebRTCConnection, message: any): void {
    const { sessionId, id } = connection;
    
    switch (message.type) {
      case 'ping':
        this.sendToPeer(connection, { type: 'pong', timestamp: Date.now() });
        break;
        
      case 'claude-command':
        // Claude Codeコマンドの実行は別のサービスが担当
        // ここではメッセージを中継するだけ
        logger.info('Claude command received via WebRTC', {
          sessionId,
          connectionId: id,
          command: message.command
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
  public async handleIceCandidate(sessionId: string, candidate: string): Promise<void> {
    const connection = this.findConnectionBySessionId(sessionId);
    if (!connection) {
      logger.error('Connection not found for ICE candidate', { sessionId });
      return;
    }

    try {
      const candidateData = JSON.parse(candidate);
      connection.peer.signal(candidateData);
      logger.info('ICE candidate processed successfully', { sessionId, connectionId: connection.id });
    } catch (error) {
      logger.error('Failed to process ICE candidate', {
        sessionId,
        error: (error as Error).message
      });
    }
  }

  /**
   * シグナリングサーバーにメッセージを送信
   */
  private async sendToSignalingServer(message: SignalMessage): Promise<SignalResponse> {
    const response = await fetch(this.signalingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Signaling server error: ${response.status}`);
    }

    return response.json();
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