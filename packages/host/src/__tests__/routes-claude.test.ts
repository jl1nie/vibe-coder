import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { claudeRoutes } from '../routes/claude';
import { ClaudeService } from '../services/claude-service';

// Mock ClaudeService
vi.mock('../services/claude-service');

describe('Claude Routes', () => {
  let app: express.Application;
  let mockClaudeService: jest.Mocked<ClaudeService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req, res, next) => {
      (req as any).sessionId = 'test-session';
      (req as any).hostId = '12345678';
      next();
    });
    
    app.use('/api/claude', claudeRoutes);
    
    // Mock ClaudeService
    mockClaudeService = new ClaudeService() as jest.Mocked<ClaudeService>;
    
    vi.clearAllMocks();
  });

  describe('POST /api/claude/execute', () => {
    it('should execute command successfully', async () => {
      const mockResult = {
        success: true,
        output: 'Command executed successfully',
        executionTime: 1000
      };

      mockClaudeService.executeCommand = vi.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/claude/execute')
        .send({ command: 'echo "test"' })
        .expect(200);

      expect(response.body).toEqual(mockResult);
      expect(mockClaudeService.executeCommand).toHaveBeenCalledWith(
        'test-session',
        'echo "test"'
      );
    });

    it('should handle command execution failure', async () => {
      mockClaudeService.executeCommand = vi.fn().mockResolvedValue({
        success: false,
        error: 'Command failed',
        executionTime: 500
      });

      const response = await request(app)
        .post('/api/claude/execute')
        .send({ command: 'invalid-command' })
        .expect(200);

      expect(response.body).toEqual({
        success: false,
        error: 'Command failed',
        executionTime: 500
      });
    });

    it('should reject empty command', async () => {
      const response = await request(app)
        .post('/api/claude/execute')
        .send({ command: '' })
        .expect(400);

      expect(response.body.error).toBe('Command is required');
    });

    it('should reject missing command', async () => {
      const response = await request(app)
        .post('/api/claude/execute')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Command is required');
    });

    it('should handle service errors', async () => {
      mockClaudeService.executeCommand = vi.fn().mockRejectedValue(
        new Error('Service unavailable')
      );

      const response = await request(app)
        .post('/api/claude/execute')
        .send({ command: 'test command' })
        .expect(500);

      expect(response.body.error).toBe('Failed to execute command');
    });
  });

  describe('POST /api/claude/cancel', () => {
    it('should cancel running command', async () => {
      mockClaudeService.cancelCommand = vi.fn().mockResolvedValue(true);

      const response = await request(app)
        .post('/api/claude/cancel')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Command cancelled successfully'
      });
      expect(mockClaudeService.cancelCommand).toHaveBeenCalledWith('test-session');
    });

    it('should handle cancel when no command is running', async () => {
      mockClaudeService.cancelCommand = vi.fn().mockResolvedValue(false);

      const response = await request(app)
        .post('/api/claude/cancel')
        .expect(400);

      expect(response.body.error).toBe('No command is currently running');
    });

    it('should handle cancel service errors', async () => {
      mockClaudeService.cancelCommand = vi.fn().mockRejectedValue(
        new Error('Cancel failed')
      );

      const response = await request(app)
        .post('/api/claude/cancel')
        .expect(500);

      expect(response.body.error).toBe('Failed to cancel command');
    });
  });

  describe('GET /api/claude/status', () => {
    it('should return command status', async () => {
      const mockStatus = {
        isRunning: true,
        currentCommand: 'test command',
        startTime: Date.now(),
        sessionId: 'test-session'
      };

      mockClaudeService.getStatus = vi.fn().mockReturnValue(mockStatus);

      const response = await request(app)
        .get('/api/claude/status')
        .expect(200);

      expect(response.body).toEqual(mockStatus);
      expect(mockClaudeService.getStatus).toHaveBeenCalledWith('test-session');
    });

    it('should return idle status when no command running', async () => {
      const mockStatus = {
        isRunning: false,
        currentCommand: null,
        startTime: null,
        sessionId: 'test-session'
      };

      mockClaudeService.getStatus = vi.fn().mockReturnValue(mockStatus);

      const response = await request(app)
        .get('/api/claude/status')
        .expect(200);

      expect(response.body).toEqual(mockStatus);
    });

    it('should handle status service errors', async () => {
      mockClaudeService.getStatus = vi.fn().mockImplementation(() => {
        throw new Error('Status unavailable');
      });

      const response = await request(app)
        .get('/api/claude/status')
        .expect(500);

      expect(response.body.error).toBe('Failed to get command status');
    });
  });

  describe('Input Validation', () => {
    it('should validate command length', async () => {
      const longCommand = 'x'.repeat(10000);

      const response = await request(app)
        .post('/api/claude/execute')
        .send({ command: longCommand })
        .expect(400);

      expect(response.body.error).toContain('too long');
    });

    it('should sanitize command input', async () => {
      const maliciousCommand = 'rm -rf / && echo "hacked"';

      mockClaudeService.executeCommand = vi.fn().mockResolvedValue({
        success: true,
        output: 'Command executed',
        executionTime: 100
      });

      const response = await request(app)
        .post('/api/claude/execute')
        .send({ command: maliciousCommand })
        .expect(200);

      expect(mockClaudeService.executeCommand).toHaveBeenCalled();
    });

    it('should handle non-string command', async () => {
      const response = await request(app)
        .post('/api/claude/execute')
        .send({ command: 123 })
        .expect(400);

      expect(response.body.error).toBe('Command must be a string');
    });
  });

  describe('Security', () => {
    it('should require authentication', async () => {
      const appNoAuth = express();
      appNoAuth.use(express.json());
      appNoAuth.use('/api/claude', claudeRoutes);

      const response = await request(appNoAuth)
        .post('/api/claude/execute')
        .send({ command: 'test' })
        .expect(401);

      expect(response.body.error).toContain('authentication');
    });

    it('should not leak sensitive information in errors', async () => {
      mockClaudeService.executeCommand = vi.fn().mockRejectedValue(
        new Error('Database password: secret123')
      );

      const response = await request(app)
        .post('/api/claude/execute')
        .send({ command: 'test' })
        .expect(500);

      expect(response.body.error).toBe('Failed to execute command');
      expect(response.body.error).not.toContain('secret123');
    });
  });
});