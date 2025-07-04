import { EventEmitter } from 'events';

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  signalingServerUrl: string;
  serverId: string;
  reconnectInterval?: number;
  connectionTimeout?: number;
}

export interface WebRTCMessage {
  type: 'command' | 'output' | 'status' | 'file-upload';
  id: string;
  timestamp: number;
  data: any;
}

export interface WebRTCConnectionState {
  isConnecting: boolean;
  isConnected: boolean;
  connectionError: string | null;
  serverId: string | null;
  latency: number;
}

export class WebRTCClient extends EventEmitter {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private config: WebRTCConfig;
  private state: WebRTCConnectionState = {
    isConnecting: false,
    isConnected: false,
    connectionError: null,
    serverId: null,
    latency: 0,
  };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionTimer: NodeJS.Timeout | null = null;
  private latencyTimer: NodeJS.Timeout | null = null;

  constructor(config: WebRTCConfig) {
    super();
    this.config = {
      reconnectInterval: 5000,
      connectionTimeout: 30000,
      ...config,
    };
  }

  public getState(): WebRTCConnectionState {
    return { ...this.state };
  }

  public async connect(serverId: string): Promise<void> {
    if (this.state.isConnecting || this.state.isConnected) {
      throw new Error('Already connecting or connected');
    }

    this.state = {
      ...this.state,
      isConnecting: true,
      serverId,
      connectionError: null,
    };
    this.emit('stateChange', this.state);

    try {
      await this.establishConnection(serverId);
    } catch (error) {
      this.handleConnectionError(error as Error);
      throw error;
    }
  }

  public disconnect(): void {
    this.cleanup();
    this.state = {
      isConnecting: false,
      isConnected: false,
      connectionError: null,
      serverId: null,
      latency: 0,
    };
    this.emit('stateChange', this.state);
    this.emit('disconnect');
  }

  public sendCommand(command: string): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    const message: WebRTCMessage = {
      type: 'command',
      id: this.generateId(),
      timestamp: Date.now(),
      data: { command },
    };

