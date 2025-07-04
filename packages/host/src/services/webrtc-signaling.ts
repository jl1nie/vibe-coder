import { EventEmitter } from 'events';
import { createLogger, LogTimer } from '../utils/logger';
import { Environment } from '../utils/env';

const logger = createLogger('webrtc-signaling');

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  from: string;
  to?: string;
}

export interface PeerConnection {
  id: string;
  isConnected: boolean;
  lastSeen: number;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
  };
}

export interface WebRTCSignalingEvents {
  peerConnected: (peerId: string, connection: PeerConnection) => void;
  peerDisconnected: (peerId: string) => void;
  signalReceived: (message: SignalingMessage) => void;
}

export class WebRTCSignalingService extends EventEmitter {
  private peers = new Map<string, PeerConnection>();
  private env: Environment;
  private cleanupInterval: NodeJS.Timeout;
  private serverId: string;

  constructor(env: Environment) {
    super();
    this.env = env;
    this.serverId = this.generateServerId();
    
    this.startCleanup();
    
    logger.info('WebRTC Signaling Service initialized', {
      serverId: this.serverId,
      iceServers: this.getIceServers(),
    });
  }

  // サーバーIDの取得
  getServerId(): string {
    return this.serverId;
  }

  // ICEサーバー設定の取得
  getIceServers(): any[] {
    try {
      return JSON.parse(this.env.ICE_SERVERS);
    } catch (error) {
      logger.error('Failed to parse ICE_SERVERS', { error });
      return [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ];
    }
  }

  // ピア接続の登録
  registerPeer(peerId: string, metadata?: any): PeerConnection {
    const timer = new LogTimer(logger, 'registerPeer', { peerId });

    try {
      const connection: PeerConnection = {
        id: peerId,
        isConnected: true,
        lastSeen: Date.now(),
        metadata,
      };

      this.peers.set(peerId, connection);
      this.emit('peerConnected', peerId, connection);

      timer.finish({
        peerCount: this.peers.size,
        metadata,
      });

      logger.info('Peer registered', {
        peerId,
        peerCount: this.peers.size,
        metadata,
      });

      return connection;
    } catch (error) {
      timer.error(error as Error);
      throw error;
    }
  }

  // ピア接続の削除
  unregisterPeer(peerId: string): void {
    const connection = this.peers.get(peerId);
    if (!connection) {
      logger.warn('Attempted to unregister unknown peer', { peerId });
      return;
    }

    this.peers.delete(peerId);
    this.emit('peerDisconnected', peerId);

    logger.info('Peer unregistered', {
      peerId,
      peerCount: this.peers.size,
      connectionDuration: Date.now() - connection.lastSeen,
    });
  }

  // シグナリングメッセージの処理
  async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    const timer = new LogTimer(logger, `handleSignaling:${message.type}`, {
      messageType: message.type,
      from: message.from,
      to: message.to,
    });

