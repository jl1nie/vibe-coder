import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import QRCode from 'qrcode';
import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';

import { ClaudeService } from './services/claude-service';
import { SessionManager } from './services/session-manager';
import { WebRTCService } from './services/webrtc-service';
import { hostConfig } from './utils/config';
import logger from './utils/logger';

import { createAuthRouter } from './routes/auth';
import { createClaudeRouter } from './routes/claude';
import { createHealthRouter } from './routes/health';
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
    this.webrtcService = new WebRTCService(
      this.sessionManager,
      this.claudeService
    );

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupWebSocket();
    this.setupCleanupTimer();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
          },
        },
      })
    );

    // CORS configuration
    this.app.use(
      cors({
        origin: process.env.CORS_ORIGIN?.split(',') || [
          'http://localhost:5173',
          'http://localhost:5174',
          'https://www.vibe-coder.space',
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })
    );

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
    this.app.use(
      '/api',
      createHealthRouter(this.claudeService, this.sessionManager)
    );
    this.app.use('/api/auth', createAuthRouter(this.sessionManager));
    this.app.use(
      '/api/claude',
      createClaudeRouter(this.claudeService, this.sessionManager)
    );
    this.app.use(
      '/api/webrtc',
      createWebRTCRouter(this.webrtcService, this.sessionManager)
    );

    // 2FA Setup page (localhost only)
    this.app.get('/setup', (req: express.Request, res: express.Response) => {
      const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
      const forwardedFor = req.get('x-forwarded-for');
      
      // Check if request is from localhost
      const isLocalhost = clientIp === '127.0.0.1' || 
                         clientIp === '::1' || 
                         clientIp === '::ffff:127.0.0.1' ||
                         clientIp?.startsWith('127.') ||
                         (!forwardedFor && clientIp === '::ffff:172.') || // Docker internal
                         (!forwardedFor && clientIp?.startsWith('192.168.'));
      
      if (!isLocalhost) {
        logger.warn('Unauthorized access attempt to setup page', { 
          clientIp, 
          forwardedFor,
          userAgent: req.get('User-Agent') 
        });
        return res.status(403).send(`
          <html>
            <head><title>Access Denied</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>🚫 Access Denied</h1>
              <p>2FA setup requires physical access to the host machine.</p>
              <p>Please access this page from localhost.</p>
            </body>
          </html>
        `);
      }

      // Serve the setup page
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Vibe Coder 2FA Setup</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              max-width: 800px; 
              margin: 0 auto; 
              padding: 20px; 
              background: #f5f5f5; 
            }
            .container { 
              background: white; 
              padding: 30px; 
              border-radius: 10px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px; 
            }
            .host-id { 
              font-size: 24px; 
              font-weight: bold; 
              color: #007bff; 
              background: #e3f2fd; 
              padding: 10px; 
              border-radius: 5px; 
              margin: 20px 0; 
            }
            .qr-container { 
              text-align: center; 
              margin: 30px 0; 
            }
            .secret-key { 
              font-family: monospace; 
              background: #f8f9fa; 
              padding: 10px; 
              border-radius: 5px; 
              word-break: break-all; 
              margin: 10px 0; 
            }
            .instructions { 
              background: #e8f5e8; 
              padding: 20px; 
              border-radius: 5px; 
              margin: 20px 0; 
            }
            .instructions ol { 
              padding-left: 20px; 
            }
            .instructions li { 
              margin: 10px 0; 
            }
            #setupButton { 
              background: #007bff; 
              color: white; 
              border: none; 
              padding: 12px 24px; 
              border-radius: 5px; 
              cursor: pointer; 
              font-size: 16px; 
              margin: 20px 5px; 
            }
            #setupButton:hover { 
              background: #0056b3; 
            }
            #setupButton:disabled { 
              background: #6c757d; 
              cursor: not-allowed; 
            }
            #renewButton { 
              background: #dc3545; 
              color: white; 
              border: none; 
              padding: 12px 24px; 
              border-radius: 5px; 
              cursor: pointer; 
              font-size: 16px; 
              margin: 20px 5px; 
            }
            #renewButton:hover { 
              background: #c82333; 
            }
            #renewButton:disabled { 
              background: #6c757d; 
              cursor: not-allowed; 
            }
            .error { 
              color: #dc3545; 
              background: #f8d7da; 
              padding: 10px; 
              border-radius: 5px; 
              margin: 10px 0; 
            }
            .success { 
              color: #155724; 
              background: #d4edda; 
              padding: 10px; 
              border-radius: 5px; 
              margin: 10px 0; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Vibe Coder 2FA Setup</h1>
              <p>Secure your Claude Code host server with two-factor authentication</p>
            </div>

            <div class="host-id">
              Host ID: ${this.sessionManager.getHostId()}
            </div>

            <div class="instructions">
              <h3>Setup Instructions:</h3>
              <ol>
                <li>Click the "Generate 2FA Setup" button below</li>
                <li>Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)</li>
                <li>Or manually enter the secret key into your authenticator app</li>
                <li>Use the Vibe Coder PWA at <a href="https://www.vibe-coder.space" target="_blank">https://www.vibe-coder.space</a></li>
                <li>Enter your Host ID: <strong>${this.sessionManager.getHostId()}</strong></li>
                <li>Enter the 6-digit code from your authenticator app</li>
              </ol>
            </div>

            <div style="text-align: center;">
              <button id="setupButton" onclick="generateSetup()">Generate 2FA Setup</button>
              <button id="renewButton" onclick="renewHostId()">Renew Host ID</button>
            </div>

            <div id="setupResult"></div>
          </div>

          <script>
            async function generateSetup() {
              const button = document.getElementById('setupButton');
              const resultDiv = document.getElementById('setupResult');
              
              button.disabled = true;
              button.textContent = 'Generating...';
              resultDiv.innerHTML = '';

              try {
                const response = await fetch('/api/auth/setup');
                const data = await response.json();

                if (response.ok) {
                  resultDiv.innerHTML = \`
                    <div class="success">
                      <h3>✅ 2FA Setup Generated</h3>
                      <p>Session ID: \${data.sessionId}</p>
                    </div>
                    <div class="qr-container">
                      <h3>QR Code:</h3>
                      <div id="qrcode"></div>
                    </div>
                    <div>
                      <h3>Secret Key (for manual entry):</h3>
                      <div class="secret-key">\${data.totpSecret}</div>
                    </div>
                  \`;

                  // Generate QR code
                  const qrcode = document.getElementById('qrcode');
                  const qrUrl = \`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=\${encodeURIComponent(data.totpUrl)}\`;
                  qrcode.innerHTML = \`<img src="\${qrUrl}" alt="QR Code" style="border: 1px solid #ccc; padding: 10px; background: white;">\`;
                } else {
                  resultDiv.innerHTML = \`
                    <div class="error">
                      <h3>❌ Error</h3>
                      <p>\${data.error}</p>
                    </div>
                  \`;
                }
              } catch (error) {
                resultDiv.innerHTML = \`
                  <div class="error">
                    <h3>❌ Connection Error</h3>
                    <p>Failed to connect to server: \${error.message}</p>
                  </div>
                \`;
              } finally {
                button.disabled = false;
                button.textContent = 'Generate New 2FA Setup';
              }
            }

            async function renewHostId() {
              const button = document.getElementById('renewButton');
              const resultDiv = document.getElementById('setupResult');
              
              if (!confirm('Are you sure you want to renew the Host ID? This will invalidate all existing sessions and require all mobile devices to reconnect with the new Host ID.')) {
                return;
              }
              
              button.disabled = true;
              button.textContent = 'Renewing...';

              try {
                const response = await fetch('/api/auth/renew-host-id', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();

                if (response.ok) {
                  resultDiv.innerHTML = \`
                    <div class="success">
                      <h3>✅ Host ID Renewed</h3>
                      <p><strong>New Host ID: \${data.newHostId}</strong></p>
                      <p>\${data.message}</p>
                      <div class="error" style="margin-top: 10px;">
                        <strong>⚠️ Warning:</strong> \${data.warning}
                      </div>
                    </div>
                  \`;
                  
                  // Update the Host ID display on the page
                  const hostIdElements = document.querySelectorAll('.host-id');
                  hostIdElements.forEach(element => {
                    element.textContent = 'Host ID: ' + data.newHostId;
                  });
                  
                  // Update the instructions
                  const instructionElements = document.querySelectorAll('strong');
                  instructionElements.forEach(element => {
                    if (element.textContent.match(/\\d{8}/)) {
                      element.textContent = data.newHostId;
                    }
                  });
                  
                  // Refresh the page after 3 seconds to update all Host ID references
                  setTimeout(() => {
                    location.reload();
                  }, 3000);
                } else {
                  resultDiv.innerHTML = \`
                    <div class="error">
                      <h3>❌ Error</h3>
                      <p>\${data.error}</p>
                    </div>
                  \`;
                }
              } catch (error) {
                resultDiv.innerHTML = \`
                  <div class="error">
                    <h3>❌ Connection Error</h3>
                    <p>Failed to connect to server: \${error.message}</p>
                  </div>
                \`;
              } finally {
                button.disabled = false;
                button.textContent = 'Renew Host ID';
              }
            }
          </script>
        </body>
        </html>
      `);
    });

    // Root endpoint - Display Host ID and TOTP Secret
    this.app.get('/', async (_req: express.Request, res: express.Response) => {
      const hostId = this.sessionManager.getHostId();
      const totpSecret = hostConfig.totpSecret;
      
      // Generate QR code for TOTP
      const totpUrl = `otpauth://totp/Vibe%20Coder:${hostId}?secret=${totpSecret}&issuer=Vibe%20Coder`;
      let qrCodeDataUrl = '';
      
      try {
        qrCodeDataUrl = await QRCode.toDataURL(totpUrl);
      } catch (error) {
        console.error('Failed to generate QR code:', error);
        qrCodeDataUrl = ''; // Will show fallback message
      }
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Vibe Coder Host - ${hostId}</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px; 
              background: #f5f5f5; 
            }
            .container { 
              background: white; 
              padding: 30px; 
              border-radius: 10px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px; 
            }
            .host-id { 
              font-size: 32px; 
              font-weight: bold; 
              color: #007bff; 
              background: #e3f2fd; 
              padding: 20px; 
              border-radius: 10px; 
              margin: 20px 0; 
              text-align: center;
            }
            .totp-secret { 
              font-family: monospace; 
              background: #f8f9fa; 
              padding: 15px; 
              border-radius: 5px; 
              word-break: break-all; 
              margin: 20px 0; 
              border: 2px solid #dee2e6;
            }
            .instructions { 
              background: #e8f5e8; 
              padding: 20px; 
              border-radius: 5px; 
              margin: 20px 0; 
            }
            .instructions ol { 
              padding-left: 20px; 
            }
            .instructions li { 
              margin: 10px 0; 
            }
            .status { 
              background: #d1ecf1; 
              color: #0c5460; 
              padding: 10px; 
              border-radius: 5px; 
              margin: 20px 0; 
              text-align: center;
            }
            .warning {
              background: #fff3cd;
              color: #856404;
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
              border-left: 4px solid #ffc107;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎯 Vibe Coder Host Server</h1>
              <p>Mobile Claude Code Remote Development Environment</p>
            </div>

            <div class="status">
              🟢 Server Running - Ready for PWA connections
            </div>

            <div class="host-id">
              Host ID: ${hostId}
            </div>

            <div>
              <h3>🔐 TOTP Authentication Setup:</h3>
              <div style="text-align: center; margin: 20px 0;">
                ${qrCodeDataUrl ? 
                  `<img src="${qrCodeDataUrl}" alt="TOTP QR Code" style="border: 2px solid #dee2e6; padding: 10px; background: white; border-radius: 10px;">` : 
                  '<p style="color: #dc3545;">❌ QR Code generation failed. Please use manual entry below.</p>'
                }
              </div>
              <details style="margin: 10px 0;">
                <summary style="cursor: pointer; font-weight: bold;">📝 Manual Entry (if QR code doesn't work)</summary>
                <div class="totp-secret" style="margin-top: 10px;">${totpSecret}</div>
              </details>
            </div>

            <div class="instructions">
              <h3>📱 Connection Instructions:</h3>
              <ol>
                <li><strong>Scan QR Code:</strong> Use your authenticator app (Google Authenticator, Authy, etc.) to scan the QR code above</li>
                <li><strong>Access PWA:</strong> Open <a href="http://localhost:5174" target="_blank">http://localhost:5174</a> (or <a href="https://www.vibe-coder.space" target="_blank">production</a>)</li>
                <li><strong>Enter Host ID:</strong> ${hostId}</li>
                <li><strong>2FA Authentication:</strong> Enter the 6-digit code from your authenticator app</li>
                <li><strong>Start Coding:</strong> Execute Claude Code commands remotely!</li>
              </ol>
            </div>

            <div class="warning">
              <strong>⚠️ Security Note:</strong> This TOTP secret is permanently saved and will persist across server restarts. Keep it secure!
            </div>
          </div>
        </body>
        </html>
      `);
    });
  }

  private setupErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  private setupWebSocket(): void {
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws, req) => {
      logger.info('WebSocket connection established', {
        ip: req.socket.remoteAddress,
      });

      ws.on('message', message => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          logger.error('Invalid WebSocket message', {
            error: (error as Error).message,
          });
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket connection closed');
      });

      ws.on('error', error => {
        logger.error('WebSocket error', { error: error.message });
      });

      // Send initial connection success
      ws.send(
        JSON.stringify({
          type: 'connection',
          hostId: this.sessionManager.getHostId(),
          timestamp: new Date(),
        })
      );
    });
  }

  private setupCleanupTimer(): void {
    // 5分間隔でクリーンアップ
    setInterval(
      () => {
        this.webrtcService.cleanupInactiveConnections();
      },
      5 * 60 * 1000
    );
  }

  private handleWebSocketMessage(ws: WebSocket, data: any): void {
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date() }));
        break;

      case 'heartbeat':
        if (data.sessionId) {
          this.sessionManager.updateSessionActivity(data.sessionId);
        }
        ws.send(
          JSON.stringify({ type: 'heartbeat-ack', timestamp: new Date() })
        );
        break;

      default:
        logger.warn('Unknown WebSocket message type', { type: data.type });
        ws.send(JSON.stringify({ error: 'Unknown message type' }));
    }
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.on('error', (error: any) => {
        logger.error('Server error', {
          error: error.message,
          code: error.code,
          stack: error.stack,
        });
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

          // Also save Host ID to workspace for user visibility
          try {
            const workspaceDir = process.env.VIBE_CODER_WORKSPACE_PATH;
            if (!workspaceDir) {
              throw new Error('FATAL: Required environment variable VIBE_CODER_WORKSPACE_PATH is not set');
            }
            const fs = require('fs');
            if (!fs.existsSync(workspaceDir)) {
              fs.mkdirSync(workspaceDir, { recursive: true });
            }
            const hostIdFile = `${workspaceDir}/HOST_ID.txt`;
            const hostIdContent = `Vibe Coder Host ID: ${this.sessionManager.getHostId()}\n\nUse this ID to connect from your mobile device.\nURL: https://www.vibe-coder.space\n\nGenerated: ${new Date().toISOString()}\n`;
            fs.writeFileSync(hostIdFile, hostIdContent);
            console.log(`Host ID saved to: ${hostIdFile}`);
          } catch (error) {
            console.warn(
              'Could not save Host ID to workspace:',
              (error as Error).message
            );
          }

          console.log(`
╭─────────────────────────────────────────────────────────────╮
│                                                             │
│  🎯 Vibe Coder Host Server                                  │
│                                                             │
│  🌐 Server: http://localhost:${hostConfig.port}                        │
│  🔑 Host ID: ${this.sessionManager.getHostId()}                                │
│  📱 Ready for PWA connections                               │
│                                                             │
│  🔗 Connect from: https://www.vibe-coder.space              │
│                                                             │
╰─────────────────────────────────────────────────────────────╯
          `);

          resolve();
        });
      } catch (error) {
        logger.error('Server listen failed', {
          error: (error as Error).message,
        });
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
    return new Promise(resolve => {
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

process.on('uncaughtException', error => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Start the server
host.start().catch(error => {
  logger.error('Failed to start server', { error: error.message });
  process.exit(1);
});

export default VibeCoderHost;
