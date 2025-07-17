import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { SessionManager } from './session-manager';
import { SignalingHandler } from './signaling-handler';
import { SignalingServerConfig } from './types';

// Default configuration
const DEFAULT_CONFIG: SignalingServerConfig = {
  port: parseInt(process.env.PORT || '5175'),
  host: process.env.HOST || '0.0.0.0',
  heartbeatInterval: 30000, // 30 seconds
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  clientTimeout: 5 * 60 * 1000, // 5 minutes
  corsOrigins: [
    'http://localhost:5174',           // PWA development
    'https://www.vibe-coder.space',    // PWA production
    /https:\/\/.*\.quickconnect\.to$/  // NAS QuickConnect
  ]
};

export class SignalingServer {
  private wss: WebSocketServer | null = null;
  private httpServer: any = null;
  private sessionManager: SessionManager;
  private signalingHandler: SignalingHandler;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(private config: SignalingServerConfig = DEFAULT_CONFIG) {
    this.sessionManager = new SessionManager(config);
    this.signalingHandler = new SignalingHandler(this.sessionManager, config);
  }

  /**
   * Start the WebSocket signaling server
   */
  public async start(): Promise<void> {
    if (this.wss) {
      throw new Error('Signaling server already started');
    }

    try {
      // Create HTTP server for WebSocket upgrade
      this.httpServer = createServer();

      // Create WebSocket server
      this.wss = new WebSocketServer({
        server: this.httpServer,
        path: '/', // Accept WebSocket connections at root path
      });

      // Set up WebSocket event handlers
      this.setupWebSocketHandlers();

      // Start heartbeat monitoring
      this.startHeartbeatMonitoring();

      // Start HTTP server
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.listen(this.config.port, this.config.host, (error: any) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      console.log(`🚀 Vibe Coder WebSocket Signaling Server started`);
      console.log(`📡 WebSocket endpoint: ws://${this.config.host === '0.0.0.0' ? 'localhost' : this.config.host}:${this.config.port}/`);
      console.log(`⚙️  Configuration:`, {
        port: this.config.port,
        host: this.config.host,
        heartbeatInterval: `${this.config.heartbeatInterval}ms`,
        sessionTimeout: `${this.config.sessionTimeout}ms`,
        clientTimeout: `${this.config.clientTimeout}ms`
      });

    } catch (error) {
      console.error('Failed to start signaling server:', error);
      throw error;
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket, request) => {
      const clientId = this.generateClientId();
      console.log(`[SignalingServer] New client connected: ${clientId}`);

      // Set up client-specific handlers
      ws.on('message', (data) => {
        if (this.isShuttingDown) return;
        
        try {
          const message = data.toString();
          this.signalingHandler.handleMessage(clientId, message, ws);
        } catch (error) {
          console.error(`[SignalingServer] Error handling message from ${clientId}:`, error);
        }
      });

      ws.on('close', (code, reason) => {
        console.log(`[SignalingServer] Client ${clientId} disconnected:`, { code, reason: reason.toString() });
        this.signalingHandler.handleDisconnection(clientId);
      });

      ws.on('open', () => {
        console.log(`[SignalingServer] WebSocket opened for client ${clientId}`);
      });

      ws.on('error', (error) => {
        console.error(`[SignalingServer] WebSocket error for client ${clientId}:`, error);
        this.signalingHandler.handleDisconnection(clientId);
      });

      ws.on('pong', () => {
        this.sessionManager.updateClientPing(clientId);
      });

      // Register client with SessionManager (isHost will be determined later)
      this.sessionManager.registerClient(clientId, ws, false);

      // Send connection acknowledgment with a small delay to ensure connection is fully established
      setImmediate(() => {
        try {
          const connectedMessage = {
            type: 'connected',
            clientId,
            timestamp: Date.now()
          };
          ws.send(JSON.stringify(connectedMessage));
          console.log(`[SignalingServer] Sent connected message to ${clientId}`);
        } catch (error) {
          console.error(`[SignalingServer] Failed to send connection ack to ${clientId}:`, error);
        }
      });
    });

    this.wss.on('error', (error) => {
      console.error('[SignalingServer] WebSocket server error:', error);
    });

    console.log('[SignalingServer] WebSocket handlers configured');
  }

  /**
   * Start heartbeat monitoring to detect dead connections
   */
  private startHeartbeatMonitoring(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      if (this.isShuttingDown || !this.wss) return;

      console.log('[SignalingServer] Performing heartbeat check...');
      
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.ping();
          } catch (error) {
            console.error('[SignalingServer] Failed to send ping:', error);
          }
        }
      });

      // Log statistics
      const stats = this.signalingHandler.getStats();
      console.log('[SignalingServer] Stats:', stats);

    }, this.config.heartbeatInterval);

    console.log(`[SignalingServer] Heartbeat monitoring started (interval: ${this.config.heartbeatInterval}ms)`);
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeatMonitoring(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[SignalingServer] Heartbeat monitoring stopped');
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get server statistics
   */
  public getStats(): any {
    return this.signalingHandler.getStats();
  }

  /**
   * Gracefully shutdown the server
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    console.log('[SignalingServer] Starting graceful shutdown...');
    this.isShuttingDown = true;

    // Stop heartbeat monitoring
    this.stopHeartbeatMonitoring();

    // Close all WebSocket connections
    if (this.wss) {
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1001, 'Server shutting down');
        }
      });

      // Close WebSocket server
      await new Promise<void>((resolve) => {
        this.wss!.close(() => {
          console.log('[SignalingServer] WebSocket server closed');
          resolve();
        });
      });
    }

    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => {
          console.log('[SignalingServer] HTTP server closed');
          resolve();
        });
      });
    }

    // Destroy session manager
    this.sessionManager.destroy();

    console.log('[SignalingServer] Graceful shutdown completed');
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new SignalingServer();

  // Handle graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n[SignalingServer] Received ${signal}, starting graceful shutdown...`);
    try {
      await server.shutdown();
      process.exit(0);
    } catch (error) {
      console.error('[SignalingServer] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Start the server
  server.start().catch((error) => {
    console.error('[SignalingServer] Failed to start server:', error);
    process.exit(1);
  });
}