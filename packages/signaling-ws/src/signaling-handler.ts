import { SessionManager } from './session-manager';
import {
  SignalingMessage,
  RegisterHostMessage,
  JoinSessionMessage,
  OfferMessage,
  AnswerMessage,
  IceCandidateMessage,
  HeartbeatMessage,
  ErrorMessage,
  SuccessMessage,
  AuthenticateHostMessage,
  VerifyTotpMessage,
  SignalingServerConfig,
  RTCSessionDescriptionInit,
  RTCIceCandidateInit
} from './types';

export class SignalingHandler {
  constructor(
    private sessionManager: SessionManager,
    private config: SignalingServerConfig
  ) {}

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(clientId: string, rawMessage: string, ws: any): void {
    try {
      const message: SignalingMessage = JSON.parse(rawMessage);
      console.log(`[SignalingHandler] Received message from ${clientId}:`, message.type);
      console.log(`[SignalingHandler] Full message:`, JSON.stringify(message));

      switch (message.type) {
        // Phase 1: 認証フロー (4メッセージ)
        case 'register-host':
          console.log(`[SignalingHandler] Calling handleRegisterHost for ${clientId}`);
          this.handleRegisterHost(clientId, message, ws);
          break;

        case 'connect-to-host':
          console.log(`[SignalingHandler] Calling handleConnectToHost for ${clientId}`);
          this.handleConnectToHost(clientId, message, ws);
          break;

        case 'verify-totp':
          this.handleVerifyTotp(clientId, message, ws);
          break;

        case 'auth-success':
          this.handleAuthSuccess(clientId, message, ws);
          break;

        // Phase 2: WebRTC確立 (3メッセージ)
        case 'webrtc-offer':
          this.handleWebRTCOffer(clientId, message, ws);
          break;

        case 'webrtc-answer':
          this.handleWebRTCAnswer(clientId, message, ws);
          break;

        case 'ice-candidate':
          this.handleIceCandidate(clientId, message, ws);
          break;

        // 共通メッセージ (1メッセージ)
        case 'heartbeat':
          this.handleHeartbeat(clientId, message, ws);
          break;

        default:
          this.sendError(clientId, `Unknown message type: ${message.type}`);
          console.warn(`[SignalingHandler] Unknown message type: ${message.type} from client ${clientId}`);
      }
    } catch (error) {
      console.error(`[SignalingHandler] Failed to parse message from client ${clientId}:`, error);
      this.sendError(clientId, 'Invalid message format');
    }
  }

  /**
   * Handle host registration (シンプルプロトコル)
   */
  private handleRegisterHost(clientId: string, message: any, ws: any): void {
    const { hostId } = message;

    if (!hostId) {
      this.sendError(clientId, 'Missing hostId for host registration');
      return;
    }

    // Register client as host
    this.sessionManager.registerClient(clientId, ws, true);
    
    // Store hostId for this client
    this.sessionManager.setHostId(clientId, hostId);

    // Send success response
    ws.send(JSON.stringify({
      type: 'host-registered',
      hostId,
      message: 'Host registered successfully'
    }));

    console.log(`[SignalingHandler] Host registered: ${hostId} for client ${clientId}`);
  }


  /**
   * Handle ICE candidate
   */
  private handleIceCandidate(clientId: string, message: IceCandidateMessage, ws: any): void {
    const { sessionId, candidate } = message;

    if (!sessionId || !candidate) {
      this.sendError(clientId, 'Missing sessionId or candidate');
      return;
    }

    // Store ICE candidate
    const success = this.sessionManager.storeCandidate(sessionId, clientId, candidate);
    if (!success) {
      this.sendError(clientId, `Session not found: ${sessionId}`);
      return;
    }

    // Forward ICE candidate to other clients in session
    this.sessionManager.broadcastToSession(sessionId, {
      type: 'candidate-received',
      sessionId,
      clientId,
      candidate,
      timestamp: Date.now()
    }, clientId);

    console.log(`[SignalingHandler] ICE candidate from ${clientId} forwarded to session ${sessionId}`);
  }

