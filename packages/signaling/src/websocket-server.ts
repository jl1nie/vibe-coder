import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import type { WebSocketSignalMessage, WebSocketSignalResponse } from '@vibe-coder/shared';

interface SessionData {
  sessionId: string;
  hostId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidates: RTCIceCandidateInit[];
  clientSocket?: WebSocket;
  hostSocket?: WebSocket;
  createdAt: number;
}

export class WebRTCSignalingServer {
  private wss: WebSocketServer;
  private sessions = new Map<string, SessionData>();
  private server;

  constructor(port: number = 3001) {
    // Create HTTP server for WebSocket upgrade
    this.server = createServer();
    
    // Create WebSocket server
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws/signal'
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    
    this.server.listen(port, () => {
      console.log(`🔗 WebSocket Signaling Server started on port ${port}`);
    });
  }

  private handleConnection(ws: WebSocket) {
    console.log('✅ New WebSocket connection established');

    ws.on('message', (data: Buffer) => {
      try {
        const message: WebSocketSignalMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('❌ WebSocket message parse error:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
      this.cleanupConnection(ws);
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
  }

  private handleMessage(ws: WebSocket, message: WebSocketSignalMessage) {
    const { type, sessionId, clientId } = message;

    switch (type) {
      case 'session-create':
        this.createSession(ws, sessionId, clientId);
        break;
      
      case 'session-join':
        this.joinSession(ws, sessionId, clientId);
        break;
      
      case 'session-leave':
        this.leaveSession(ws, sessionId, clientId);
        break;
      
      case 'offer':
        this.handleOffer(ws, sessionId, clientId, message.offer);
        break;
      
      case 'answer':
        this.handleAnswer(ws, sessionId, clientId, message.answer);
        break;
      
      case 'ice-candidate':
        this.handleIceCandidate(ws, sessionId, clientId, message.candidate);
        break;
      
      default:
        this.sendError(ws, `Unknown message type: ${type}`);
    }
  }

  private createSession(ws: WebSocket, sessionId: string, clientId: string) {
    if (this.sessions.has(sessionId)) {
      this.sendError(ws, 'Session already exists');
      return;
    }

    const sessionData: SessionData = {
      sessionId,
      hostId: clientId,
      candidates: [],
      hostSocket: ws,
      createdAt: Date.now()
    };

    this.sessions.set(sessionId, sessionData);

    const response: WebSocketSignalResponse = {
      type: 'session-created',
      sessionId,
      clientId,
      timestamp: Date.now(),
      message: 'Session created successfully'
    };

    ws.send(JSON.stringify(response));
    console.log(`📦 Session created: ${sessionId} for host: ${clientId}`);
  }

  private joinSession(ws: WebSocket, sessionId: string, clientId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    session.clientSocket = ws;

    const response: WebSocketSignalResponse = {
      type: 'session-joined',
      sessionId,
      clientId,
      timestamp: Date.now(),
      message: 'Session joined successfully'
    };

    ws.send(JSON.stringify(response));

    // Notify host about client joining
    if (session.hostSocket) {
      const hostNotification: WebSocketSignalResponse = {
        type: 'peer-connected',
        sessionId,
        clientId,
        timestamp: Date.now(),
        message: 'Client connected to session'
      };
      session.hostSocket.send(JSON.stringify(hostNotification));
    }

    console.log(`🔗 Client ${clientId} joined session: ${sessionId}`);
  }

  private leaveSession(ws: WebSocket, sessionId: string, clientId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    // Remove socket reference
    if (session.clientSocket === ws) {
      session.clientSocket = undefined;
    } else if (session.hostSocket === ws) {
      session.hostSocket = undefined;
    }

    const response: WebSocketSignalResponse = {
      type: 'session-left',
      sessionId,
      clientId,
      timestamp: Date.now(),
      message: 'Session left successfully'
    };

    ws.send(JSON.stringify(response));

    // Notify other peer about disconnection
    const otherSocket = session.clientSocket || session.hostSocket;
    if (otherSocket) {
      const peerNotification: WebSocketSignalResponse = {
        type: 'peer-disconnected',
        sessionId,
        clientId,
        timestamp: Date.now(),
        message: 'Peer disconnected from session'
      };
      otherSocket.send(JSON.stringify(peerNotification));
    }

    console.log(`🔌 Client ${clientId} left session: ${sessionId}`);
  }

  private handleOffer(ws: WebSocket, sessionId: string, clientId: string, offer?: RTCSessionDescriptionInit) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    if (!offer) {
      this.sendError(ws, 'Offer is required');
      return;
    }

    session.offer = offer;
    
    // Forward offer to host
    if (session.hostSocket && session.hostSocket !== ws) {
      const response: WebSocketSignalResponse = {
        type: 'offer-received',
        sessionId,
        clientId,
        offer,
        timestamp: Date.now()
      };
      session.hostSocket.send(JSON.stringify(response));
    }

    // Confirm to sender
    const confirmation: WebSocketSignalResponse = {
      type: 'success',
      sessionId,
      clientId,
      timestamp: Date.now(),
      message: 'Offer sent successfully'
    };
    ws.send(JSON.stringify(confirmation));

    console.log(`📤 Offer forwarded for session: ${sessionId}`);
  }

  private handleAnswer(ws: WebSocket, sessionId: string, clientId: string, answer?: RTCSessionDescriptionInit) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    if (!answer) {
      this.sendError(ws, 'Answer is required');
      return;
    }

    session.answer = answer;
    
    // Forward answer to client
    if (session.clientSocket && session.clientSocket !== ws) {
      const response: WebSocketSignalResponse = {
        type: 'answer-received',
        sessionId,
        clientId,
        answer,
        timestamp: Date.now()
      };
      session.clientSocket.send(JSON.stringify(response));
    }

    // Confirm to sender
    const confirmation: WebSocketSignalResponse = {
      type: 'success',
      sessionId,
      clientId,
      timestamp: Date.now(),
      message: 'Answer sent successfully'
    };
    ws.send(JSON.stringify(confirmation));

    console.log(`📥 Answer forwarded for session: ${sessionId}`);
  }

  private handleIceCandidate(ws: WebSocket, sessionId: string, clientId: string, candidate?: RTCIceCandidateInit) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    if (!candidate) {
      this.sendError(ws, 'ICE candidate is required');
      return;
    }

    session.candidates.push(candidate);
    
    // Forward candidate to the other peer
    const targetSocket = ws === session.clientSocket ? session.hostSocket : session.clientSocket;
    if (targetSocket) {
      const response: WebSocketSignalResponse = {
        type: 'candidate-received',
        sessionId,
        clientId,
        candidate,
        timestamp: Date.now()
      };
      targetSocket.send(JSON.stringify(response));
    }

    // Confirm to sender
    const confirmation: WebSocketSignalResponse = {
      type: 'success',
      sessionId,
      clientId,
      timestamp: Date.now(),
      message: 'ICE candidate forwarded successfully'
    };
    ws.send(JSON.stringify(confirmation));

    console.log(`🔄 ICE candidate forwarded for session: ${sessionId}`);
  }


  private cleanupConnection(ws: WebSocket) {
    // Find and cleanup sessions associated with this connection
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.clientSocket === ws || session.hostSocket === ws) {
        console.log(`🧹 Cleaning up session: ${sessionId}`);
        
        // Notify other peer about disconnection
        const otherSocket = session.clientSocket === ws ? session.hostSocket : session.clientSocket;
        if (otherSocket) {
          const notification: WebSocketSignalResponse = {
            type: 'peer-disconnected',
            sessionId,
            clientId: session.hostId,
            timestamp: Date.now(),
            message: 'Peer disconnected'
          };
          otherSocket.send(JSON.stringify(notification));
        }
        
        this.sessions.delete(sessionId);
      }
    }
  }

  private sendError(ws: WebSocket, message: string) {
    const response: WebSocketSignalResponse = {
      type: 'error',
      sessionId: '',
      timestamp: Date.now(),
      error: message
    };
    ws.send(JSON.stringify(response));
  }

  public close() {
    this.wss.close();
    this.server.close();
  }
}

// Start server if this file is run directly
if (require.main === module) {
  new WebRTCSignalingServer(3001);
}