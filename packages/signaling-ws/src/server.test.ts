import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WebSocket from 'ws';
import { SignalingServer } from './server';
import { SignalingServerConfig } from './types';

describe('WebSocket Signaling Server', () => {
  let server: SignalingServer;
  let config: SignalingServerConfig;
  let actualPort: number;

  beforeEach(() => {
    config = {
      port: 0, // Use random port for testing
      host: '127.0.0.1',
      heartbeatInterval: 1000,
      sessionTimeout: 10000,
      clientTimeout: 5000,
      corsOrigins: ['http://localhost:3000']
    };
    server = new SignalingServer(config);
  });

  afterEach(async () => {
    if (server) {
      await server.shutdown();
    }
  });

  it('should start and stop gracefully', async () => {
    await server.start();
    expect(server).toBeDefined();
    
    await server.shutdown();
    // Server should be cleanly shut down
  });

  it('should accept WebSocket connections', async () => {
    // Start server and get actual port
    await server.start();
    
    // Get the actual port from the server's HTTP server
    const httpServer = (server as any).httpServer;
    actualPort = httpServer.address().port;

    // Connect a WebSocket client
    const ws = new WebSocket(`ws://127.0.0.1:${actualPort}`);
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 3000);
      ws.on('open', () => {
        clearTimeout(timeout);
        resolve(undefined);
      });
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    expect(ws.readyState).toBe(WebSocket.OPEN);
    
    ws.close();
  }, 10000);

  it('should handle host registration', async () => {
    await server.start();
    const httpServer = (server as any).httpServer;
    actualPort = httpServer.address().port;
    
    const ws = new WebSocket(`ws://127.0.0.1:${actualPort}`);
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 3000);
      ws.on('open', () => {
        clearTimeout(timeout);
        resolve(undefined);
      });
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Send host registration
    const registerMessage = {
      type: 'register-host',
      sessionId: 'test-session-123',
      hostId: 'test-host-456',
      timestamp: Date.now()
    };

    ws.send(JSON.stringify(registerMessage));

    // Wait for response
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Response timeout')), 3000);
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'host-registered') {
          clearTimeout(timeout);
          resolve(message);
        }
      });
    });

    expect(response).toMatchObject({
      type: 'host-registered',
      sessionId: 'test-session-123'
    });

    ws.close();
  }, 10000);

  it('should handle heartbeat messages', async () => {
    await server.start();
    const httpServer = (server as any).httpServer;
    actualPort = httpServer.address().port;
    
    const ws = new WebSocket(`ws://127.0.0.1:${actualPort}`);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 3000);
      ws.on('open', () => {
        clearTimeout(timeout);
        resolve(undefined);
      });
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Send heartbeat
    ws.send(JSON.stringify({
      type: 'heartbeat',
      timestamp: Date.now()
    }));

    // Should receive heartbeat-ack
    const ackResponse = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Response timeout')), 3000);
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'heartbeat-ack') {
          clearTimeout(timeout);
          resolve(message);
        }
      });
    });

    expect(ackResponse).toMatchObject({
      type: 'heartbeat-ack'
    });

    ws.close();
  }, 10000);

  it('should provide server statistics', async () => {
    await server.start();
    
    const stats = server.getStats();
    
    expect(stats).toHaveProperty('sessions');
    expect(stats).toHaveProperty('clients');
    expect(stats).toHaveProperty('activeSessions');
    expect(stats).toHaveProperty('activeClients');
    expect(stats).toHaveProperty('uptime');
    expect(stats).toHaveProperty('timestamp');
  });
});