    try {
      this.validateSignalingMessage(message);
      
      // ピアの最終アクセス時刻を更新
      const peer = this.peers.get(message.from);
      if (peer) {
        peer.lastSeen = Date.now();
        this.peers.set(message.from, peer);
      }

      // メッセージタイプに応じた処理
      switch (message.type) {
        case 'offer':
          await this.handleOffer(message);
          break;
        case 'answer':
          await this.handleAnswer(message);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(message);
          break;
        default:
          throw new Error(`Unknown signaling message type: ${message.type}`);
      }

      this.emit('signalReceived', message);
      timer.finish();

    } catch (error) {
      timer.error(error as Error);
      throw error;
    }
  }

  // Offerの処理
  private async handleOffer(message: SignalingMessage): Promise<void> {
    logger.debug('Processing WebRTC offer', {
      from: message.from,
      to: message.to,
      sdpType: message.data?.type,
    });

    // 外部シグナリングサーバーへの転送
    if (this.env.SIGNALING_SERVER_URL) {
      await this.forwardToSignalingServer(message);
    }

    // ローカル処理（必要に応じて実装）
    // 例: P2P接続の直接確立など
  }

  // Answerの処理
  private async handleAnswer(message: SignalingMessage): Promise<void> {
    logger.debug('Processing WebRTC answer', {
      from: message.from,
      to: message.to,
      sdpType: message.data?.type,
    });

    if (this.env.SIGNALING_SERVER_URL) {
      await this.forwardToSignalingServer(message);
    }
  }

  // ICE Candidateの処理
  private async handleIceCandidate(message: SignalingMessage): Promise<void> {
    logger.debug('Processing ICE candidate', {
      from: message.from,
      to: message.to,
      candidate: message.data?.candidate ? 'present' : 'null',
    });

    if (this.env.SIGNALING_SERVER_URL) {
      await this.forwardToSignalingServer(message);
    }
  }

  // 外部シグナリングサーバーへの転送
  private async forwardToSignalingServer(message: SignalingMessage): Promise<void> {
    if (!this.env.SIGNALING_SERVER_URL) {
      return;
    }

    try {
      const response = await fetch(`${this.env.SIGNALING_SERVER_URL}/api/signal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: message.type,
          serverId: this.serverId,
          data: message.data,
        }),
      });

      if (!response.ok) {
        throw new Error(`Signaling server responded with ${response.status}`);
      }

      logger.debug('Message forwarded to signaling server', {
        messageType: message.type,
        from: message.from,
        status: response.status,
      });

    } catch (error) {
      logger.error('Failed to forward message to signaling server', {
        messageType: message.type,
        from: message.from,
        error,
      });
      throw error;
    }
  }

  // シグナリングメッセージの検証
  private validateSignalingMessage(message: SignalingMessage): void {
    if (!message.type || !message.from) {
      throw new Error('Invalid signaling message: missing required fields');
    }

    if (!['offer', 'answer', 'ice-candidate'].includes(message.type)) {
      throw new Error(`Invalid signaling message type: ${message.type}`);
    }

    if (!message.data) {
      throw new Error('Invalid signaling message: missing data field');
    }

    // SDP検証（offer/answer用）
    if (message.type === 'offer' || message.type === 'answer') {
      if (!message.data.type || !message.data.sdp) {
        throw new Error(`Invalid ${message.type}: missing SDP data`);
      }

      if (message.data.sdp.length > 10000) {
        throw new Error(`SDP too large: ${message.data.sdp.length} characters`);
      }
    }

    // ICE Candidate検証
    if (message.type === 'ice-candidate') {
      // null candidateは終了シグナルなので許可
      if (message.data.candidate !== null) {
        if (!message.data.candidate || !message.data.sdpMid) {
          throw new Error('Invalid ICE candidate: missing required fields');
        }
      }
    }
  }

  // 接続されたピア一覧の取得
  getConnectedPeers(): PeerConnection[] {
    return Array.from(this.peers.values()).filter(peer => peer.isConnected);
  }

  // ピア接続の取得
  getPeer(peerId: string): PeerConnection | undefined {
    return this.peers.get(peerId);
  }

  // 統計情報の取得
  getStats(): Record<string, any> {
    const now = Date.now();
    const connectedPeers = this.getConnectedPeers();
    
    return {
      serverId: this.serverId,
      totalPeers: this.peers.size,
      connectedPeers: connectedPeers.length,
      averageConnectionDuration: connectedPeers.length > 0
        ? connectedPeers.reduce((sum, peer) => sum + (now - peer.lastSeen), 0) / connectedPeers.length
        : 0,
      iceServers: this.getIceServers(),
    };
  }

  // 古い接続のクリーンアップ
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 5 * 60 * 1000; // 5分

      for (const [peerId, connection] of this.peers) {
        if (now - connection.lastSeen > timeout) {
          logger.info('Cleaning up stale peer connection', {
            peerId,
            lastSeen: new Date(connection.lastSeen).toISOString(),
            ageMinutes: Math.round((now - connection.lastSeen) / 60000),
          });

          this.unregisterPeer(peerId);
        }
      }
    }, 60000); // 1分間隔

    logger.debug('WebRTC peer cleanup monitor started');
  }

  // サーバーIDの生成
  private generateServerId(): string {
    return `vibe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // クリーンアップ
  async cleanup(): Promise<void> {
    logger.info('Starting WebRTC Signaling Service cleanup');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // すべてのピア接続を削除
    for (const peerId of this.peers.keys()) {
      this.unregisterPeer(peerId);
    }

    this.peers.clear();
    logger.info('WebRTC Signaling Service cleanup completed');
  }
}

// ファクトリー関数
export function setupWebRTCSignaling(env: Environment): WebRTCSignalingService {
  return new WebRTCSignalingService(env);
}