import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import * as crypto from 'crypto';
import { 
  createLogger, 
  generateId, 
  createError,
  ERROR_CODES,
  WebRTCSignalMessage,
  validateWebRTCSignalMessage,
  WEBRTC_CONFIG
} from '@vibe-coder/shared';

const logger = createLogger('webrtc-service');

export interface PeerConnection {
  id: string;
  serverId: string;
  clientId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'failed';
  createdAt: string;
  lastActivity: string;
  signalData?: any;
  metadata?: Record<string, any>;
}

export interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate' | 'close';
  data: any;
  timestamp: number;
}

export interface WebRTCStats {
  totalConnections: number;
  activeConnections: number;
  failedConnections: number;
  averageConnectionTime: number;
}

export class WebRTCService extends EventEmitter {
  private connections = new Map<string, PeerConnection>();
  private signalQueue = new Map<string, SignalData[]>();
  private connectionStats = {
    total: 0,
    successful: 0,
    failed: 0,
    totalConnectionTime: 0,
  };
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    
    // 定期クリーンアップ（5分ごと）
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 300000);

    logger.info('WebRTCService initialized');
  }

  public async createPeerConnection(
    clientId: string, 
    metadata?: Record<string, any>
  ): Promise<PeerConnection> {
    const connectionId = generateId();
    const serverId = this.generateServerId();

    const connection: PeerConnection = {
      id: connectionId,
      serverId,
      clientId,
      status: 'connecting',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      metadata: metadata || {},
    };

    this.connections.set(connectionId, connection);
    this.connectionStats.total++;

    logger.info('Created new peer connection', { 
      connectionId, 
      serverId, 
      clientId,
      totalConnections: this.connections.size 
    });

    this.emit('connection-created', connection);
    return connection;
  }

  public async handleSignal(
    ws: WebSocket, 
    signalMessage: any, 
    clientId: string
  ): Promise<void> {
    try {
      // メッセージ検証
      if (!validateWebRTCSignalMessage(signalMessage)) {
        throw createError(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid WebRTC signal message format'
        );
      }

      const { type, serverId, data } = signalMessage as WebRTCSignalMessage;

      logger.debug('Received WebRTC signal', { 
        type, 
        serverId, 
        clientId 
      });

      switch (type) {
        case 'offer':
          await this.handleOffer(ws, serverId, clientId, data);
          break;

        case 'answer':
          await this.handleAnswer(ws, serverId, clientId, data);
          break;

        case 'ice-candidate':
          await this.handleIceCandidate(ws, serverId, clientId, data);
          break;

        case 'close':
          await this.handleClose(serverId, clientId);
          break;

        default:
          throw createError(
            ERROR_CODES.VALIDATION_ERROR,
            `Unknown signal type: ${type}`
          );
      }

    } catch (error) {
      logger.error('Error handling WebRTC signal', { 
        clientId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });

      this.sendSignalResponse(ws, {
        type: 'error',
        error: error instanceof Error ? error.message : 'Signal processing failed',
        code: (error as any).code || ERROR_CODES.WEBRTC_ERROR,
      });
    }
  }

  private async handleOffer(
    ws: WebSocket, 
    serverId: string, 
    clientId: string, 
    offerData: any
  ): Promise<void> {
    const connection = this.findConnectionByServerId(serverId);
    
    if (!connection) {
      throw createError(
        ERROR_CODES.CONNECTION_FAILED,
        `Connection not found for server ID: ${serverId}`
      );
    }

    // Offer データを保存
    connection.signalData = {
      type: 'offer',
      data: offerData,
      timestamp: Date.now(),
    };
    
    this.updateConnectionActivity(connection.id);

    logger.info('Received WebRTC offer', { 
      connectionId: connection.id, 
      serverId, 
      clientId 
    });

    // シグナリングキューに追加
    this.addToSignalQueue(serverId, {
      type: 'offer',
      data: offerData,
      timestamp: Date.now(),
    });

    // Answer待機のためのタイムアウト設定（30秒）
    setTimeout(() => {
      if (connection.status === 'connecting') {
        logger.warn('WebRTC offer timeout', { connectionId: connection.id });
        this.updateConnectionStatus(connection.id, 'failed');
        this.connectionStats.failed++;
      }
    }, 30000);

    this.sendSignalResponse(ws, {
      type: 'offer-received',
      serverId,
      status: 'waiting-for-answer',
    });

    this.emit('offer-received', { connection, offerData });
  }

  private async handleAnswer(
    ws: WebSocket, 
    serverId: string, 
    clientId: string, 
    answerData: any
  ): Promise<void> {
    const connection = this.findConnectionByServerId(serverId);
    
    if (!connection) {
      throw createError(
        ERROR_CODES.CONNECTION_FAILED,
        `Connection not found for server ID: ${serverId}`
      );
    }

    if (!connection.signalData || connection.signalData.type !== 'offer') {
      throw createError(
        ERROR_CODES.CONNECTION_FAILED,
        'No valid offer found for this connection'
      );
    }

    logger.info('Received WebRTC answer', { 
      connectionId: connection.id, 
      serverId, 
      clientId 
    });

    // Answer データを処理
    this.addToSignalQueue(serverId, {
      type: 'answer',
      data: answerData,
      timestamp: Date.now(),
    });

    // 接続成功として記録
    this.updateConnectionStatus(connection.id, 'connected');
    this.connectionStats.successful++;
    
    const connectionTime = Date.now() - new Date(connection.createdAt).getTime();
    this.connectionStats.totalConnectionTime += connectionTime;

    this.sendSignalResponse(ws, {
      type: 'answer-received',
      serverId,
      status: 'connected',
      connectionTime,
    });

    this.emit('connection-established', { connection, answerData });
  }

  private async handleIceCandidate(
    ws: WebSocket, 
    serverId: string, 
    clientId: string, 
    candidateData: any
  ): Promise<void> {
    const connection = this.findConnectionByServerId(serverId);
    
    if (!connection) {
      logger.warn('ICE candidate for unknown connection', { serverId, clientId });
      return;
    }

    logger.debug('Received ICE candidate', { 
      connectionId: connection.id, 
      serverId 
    });

    // ICE candidate をキューに追加
    this.addToSignalQueue(serverId, {
      type: 'ice-candidate',
      data: candidateData,
      timestamp: Date.now(),
    });

    this.updateConnectionActivity(connection.id);

    this.sendSignalResponse(ws, {
      type: 'ice-candidate-received',
      serverId,
    });

    this.emit('ice-candidate-received', { connection, candidateData });
  }

  private async handleClose(serverId: string, clientId: string): Promise<void> {
    const connection = this.findConnectionByServerId(serverId);
    
    if (connection) {
      logger.info('WebRTC connection closed', { 
        connectionId: connection.id, 
        serverId, 
        clientId 
      });

      this.updateConnectionStatus(connection.id, 'disconnected');
      this.emit('connection-closed', { connection });
    }

    // シグナリングキューからクリーンアップ
    this.signalQueue.delete(serverId);
  }

  public getSignalData(serverId: string, type?: string): SignalData[] {
    const signals = this.signalQueue.get(serverId) || [];
    
    if (type) {
      return signals.filter(signal => signal.type === type);
    }
    
    return signals;
  }

  public clearSignalData(serverId: string, type?: string): void {
    if (!type) {
      this.signalQueue.delete(serverId);
      return;
    }

    const signals = this.signalQueue.get(serverId) || [];
    const filtered = signals.filter(signal => signal.type !== type);
    
    if (filtered.length > 0) {
      this.signalQueue.set(serverId, filtered);
    } else {
      this.signalQueue.delete(serverId);
    }
  }

  public getConnection(connectionId: string): PeerConnection | undefined {
    return this.connections.get(connectionId);
  }

  public getConnectionByServerId(serverId: string): PeerConnection | undefined {
    return this.findConnectionByServerId(serverId);
  }

  public getAllConnections(): PeerConnection[] {
    return Array.from(this.connections.values());
  }

  public getActiveConnections(): PeerConnection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.status === 'connected');
  }

  public getStats(): WebRTCStats {
    const activeConnections = this.getActiveConnections().length;
    const averageConnectionTime = this.connectionStats.successful > 0 
      ? this.connectionStats.totalConnectionTime / this.connectionStats.successful 
      : 0;

    return {
      totalConnections: this.connectionStats.total,
      activeConnections,
      failedConnections: this.connectionStats.failed,
      averageConnectionTime,
    };
  }

  public async cleanup(clientId?: string): Promise<void> {
    if (clientId) {
      // 特定クライアントの接続をクリーンアップ
      const clientConnections = Array.from(this.connections.values())
        .filter(conn => conn.clientId === clientId);

      for (const connection of clientConnections) {
        this.updateConnectionStatus(connection.id, 'disconnected');
        this.signalQueue.delete(connection.serverId);
        this.connections.delete(connection.id);
      }

      if (clientConnections.length > 0) {
        logger.info('Cleaned up client WebRTC connections', { 
          clientId, 
          connectionCount: clientConnections.length 
        });
      }
    } else {
      // 全体クリーンアップ
      logger.info('Cleaning up all WebRTC connections');
      
      clearInterval(this.cleanupInterval);
      this.connections.clear();
      this.signalQueue.clear();
      this.removeAllListeners();
    }
  }

  private findConnectionByServerId(serverId: string): PeerConnection | undefined {
    return Array.from(this.connections.values())
      .find(conn => conn.serverId === serverId);
  }

  private updateConnectionStatus(connectionId: string, status: PeerConnection['status']): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.status = status;
      connection.lastActivity = new Date().toISOString();
      
      logger.debug('Updated connection status', { connectionId, status });
      this.emit('connection-status-changed', { connection, previousStatus: connection.status });
    }
  }

  private updateConnectionActivity(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date().toISOString();
    }
  }

  private addToSignalQueue(serverId: string, signal: SignalData): void {
    const queue = this.signalQueue.get(serverId) || [];
    queue.push(signal);
    
    // キューサイズ制限（最新100件）
    if (queue.length > 100) {
      queue.splice(0, queue.length - 100);
    }
    
    this.signalQueue.set(serverId, queue);
  }

  private sendSignalResponse(ws: WebSocket, response: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'webrtc-signal-response',
        data: response,
      }));
    }
  }

  private generateServerId(): string {
    // 一意で推測困難なサーバーIDを生成
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    return `${timestamp}-${random}`;
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    const maxInactiveTime = 10 * 60 * 1000; // 10分
    const connectingTimeout = 2 * 60 * 1000; // 2分

    for (const [connectionId, connection] of this.connections.entries()) {
      const lastActivityTime = new Date(connection.lastActivity).getTime();
      const timeSinceActivity = now - lastActivityTime;

      // 接続中状態が長時間続く場合
      if (connection.status === 'connecting' && timeSinceActivity > connectingTimeout) {
        logger.warn('Cleaning up stale connecting connection', { 
          connectionId, 
          timeSinceActivity 
        });
        
        this.updateConnectionStatus(connectionId, 'failed');
        this.connectionStats.failed++;
        this.connections.delete(connectionId);
        this.signalQueue.delete(connection.serverId);
      }
      // 非アクティブな接続のクリーンアップ
      else if (timeSinceActivity > maxInactiveTime) {
        logger.info('Cleaning up inactive connection', { 
          connectionId, 
          status: connection.status,
          timeSinceActivity 
        });
        
        this.connections.delete(connectionId);
        this.signalQueue.delete(connection.serverId);
      }
    }

    // 孤立したシグナリングキューのクリーンアップ
    for (const serverId of this.signalQueue.keys()) {
      if (!this.findConnectionByServerId(serverId)) {
        this.signalQueue.delete(serverId);
      }
    }
  }
}