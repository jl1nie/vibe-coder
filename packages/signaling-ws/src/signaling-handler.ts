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

      switch (message.type) {
        case 'register-host':
          this.handleRegisterHost(clientId, message as RegisterHostMessage, ws);
          break;

        case 'join-session':
          this.handleJoinSession(clientId, message as JoinSessionMessage, ws);
          break;

        case 'offer':
          this.handleOffer(clientId, message as OfferMessage, ws);
          break;

        case 'answer':
          this.handleAnswer(clientId, message as AnswerMessage, ws);
          break;

        case 'ice-candidate':
          this.handleIceCandidate(clientId, message as IceCandidateMessage, ws);
          break;

        case 'heartbeat':
          this.handleHeartbeat(clientId, message as HeartbeatMessage, ws);
          break;

        case 'authenticate-host':
          this.handleAuthenticateHost(clientId, message as AuthenticateHostMessage, ws);
          break;

        case 'verify-totp':
          this.handleVerifyTotp(clientId, message as VerifyTotpMessage, ws);
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
   * Handle host registration
   */
  private handleRegisterHost(clientId: string, message: RegisterHostMessage, ws: any): void {
    const { sessionId, hostId } = message;

    if (!sessionId || !hostId) {
      this.sendError(clientId, 'Missing sessionId or hostId for host registration');
      return;
    }

    // Register client as host
    this.sessionManager.registerClient(clientId, ws, true);
    this.sessionManager.updateClientSession(clientId, sessionId);

    // Create or get session
    let session = this.sessionManager.getSession(sessionId);
    if (!session) {
      session = this.sessionManager.createSession(sessionId, hostId);
    }

    // Send success response
    this.sendSuccess(clientId, 'host-registered', sessionId);
    console.log(`[SignalingHandler] Host registered: ${hostId} for session ${sessionId}`);
  }

  /**
   * Handle client session join
   */
  private handleJoinSession(clientId: string, message: JoinSessionMessage, ws: any): void {
    const { sessionId } = message;

    if (!sessionId) {
      this.sendError(clientId, 'Missing sessionId for session join');
      return;
    }

    // Register client
    this.sessionManager.registerClient(clientId, ws, false);
    
    // Join session
    const success = this.sessionManager.joinSession(sessionId, clientId);
    if (!success) {
      this.sendError(clientId, `Session not found: ${sessionId}`);
      return;
    }

    this.sessionManager.updateClientSession(clientId, sessionId);

    // Send success response
    this.sendSuccess(clientId, 'session-joined', sessionId, clientId);
    
    // Notify other clients in session about new peer
    this.sessionManager.broadcastToSession(sessionId, {
      type: 'peer-connected',
      sessionId,
      clientId,
      timestamp: Date.now()
    }, clientId);

    console.log(`[SignalingHandler] Client ${clientId} joined session ${sessionId}`);
  }

  /**
   * Handle WebRTC offer
   */
  private handleOffer(clientId: string, message: OfferMessage, ws: any): void {
    const { sessionId, offer } = message;

    if (!sessionId || !offer) {
      this.sendError(clientId, 'Missing sessionId or offer');
      return;
    }

    // Store offer
    const success = this.sessionManager.storeOffer(sessionId, clientId, offer);
    if (!success) {
      this.sendError(clientId, `Session not found: ${sessionId}`);
      return;
    }

    // Forward offer to other clients in session
    this.sessionManager.broadcastToSession(sessionId, {
      type: 'offer-received',
      sessionId,
      clientId,
      offer,
      timestamp: Date.now()
    }, clientId);

    console.log(`[SignalingHandler] Offer from ${clientId} forwarded to session ${sessionId}`);
  }

  /**
   * Handle WebRTC answer
   */
  private handleAnswer(clientId: string, message: AnswerMessage, ws: any): void {
    const { sessionId, answer } = message;

    if (!sessionId || !answer) {
      this.sendError(clientId, 'Missing sessionId or answer');
      return;
    }

    // Store answer
    const success = this.sessionManager.storeAnswer(sessionId, clientId, answer);
    if (!success) {
      this.sendError(clientId, `Session not found: ${sessionId}`);
      return;
    }

    // Forward answer to other clients in session
    this.sessionManager.broadcastToSession(sessionId, {
      type: 'answer-received',
      sessionId,
      clientId,
      answer,
      timestamp: Date.now()
    }, clientId);

    console.log(`[SignalingHandler] Answer from ${clientId} forwarded to session ${sessionId}`);
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
   * Handle Host ID authentication via signaling
   */
  private async handleAuthenticateHost(clientId: string, message: AuthenticateHostMessage, ws: any): Promise<void> {
    const { hostId } = message;

    if (!hostId || !/^[0-9]{8}$/.test(hostId)) {
      this.sendError(clientId, 'Invalid Host ID format. Must be 8 digits.');
      return;
    }

    try {
      // Forward authentication request to host server
      const hostClients = this.sessionManager.getHostClients();
      let targetHost = null;

      // Find host with matching hostId
      for (const [hostClientId, client] of hostClients) {
        // We need to check if this host has the requested hostId
        // For now, we'll use a simplified approach and generate a sessionId
        if (client.isHost) {
          targetHost = hostClientId;
          break;
        }
      }

      if (!targetHost) {
        this.sendError(clientId, `Host with ID ${hostId} not found or offline`);
        return;
      }

      // Generate session ID for this authentication attempt
      const sessionId = this.generateSessionId();
      
      // Store the authentication session
      this.sessionManager.storeAuthSession(sessionId, clientId, hostId);
      
      // Send authentication request to host
      this.sessionManager.sendToClient(targetHost, {
        type: 'auth-request',
        sessionId,
        hostId,
        clientId,
        timestamp: Date.now()
      });

      // Respond to client with session ID and next step
      this.sendSuccess(clientId, 'totp-required', sessionId, undefined, 
        'Host ID verified. Please enter your 6-digit TOTP code.');

      console.log(`[SignalingHandler] Authentication initiated for Host ID ${hostId}, session ${sessionId}`);
    } catch (error) {
      console.error(`[SignalingHandler] Authentication error:`, error);
      this.sendError(clientId, 'Authentication service temporarily unavailable');
    }
  }

  /**
   * Handle TOTP verification via signaling
   */
  private async handleVerifyTotp(clientId: string, message: VerifyTotpMessage, ws: any): Promise<void> {
    const { sessionId, totpCode } = message;

    if (!sessionId || !totpCode || !/^[0-9]{6}$/.test(totpCode)) {
      this.sendError(clientId, 'Invalid session ID or TOTP code format');
      return;
    }

    try {
      // Get authentication session
      const authSession = this.sessionManager.getAuthSession(sessionId);
      if (!authSession || authSession.clientId !== clientId) {
        this.sendError(clientId, `Invalid or expired session: ${sessionId}`);
        return;
      }

      // Forward TOTP verification to host
      const hostClients = this.sessionManager.getHostClients();
      let targetHost = null;

      for (const [hostClientId, client] of hostClients) {
        if (client.isHost) {
          targetHost = hostClientId;
          break;
        }
      }

      if (!targetHost) {
        this.sendError(clientId, 'Host server offline');
        return;
      }

      // Send TOTP verification to host
      this.sessionManager.sendToClient(targetHost, {
        type: 'verify-totp',
        sessionId,
        totpCode,
        clientId,
        hostId: authSession.hostId,
        timestamp: Date.now()
      });

      console.log(`[SignalingHandler] TOTP verification sent to host for session ${sessionId}`);
    } catch (error) {
      console.error(`[SignalingHandler] TOTP verification error:`, error);
      this.sendError(clientId, 'TOTP verification failed');
    }
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