export interface WebRTCConnectionState {
  peerConnection: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  isConnected: boolean;
  iceConnectionState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
}

export interface WebRTCConfig {
  signalingUrl: string;
  sessionId: string;
  hostId: string;
  onMessage?: (data: string) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: string) => void;
}

interface SignalingMessage {
  type: 'connect-to-host' | 'verify-totp' | 'webrtc-offer' | 'webrtc-answer' | 'ice-candidate' | 'heartbeat';
  sessionId?: string;
  hostId?: string;
  totpCode?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  timestamp?: number;
}

interface SignalingResponse {
  type: 'host-found' | 'auth-success' | 'webrtc-answer' | 'ice-candidate' | 'error' | 'heartbeat-ack';
  sessionId?: string;
  hostId?: string;
  message?: string;
  error?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  timestamp?: number;
}

export class WebRTCManager {
  private config: WebRTCConfig;
  private state: WebRTCConnectionState = {
    peerConnection: null,
    dataChannel: null,
    isConnected: false,
    iceConnectionState: 'new',
    signalingState: 'stable'
  };
  private ws: WebSocket | null = null;

  constructor(config: WebRTCConfig) {
    this.config = config;
  }


  /**
   * Authenticate with host via WebSocket signaling
   */
  async authenticateHost(hostId: string): Promise<{ sessionId: string; message: string }> {
    try {
      console.log('🔐 Starting host authentication via signaling');
      
      // Use signaling URL from config
      const signalingUrl = this.config.signalingUrl;
      
      // Connect to signaling server for authentication
      await this.connectSignaling(signalingUrl);
      
      // Send authentication request
      const authResult = await new Promise<{ sessionId: string; message: string }>((resolve, reject) => {
        // Set up authentication response handler
        const authTimeout = setTimeout(() => {
          reject(new Error('Authentication timeout'));
        }, 30000); // 30 second timeout
        
        const handleAuthResponse = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            console.log('📨 Auth response:', message);
            
            if (message.type === 'host-found') {
              clearTimeout(authTimeout);
              resolve({
                sessionId: message.sessionId,
                message: message.message || 'Host found. Proceed with TOTP authentication'
              });
            } else if (message.type === 'error') {
              clearTimeout(authTimeout);
              reject(new Error(message.error || 'Authentication failed'));
            }
          } catch (error) {
            console.error('Failed to parse auth response:', error);
          }
        };
        
        // Add temporary message handler
        if (this.ws) {
          this.ws.addEventListener('message', handleAuthResponse);
          
          // Send authentication request (シンプルプロトコル準拠)
          this.ws.send(JSON.stringify({
            type: 'connect-to-host',
            hostId
          }));
          
          // Cleanup handler after response
          const cleanup = () => {
            if (this.ws) {
              this.ws.removeEventListener('message', handleAuthResponse);
            }
          };
          
          setTimeout(cleanup, 35000); // Cleanup after timeout + buffer
        } else {
          clearTimeout(authTimeout);
          reject(new Error('WebSocket not connected'));
        }
      });
      
