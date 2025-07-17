import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createHealthRouter } from '../routes/health';
import { ClaudeService } from '../services/claude-service';
import { SessionManager } from '../services/session-manager';

// Mock dependencies
vi.mock('../services/claude-service');
vi.mock('../services/session-manager');

describe('Health Routes', () => {
  let app: express.Application;
  let mockClaudeService: any;
  let mockSessionManager: any;

  beforeEach(() => {
    // Create mocks
    mockClaudeService = {
      healthCheck: vi.fn().mockResolvedValue(true),
    };

    mockSessionManager = {
      getActiveSessions: vi.fn().mockReturnValue(['session1', 'session2']),
      getTotalSessions: vi.fn().mockReturnValue(5),
      getStats: vi.fn().mockReturnValue({
        sessions: 2,
        clients: 3,
        activeSessions: 1,
        activeClients: 2
      }),
    };

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api', createHealthRouter(mockClaudeService, mockSessionManager));
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        sessions: {
          active: 2,
          total: 5,
        },
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
          percentage: expect.any(Number),
        },
        claude: {
          available: true,
          lastCheck: expect.any(String),
        },
        protocolStats: {
          sessions: 2,
          clients: 3,
          activeSessions: 1,
          activeClients: 2
        },
        responseTime: expect.any(Number),
      });
    });

    it('should return valid timestamp format', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      const timestamp = response.body.timestamp;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should return positive uptime', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.uptime).toBeGreaterThan(0);
    });

    it('should include proper headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .get('/api/health/invalid')
        .expect(404);

      // Express default 404 response doesn't include error body,
      // so we just check that we get a 404 status
      expect(response.status).toBe(404);
    });
  });
});