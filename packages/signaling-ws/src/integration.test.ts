import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WebSocket from 'ws';
import { SignalingServer } from './server';
import { SignalingServerConfig } from './types';

describe('SignalingServer Integration Tests', () => {
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

  describe('Full WebRTC Signaling Flow', () => {
    it('should handle complete host registration and client connection flow', async () => {
      await server.start();
      const httpServer = (server as any).httpServer;
      actualPort = httpServer.address().port;

      // Create host connection
      const hostWs = new WebSocket(`ws://127.0.0.1:${actualPort}`);
      await waitForConnection(hostWs);

      // Create client connection
      const clientWs = new WebSocket(`ws://127.0.0.1:${actualPort}`);
      await waitForConnection(clientWs);

      // Wait for connected messages
      const hostConnected = await waitForMessage(hostWs);
      expect(hostConnected.type).toBe('connected');
      
      const clientConnected = await waitForMessage(clientWs);
      expect(clientConnected.type).toBe('connected');

      // Register host
      const sessionId = 'test-session-123';
      const hostId = 'test-host-456';
      
      hostWs.send(JSON.stringify({
        type: 'register-host',
        sessionId,
        hostId,
        timestamp: Date.now()
      }));

      // Wait for host registration response
      const hostResponse = await waitForMessage(hostWs);
      expect(hostResponse.type).toBe('host-registered');
      expect(hostResponse.sessionId).toBe(sessionId);

      // Client joins session
      clientWs.send(JSON.stringify({
        type: 'join-session',
        sessionId,
        timestamp: Date.now()
      }));

      // Wait for join response
      const joinResponse = await waitForMessage(clientWs);
      expect(joinResponse.type).toBe('session-joined');
      expect(joinResponse.sessionId).toBe(sessionId);

      // Host should receive peer-connected notification
      const peerConnectedMessage = await waitForMessage(hostWs);
      expect(peerConnectedMessage.type).toBe('peer-connected');
      expect(peerConnectedMessage.sessionId).toBe(sessionId);

      hostWs.close();
      clientWs.close();
    }, 15000);

    it('should handle WebRTC offer/answer exchange', async () => {
      await server.start();
      const httpServer = (server as any).httpServer;
      actualPort = httpServer.address().port;

      // Setup host and client
      const hostWs = new WebSocket(`ws://127.0.0.1:${actualPort}`);
      const clientWs = new WebSocket(`ws://127.0.0.1:${actualPort}`);
      
      await waitForConnection(hostWs);
      await waitForConnection(clientWs);

      // Wait for connected messages
      await waitForMessage(hostWs); // connected
      await waitForMessage(clientWs); // connected

      const sessionId = 'webrtc-session-123';

      // Register host and join client
      hostWs.send(JSON.stringify({
        type: 'register-host',
        sessionId,
        hostId: 'webrtc-host',
        timestamp: Date.now()
      }));

      await waitForMessage(hostWs); // host-registered

      clientWs.send(JSON.stringify({
        type: 'join-session',
        sessionId,
        timestamp: Date.now()
      }));

      await waitForMessage(clientWs); // session-joined
      await waitForMessage(hostWs); // peer-connected

      // Client sends offer
      const offer = {
        type: 'offer' as RTCSdpType,
        sdp: 'v=0\r\no=- 123456789 123456789 IN IP4 127.0.0.1\r\n...'
      };

      clientWs.send(JSON.stringify({
        type: 'offer',
        sessionId,
        offer,
        timestamp: Date.now()
      }));

      // Host should receive offer
      const offerReceived = await waitForMessage(hostWs);
      expect(offerReceived.type).toBe('offer-received');
      expect(offerReceived.offer).toEqual(offer);

      // Host sends answer
      const answer = {
        type: 'answer' as RTCSdpType,
        sdp: 'v=0\r\no=- 987654321 987654321 IN IP4 127.0.0.1\r\n...'
      };

      hostWs.send(JSON.stringify({
        type: 'answer',
        sessionId,
        answer,
        timestamp: Date.now()
      }));

      // Client should receive answer
      const answerReceived = await waitForMessage(clientWs);
      expect(answerReceived.type).toBe('answer-received');
      expect(answerReceived.answer).toEqual(answer);

      hostWs.close();
      clientWs.close();
    }, 15000);

    it('should handle ICE candidate exchange', async () => {
      await server.start();
      const httpServer = (server as any).httpServer;
      actualPort = httpServer.address().port;

      // Setup host and client
      const hostWs = new WebSocket(`ws://127.0.0.1:${actualPort}`);
      const clientWs = new WebSocket(`ws://127.0.0.1:${actualPort}`);
      
      await waitForConnection(hostWs);
      await waitForConnection(clientWs);

      // Wait for connected messages
      await waitForMessage(hostWs); // connected
      await waitForMessage(clientWs); // connected

      const sessionId = 'ice-session-123';

      // Setup session
      hostWs.send(JSON.stringify({
        type: 'register-host',
        sessionId,
        hostId: 'ice-host',
        timestamp: Date.now()
      }));

      await waitForMessage(hostWs);

      clientWs.send(JSON.stringify({
        type: 'join-session',
        sessionId,
        timestamp: Date.now()
      }));

      await waitForMessage(clientWs);
      await waitForMessage(hostWs);

      // Exchange ICE candidates
      const candidate1 = {
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0'
      };

      const candidate2 = {
        candidate: 'candidate:2 1 UDP 2130706430 10.0.0.1 54401 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0'
      };

      // Client sends candidate
      clientWs.send(JSON.stringify({
        type: 'ice-candidate',
        sessionId,
        candidate: candidate1,
        timestamp: Date.now()
      }));

      // Host should receive candidate
      const candidateReceived1 = await waitForMessage(hostWs);
      expect(candidateReceived1.type).toBe('candidate-received');
      expect(candidateReceived1.candidate).toEqual(candidate1);

      // Host sends candidate
      hostWs.send(JSON.stringify({
        type: 'ice-candidate',
        sessionId,
        candidate: candidate2,
        timestamp: Date.now()
      }));

      // Client should receive candidate
      const candidateReceived2 = await waitForMessage(clientWs);
      expect(candidateReceived2.type).toBe('candidate-received');
      expect(candidateReceived2.candidate).toEqual(candidate2);

      hostWs.close();
      clientWs.close();
    }, 15000);
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle client disconnection gracefully', async () => {
      await server.start();
      const httpServer = (server as any).httpServer;
      actualPort = httpServer.address().port;

      const hostWs = new WebSocket(`ws://127.0.0.1:${actualPort}`);
      const clientWs = new WebSocket(`ws://127.0.0.1:${actualPort}`);
      
      await waitForConnection(hostWs);
      await waitForConnection(clientWs);

      // Wait for connected messages
      await waitForMessage(hostWs); // connected
      await waitForMessage(clientWs); // connected

      const sessionId = 'disconnect-session-123';

      // Setup session
      hostWs.send(JSON.stringify({
        type: 'register-host',
        sessionId,
        hostId: 'disconnect-host',
        timestamp: Date.now()
      }));

      await waitForMessage(hostWs);

      clientWs.send(JSON.stringify({
        type: 'join-session',
        sessionId,
        timestamp: Date.now()
      }));

      await waitForMessage(clientWs);
      await waitForMessage(hostWs); // peer-connected

      // Disconnect client abruptly
      clientWs.terminate();

      // Host should receive peer-disconnected
      const disconnectedMessage = await waitForMessage(hostWs);
      expect(disconnectedMessage.type).toBe('peer-disconnected');
      expect(disconnectedMessage.sessionId).toBe(sessionId);

      hostWs.close();
    }, 15000);

    it('should handle multiple clients in same session', async () => {
      await server.start();
      const httpServer = (server as any).httpServer;
      actualPort = httpServer.address().port;

      const hostWs = new WebSocket(`ws://127.0.0.1:${actualPort}`);
      const client1Ws = new WebSocket(`ws://127.0.0.1:${actualPort}`);
      const client2Ws = new WebSocket(`ws://127.0.0.1:${actualPort}`);
      
      await waitForConnection(hostWs);
      await waitForConnection(client1Ws);
      await waitForConnection(client2Ws);

      // Wait for connected messages
      await waitForMessage(hostWs); // connected
      await waitForMessage(client1Ws); // connected
      await waitForMessage(client2Ws); // connected

      const sessionId = 'multi-client-session-123';

      // Register host
      hostWs.send(JSON.stringify({
        type: 'register-host',
        sessionId,
        hostId: 'multi-host',
        timestamp: Date.now()
      }));

      await waitForMessage(hostWs);

      // Client 1 joins
      client1Ws.send(JSON.stringify({
        type: 'join-session',
        sessionId,
        timestamp: Date.now()
      }));

      await waitForMessage(client1Ws); // session-joined
      await waitForMessage(hostWs); // peer-connected

      // Client 2 joins
      client2Ws.send(JSON.stringify({
        type: 'join-session',
        sessionId,
        timestamp: Date.now()
      }));

      await waitForMessage(client2Ws); // session-joined
      
      // Should notify existing clients about new peer
      const peerConnected1 = await waitForMessage(hostWs);
      const peerConnected2 = await waitForMessage(client1Ws);
      
      expect(peerConnected1.type).toBe('peer-connected');
      expect(peerConnected2.type).toBe('peer-connected');

      hostWs.close();
      client1Ws.close();
      client2Ws.close();
    }, 15000);

    it('should handle heartbeat timeout', async () => {
      await server.start();
      const httpServer = (server as any).httpServer;
      actualPort = httpServer.address().port;

      const ws = new WebSocket(`ws://127.0.0.1:${actualPort}`);
      await waitForConnection(ws);

      // Wait for connected message first
      const connectedMessage = await waitForMessage(ws);
      expect(connectedMessage.type).toBe('connected');

      // Send heartbeat
      ws.send(JSON.stringify({
        type: 'heartbeat',
        timestamp: Date.now()
      }));

      // Should receive heartbeat-ack
      const ackResponse = await waitForMessage(ws);
      expect(ackResponse.type).toBe('heartbeat-ack');

      ws.close();
    }, 10000);

    it('should handle invalid message formats', async () => {
      await server.start();
      const httpServer = (server as any).httpServer;
      actualPort = httpServer.address().port;

      const ws = new WebSocket(`ws://127.0.0.1:${actualPort}`);
      await waitForConnection(ws);

      // Wait for connected message first
      const connectedMessage = await waitForMessage(ws);
      expect(connectedMessage.type).toBe('connected');

      // Send invalid JSON
      ws.send('{ invalid json }');

      // Should receive error
      const errorResponse = await waitForMessage(ws);
      expect(errorResponse.type).toBe('error');
      expect(errorResponse.error).toBe('Invalid message format');

      // Send unknown message type
      ws.send(JSON.stringify({
        type: 'unknown-message-type',
        timestamp: Date.now()
      }));

      // Should receive error
      const errorResponse2 = await waitForMessage(ws);
      expect(errorResponse2.type).toBe('error');
      expect(errorResponse2.error).toBe('Unknown message type: unknown-message-type');

      ws.close();
    }, 10000);
  });

  describe('Server Statistics and Health', () => {
    it('should provide accurate server statistics', async () => {
      await server.start();
      
      const stats = server.getStats();
      
      expect(stats).toHaveProperty('sessions');
      expect(stats).toHaveProperty('clients');
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('activeClients');
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('timestamp');
      
      expect(typeof stats.sessions).toBe('number');
      expect(typeof stats.clients).toBe('number');
      expect(typeof stats.activeSessions).toBe('number');
      expect(typeof stats.activeClients).toBe('number');
      expect(typeof stats.uptime).toBe('number');
      expect(typeof stats.timestamp).toBe('string');
    });

    it('should update statistics when clients connect', async () => {
      await server.start();
      const httpServer = (server as any).httpServer;
      actualPort = httpServer.address().port;

      const initialStats = server.getStats();
      expect(initialStats.clients).toBe(0);
      expect(initialStats.sessions).toBe(0);

      // Connect client and create session
      const ws = new WebSocket(`ws://127.0.0.1:${actualPort}`);
      await waitForConnection(ws);

      // Wait for connected message
      await waitForMessage(ws); // connected

      ws.send(JSON.stringify({
        type: 'register-host',
        sessionId: 'stats-session',
        hostId: 'stats-host',
        timestamp: Date.now()
      }));

      await waitForMessage(ws); // host-registered

      const updatedStats = server.getStats();
      expect(updatedStats.clients).toBe(1);
      expect(updatedStats.sessions).toBe(1);

      ws.close();
    }, 10000);
  });
});

// Helper functions
async function waitForConnection(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
    ws.on('open', () => {
      clearTimeout(timeout);
      resolve();
    });
    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function waitForMessage(ws: WebSocket): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Message timeout')), 5000);
    ws.on('message', (data) => {
      clearTimeout(timeout);
      try {
        const message = JSON.parse(data.toString());
        resolve(message);
      } catch (error) {
        reject(error);
      }
    });
    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}