      return authResult;
    } catch (error) {
      console.error('❌ Host authentication failed:', error);
      throw error;
    }
  }

  /**
   * Verify TOTP code via WebSocket signaling
   */
  async verifyTotp(sessionId: string, totpCode: string): Promise<{ token: string; message: string }> {
    try {
      console.log('🔑 Verifying TOTP via signaling');
      
      const verifyResult = await new Promise<{ token: string; message: string }>((resolve, reject) => {
        const verifyTimeout = setTimeout(() => {
          reject(new Error('TOTP verification timeout'));
        }, 30000);
        
        const handleVerifyResponse = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            console.log('📨 TOTP response:', message);
            
            if (message.type === 'auth-success') {
              clearTimeout(verifyTimeout);
              
              resolve({
                token: sessionId, // Use sessionId as token
                message: message.message || 'Authentication successful'
              });
            } else if (message.type === 'error') {
              clearTimeout(verifyTimeout);
              reject(new Error(message.error || 'TOTP verification failed'));
            }
          } catch (error) {
            console.error('Failed to parse TOTP response:', error);
          }
        };
        
        if (this.ws) {
          this.ws.addEventListener('message', handleVerifyResponse);
          
          // Send TOTP verification (シンプルプロトコル準拠)
          this.ws.send(JSON.stringify({
            type: 'verify-totp',
            sessionId,
            totpCode
          }));
          
          // Cleanup handler
          setTimeout(() => {
            if (this.ws) {
              this.ws.removeEventListener('message', handleVerifyResponse);
            }
          }, 35000);
        } else {
          clearTimeout(verifyTimeout);
          reject(new Error('WebSocket not connected'));
        }
      });
      
      return verifyResult;
    } catch (error) {
      console.error('❌ TOTP verification failed:', error);
      throw error;
    }
  }

  async connect(): Promise<boolean> {
    try {
      console.log('🚀 Starting Native WebRTC connection with WebSocket signaling...');
      
      // Build WebSocket URL for signaling server (port 5175)
      const signalingUrl = this.config.signalingUrl;
      
      console.log('🔗 Connecting to WebRTC signaling server:', signalingUrl);
      
      // Connect to WebSocket signaling server
      await this.connectSignaling(signalingUrl);
      
      // Create native RTCPeerConnection with RFC 8445 compliant ICE configuration
      // Always use STUN servers for proper Server-reflexive candidate gathering
      const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ];
      
      const pc = new RTCPeerConnection({
        iceServers,
        // RFC 8445 Section 2: ICE candidate gathering policy
        iceCandidatePoolSize: 10, // Pre-gather candidates for faster connection
        iceTransportPolicy: 'all', // Allow all types of candidates
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require'
      });
      
      this.state.peerConnection = pc;
      this.setupPeerConnectionHandlers(pc);
      
      // Create data channel (PWA is initiator)
      const dataChannel = pc.createDataChannel('commands', {
        ordered: true
      });
      
      this.state.dataChannel = dataChannel;
      this.setupDataChannelHandlers(dataChannel);
      
      // Join signaling session as client
      // No need for join-session in simple protocol
      
      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      await this.sendSignalingMessage({
        type: 'webrtc-offer',
        sessionId: this.config.sessionId,
        offer
      });
      
      console.log('📤 Offer sent via WebSocket signaling');
      
      // Set timeout for WebRTC connection establishment
      setTimeout(() => {
        if (!this.state.isConnected) {
          console.warn('⚠️ WebRTC connection timeout');
          this.config.onMessage?.('\r\n⚠️ WebRTC P2P connection timeout. Please check your network connection.\r\n');
          this.config.onMessage?.('🔄 Attempting to reconnect...\r\n');
          this.config.onMessage?.('\r\nuser@localhost:~/project$ ');
          this.config.onConnectionChange?.(false);
        }
      }, 30000); // 30 second timeout

      return true;

    } catch (error) {
      console.error('❌ WebRTC connection failed:', error);
      
      // Show connection failure message
      this.config.onMessage?.('\r\n⚠️ WebRTC P2P connection failed. Please check your authentication and network.\r\n');
      this.config.onMessage?.('🔄 You may need to re-authenticate and try again.\r\n');
      this.config.onMessage?.('\r\nuser@localhost:~/project$ ');
      
      // Notify about connection failure
      this.config.onConnectionChange?.(false);
      
      this.cleanup();
      return false;
    }
  }

  private async connectSignaling(signalingUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(signalingUrl);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket signaling connected');
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message: SignalingResponse = JSON.parse(event.data);
          this.handleSignalingMessage(message);
        } catch (error) {
          console.error('❌ WebSocket message parse error:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket signaling closed:', event.code, event.reason);
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket signaling error:', error);
        reject(error);
      };
      
      // Connection timeout
      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          this.ws?.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  private setupPeerConnectionHandlers(pc: RTCPeerConnection): void {
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Log detailed ICE candidate information for RFC 8445 compliance verification
        console.log('🔄 ICE candidate generated (PWA side)', {
          candidate: event.candidate.candidate,
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
        
        console.log('🔍 ICE candidate type analysis (PWA)', {
          candidateType,
          candidateString: candidateStr
        });
        
        // Ensure we send a properly formatted ICE candidate (standard RTCIceCandidateInit only)
        const candidateData = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex
        };
        
        this.sendSignalingMessage({
          type: 'ice-candidate',
          sessionId: this.config.sessionId,
          candidate: candidateData
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('🔄 ICE connection state:', pc.iceConnectionState);
      this.state.iceConnectionState = pc.iceConnectionState;
      
      const connected = pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed';
      this.state.isConnected = connected;
      this.config.onConnectionChange?.(connected);
      
      if (connected) {
        console.log('✅ ICE connection established!');
      } else if (pc.iceConnectionState === 'failed') {
        console.error('❌ ICE connection failed');
        this.config.onError?.('ICE connection failed');
      }
    };

    pc.onsignalingstatechange = () => {
      console.log('🔄 Signaling state:', pc.signalingState);
      this.state.signalingState = pc.signalingState;
    };

    pc.ondatachannel = (event) => {
      const dc = event.channel;
      console.log('✅ Data channel received:', dc.label);
      this.state.dataChannel = dc;
      this.setupDataChannelHandlers(dc);
    };
  }

  private setupDataChannelHandlers(dataChannel: RTCDataChannel): void {
    dataChannel.onopen = () => {
      console.log('✅ Data channel opened - P2P connection established!');
      this.state.isConnected = true;
      this.config.onConnectionChange?.(true);
      this.config.onMessage?.('\r\n🎉 WebRTC P2P Connection Established!\r\n');
      this.config.onMessage?.('\r\nuser@localhost:~/project$ ');
    };
    
    dataChannel.onmessage = (event) => {
      console.log('📨 Data channel message:', event.data);
      this.config.onMessage?.(event.data);
    };
    
    dataChannel.onerror = (error) => {
      console.error('❌ Data channel error:', error);
      this.config.onError?.(`Data Channel Error: ${error}`);
    };
    
    dataChannel.onclose = () => {
      console.log('❌ Data channel closed');
      this.config.onMessage?.('\r\n⚠️ WebRTC Data Channel disconnected.\r\n');
      this.state.isConnected = false;
      this.config.onConnectionChange?.(false);
    };
  }

  private async sendSignalingMessage(message: SignalingMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket signaling not connected');
    }
    
    this.ws.send(JSON.stringify(message));
  }

  private handleSignalingMessage(message: SignalingResponse): void {
    console.log('📨 Signaling message:', message.type, message.sessionId);
    
    switch (message.type) {
      
      case 'webrtc-answer':
        if (message.answer) {
          this.handleAnswerReceived(message.answer);
        }
        break;
      
      case 'ice-candidate':
        if (message.candidate) {
          this.handleCandidateReceived(message.candidate);
        }
        break;
      
      case 'error':
        console.error('❌ Signaling error:', message.error);
        this.config.onError?.(message.error || 'Signaling error');
        break;
      
      case 'heartbeat-ack':
        console.log('💓 Heartbeat acknowledged');
        break;
      
      default:
        console.log('📨 Unknown signaling message:', message);
    }
  }


  private async handleAnswerReceived(answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.state.peerConnection;
    if (!pc) return;

    console.log('📥 Processing received answer');
    await pc.setRemoteDescription(answer);
  }

  private async handleCandidateReceived(candidate: any): Promise<void> {
    const pc = this.state.peerConnection;
    if (!pc) return;

    console.log('🔄 Received ICE candidate via WebSocket', candidate);
    console.log('🔍 Candidate type:', typeof candidate);
    console.log('🔍 Candidate keys:', candidate && typeof candidate === 'object' ? Object.keys(candidate) : 'N/A');
    console.log('🔍 Raw candidate:', JSON.stringify(candidate, null, 2));
    
    try {
      // Handle different ICE candidate formats from @roamhq/wrtc vs browser
      let candidateInit: RTCIceCandidateInit;
      
      if (typeof candidate === 'string') {
        // If candidate is a string, try to parse it
        candidateInit = JSON.parse(candidate);
        console.log('🔍 Parsed from string:', candidateInit);
      } else if (candidate && typeof candidate === 'object') {
        // If it's already an object, extract only the standard RTCIceCandidateInit fields
        candidateInit = {
          candidate: candidate.candidate || candidate,
          sdpMid: candidate.sdpMid || null,
          sdpMLineIndex: candidate.sdpMLineIndex !== undefined ? candidate.sdpMLineIndex : null
        };
        
        console.log('🔍 Extracted fields:');
        console.log('  - candidate:', candidateInit.candidate);
        console.log('  - sdpMid:', candidateInit.sdpMid);
        console.log('  - sdpMLineIndex:', candidateInit.sdpMLineIndex);
        
        // Clean up any undefined values that might cause issues
        if (candidateInit.sdpMid === undefined) candidateInit.sdpMid = null;
        if (candidateInit.sdpMLineIndex === undefined) candidateInit.sdpMLineIndex = null;
        
      } else {
        console.error('❌ Invalid ICE candidate format:', typeof candidate, candidate);
        return;
      }
      
      // Validate required fields
      if (!candidateInit.candidate || typeof candidateInit.candidate !== 'string') {
        console.error('❌ ICE candidate missing or invalid "candidate" field:', candidateInit);
        return;
      }
      
      // Additional validation for browser compatibility
      const validCandidate: RTCIceCandidateInit = {};
      if (candidateInit.candidate) validCandidate.candidate = candidateInit.candidate;
      if (candidateInit.sdpMid !== null && candidateInit.sdpMid !== undefined) {
        validCandidate.sdpMid = candidateInit.sdpMid;
      }
      if (candidateInit.sdpMLineIndex !== null && candidateInit.sdpMLineIndex !== undefined) {
        validCandidate.sdpMLineIndex = candidateInit.sdpMLineIndex;
      }
      
      console.log('🔄 Final candidate object for RTCIceCandidate:', JSON.stringify(validCandidate, null, 2));
      
      await pc.addIceCandidate(new RTCIceCandidate(validCandidate));
      console.log('✅ ICE candidate added successfully');
    } catch (error) {
      console.error('❌ Failed to add ICE candidate:', error);
      console.error('❌ Original candidate data:', candidate);
      console.error('❌ Candidate type:', typeof candidate);
      console.error('❌ Error stack:', (error as Error).stack);
      
      // Try alternative approach - empty candidate to signal end
      if (candidate === null || candidate === '') {
        try {
          await pc.addIceCandidate(null);
          console.log('✅ Added null ICE candidate (end-of-candidates)');
        } catch (nullError) {
          console.error('❌ Failed to add null ICE candidate:', nullError);
        }
      }
    }
  }

  sendMessage(data: string): boolean {
    if (this.state.dataChannel && this.state.dataChannel.readyState === 'open') {
      // Send data directly (data is already JSON from App.tsx)
      this.state.dataChannel.send(data);
      return true;
    }
    console.error('❌ Data channel not available for sending');
    return false;
  }

  getState(): WebRTCConnectionState {
    return { 
      ...this.state,
      iceConnectionState: this.state.peerConnection?.iceConnectionState || 'new',
      signalingState: this.state.peerConnection?.signalingState || 'stable'
    };
  }

  cleanup(): void {
    // No need for leave session in simple protocol
    
    if (this.state.dataChannel) {
      this.state.dataChannel.close();
      this.state.dataChannel = null;
    }
    
    if (this.state.peerConnection) {
      this.state.peerConnection.close();
      this.state.peerConnection = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.state.isConnected = false;
    this.state.iceConnectionState = 'closed';
    this.state.signalingState = 'closed';
  }
}