  /**
   * Handle heartbeat
   */
  private handleHeartbeat(clientId: string, message: HeartbeatMessage, ws: any): void {
    // Update client ping timestamp
    this.sessionManager.updateClientPing(clientId);

    // Send heartbeat acknowledgment
    this.sessionManager.sendToClient(clientId, {
      type: 'heartbeat-ack',
      timestamp: Date.now()
    });
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(clientId: string): void {
    const client = this.sessionManager.getClient(clientId);
    if (client && client.sessionId) {
      // Notify other clients in session about peer disconnection
      this.sessionManager.broadcastToSession(client.sessionId, {
        type: 'peer-disconnected',
        sessionId: client.sessionId,
        clientId,
        timestamp: Date.now()
      }, clientId);
    }

    // Unregister client
    this.sessionManager.unregisterClient(clientId);
    console.log(`[SignalingHandler] Client ${clientId} disconnected`);
  }

  /**
   * Send error message to client
   */
  private sendError(clientId: string, error: string): void {
    const errorMessage: ErrorMessage = {
      type: 'error',
      error,
      timestamp: Date.now()
    };

    this.sessionManager.sendToClient(clientId, errorMessage);
  }

  /**
   * Send success message to client
   */
  private sendSuccess(clientId: string, type: 'host-registered' | 'session-joined' | 'connected' | 'host-authenticated' | 'totp-required', sessionId?: string, targetClientId?: string, message?: string): void {
    const successMessage: SuccessMessage = {
      type,
      timestamp: Date.now(),
      ...(sessionId && { sessionId }),
      ...(targetClientId && { clientId: targetClientId }),
      ...(message && { message })
    };

    this.sessionManager.sendToClient(clientId, successMessage);
  }


  /**
   * Handle verify-totp (シンプルプロトコル)
   */
  private async handleVerifyTotp(clientId: string, message: any, ws: any): Promise<void> {
    const { sessionId, totpCode } = message;

    if (!sessionId || !totpCode) {
      this.sendError(clientId, 'Missing sessionId or totpCode in verify-totp message');
      return;
    }

    // ホストにTOTP認証を転送
    const hostPeer = this.sessionManager.findHostBySession(sessionId);
    if (hostPeer) {
      this.sessionManager.sendMessage(hostPeer.clientId, {
        type: 'verify-totp',
        sessionId,
        totpCode
      });
    } else {
      this.sendError(clientId, 'Host not found for TOTP verification');
    }

    console.log(`[SignalingHandler] TOTP verification forwarded for session: ${sessionId}`);
  }

  /**
   * Handle connect-to-host (シンプルプロトコル)
   */
  private handleConnectToHost(clientId: string, message: any, ws: any): void {
    const { hostId } = message;
    
    console.log(`[SignalingHandler] handleConnectToHost: clientId=${clientId}, hostId=${hostId}`);
    
    if (!hostId) {
      console.log(`[SignalingHandler] Missing hostId in connect-to-host message`);
      this.sendError(clientId, 'Missing hostId in connect-to-host message');
      return;
    }

    // ホストが登録されているか確認
    const hostClient = this.sessionManager.findHostSession(hostId);
    console.log(`[SignalingHandler] findHostSession result:`, hostClient ? 'FOUND' : 'NOT FOUND');
    
    if (!hostClient) {
      console.log(`[SignalingHandler] Host not found for hostId: ${hostId}`);
      this.sendError(clientId, 'Host not found or not available');
      return;
    }

    // セッションID生成
    const sessionId = this.generateSessionId();
    
    // PWAに応答
    ws.send(JSON.stringify({
      type: 'host-found',
      hostId,
      sessionId,
      message: 'Host found. Enter TOTP code'
    }));

    console.log(`[SignalingHandler] Host found: ${hostId} for client ${clientId}, sessionId: ${sessionId}`);
  }

  /**
   * Handle auth-success (シンプルプロトコル)
   */
  private handleAuthSuccess(clientId: string, message: any, ws: any): void {
    const { sessionId } = message;
    
    if (!sessionId) {
      this.sendError(clientId, 'Missing sessionId in auth-success message');
      return;
    }

    // PWAクライアントを見つけて認証成功を通知
    const pwaPeer = this.sessionManager.findClientBySession(sessionId);
    if (pwaPeer) {
      this.sessionManager.sendMessage(pwaPeer.clientId, {
        type: 'auth-success',
        sessionId,
        message: 'Authentication successful'
      });
    }

    console.log(`[SignalingHandler] Auth success forwarded for session: ${sessionId}`);
  }

  /**
   * Handle webrtc-offer (シンプルプロトコル)
   */
  private handleWebRTCOffer(clientId: string, message: any, ws: any): void {
    const { sessionId, offer } = message;
    
    if (!sessionId || !offer) {
      this.sendError(clientId, 'Missing sessionId or offer in webrtc-offer message');
      return;
    }

    // ホストに転送
    const hostPeer = this.sessionManager.findHostBySession(sessionId);
    if (hostPeer) {
      this.sessionManager.sendMessage(hostPeer.clientId, {
        type: 'webrtc-offer',
        sessionId,
        offer
      });
    }

    console.log(`[SignalingHandler] WebRTC offer forwarded for session: ${sessionId}`);
  }

  /**
   * Handle webrtc-answer (シンプルプロトコル)
   */
  private handleWebRTCAnswer(clientId: string, message: any, ws: any): void {
    const { sessionId, answer } = message;
    
    if (!sessionId || !answer) {
      this.sendError(clientId, 'Missing sessionId or answer in webrtc-answer message');
      return;
    }

    // PWAに転送
    const pwaPeer = this.sessionManager.findClientBySession(sessionId);
    if (pwaPeer) {
      this.sessionManager.sendMessage(pwaPeer.clientId, {
        type: 'webrtc-answer',
        sessionId,
        answer
      });
    }

    console.log(`[SignalingHandler] WebRTC answer forwarded for session: ${sessionId}`);
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  /**
   * Get signaling statistics
   */
  getStats(): any {
    const sessionStats = this.sessionManager.getStats();
    return {
      ...sessionStats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }
}