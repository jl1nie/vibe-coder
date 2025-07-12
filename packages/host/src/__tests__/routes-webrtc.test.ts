import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createWebRTCRouter } from '../routes/webrtc';
import { WebRTCService } from '../services/webrtc-service';
import { SessionManager } from '../services/session-manager';

// Mock dependencies
vi.mock('../middleware/auth', () => ({
  authenticateSession: vi.fn((sessionManager) => (req: any, res: any, next: any) => {
    req.sessionId = 'test-session';
    next();
  }),
}));

vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('WebRTC Routes', () => {
  let app: express.Application;
  let mockWebRTCService: jest.Mocked<WebRTCService>;
  let mockSessionManager: jest.Mocked<SessionManager>;

  beforeEach(() => {
    mockWebRTCService = {
      createConnection: vi.fn(),
      getConnectionBySessionId: vi.fn(),
      removeConnection: vi.fn(),
      getConnections: vi.fn(),
    } as any;

    mockSessionManager = {
      getSession: vi.fn(),
      getHostId: vi.fn().mockReturnValue('12345678'),
    } as any;

    app = express();
    app.use(express.json());
    app.use('/api/webrtc', createWebRTCRouter(mockWebRTCService, mockSessionManager));

    vi.clearAllMocks();
  });

  describe('POST /api/webrtc/start', () => {
    it('should start WebRTC connection successfully', async () => {
      const mockConnection = {
        id: 'conn-123',
        sessionId: 'test-session',
        isConnected: false,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        hostId: '12345678',
        totpSecret: 'secret',
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      mockWebRTCService.createConnection.mockResolvedValue(mockConnection);

      const response = await request(app)
        .post('/api/webrtc/start')
        .send({ sessionId: 'test-session' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        connectionId: 'conn-123',
        message: 'WebRTC connection started successfully',
      });

      expect(mockWebRTCService.createConnection).toHaveBeenCalledWith('test-session');
    });

    it('should reject request without session ID', async () => {
      const response = await request(app)
        .post('/api/webrtc/start')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Session ID is required',
      });

      expect(mockWebRTCService.createConnection).not.toHaveBeenCalled();
    });

    it('should reject request with non-existent session', async () => {
      mockSessionManager.getSession.mockReturnValue(null);

      const response = await request(app)
        .post('/api/webrtc/start')
        .send({ sessionId: 'non-existent' })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Session not found',
      });

      expect(mockWebRTCService.createConnection).not.toHaveBeenCalled();
    });

    it('should handle WebRTC service errors', async () => {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        hostId: '12345678',
        totpSecret: 'secret',
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      mockWebRTCService.createConnection.mockRejectedValue(
        new Error('WebRTC connection failed')
      );

      const response = await request(app)
        .post('/api/webrtc/start')
        .send({ sessionId: 'test-session' })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to start WebRTC connection',
      });
    });
  });

  describe('GET /api/webrtc/status/:sessionId', () => {
    it('should return connection status', async () => {
      const mockConnection = {
        id: 'conn-123',
        sessionId: 'test-session',
        isConnected: true,
        createdAt: new Date('2024-01-01T12:00:00Z'),
        lastActivity: new Date('2024-01-01T12:05:00Z'),
      };

      mockWebRTCService.getConnectionBySessionId.mockReturnValue(mockConnection);

      const response = await request(app)
        .get('/api/webrtc/status/test-session')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        connection: {
          id: 'conn-123',
          sessionId: 'test-session',
          isConnected: true,
          createdAt: '2024-01-01T12:00:00.000Z',
          lastActivity: '2024-01-01T12:05:00.000Z',
        },
      });

      expect(mockWebRTCService.getConnectionBySessionId).toHaveBeenCalledWith('test-session');
    });

    it('should return 404 for non-existent connection', async () => {
      mockWebRTCService.getConnectionBySessionId.mockReturnValue(null);

      const response = await request(app)
        .get('/api/webrtc/status/non-existent')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Connection not found',
      });
    });

    it('should handle service errors', async () => {
      mockWebRTCService.getConnectionBySessionId.mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app)
        .get('/api/webrtc/status/test-session')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to get connection status',
      });
    });
  });

  describe('POST /api/webrtc/stop', () => {
    it('should stop WebRTC connection successfully', async () => {
      const mockConnection = {
        id: 'conn-123',
        sessionId: 'test-session',
        isConnected: true,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      mockWebRTCService.getConnectionBySessionId.mockReturnValue(mockConnection);

      const response = await request(app)
        .post('/api/webrtc/stop')
        .send({ sessionId: 'test-session' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'WebRTC connection stopped successfully',
      });

      expect(mockWebRTCService.removeConnection).toHaveBeenCalledWith('conn-123');
    });

    it('should reject request without session ID', async () => {
      const response = await request(app)
        .post('/api/webrtc/stop')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Session ID is required',
      });

      expect(mockWebRTCService.removeConnection).not.toHaveBeenCalled();
    });

    it('should reject request with non-existent connection', async () => {
      mockWebRTCService.getConnectionBySessionId.mockReturnValue(null);

      const response = await request(app)
        .post('/api/webrtc/stop')
        .send({ sessionId: 'non-existent' })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Connection not found',
      });

      expect(mockWebRTCService.removeConnection).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const mockConnection = {
        id: 'conn-123',
        sessionId: 'test-session',
        isConnected: true,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      mockWebRTCService.getConnectionBySessionId.mockReturnValue(mockConnection);
      mockWebRTCService.removeConnection.mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app)
        .post('/api/webrtc/stop')
        .send({ sessionId: 'test-session' })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to stop WebRTC connection',
      });
    });
  });

  describe('GET /api/webrtc/connections', () => {
    it('should return all connections', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          sessionId: 'session-1',
          isConnected: true,
          createdAt: new Date('2024-01-01T12:00:00Z'),
          lastActivity: new Date('2024-01-01T12:05:00Z'),
        },
        {
          id: 'conn-2',
          sessionId: 'session-2',
          isConnected: false,
          createdAt: new Date('2024-01-01T12:10:00Z'),
          lastActivity: new Date('2024-01-01T12:12:00Z'),
        },
      ];

      mockWebRTCService.getConnections.mockReturnValue(mockConnections);

      const response = await request(app)
        .get('/api/webrtc/connections')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        connections: [
          {
            id: 'conn-1',
            sessionId: 'session-1',
            isConnected: true,
            createdAt: '2024-01-01T12:00:00.000Z',
            lastActivity: '2024-01-01T12:05:00.000Z',
          },
          {
            id: 'conn-2',
            sessionId: 'session-2',
            isConnected: false,
            createdAt: '2024-01-01T12:10:00.000Z',
            lastActivity: '2024-01-01T12:12:00.000Z',
          },
        ],
      });

      expect(mockWebRTCService.getConnections).toHaveBeenCalled();
    });

    it('should return empty array when no connections exist', async () => {
      mockWebRTCService.getConnections.mockReturnValue([]);

      const response = await request(app)
        .get('/api/webrtc/connections')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        connections: [],
      });
    });

    it('should handle service errors', async () => {
      mockWebRTCService.getConnections.mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app)
        .get('/api/webrtc/connections')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to get connections',
      });
    });
  });

  describe('Logging', () => {
    it('should log successful connection start', async () => {
      const logger = require('../utils/logger').default;
      const mockConnection = {
        id: 'conn-123',
        sessionId: 'test-session',
        isConnected: false,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        hostId: '12345678',
        totpSecret: 'secret',
        expiresAt: new Date(Date.now() + 60000),
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      mockWebRTCService.createConnection.mockResolvedValue(mockConnection);

      await request(app)
        .post('/api/webrtc/start')
        .send({ sessionId: 'test-session' })
        .expect(200);

      expect(logger.info).toHaveBeenCalledWith('WebRTC connection started', {
        sessionId: 'test-session',
        connectionId: 'conn-123',
        hostId: '12345678',
      });
    });

    it('should log errors', async () => {
      const logger = require('../utils/logger').default;

      mockWebRTCService.getConnectionBySessionId.mockImplementation(() => {
        throw new Error('Test error');
      });

      await request(app)
        .get('/api/webrtc/status/test-session')
        .expect(500);

      expect(logger.error).toHaveBeenCalledWith('Failed to get WebRTC connection status', {
        error: 'Test error',
      });
    });
  });
});