    this.dataChannel.send(JSON.stringify(message));
    this.emit('commandSent', command);
  }

  public sendFile(file: File): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    const reader = new FileReader();
    reader.onload = () => {
      const message: WebRTCMessage = {
        type: 'file-upload',
        id: this.generateId(),
        timestamp: Date.now(),
        data: {
          name: file.name,
          type: file.type,
          size: file.size,
          content: reader.result,
        },
      };

      this.dataChannel!.send(JSON.stringify(message));
      this.emit('fileSent', file);
    };

    reader.readAsDataURL(file);
  }

  private async establishConnection(serverId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connectionTimer = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.connectionTimeout);

      this.createPeerConnection()
        .then(() => this.createOffer(serverId))
        .then(() => this.waitForAnswer(serverId))
        .then(() => {
          if (this.connectionTimer) {
            clearTimeout(this.connectionTimer);
            this.connectionTimer = null;
          }
          resolve();
        })
        .catch(reject);
    });
  }

  private async createPeerConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers,
    });

    // ICE candidate handling
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage('ice-candidate', {
          candidate: event.candidate,
        });
      }
    };

    // Connection state monitoring
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      
      switch (state) {
        case 'connected':
          this.handleConnectionEstablished();
          break;
        case 'disconnected':
        case 'failed':
          this.handleConnectionLost();
          break;
        case 'closed':
          this.handleConnectionClosed();
          break;
      }
    };

    // Data channel creation
    this.dataChannel = this.peerConnection.createDataChannel('vibe-coder', {
      ordered: true,
    });

    this.setupDataChannel();
  }

  private setupDataChannel(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      this.emit('dataChannelOpen');
      this.startLatencyMonitoring();
    };

    this.dataChannel.onclose = () => {
      this.emit('dataChannelClose');
      this.stopLatencyMonitoring();
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message: WebRTCMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
      this.emit('error', error);
    };
  }

  private async createOffer(serverId: string): Promise<void> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    await this.sendSignalingMessage('offer', {
      serverId,
      offer: offer,
    });
  }

  private async waitForAnswer(serverId: string): Promise<void> {
    const pollInterval = 1000;
    const maxAttempts = 30;
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        attempts++;
        
        if (attempts > maxAttempts) {
          reject(new Error('No answer received from server'));
          return;
        }

        try {
          const response = await fetch(
            `${this.config.signalingServerUrl}/api/signal?type=answer&serverId=${serverId}`
          );
          
          const data = await response.json();
          
          if (data.data) {
            const answer = new RTCSessionDescription(data.data);
            await this.peerConnection!.setRemoteDescription(answer);
            await this.processIceCandidates(serverId);
            resolve();
          } else {
            setTimeout(poll, pollInterval);
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  private async processIceCandidates(serverId: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.signalingServerUrl}/api/signal?type=ice-candidate&serverId=${serverId}`
      );
      
      const data = await response.json();
      
      if (data.data && Array.isArray(data.data)) {
        for (const candidateData of data.data) {
          try {
            const candidate = new RTCIceCandidate(candidateData);
            await this.peerConnection!.addIceCandidate(candidate);
          } catch (error) {
            console.warn('Failed to add ICE candidate:', error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to process ICE candidates:', error);
    }
  }

  private async sendSignalingMessage(type: string, data: any): Promise<void> {
    const response = await fetch(`${this.config.signalingServerUrl}/api/signal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        serverId: this.state.serverId,
        data,
      }),
    });

    if (!response.ok) {
      throw new Error(`Signaling failed: ${response.statusText}`);
    }
  }

  private handleMessage(message: WebRTCMessage): void {
    switch (message.type) {
      case 'output':
        this.emit('terminalOutput', message.data);
        break;
      case 'status':
        this.emit('statusUpdate', message.data);
        break;
      default:
        this.emit('message', message);
    }
  }

  private handleConnectionEstablished(): void {
    this.state = {
      ...this.state,
      isConnecting: false,
      isConnected: true,
      connectionError: null,
    };
    this.emit('stateChange', this.state);
    this.emit('connect');
  }

  private handleConnectionLost(): void {
    if (this.state.isConnected) {
      this.state = {
        ...this.state,
        isConnected: false,
        connectionError: 'Connection lost',
      };
      this.emit('stateChange', this.state);
      this.emit('connectionLost');
      this.attemptReconnection();
    }
  }

  private handleConnectionClosed(): void {
    this.state = {
      ...this.state,
      isConnecting: false,
      isConnected: false,
    };
    this.emit('stateChange', this.state);
  }

  private handleConnectionError(error: Error): void {
    this.state = {
      ...this.state,
      isConnecting: false,
      isConnected: false,
      connectionError: error.message,
    };
    this.emit('stateChange', this.state);
    this.emit('error', error);
  }

  private attemptReconnection(): void {
    if (this.reconnectTimer || !this.state.serverId) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.state.serverId) {
        this.connect(this.state.serverId).catch((error) => {
          console.error('Reconnection failed:', error);
          this.attemptReconnection();
        });
      }
    }, this.config.reconnectInterval);
  }

  private startLatencyMonitoring(): void {
    this.latencyTimer = setInterval(() => {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        const start = performance.now();
        const pingMessage: WebRTCMessage = {
          type: 'ping',
          id: this.generateId(),
          timestamp: start,
          data: {},
        };

        this.dataChannel.send(JSON.stringify(pingMessage));

        // Handle pong response in message handler
        const handlePong = (message: WebRTCMessage) => {
          if (message.type === 'pong' && message.id === pingMessage.id) {
            this.state.latency = performance.now() - start;
            this.emit('stateChange', this.state);
            this.off('message', handlePong);
          }
        };

        this.on('message', handlePong);
      }
    }, 5000);
  }

  private stopLatencyMonitoring(): void {
    if (this.latencyTimer) {
      clearInterval(this.latencyTimer);
      this.latencyTimer = null;
    }
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }

    this.stopLatencyMonitoring();

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

// Default configuration
export const DEFAULT_WEBRTC_CONFIG: Partial<WebRTCConfig> = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  reconnectInterval: 5000,
  connectionTimeout: 30000,
};