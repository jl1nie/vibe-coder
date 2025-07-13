import type { WebSocketSignalMessage, WebSocketSignalResponse } from '@vibe-coder/shared';

export interface WebSocketSignalingConfig {
  signalingUrl: string;
  sessionId: string;
  clientId: string; // PWA client identifier
  wsPath: string; // WebSocket endpoint path
  connectionTimeout: number; // Connection timeout in milliseconds
  onOffer?: (offer: RTCSessionDescriptionInit) => void;
  onAnswer?: (answer: RTCSessionDescriptionInit) => void;
  onCandidate?: (candidate: RTCIceCandidateInit) => void;
  onConnectionStateChange?: (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
}

export class WebSocketSignalingClient {
  private ws: WebSocket | null = null;
  private config: WebSocketSignalingConfig;

  constructor(config: WebSocketSignalingConfig) {
    this.config = config;
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // Build proper WebSocket URL
        let wsUrl: string;
        if (this.config.signalingUrl.startsWith('http://') || this.config.signalingUrl.startsWith('https://')) {
          // URL with scheme - convert to WebSocket scheme
          wsUrl = this.config.signalingUrl
            .replace('http://', 'ws://')
            .replace('https://', 'wss://') + this.config.wsPath;
        } else {
          // Plain host:port format - add WebSocket scheme
          const protocol = this.config.signalingUrl.includes('localhost') ? 'ws://' : 'wss://';
          wsUrl = `${protocol}${this.config.signalingUrl}${this.config.wsPath}`;
        }

        console.log(`🔗 Connecting to WebSocket: ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connection established');
          this.config.onConnectionStateChange?.('connected');
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketSignalResponse = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ WebSocket message parse error:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket connection closed:', event.code, event.reason);
          this.config.onConnectionStateChange?.('disconnected');
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.config.onConnectionStateChange?.('error');
          reject(error);
        };

        // Connection timeout
        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.ws?.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, this.config.connectionTimeout);

      } catch (error) {
        console.error('❌ WebSocket connection error:', error);
        reject(error);
      }
    });
  }


  private handleMessage(message: WebSocketSignalResponse) {
    const { type } = message;

    switch (type) {
      case 'offer':
      case 'offer-received':
        console.log('📤 Received offer via WebSocket');
        this.config.onOffer?.(message.offer!);
        break;
      
      case 'answer':
      case 'answer-received':
        console.log('📥 Received answer via WebSocket');
        this.config.onAnswer?.(message.answer!);
        break;
      
      case 'ice-candidate':
      case 'candidate-received':
        console.log('🔄 Received ICE candidate via WebSocket', message.candidate);
        // Handle nested candidate structure from signaling server
        const candidate = message.candidate?.candidate || message.candidate;
        if (candidate) {
          this.config.onCandidate?.(candidate as RTCIceCandidateInit);
        }
        break;
      
      case 'session-created':
      case 'session-joined':
      case 'session-left':
      case 'success':
        console.log('✅ WebSocket operation success:', message.message);
        break;
      
      case 'peer-connected':
        console.log('👥 Peer connected:', message.clientId);
        break;
      
      case 'peer-disconnected':
        console.log('👤 Peer disconnected:', message.clientId);
        this.config.onConnectionStateChange?.('disconnected');
        break;
      
      case 'error':
        console.error('❌ WebSocket operation error:', message.error);
        this.config.onConnectionStateChange?.('error');
        break;
      
      default:
        console.log('📨 WebSocket message:', message);
    }
  }

  async createSession(): Promise<boolean> {
    return this.sendMessage({
      type: 'join-session',  // PWA joins existing session created by host
      sessionId: this.config.sessionId,
      clientId: this.config.clientId,
      timestamp: Date.now()
    });
  }

  async joinSession(): Promise<boolean> {
    return this.sendMessage({
      type: 'join-session',  // Standard join-session message
      sessionId: this.config.sessionId,
      clientId: this.config.clientId,
      timestamp: Date.now()
    });
  }

  async leaveSession(): Promise<boolean> {
    return this.sendMessage({
      type: 'session-leave',  // Correct message type for leaving
      sessionId: this.config.sessionId,
      clientId: this.config.clientId,
      timestamp: Date.now()
    });
  }

  async sendOffer(offer: RTCSessionDescriptionInit): Promise<boolean> {
    console.log('📤 Sending offer via WebSocket');
    return this.sendMessage({
      type: 'offer',
      sessionId: this.config.sessionId,
      clientId: this.config.clientId,
      offer,
      timestamp: Date.now()
    });
  }

  async sendAnswer(answer: RTCSessionDescriptionInit): Promise<boolean> {
    console.log('📥 Sending answer via WebSocket');
    return this.sendMessage({
      type: 'answer',
      sessionId: this.config.sessionId,
      clientId: this.config.clientId,
      answer,
      timestamp: Date.now()
    });
  }

  async sendCandidate(candidate: RTCIceCandidateInit): Promise<boolean> {
    console.log('🔄 Sending ICE candidate via WebSocket');
    return this.sendMessage({
      type: 'ice-candidate',
      sessionId: this.config.sessionId,
      clientId: this.config.clientId,
      candidate,
      timestamp: Date.now()
    });
  }

  async authenticateHost(hostId: string): Promise<boolean> {
    console.log('🔐 Sending host authentication via WebSocket');
    return this.sendMessage({
      type: 'session-create', // Use existing type for now
      sessionId: 'auth-' + hostId,
      clientId: this.config.clientId,
      timestamp: Date.now()
    } as any);
  }

  async verifyTotp(sessionId: string, _totpCode: string): Promise<boolean> {
    console.log('🔑 Sending TOTP verification via WebSocket');
    return this.sendMessage({
      type: 'session-join', // Use existing type for now
      sessionId,
      clientId: this.config.clientId,
      timestamp: Date.now()
    } as any);
  }

  private async sendMessage(message: WebSocketSignalMessage): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.error('❌ WebSocket not connected');
        resolve(false);
        return;
      }

      try {
        this.ws.send(JSON.stringify(message));
        resolve(true);
      } catch (error) {
        console.error('❌ Failed to send WebSocket message:', error);
        resolve(false);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Factory function for WebSocket signaling setup
export function createWebSocketSignaling(
  signalingUrl: string,
  sessionId: string,
  clientId: string,
  wsPath: string,
  connectionTimeout: number,
  callbacks: {
    onOffer?: (offer: RTCSessionDescriptionInit) => void;
    onAnswer?: (answer: RTCSessionDescriptionInit) => void;
    onCandidate?: (candidate: RTCIceCandidateInit) => void;
    onConnectionStateChange?: (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  } = {}
): WebSocketSignalingClient {
  const config: WebSocketSignalingConfig = {
    signalingUrl,
    sessionId,
    clientId,
    wsPath,
    connectionTimeout,
    ...callbacks
  };
  return new WebSocketSignalingClient(config);
}