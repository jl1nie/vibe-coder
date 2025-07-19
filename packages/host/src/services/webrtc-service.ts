import WebSocket from 'ws';
import logger from '../utils/logger';
import { SessionManager } from './session-manager';
import { ClaudeInteractiveService } from './claude-interactive-service';
import type { WebSocketSignalMessage, WebSocketSignalResponse } from '@vibe-coder/shared';

// Extended interface for new WebRTC protocol messages
interface ExtendedWebSocketSignalMessage {
  type: WebSocketSignalMessage['type'] | 'webrtc-offer-received' | 'webrtc-answer-received' | 'ice-candidate-received';
  sessionId: string;
  clientId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: any;
  timestamp: number;
  messageId?: string;
  error?: string;
  jwtToken?: string;
}

interface ExtendedWebSocketSignalResponse {
  type: WebSocketSignalResponse['type'] | 'verify-totp' | 'webrtc-offer' | 'webrtc-offer-received' | 'webrtc-answer-received' | 'ice-candidate-received';
  sessionId: string;
  clientId?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: any;
  timestamp?: number;
  messageId?: string;
  message?: string;
  error?: string;
  jwtToken?: string;
  totpCode?: string;
}

export interface WebRTCConnection {
  id: string;
  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  sessionId: string;
  isConnected: boolean;
  createdAt: Date;
  lastActivity: Date;
}

export interface WebSocketSignalingConfig {
  signalingUrl: string;
  signalingWsPath: string;
  signalingConnectionTimeout: number;
  signalingHeartbeatInterval: number;
  hostId: string;
  webrtcStunServers: string[];
  webrtcTurnServers: string[];
}

export class WebRTCService {
  private connections = new Map<string, WebRTCConnection>();
  private claudeInteractiveService: ClaudeInteractiveService;
  private signalingWs: WebSocket | null = null;
  private signalingConfig: WebSocketSignalingConfig | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(private sessionManager: SessionManager) {
    this.claudeInteractiveService = new ClaudeInteractiveService();
    
    // Listen for authentication events to register WebRTC sessions
    this.sessionManager.onAuthentication((sessionId: string) => {
      this.registerWebRTCSession(sessionId);
    });
  }

  /**
   * Register authenticated session with WebRTC signaling
   */
  private registerWebRTCSession(sessionId: string): void {
    if (!this.signalingWs || this.signalingWs.readyState !== WebSocket.OPEN) {
      logger.warn('WebSocket signaling not connected, cannot register session', { sessionId });
      return;
    }

    const registerMessage = {
      type: 'register-host',
      sessionId,
      hostId: this.sessionManager.getHostId(),
      timestamp: Date.now()
    };

    logger.info('Registering authenticated session with signaling server', { 
      sessionId, 
      hostId: this.sessionManager.getHostId() 
    });

    try {
      this.signalingWs.send(JSON.stringify(registerMessage));
    } catch (error) {
      logger.error('Failed to register session with signaling server', { 
        sessionId,
        error: (error as Error).message 
      });
    }
  }






