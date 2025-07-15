import WebSocket, { WebSocketServer } from 'ws';
import { createServer } from 'http';
import logger from './utils/logger';
import type { 
  WebSocketSignalMessage, 
  WebSocketSignalResponse,
  SessionInfo 
} from '@vibe-coder/shared';

interface SignalingSession {
  sessionId: string;
  hostId?: string;
  hostConnection?: WebSocket;
  clientConnections: Map<string, WebSocket>;
  offers: Map<string, RTCSessionDescriptionInit>;
  answers: Map<string, RTCSessionDescriptionInit>;
  iceCandidates: Map<string, RTCIceCandidateInit[]>;
  createdAt: Date;
  lastActivity: Date;
}

export class WebSocketSignalingServer {
  private wss: WebSocketServer;
  private server: any;
  private sessions = new Map<string, SignalingSession>();
  private connectionCount = 0;
  private isShuttingDown = false;

  constructor(private port: number = 5175) {
    this.server = createServer();
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/'
    });
    
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const connectionId = `conn-${++this.connectionCount}`;
      logger.info('New WebSocket connection', { connectionId });

      ws.on('message', (data) => {
        try {
          const message: WebSocketSignalMessage = JSON.parse(data.toString());
          this.handleMessage(ws, connectionId, message);
        } catch (error) {
          logger.error('Invalid WebSocket message format', { 
            connectionId, 
            error: (error as Error).message 
          });
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket connection closed', { connectionId });
        this.handleDisconnection(ws, connectionId);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket connection error', { 
          connectionId, 
          error: error.message 
        });
      });

      // Send connection confirmation
      this.sendResponse(ws, {
        type: 'success',
        sessionId: 'system',
        message: 'Connected to signaling server',
        timestamp: Date.now()
      });
    });
  }

  private handleMessage(ws: WebSocket, connectionId: string, message: WebSocketSignalMessage): void {
    logger.info('Received signaling message', { 
      connectionId, 
      type: message.type, 
      sessionId: message.sessionId 
    });

    switch (message.type) {
      case 'register-host':
        this.handleRegisterHost(ws, connectionId, message);
        break;
      
      case 'join-session':
      case 'session-join':
        this.handleJoinSession(ws, connectionId, message);
        break;
      
      case 'session-leave':
      case 'leave-session':
        this.handleLeaveSession(ws, connectionId, message);
        break;
      
      case 'offer':
        this.handleOffer(ws, connectionId, message);
        break;
      
      case 'answer':
        this.handleAnswer(ws, connectionId, message);
        break;
      
      case 'ice-candidate':
        this.handleIceCandidate(ws, connectionId, message);
        break;
      
      case 'heartbeat':
        this.handleHeartbeat(ws, connectionId, message);
        break;
      
      default:
        logger.warn('Unknown message type', { 
          connectionId, 
          type: (message as any).type 
        });
        this.sendError(ws, `Unknown message type: ${(message as any).type}`);
    }
  }

  private handleRegisterHost(ws: WebSocket, connectionId: string, message: WebSocketSignalMessage): void {
    const { sessionId, clientId } = message;
    
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = this.createSession(sessionId, clientId);
    }
    
    session.hostConnection = ws;
    session.hostId = clientId;
    session.lastActivity = new Date();
    
    logger.info('Host registered', { 
      connectionId, 
      sessionId, 
      hostId: clientId 
    });
    
    this.sendResponse(ws, {
      type: 'session-created',
      sessionId,
      message: 'Host registered successfully',
      timestamp: Date.now()
    });
  }

  private handleJoinSession(ws: WebSocket, connectionId: string, message: WebSocketSignalMessage): void {
    const { sessionId, clientId } = message;
    
    let session = this.sessions.get(sessionId);
    if (!session) {
      // Create session if it doesn't exist (client-first scenario)
      session = this.createSession(sessionId);
    }
    
    session.clientConnections.set(clientId!, ws);
    session.lastActivity = new Date();
    
    logger.info('Client joined session', { 
      connectionId, 
      sessionId, 
      clientId,
      totalClients: session.clientConnections.size
    });
    
    this.sendResponse(ws, {
      type: 'session-joined',
      sessionId,
      message: 'Joined session successfully',
      timestamp: Date.now()
    });
    
    // Notify host about new client
    if (session.hostConnection) {
      this.sendResponse(session.hostConnection, {
        type: 'peer-connected',
        sessionId,
        clientId,
        timestamp: Date.now()
      });
    }
  }

  private handleLeaveSession(ws: WebSocket, connectionId: string, message: WebSocketSignalMessage): void {
    const { sessionId, clientId } = message;
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }
    
    session.clientConnections.delete(clientId!);
    session.lastActivity = new Date();
    
    logger.info('Client left session', { 
      connectionId, 
      sessionId, 
      clientId,
      remainingClients: session.clientConnections.size
    });
    
    this.sendResponse(ws, {
      type: 'session-left',
      sessionId,
      message: 'Left session successfully',
      timestamp: Date.now()
    });
    
    // Notify host about client disconnect
    if (session.hostConnection) {
      this.sendResponse(session.hostConnection, {
        type: 'peer-disconnected',
        sessionId,
        clientId,
        timestamp: Date.now()
      });
    }
    
    // Clean up empty session
    if (session.clientConnections.size === 0 && !session.hostConnection) {
      this.sessions.delete(sessionId);
      logger.info('Session cleaned up', { sessionId });
    }
  }

  private handleOffer(ws: WebSocket, connectionId: string, message: WebSocketSignalMessage): void {
    const { sessionId, clientId, offer } = message;
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }
    
    // Store offer for potential future retrieval
    if (offer && clientId) {
      session.offers.set(clientId, offer);
    }
    
    session.lastActivity = new Date();
    
    logger.info('WebRTC offer received', { 
      connectionId, 
      sessionId, 
      clientId,
      hasOffer: !!offer
    });
    
    // Forward offer to host
    if (session.hostConnection) {
      this.sendResponse(session.hostConnection, {
        type: 'offer-received',
        sessionId,
        clientId,
        offer,
        timestamp: Date.now()
      });
      
      this.sendResponse(ws, {
        type: 'success',
        sessionId,
        message: 'Offer forwarded to host',
        timestamp: Date.now()
      });
    } else {
      this.sendError(ws, 'Host not available');
    }
  }

  private handleAnswer(ws: WebSocket, connectionId: string, message: WebSocketSignalMessage): void {
    const { sessionId, clientId, answer } = message;
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }
    
    // Store answer for potential future retrieval
    if (answer && clientId) {
      session.answers.set(clientId, answer);
    }
    
    session.lastActivity = new Date();
    
    logger.info('WebRTC answer received', { 
      connectionId, 
      sessionId, 
      clientId,
      hasAnswer: !!answer
    });
    
    // Forward answer to appropriate client
    if (clientId) {
      const targetClient = session.clientConnections.get(clientId);
      if (targetClient) {
        this.sendResponse(targetClient, {
          type: 'answer-received',
          sessionId,
          clientId,
          answer,
          timestamp: Date.now()
        });
        
        this.sendResponse(ws, {
          type: 'success',
          sessionId,
          message: 'Answer forwarded to client',
          timestamp: Date.now()
        });
      } else {
        // Broadcast to all clients if specific client not found
        session.clientConnections.forEach((clientWs, cId) => {
          this.sendResponse(clientWs, {
            type: 'answer-received',
            sessionId,
            clientId: cId,
            answer,
            timestamp: Date.now()
          });
        });
      }
    }
  }

  private handleIceCandidate(ws: WebSocket, connectionId: string, message: WebSocketSignalMessage): void {
    const { sessionId, clientId, candidate } = message;
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }
    
    // Store ICE candidate
    if (candidate && clientId) {
      if (!session.iceCandidates.has(clientId)) {
        session.iceCandidates.set(clientId, []);
      }
      session.iceCandidates.get(clientId)!.push(candidate);
    }
    
    session.lastActivity = new Date();
    
    logger.info('ICE candidate received', { 
      connectionId, 
      sessionId, 
      clientId,
      hasCandidate: !!candidate
    });
    
    // Forward ICE candidate based on sender
    if (ws === session.hostConnection) {
      // Host sending to client(s)
      if (clientId) {
        const targetClient = session.clientConnections.get(clientId);
        if (targetClient) {
          this.sendResponse(targetClient, {
            type: 'candidate-received',
            sessionId,
            clientId,
            candidate,
            timestamp: Date.now()
          });
        }
      } else {
        // Broadcast to all clients
        session.clientConnections.forEach((clientWs, cId) => {
          this.sendResponse(clientWs, {
            type: 'candidate-received',
            sessionId,
            clientId: cId,
            candidate,
            timestamp: Date.now()
          });
        });
      }
    } else {
      // Client sending to host
      if (session.hostConnection) {
        this.sendResponse(session.hostConnection, {
          type: 'candidate-received',
          sessionId,
          clientId,
          candidate,
          timestamp: Date.now()
        });
      }
    }
    
    this.sendResponse(ws, {
      type: 'success',
      sessionId,
      message: 'ICE candidate forwarded',
      timestamp: Date.now()
    });
  }

  private handleHeartbeat(ws: WebSocket, connectionId: string, message: WebSocketSignalMessage): void {
    const { sessionId } = message;
    
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
    
    this.sendResponse(ws, {
      type: 'success',
      sessionId,
      message: 'heartbeat-ack',
      timestamp: Date.now()
    });
  }

  private handleDisconnection(ws: WebSocket, connectionId: string): void {
    // Find and clean up sessions associated with this connection
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.hostConnection === ws) {
        // Host disconnected
        session.hostConnection = undefined;
        logger.info('Host disconnected from session', { sessionId, connectionId });
        
        // Notify all clients
        session.clientConnections.forEach((clientWs, clientId) => {
          this.sendResponse(clientWs, {
            type: 'peer-disconnected',
            sessionId,
            clientId: 'host',
            timestamp: Date.now()
          });
        });
      } else {
        // Check if it's a client connection
        for (const [clientId, clientWs] of session.clientConnections.entries()) {
          if (clientWs === ws) {
            session.clientConnections.delete(clientId);
            logger.info('Client disconnected from session', { sessionId, clientId, connectionId });
            
            // Notify host
            if (session.hostConnection) {
              this.sendResponse(session.hostConnection, {
                type: 'peer-disconnected',
                sessionId,
                clientId,
                timestamp: Date.now()
              });
            }
            break;
          }
        }
      }
      
      // Clean up empty sessions
      if (!session.hostConnection && session.clientConnections.size === 0) {
        this.sessions.delete(sessionId);
        logger.info('Empty session cleaned up', { sessionId });
      }
    }
  }

  private createSession(sessionId: string, hostId?: string): SignalingSession {
    const session: SignalingSession = {
      sessionId,
      hostId,
      clientConnections: new Map(),
      offers: new Map(),
      answers: new Map(),
      iceCandidates: new Map(),
      createdAt: new Date(),
      lastActivity: new Date()
    };
    
    this.sessions.set(sessionId, session);
    logger.info('New signaling session created', { sessionId, hostId });
    
    return session;
  }

  private sendResponse(ws: WebSocket, response: WebSocketSignalResponse): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(response));
      } catch (error) {
        logger.error('Failed to send WebSocket response', { 
          error: (error as Error).message 
        });
      }
    }
  }

  private sendError(ws: WebSocket, error: string, sessionId: string = 'system'): void {
    this.sendResponse(ws, {
      type: 'error',
      sessionId,
      error,
      timestamp: Date.now()
    });
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => {
        logger.info(`WebSocket Signaling Server started on port ${this.port}`);
        resolve();
      });
      
      this.server.on('error', (error: Error) => {
        logger.error('Server startup error', { error: error.message });
        reject(error);
      });
    });
  }

  public async stop(): Promise<void> {
    this.isShuttingDown = true;
    
    // Close all WebSocket connections
    this.wss.clients.forEach((ws) => {
      ws.close(1001, 'Server shutting down');
    });
    
    // Close WebSocket server
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => {
          logger.info('WebSocket Signaling Server stopped');
          resolve();
        });
      });
    });
  }

  public getStats(): {
    activeSessions: number;
    totalConnections: number;
    sessionDetails: SessionInfo[];
  } {
    const sessionDetails: SessionInfo[] = Array.from(this.sessions.values()).map(session => ({
      sessionId: session.sessionId,
      hostId: session.hostId || 'unknown',
      status: session.hostConnection ? 
        (session.clientConnections.size > 0 ? 'connected' : 'waiting') : 
        'disconnected',
      createdAt: session.createdAt.getTime(),
      connectedClients: session.clientConnections.size
    }));

    return {
      activeSessions: this.sessions.size,
      totalConnections: this.wss.clients.size,
      sessionDetails
    };
  }

  public cleanupInactiveSessions(): void {
    const inactiveThreshold = 10 * 60 * 1000; // 10 minutes
    const now = new Date();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > inactiveThreshold) {
        logger.info('Cleaning up inactive session', { 
          sessionId, 
          lastActivity: session.lastActivity,
          ageMinutes: Math.round((now.getTime() - session.createdAt.getTime()) / (1000 * 60))
        });
        this.sessions.delete(sessionId);
      }
    }
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new WebSocketSignalingServer();
  
  process.on('SIGINT', async () => {
    console.log('\nShutting down WebSocket Signaling Server...');
    await server.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\nShutting down WebSocket Signaling Server...');
    await server.stop();
    process.exit(0);
  });
  
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}