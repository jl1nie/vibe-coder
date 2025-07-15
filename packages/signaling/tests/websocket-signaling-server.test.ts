import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WebSocket from 'ws';
import { WebSocketSignalingServer } from '../src/server';

describe('WebSocket Signaling Server', () => {
  let server: WebSocketSignalingServer;
  let port: number;

  beforeEach(() => {
    port = 5000 + Math.floor(Math.random() * 1000); // Random port for testing
    server = new WebSocketSignalingServer(port);
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Server Lifecycle', () => {
    it('should start and stop server successfully', async () => {
      await server.start();
      
      const stats = server.getStats();
      expect(stats.activeSessions).toBe(0);
      expect(stats.totalConnections).toBe(0);
      
      await server.stop();
    });

    it('should handle multiple client connections', async () => {
      await server.start();
      
      // Connect first client
      const client1 = new WebSocket(`ws://localhost:${port}`);
      await new Promise(resolve => client1.onopen = resolve);
      
      // Connect second client
      const client2 = new WebSocket(`ws://localhost:${port}`);
      await new Promise(resolve => client2.onopen = resolve);
      
      // Small delay to ensure connections are registered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = server.getStats();
      expect(stats.totalConnections).toBe(2);
      
      client1.close();
      client2.close();
    });
  });

  describe('Session Management', () => {
    it('should create and manage signaling sessions', async () => {
      await server.start();
      
      const client = new WebSocket(`ws://localhost:${port}`);
      await new Promise(resolve => client.onopen = resolve);
      
      // Skip the initial connection success message
      await new Promise(resolve => {
        client.onmessage = () => resolve(true);
      });
      
      // Register as host
      const hostMessage = {
        type: 'register-host',
        sessionId: 'test-session-123',
        clientId: 'host-test',
        timestamp: Date.now()
      };
      
      client.send(JSON.stringify(hostMessage));
      
      // Wait for session-created response specifically
      const response = await new Promise(resolve => {
        client.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.type === 'session-created') {
            resolve(message);
          }
        };
      });
      
      expect(response).toEqual(
        expect.objectContaining({
          type: 'session-created',
          sessionId: 'test-session-123'
        })
      );
      
      const stats = server.getStats();
      expect(stats.activeSessions).toBe(1);
      expect(stats.sessionDetails).toHaveLength(1);
      expect(stats.sessionDetails[0].sessionId).toBe('test-session-123');
      
      client.close();
    });

    it('should handle client joining existing session', async () => {
      await server.start();
      
      // Host connection
      const host = new WebSocket(`ws://localhost:${port}`);
      await new Promise(resolve => host.onopen = resolve);
      
      // Skip the initial connection success message
      await new Promise(resolve => {
        host.onmessage = () => resolve(true);
      });
      
      // Register host
      host.send(JSON.stringify({
        type: 'register-host',
        sessionId: 'test-session-456',
        clientId: 'host-456',
        timestamp: Date.now()
      }));
      
      // Wait for host registration response
      await new Promise(resolve => {
        host.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.type === 'session-created') {
            resolve(true);
          }
        };
      });
      
      // Client connection
      const client = new WebSocket(`ws://localhost:${port}`);
      await new Promise(resolve => client.onopen = resolve);
      
      // Skip the initial connection success message
      await new Promise(resolve => {
        client.onmessage = () => resolve(true);
      });
      
      // Join session
      client.send(JSON.stringify({
        type: 'join-session',
        sessionId: 'test-session-456',
        clientId: 'client-456',
        timestamp: Date.now()
      }));
      
      // Verify client joined - wait for the session-joined message specifically
      const clientResponse = await new Promise(resolve => {
        client.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.type === 'session-joined') {
            resolve(message);
          }
        };
      });
      
      expect(clientResponse).toEqual(
        expect.objectContaining({
          type: 'session-joined',
          sessionId: 'test-session-456'
        })
      );
      
      const stats = server.getStats();
      expect(stats.sessionDetails[0].connectedClients).toBe(1);
      
      host.close();
      client.close();
    });
  });

  describe('WebRTC Signaling', () => {
    it('should relay offer from client to host', async () => {
      await server.start();
      
      // Setup host
      const host = new WebSocket(`ws://localhost:${port}`);
      await new Promise(resolve => host.onopen = resolve);
      
      host.send(JSON.stringify({
        type: 'register-host',
        sessionId: 'webrtc-test',
        clientId: 'host-webrtc',
        timestamp: Date.now()
      }));
      
      await new Promise(resolve => {
        host.onmessage = () => resolve(true);
      });
      
      // Setup client
      const client = new WebSocket(`ws://localhost:${port}`);
      await new Promise(resolve => client.onopen = resolve);
      
      client.send(JSON.stringify({
        type: 'join-session',
        sessionId: 'webrtc-test',
        clientId: 'client-webrtc',
        timestamp: Date.now()
      }));
      
      await new Promise(resolve => {
        client.onmessage = () => resolve(true);
      });
      
      // Send offer from client
      const offer = {
        type: 'offer',
        sdp: 'mock-sdp-offer-data',
        timestamp: Date.now()
      };
      
      client.send(JSON.stringify({
        type: 'offer',
        sessionId: 'webrtc-test',
        clientId: 'client-webrtc',
        offer,
        timestamp: Date.now()
      }));
      
      // Host should receive offer
      const hostReceived = await new Promise(resolve => {
        host.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.type === 'offer-received') {
            resolve(message);
          }
        };
      });
      
      expect(hostReceived).toEqual(
        expect.objectContaining({
          type: 'offer-received',
          sessionId: 'webrtc-test',
          clientId: 'client-webrtc',
          offer: expect.objectContaining({
            type: 'offer',
            sdp: 'mock-sdp-offer-data'
          })
        })
      );
      
      host.close();
      client.close();
    });

    it('should relay answer from host to client', async () => {
      await server.start();
      
      // Setup connections (simplified)
      const host = new WebSocket(`ws://localhost:${port}`);
      const client = new WebSocket(`ws://localhost:${port}`);
      
      await Promise.all([
        new Promise(resolve => host.onopen = resolve),
        new Promise(resolve => client.onopen = resolve)
      ]);
      
      // Register and join
      host.send(JSON.stringify({
        type: 'register-host',
        sessionId: 'answer-test',
        clientId: 'host-answer',
        timestamp: Date.now()
      }));
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      client.send(JSON.stringify({
        type: 'join-session',
        sessionId: 'answer-test',
        clientId: 'client-answer',
        timestamp: Date.now()
      }));
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Send answer from host
      const answer = {
        type: 'answer',
        sdp: 'mock-sdp-answer-data',
        timestamp: Date.now()
      };
      
      host.send(JSON.stringify({
        type: 'answer',
        sessionId: 'answer-test',
        clientId: 'client-answer',
        answer,
        timestamp: Date.now()
      }));
      
      // Client should receive answer
      const clientReceived = await new Promise(resolve => {
        client.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.type === 'answer-received') {
            resolve(message);
          }
        };
      });
      
      expect(clientReceived).toEqual(
        expect.objectContaining({
          type: 'answer-received',
          sessionId: 'answer-test',
          answer: expect.objectContaining({
            type: 'answer',
            sdp: 'mock-sdp-answer-data'
          })
        })
      );
      
      host.close();
      client.close();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON messages gracefully', async () => {
      await server.start();
      
      const client = new WebSocket(`ws://localhost:${port}`);
      await new Promise(resolve => client.onopen = resolve);
      
      // Send invalid JSON
      client.send('invalid-json-message');
      
      // Should not crash the server
      const stats = server.getStats();
      expect(stats.totalConnections).toBe(1);
      
      client.close();
    });

    it('should clean up sessions on client disconnect', async () => {
      await server.start();
      
      const client = new WebSocket(`ws://localhost:${port}`);
      await new Promise(resolve => client.onopen = resolve);
      
      // Skip the initial connection success message
      await new Promise(resolve => {
        client.onmessage = () => resolve(true);
      });
      
      client.send(JSON.stringify({
        type: 'register-host',
        sessionId: 'cleanup-test',
        clientId: 'host-cleanup',
        timestamp: Date.now()
      }));
      
      // Wait for session-created response
      await new Promise(resolve => {
        client.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.type === 'session-created') {
            resolve(true);
          }
        };
      });
      
      let stats = server.getStats();
      expect(stats.activeSessions).toBe(1);
      
      // Disconnect client (host)
      client.close();
      
      // Wait for cleanup - the session should be cleaned up when the host disconnects
      // and there are no other clients
      await new Promise(resolve => setTimeout(resolve, 100));
      
      stats = server.getStats();
      expect(stats.activeSessions).toBe(0);
    });
  });

  describe('Session Cleanup', () => {
    it('should provide cleanup functionality for inactive sessions', () => {
      // Test the cleanup method exists and can be called
      expect(typeof server.cleanupInactiveSessions).toBe('function');
      
      // Call cleanup - should not throw
      expect(() => server.cleanupInactiveSessions()).not.toThrow();
    });
  });
});