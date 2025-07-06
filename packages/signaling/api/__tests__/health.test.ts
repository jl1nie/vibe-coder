import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import handler from '../health';

describe('Health API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const req = new NextRequest('http://localhost/api/health', {
        method: 'GET'
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.version).toBe('0.1.0');
      expect(data.environment).toBe('edge');
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeDefined();
      expect(data.memory).toBeDefined();
    });

    it('should reject non-GET requests', async () => {
      const req = new NextRequest('http://localhost/api/health', {
        method: 'POST'
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Method not allowed');
    });
  });

  describe('Error Handling', () => {
    it('should handle internal errors gracefully', async () => {
      // Mock process.uptime to throw an error
      const originalUptime = process.uptime;
      process.uptime = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      const req = new NextRequest('http://localhost/api/health', {
        method: 'GET'
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.status).toBe('unhealthy');
      expect(data.error).toBe('Internal server error');
      expect(data.timestamp).toBeDefined();

      // Restore original function
      process.uptime = originalUptime;
    });
  });
});