  /**
   * WebSocketシグナリング接続を初期化
   */
  public async initializeSignaling(config: WebSocketSignalingConfig): Promise<boolean> {
    this.signalingConfig = config;
    
    // Build WebSocket URL from config
    let wsUrl: string;
    logger.debug('Building WebSocket URL', { 
      signalingUrl: config.signalingUrl, 
      signalingWsPath: config.signalingWsPath,
      hasProtocol: config.signalingUrl.startsWith('ws://') || config.signalingUrl.startsWith('wss://')
    });
    
    if (config.signalingUrl.startsWith('ws://') || config.signalingUrl.startsWith('wss://')) {
      // URL already has protocol, use as-is
      wsUrl = `${config.signalingUrl}${config.signalingWsPath}`;
    } else {
      // No protocol, add it based on host
      // Use ws:// for local development (localhost, Docker bridge IPs, container names)
      const isLocalDevelopment = config.signalingUrl.includes('localhost') || 
                                config.signalingUrl.includes('vibe-coder-signaling') ||
                                config.signalingUrl.includes('172.17.0.1') ||
                                config.signalingUrl.includes('127.0.0.1');
      const protocol = isLocalDevelopment ? 'ws' : 'wss';
      wsUrl = `${protocol}://${config.signalingUrl}${config.signalingWsPath}`;
    }

    return new Promise((resolve, reject) => {
      try {
        logger.info('Connecting to WebSocket signaling', { url: wsUrl });
        this.signalingWs = new WebSocket(wsUrl);

        this.signalingWs.onopen = () => {
          logger.info('WebSocket signaling connected');
          
          // Clear any pending reconnect
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
          }
          
          // Register this host with signaling server (Simple Protocol)
          const hostId = this.sessionManager.getHostId();
          const registerHostMessage = {
            type: 'register-host',
            hostId: hostId
          };
          
          logger.info('Registering host with signaling server', { hostId, message: registerHostMessage });
          this.signalingWs!.send(JSON.stringify(registerHostMessage));
          
          // Register existing authenticated sessions with signaling server
          const authenticatedSessions = this.sessionManager.getAuthenticatedSessions();
          logger.info('Registering existing authenticated sessions', { 
            sessions: authenticatedSessions 
          });
          
          authenticatedSessions.forEach(sessionId => {
            this.registerWebRTCSession(sessionId);
          });
          
          // Start heartbeat
          this.startHeartbeat();
          
          resolve(true);
        };

        this.signalingWs.onmessage = (event) => {
          try {
            const rawData = event.data.toString();
            logger.info('Raw WebSocket message received', { 
              messageLength: rawData.length,
              messagePreview: rawData.substring(0, 500)
            });
            
            const message: WebSocketSignalResponse = JSON.parse(rawData);
            
            logger.info('Parsed WebSocket message', {
              type: message.type,
              sessionId: message.sessionId,
              hasCandidate: !!message.candidate,
              candidatePreview: message.candidate ? 
                (typeof message.candidate === 'string' ? 
                  (message.candidate as string).substring(0, 100) : 
                  JSON.stringify(message.candidate).substring(0, 100)) : 
                undefined
            });
            
            this.handleWebSocketSignalingMessage(message);
          } catch (error) {
            logger.error('WebSocket signaling message parse error', { 
              error: (error as Error).message,
              rawData: event.data.toString().substring(0, 200)
            });
          }
        };

        this.signalingWs.onclose = (event) => {
          logger.warn('WebSocket signaling connection closed', { code: event.code, reason: event.reason });
          this.signalingWs = null;
          
          // Attempt reconnection if not shutting down
          if (!this.isShuttingDown && config.signalingUrl) {
            this.scheduleReconnect();
          }
        };

        this.signalingWs.onerror = (error) => {
          logger.error('WebSocket signaling error', { error: error.message });
          
          // Don't reject on first connection if already connected
          if (this.signalingWs && this.signalingWs.readyState === WebSocket.CONNECTING) {
            reject(error);
          }
        };

        // Connection timeout
        setTimeout(() => {
          if (!this.signalingWs || this.signalingWs.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket signaling connection timeout'));
          }
        }, config.signalingConnectionTimeout);

      } catch (error) {
        logger.error('Failed to initialize WebSocket signaling', { error: (error as Error).message });
        reject(error);
      }
    });
  }

  /**
   * Handle TOTP verification (Simple Protocol)
   */
  private handleVerifyTotp(sessionId: string, totpCode: string): void {
    logger.info('Handling TOTP verification', { sessionId, totpCode: '***' });
    
    try {
      // Create session if it doesn't exist (for simple protocol)
      if (!this.sessionManager.getSession(sessionId)) {
        logger.info('Creating new session for TOTP verification', { sessionId });
        this.sessionManager.createSessionWithId(sessionId);
      }
      
      // Verify TOTP code
      const isValid = this.sessionManager.verifyTotp(sessionId, totpCode);
      
      if (isValid) {
        // Mark session as authenticated
        this.sessionManager.setAuthenticated(sessionId);
        
        // Send auth-success response
        const response = {
          type: 'auth-success',
          sessionId,
          message: 'Authentication successful'
        };
        
        if (this.signalingWs) {
          this.signalingWs.send(JSON.stringify(response));
          logger.info('TOTP verification successful, sent auth-success', { sessionId });
        }
      } else {
        // Send error response
        const response = {
          type: 'error',
          sessionId,
          message: 'Invalid TOTP code'
        };
        
        if (this.signalingWs) {
          this.signalingWs.send(JSON.stringify(response));
          logger.warn('TOTP verification failed', { sessionId });
        }
      }
    } catch (error) {
      logger.error('Error during TOTP verification', { sessionId, error: (error as Error).message });
      
      const response = {
        type: 'error',
        sessionId,
        message: 'TOTP verification error'
      };
      
      if (this.signalingWs) {
        this.signalingWs.send(JSON.stringify(response));
      }
    }
  }

  /**
   * シグナリングメッセージハンドラー
   */
  private handleWebSocketSignalingMessage(message: ExtendedWebSocketSignalResponse): void {
    logger.info('Received signaling message', { 
      type: message.type, 
      sessionId: message.sessionId,
      candidateType: message.candidate ? typeof message.candidate : 'undefined',
      candidateKeys: message.candidate && typeof message.candidate === 'object' ? Object.keys(message.candidate) : [],
      candidateData: message.candidate ? 
        (typeof message.candidate === 'string' ? 
          (message.candidate as string).substring(0, 200) : 
          JSON.stringify(message.candidate).substring(0, 200)) : 
        undefined,
      candidateIsString: typeof message.candidate === 'string',
      candidateHasProperty: message.candidate && typeof message.candidate === 'object' ? Object.prototype.hasOwnProperty.call(message.candidate, 'candidate') : false,
      rawMessage: JSON.stringify(message).substring(0, 500)
    });

    // Simple protocol - no JWT verification needed

    switch (message.type) {
      case 'verify-totp':
        this.handleVerifyTotp(message.sessionId, (message as any).totpCode);
        break;
        
      case 'webrtc-offer':
      case 'webrtc-offer-received':
      case 'offer-received':
      case 'offer':
        this.handleSignalingOffer(message.sessionId, message.offer!).catch(error => {
          logger.error('Failed to handle signaling offer', { 
            sessionId: message.sessionId, 
            error: error.message 
          });
        });
        break;
      
      case 'webrtc-answer-received':
      case 'answer-received':
      case 'answer':
        this.handleSignalingAnswer(message.sessionId, message.answer!);
        break;
      
      case 'ice-candidate':
      case 'ice-candidate-received':
      case 'candidate-received':
        this.handleSignalingCandidate(message.sessionId, message.candidate!);
        break;
      
      case 'peer-connected':
        logger.info('Peer connected to session', { sessionId: message.sessionId, clientId: message.clientId });
        break;
      
      case 'peer-disconnected':
        logger.info('Peer disconnected from session', { sessionId: message.sessionId, clientId: message.clientId });
        break;
        
      case 'error':
        logger.error('Signaling error', { error: message.error, sessionId: message.sessionId });
        break;
      
      default:
        // Handle unknown message types including host-registered, heartbeat-ack
        if ((message as any).type === 'host-registered') {
          logger.info('Host successfully registered with signaling server', { 
            sessionId: message.sessionId 
          });
        } else if ((message as any).type === 'heartbeat-ack') {
          // Heartbeat acknowledged - connection is alive
        } else if ((message as any).type === 'connected') {
          logger.info('Connected to signaling server');
        } else {
          logger.warn('Received unknown signaling message type', { type: (message as any).type });
        }
        break;
    }
  }


  /**
   * WebSocketシグナリングメッセージ送信
   */
  private sendSignalingMessage(message: ExtendedWebSocketSignalMessage | WebSocketSignalMessage): boolean {
    if (!this.signalingWs || this.signalingWs.readyState !== WebSocket.OPEN) {
      logger.error('WebSocket signaling not connected');
      return false;
    }

    try {
      this.signalingWs.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Failed to send signaling message', { error: (error as Error).message });
      return false;
    }
  }


  /**
   * シグナリングサーバーにセッション作成
   */
  public async createSignalingSession(sessionId: string): Promise<boolean> {
    if (!this.signalingConfig) {
      logger.error('Signaling config not initialized');
      return false;
    }

    const message: WebSocketSignalMessage = {
      type: 'register-host',
      sessionId,
      clientId: this.signalingConfig.hostId,
      timestamp: Date.now()
    };

    return this.sendSignalingMessage(message);
  }

  /**
   * WebRTC接続を開始（ホスト側）
   */
  public async createConnection(sessionId: string): Promise<WebRTCConnection> {
    const connectionId = `${sessionId}-${Date.now()}`;
    
    logger.info('Creating Native WebRTC connection', { sessionId, connectionId });

    // Import wrtc dynamically to avoid TypeScript module resolution issues
    let wrtc: any;
    try {
      wrtc = require('@roamhq/wrtc');
      logger.info('Native wrtc module loaded successfully');
    } catch (error) {
      logger.error('wrtc module not available - WebRTC P2P will not work in Docker environment', {
        error: (error as Error).message
      });
      
      // In Docker environments, wrtc native module is not available
      // This is a fundamental limitation - we need to use REST API fallback
      throw new Error('No WebRTC support: Specify `opts.wrtc` option in this environment');
    }

    // Build ICE servers from config (RFC 8445 compliant)
    const iceServers: RTCIceServer[] = [];
    
    // Add STUN servers for Server-reflexive candidates (RFC 8445 Section 5.1.1)
    if (this.signalingConfig?.webrtcStunServers) {
      iceServers.push(...this.signalingConfig.webrtcStunServers.map(url => ({ urls: url })));
    }
    
    // Fallback to default STUN servers if none configured
    if (iceServers.length === 0) {
      iceServers.push(
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      );
    }

    // Create native RTCPeerConnection with proper ICE configuration
    // This will generate both Host candidates (local IPs) and Server-reflexive candidates (via STUN)
    const peerConnection = new wrtc.RTCPeerConnection({
      iceServers,
      // RFC 8445 Section 2: ICE candidate gathering policy
      iceCandidatePoolSize: 10, // Pre-gather candidates for faster connection
      // Force gathering of all candidate types
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require'
    });

    const connection: WebRTCConnection = {
      id: connectionId,
      peerConnection,
      dataChannel: null,
      sessionId,
      isConnected: false,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.connections.set(connectionId, connection);

    // WebRTC イベントハンドラー設定
    this.setupPeerConnectionHandlers(connection);

    return connection;
  }

  /**
   * Native WebRTC PeerConnection のイベントハンドラー設定
   */
  private setupPeerConnectionHandlers(connection: WebRTCConnection): void {
    const { peerConnection, sessionId, id } = connection;

    // ICE candidate generation
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Log detailed ICE candidate information for RFC 8445 compliance verification
        logger.info('ICE candidate generated (Host side)', { 
          sessionId, 
          connectionId: id,
          candidate: event.candidate.candidate,
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
          port: event.candidate.port,
          priority: event.candidate.priority,
          foundation: event.candidate.foundation,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex
        });
        
        // Analyze candidate type for RFC 8445 compliance
        const candidateStr = event.candidate.candidate;
        let candidateType = 'unknown';
        if (candidateStr.includes('typ host')) candidateType = 'host';
        else if (candidateStr.includes('typ srflx')) candidateType = 'server-reflexive';
        else if (candidateStr.includes('typ prflx')) candidateType = 'peer-reflexive';
        else if (candidateStr.includes('typ relay')) candidateType = 'relay';
        
        logger.info('ICE candidate type analysis', {
          sessionId,
          connectionId: id,
          candidateType,
          candidateString: candidateStr
        });
        
        // Convert to standard RTCIceCandidateInit format (remove non-standard properties)
        const candidateInit = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex
        };
        
        this.sendIceCandidate(sessionId, candidateInit);
      }
    };

    // ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      logger.info('ICE connection state changed', { 
        sessionId, 
        connectionId: id, 
        state: peerConnection.iceConnectionState 
      });
      
      const connected = peerConnection.iceConnectionState === 'connected' || 
                       peerConnection.iceConnectionState === 'completed';
      connection.isConnected = connected;
      
      if (connected) {
        connection.lastActivity = new Date();
        
        // Use protocol-compliant session management
        this.sessionManager.addWebRTCConnection(sessionId, id);
        this.sessionManager.markSessionConnected(sessionId);
        this.sessionManager.updateSessionActivity(sessionId);
        
        logger.info('WebRTC connection established via protocol-compliant session management', { 
          sessionId, 
          connectionId: id 
        });
      } else if (peerConnection.iceConnectionState === 'failed') {
        logger.error('ICE connection failed', { sessionId, connectionId: id });
        
        // Use protocol-compliant session management
        this.sessionManager.markSessionDisconnected(sessionId);
        this.sessionManager.incrementReconnectAttempts(sessionId);
        
        this.connections.delete(id);
      } else if (peerConnection.iceConnectionState === 'disconnected') {
        // Handle temporary disconnection
        this.sessionManager.markSessionDisconnected(sessionId);
        
        logger.warn('WebRTC connection disconnected', { sessionId, connectionId: id });
      }
    };

    // Signaling state changes
    peerConnection.onsignalingstatechange = () => {
      logger.info('Signaling state changed', { 
        sessionId, 
        connectionId: id, 
        state: peerConnection.signalingState 
      });
    };

    // Data channel received from client
    peerConnection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      connection.dataChannel = dataChannel;
      
      logger.info('Data channel received', { 
        sessionId, 
        connectionId: id, 
        label: dataChannel.label 
      });

      dataChannel.onopen = () => {
        logger.info('Data channel opened', { sessionId, connectionId: id });
        connection.isConnected = true;
        connection.lastActivity = new Date();
      };

      dataChannel.onmessage = (event) => {
        logger.info('WebRTC data received', { sessionId, connectionId: id });
        connection.lastActivity = new Date();
        
        try {
          const message = JSON.parse(event.data.toString());
          this.handleDataChannelMessage(connection, message);
        } catch (error) {
          logger.error('Invalid WebRTC data format', {
            sessionId,
            error: (error as Error).message
          });
        }
      };

      dataChannel.onclose = () => {
        logger.info('Data channel closed', { sessionId, connectionId: id });
        connection.isConnected = false;
        connection.dataChannel = null;
      };

      dataChannel.onerror = (error) => {
        logger.error('Data channel error', {
          sessionId,
          connectionId: id,
          error: error
        });
      };
    };

    // Connection state changes
    peerConnection.onconnectionstatechange = () => {
      logger.info('Connection state changed', { 
        sessionId, 
        connectionId: id, 
        state: peerConnection.connectionState 
      });
      
      if (peerConnection.connectionState === 'failed' || 
          peerConnection.connectionState === 'closed') {
        logger.info('WebRTC connection closed', { sessionId, connectionId: id });
        connection.isConnected = false;
        this.connections.delete(id);
      }
    };
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
   * Data Channel経由でPeerにメッセージを送信
   */
  public sendToPeer(connection: WebRTCConnection, message: any): void {
    if (!connection.isConnected || !connection.dataChannel) {
      logger.warn('Cannot send message to disconnected peer or no data channel', {
        sessionId: connection.sessionId,
        connectionId: connection.id,
        hasDataChannel: !!connection.dataChannel,
        isConnected: connection.isConnected
      });
      return;
    }

    if (connection.dataChannel.readyState !== 'open') {
      logger.warn('Data channel not open for sending', {
        sessionId: connection.sessionId,
        connectionId: connection.id,
        readyState: connection.dataChannel.readyState
      });
      return;
    }

    try {
      connection.dataChannel.send(JSON.stringify(message));
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
   * WebSocketシグナリングからのOffer処理
   */
  private async handleSignalingOffer(sessionId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    let connection = this.findConnectionBySessionId(sessionId);
    
    // Connectionが存在しない場合は新規作成
    if (!connection) {
      logger.info('Creating new WebRTC connection for offer', { sessionId });
      
      try {
        connection = await this.createConnection(sessionId);
        logger.info('New WebRTC connection created', { 
          sessionId, 
          connectionId: connection.id 
        });
      } catch (error) {
        logger.error('Failed to create WebRTC connection for offer', {
          sessionId,
          error: (error as Error).message
        });
        return;
      }
    }

    try {
      // Set remote description (offer from client)
      await connection.peerConnection.setRemoteDescription(offer);
      logger.info('Remote description (offer) set successfully', { sessionId, connectionId: connection.id });
      
      // Create answer
      const answer = await connection.peerConnection.createAnswer();
      await connection.peerConnection.setLocalDescription(answer);
      
      // Send answer via signaling
      this.sendAnswer(sessionId, answer);
      logger.info('Answer created and sent', { sessionId, connectionId: connection.id });
    } catch (error) {
      logger.error('Failed to process offer', {
        sessionId,
        error: (error as Error).message
      });
    }
  }

  /**
   * WebSocketシグナリングからのAnswer処理
   */
  private async handleSignalingAnswer(sessionId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const connection = this.findConnectionBySessionId(sessionId);
    if (!connection) {
      logger.error('Connection not found for answer', { sessionId });
      return;
    }

    try {
      await connection.peerConnection.setRemoteDescription(answer);
      logger.info('Answer processed successfully', { sessionId, connectionId: connection.id });
    } catch (error) {
      logger.error('Failed to process answer', {
        sessionId,
        error: (error as Error).message
      });
    }
  }

  /**
   * WebSocketシグナリングからのICE Candidate処理
   */
  private async handleSignalingCandidate(sessionId: string, candidate: any): Promise<void> {
    const connection = this.findConnectionBySessionId(sessionId);
    if (!connection) {
      logger.error('Connection not found for ICE candidate', { sessionId });
      return;
    }

    logger.debug('Processing ICE candidate', {
      sessionId,
      connectionId: connection.id,
      candidateType: typeof candidate
    });

    try {
      // @roamhq/wrtc では toJSON() が実装されているため、
      // ICE候補は正しいオブジェクト形式で届く
      if (!candidate || typeof candidate !== 'object') {
        logger.error('Invalid ICE candidate format', {
          sessionId,
          candidateType: typeof candidate,
          candidateValue: String(candidate).substring(0, 100)
        });
        return;
      }

      // Add ICE candidate to peer connection  
      logger.debug('Adding ICE candidate to peer connection', {
        sessionId,
        candidate: JSON.stringify(candidate).substring(0, 200)
      });
      
      // @roamhq/wrtc では標準的な addIceCandidate が使用可能
      await connection.peerConnection.addIceCandidate(candidate);
      
      logger.info('ICE candidate processed successfully', { 
        sessionId, 
        connectionId: connection.id,
        hasCandidate: !!(candidate?.candidate)
      });
    } catch (error) {
      logger.error('Failed to process ICE candidate', {
        sessionId,
        connectionId: connection.id,
        candidateData: JSON.stringify(candidate).substring(0, 100),
        candidateType: typeof candidate,
        error: (error as Error).message,
        stack: (error as Error).stack
      });
    }
  }

  /**
   * Handle WebRTC offer with JWT verification
   */
  public async handleOffer(sessionId: string, offer: RTCSessionDescriptionInit, jwtToken: string): Promise<RTCSessionDescriptionInit> {
    // Verify JWT token
    if (!this.sessionManager.verifyJwtToken(jwtToken)) {
      throw new Error('Authentication failed');
    }

    // Verify session is authenticated
    const session = this.sessionManager.getSession(sessionId);
    if (!session || !session.isAuthenticated) {
      throw new Error('Session not authenticated');
    }

    // Find or create WebRTC connection
    let connection = Array.from(this.connections.values()).find(c => c.sessionId === sessionId);
    if (!connection) {
      connection = await this.createConnection(sessionId);
    }

    // Set remote description (offer)
    await connection.peerConnection.setRemoteDescription(offer);

    // Create answer
    const answer = await connection.peerConnection.createAnswer();
    await connection.peerConnection.setLocalDescription(answer);

    logger.info('WebRTC offer processed and answer created', {
      sessionId,
      connectionId: connection.id,
      offerType: offer.type,
      answerType: answer.type
    });

    return answer;
  }

  /**
   * Handle ICE candidate with JWT verification
   */
  public async handleIceCandidate(sessionId: string, candidate: RTCIceCandidateInit, jwtToken: string): Promise<void> {
    // Verify JWT token
    if (!this.sessionManager.verifyJwtToken(jwtToken)) {
      throw new Error('Authentication failed');
    }

    // Find WebRTC connection
    const connection = Array.from(this.connections.values()).find(c => c.sessionId === sessionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    // Add ICE candidate
    await connection.peerConnection.addIceCandidate(candidate);

    logger.info('ICE candidate processed', {
      sessionId,
      connectionId: connection.id,
      candidate: candidate.candidate
    });
  }

  /**
   * AnswerをWebSocketシグナリング経由で送信
   */
  public sendAnswer(sessionId: string, answer: RTCSessionDescriptionInit): boolean {
    if (!this.signalingConfig) {
      logger.error('Signaling config not initialized');
      return false;
    }

    // Get JWT token for this session
    const jwtToken = this.sessionManager.generateJwtToken(sessionId);
    if (!jwtToken) {
      logger.error('JWT token not found for session', { sessionId });
      return false;
    }

    const message: ExtendedWebSocketSignalMessage = {
      type: 'answer',
      sessionId,
      clientId: this.signalingConfig.hostId,
      jwtToken,
      answer,
      timestamp: Date.now()
    };

    return this.sendSignalingMessage(message);
  }

  /**
   * ICE CandidateをWebSocketシグナリング経由で送信
   */
  public sendIceCandidate(sessionId: string, candidate: RTCIceCandidateInit): boolean {
    if (!this.signalingConfig) {
      logger.error('Signaling config not initialized');
      return false;
    }

    // Get JWT token for this session
    const jwtToken = this.sessionManager.generateJwtToken(sessionId);
    if (!jwtToken) {
      logger.error('JWT token not found for session', { sessionId });
      return false;
    }

    const message: ExtendedWebSocketSignalMessage = {
      type: 'ice-candidate',
      sessionId,
      clientId: this.signalingConfig.hostId,
      jwtToken,
      candidate,
      timestamp: Date.now()
    };

    return this.sendSignalingMessage(message);
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
      if (connection.dataChannel) {
        connection.dataChannel.close();
      }
      if (connection.peerConnection) {
        connection.peerConnection.close();
      }
      this.connections.delete(connectionId);
      logger.info('Connection removed', { connectionId, sessionId: connection.sessionId });
    }
  }

  /**
   * 自動再接続スケジュール
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout || this.isShuttingDown || !this.signalingConfig) {
      return;
    }

    const reconnectDelay = 5000; // 5 seconds
    logger.info('Scheduling WebSocket signaling reconnection', { delay: reconnectDelay });

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      
      if (!this.isShuttingDown && this.signalingConfig) {
        try {
          logger.info('Attempting WebSocket signaling reconnection');
          await this.initializeSignaling(this.signalingConfig);
        } catch (error) {
          logger.error('WebSocket signaling reconnection failed', { 
            error: (error as Error).message 
          });
          // Schedule another reconnect attempt
          this.scheduleReconnect();
        }
      }
    }, reconnectDelay);
  }

  /**
   * ハートビート開始
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval || !this.signalingConfig) {
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
        try {
          // Send heartbeat message instead of ping
          this.signalingWs.send(JSON.stringify({
            type: 'heartbeat',
            timestamp: Date.now()
          }));
        } catch (error) {
          logger.error('Failed to send heartbeat', { error: (error as Error).message });
        }
      }
    }, this.signalingConfig.signalingHeartbeatInterval);
  }

  /**
   * ハートビート停止
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 全ての接続を削除
   */
  public destroy(): void {
    this.isShuttingDown = true;

    // Stop heartbeat
    this.stopHeartbeat();

    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // WebRTC接続を削除
    for (const connection of this.connections.values()) {
      if (connection.dataChannel) {
        connection.dataChannel.close();
      }
      if (connection.peerConnection) {
        connection.peerConnection.close();
      }
    }
    this.connections.clear();
    
    // WebSocketシグナリング接続を削除
    if (this.signalingWs) {
      this.signalingWs.close();
      this.signalingWs = null;
    }
    
    // インタラクティブセッションも破棄
    this.claudeInteractiveService.destroy();
    
    logger.info('WebRTC service destroyed');
  }

  /**
   * 非アクティブな接続をクリーンアップ
   */
  /**
   * WebSocket接続状態の取得
   */
  public getSignalingStatus(): {
    connected: boolean;
    url?: string;
    readyState?: number;
    lastReconnectAttempt?: Date;
    reconnectAttempts?: number;
  } {
    return {
      connected: this.signalingWs ? this.signalingWs.readyState === WebSocket.OPEN : false,
      url: this.signalingConfig ? 
        (() => {
          if (this.signalingConfig.signalingUrl.startsWith('ws://') || this.signalingConfig.signalingUrl.startsWith('wss://')) {
            return `${this.signalingConfig.signalingUrl}${this.signalingConfig.signalingWsPath}`;
          } else {
            const protocol = (this.signalingConfig.signalingUrl.includes('localhost') || this.signalingConfig.signalingUrl.includes('vibe-coder-signaling')) ? 'ws' : 'wss';
            return `${protocol}://${this.signalingConfig.signalingUrl}${this.signalingConfig.signalingWsPath}`;
          }
        })() : 
        undefined,
      readyState: this.signalingWs?.readyState,
      lastReconnectAttempt: this.reconnectTimeout ? new Date() : undefined
    };
  }

  /**
   * 接続統計の取得
   */
  public getConnectionStats(): {
    total: number;
    active: number;
    bySession: Record<string, number>;
    averageLifetime: number;
  } {
    const now = new Date();
    let totalLifetime = 0;
    const bySession: Record<string, number> = {};
    let activeCount = 0;

    for (const connection of this.connections.values()) {
      const lifetime = now.getTime() - connection.createdAt.getTime();
      totalLifetime += lifetime;
      
      if (connection.isConnected) {
        activeCount++;
      }

      bySession[connection.sessionId] = (bySession[connection.sessionId] || 0) + 1;
    }

    return {
      total: this.connections.size,
      active: activeCount,
      bySession,
      averageLifetime: this.connections.size > 0 ? totalLifetime / this.connections.size : 0
    };
  }

  /**
   * 詳細ステータスログの出力
   */
  public logDetailedStatus(): void {
    const signalingStatus = this.getSignalingStatus();
    const connectionStats = this.getConnectionStats();
    const claudeSessionCount = this.claudeInteractiveService.getActiveSessions().length;

    logger.info('WebRTC Service Status Report', {
      signaling: {
        connected: signalingStatus.connected,
        url: signalingStatus.url,
        readyState: this.getReadyStateText(signalingStatus.readyState),
        reconnectScheduled: !!this.reconnectTimeout,
        heartbeatActive: !!this.heartbeatInterval
      },
      connections: {
        total: connectionStats.total,
        active: connectionStats.active,
        averageLifetimeMinutes: Math.round(connectionStats.averageLifetime / (1000 * 60) * 100) / 100,
        bySession: connectionStats.bySession
      },
      claude: {
        activeSessions: claudeSessionCount
      },
      performance: {
        shutdownFlag: this.isShuttingDown,
        memoryConnections: this.connections.size
      }
    });
  }

  /**
   * WebSocket ReadyState を文字列に変換
   */
  private getReadyStateText(readyState?: number): string {
    switch (readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }

  public cleanupInactiveConnections(): void {
    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5分
    const beforeCount = this.connections.size;

    for (const [connectionId, connection] of this.connections.entries()) {
      if (now.getTime() - connection.lastActivity.getTime() > inactiveThreshold) {
        logger.info('Cleaning up inactive connection', {
          connectionId,
          sessionId: connection.sessionId,
          lastActivity: connection.lastActivity,
          lifetimeMinutes: Math.round((now.getTime() - connection.createdAt.getTime()) / (1000 * 60) * 100) / 100
        });
        this.removeConnection(connectionId);
      }
    }

    const afterCount = this.connections.size;
    if (beforeCount !== afterCount) {
      logger.info('Connection cleanup completed', {
        cleaned: beforeCount - afterCount,
        remaining: afterCount
      });
    }
  }
}