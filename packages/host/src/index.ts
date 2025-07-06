import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import { hostConfig } from './utils/config';
import logger from './utils/logger';
import { SessionManager } from './services/session-manager';
import { ClaudeService } from './services/claude-service';
import { WebRTCService } from './services/webrtc-service';

import { createHealthRouter } from './routes/health';
import { createAuthRouter } from './routes/auth';
import { createClaudeRouter } from './routes/claude';
import { createWebRTCRouter } from './routes/webrtc';

import { errorHandler, notFoundHandler } from './middleware/error';

class VibeCoderHost {
  private app: express.Application;
  private server: any;
  private wss!: WebSocketServer;
  private sessionManager: SessionManager;
  private claudeService: ClaudeService;
  private webrtcService: WebRTCService;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.sessionManager = new SessionManager();
    this.claudeService = new ClaudeService();
    this.webrtcService = new WebRTCService(this.sessionManager);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupWebSocket();
    this.setupCleanupTimer();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, _res, next) => {
      logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api', createHealthRouter(this.claudeService, this.sessionManager));
    this.app.use('/api/auth', createAuthRouter(this.sessionManager));
    this.app.use('/api/claude', createClaudeRouter(this.claudeService, this.sessionManager));
    this.app.use('/api/webrtc', createWebRTCRouter(this.webrtcService, this.sessionManager));

    // Root endpoint
    this.app.get('/', (_req, res) => {
      res.json({
        name: 'Vibe Coder Host',
        version: '0.1.0',
        hostId: this.sessionManager.getHostId(),
        status: 'running',
        timestamp: new Date(),
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  private setupWebSocket(): void {
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws, req) => {
      logger.info('WebSocket connection established', { ip: req.socket.remoteAddress });
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          logger.error('Invalid WebSocket message', { error: (error as Error).message });
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket connection closed');
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', { error: error.message });
      });

      // Send initial connection success
      ws.send(JSON.stringify({
        type: 'connection',
        hostId: this.sessionManager.getHostId(),
        timestamp: new Date(),
      }));
    });
  }

  private setupCleanupTimer(): void {
    // 5分間隔でクリーンアップ
    setInterval(() => {
      this.webrtcService.cleanupInactiveConnections();
    }, 5 * 60 * 1000);
  }

  private handleWebSocketMessage(ws: any, data: any): void {
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date() }));
        break;
        
      case 'heartbeat':
        if (data.sessionId) {
          this.sessionManager.updateSessionActivity(data.sessionId);
        }
        ws.send(JSON.stringify({ type: 'heartbeat-ack', timestamp: new Date() }));
        break;
        
      default:
        logger.warn('Unknown WebSocket message type', { type: data.type });
        ws.send(JSON.stringify({ error: 'Unknown message type' }));
    }
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.on('error', (error: any) => {
        logger.error('Server error', { error: error.message, code: error.code, stack: error.stack });
        reject(error);
      });

      this.server.on('listening', () => {
        const addr = this.server.address();
        logger.info('Server actually listening', { address: addr });
      });

      try {
        this.server.listen(hostConfig.port, '0.0.0.0', () => {
          const addr = this.server.address();
          logger.info('Vibe Coder Host started', {
            port: hostConfig.port,
            actualAddress: addr,
            hostId: this.sessionManager.getHostId(),
            environment: process.env.NODE_ENV || 'development',
          });
          
          console.log(`
╭─────────────────────────────────────────────────────────────╮
│                                                             │
│  🎯 Vibe Coder Host Server                                  │
│                                                             │
│  🌐 Server: http://localhost:${hostConfig.port}                        │
│  🔑 Host ID: ${this.sessionManager.getHostId()}                                │
│  📱 Ready for PWA connections                               │
│                                                             │
│  🔗 Connect from: https://vibe-coder.space                  │
│                                                             │
╰─────────────────────────────────────────────────────────────╯
          `);
          
          resolve();
        });
      } catch (error) {
        logger.error('Server listen failed', { error: (error as Error).message });
        reject(error);
      }
    });
  }

  public async stop(): Promise<void> {
    logger.info('Shutting down Vibe Coder Host...');
    
    // Close WebSocket server
    this.wss.close();
    
    // Stop services
    this.claudeService.destroy();
    this.sessionManager.destroy();
    this.webrtcService.destroy();
    
    // Close HTTP server
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('Vibe Coder Host stopped');
        resolve();
      });
    });
  }
}

// Start server
const host = new VibeCoderHost();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await host.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await host.stop();
  process.exit(0);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Start the server
host.start().catch((error) => {
  logger.error('Failed to start server', { error: error.message });
  process.exit(1);
});

export default VibeCoderHost;