import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import handler from '../session';

describe('Session API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Creation (POST)', () => {
    it('should create session successfully', async () => {
      const req = new NextRequest('http://localhost/api/session?sessionId=TEST1234', {
        method: 'POST',
        body: JSON.stringify({
          hostId: 'HOST5678'
        })
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Session created successfully');
      expect(data.sessionInfo).toEqual({
        sessionId: 'TEST1234',
        hostId: 'HOST5678',
        status: 'waiting',
        createdAt: expect.any(Number),
        connectedClients: 0
      });
    });

    it('should reject creation without hostId', async () => {
      const req = new NextRequest('http://localhost/api/session?sessionId=TEST1234', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('hostId and sessionId are required');
    });

    it('should reject creation without sessionId', async () => {
      const req = new NextRequest('http://localhost/api/session', {
        method: 'POST',
        body: JSON.stringify({
          hostId: 'HOST5678'
        })
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('hostId and sessionId are required');
    });
  });

  describe('Session Retrieval (GET)', () => {
    it('should retrieve existing session', async () => {
      // First create a session
      const createReq = new NextRequest('http://localhost/api/session?sessionId=TEST1234', {
        method: 'POST',
        body: JSON.stringify({
          hostId: 'HOST5678'
        })
      });

      await handler(createReq);

      // Then retrieve it
      const getReq = new NextRequest('http://localhost/api/session?sessionId=TEST1234', {
        method: 'GET'
      });

      const response = await handler(getReq);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sessionInfo).toEqual({
        sessionId: 'TEST1234',
        hostId: 'HOST5678',
        status: 'waiting',
        createdAt: expect.any(Number),
        connectedClients: 0
      });
    });

    it('should return 404 for non-existent session', async () => {
      const req = new NextRequest('http://localhost/api/session?sessionId=NONEXISTENT', {
        method: 'GET'
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Session not found');
    });

    it('should reject retrieval without sessionId', async () => {
      const req = new NextRequest('http://localhost/api/session', {
        method: 'GET'
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('sessionId is required');
    });
  });

  describe('Session Update (PUT)', () => {
    it('should update session status', async () => {
      // First create a session
      const createReq = new NextRequest('http://localhost/api/session?sessionId=TEST1234', {
        method: 'POST',
        body: JSON.stringify({
          hostId: 'HOST5678'
        })
      });

      await handler(createReq);

      // Then update it
      const updateReq = new NextRequest('http://localhost/api/session?sessionId=TEST1234', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'connected'
        })
      });

      const response = await handler(updateReq);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Session updated successfully');
      expect(data.sessionInfo!.status).toBe('connected');
    });

    it('should update connected clients count', async () => {
      // First create a session
      const createReq = new NextRequest('http://localhost/api/session?sessionId=TEST1234', {
        method: 'POST',
        body: JSON.stringify({
          hostId: 'HOST5678'
        })
      });

      await handler(createReq);

      // Then update it
      const updateReq = new NextRequest('http://localhost/api/session?sessionId=TEST1234', {
        method: 'PUT',
        body: JSON.stringify({
          connectedClients: 2
        })
      });

      const response = await handler(updateReq);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sessionInfo!.connectedClients).toBe(2);
    });

    it('should return 404 for non-existent session update', async () => {
      const req = new NextRequest('http://localhost/api/session?sessionId=NONEXISTENT', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'connected'
        })
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Session not found');
    });

    it('should reject update without sessionId', async () => {
      const req = new NextRequest('http://localhost/api/session', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'connected'
        })
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('sessionId is required');
    });
  });

  describe('Session Deletion (DELETE)', () => {
    it('should delete existing session', async () => {
      // First create a session
      const createReq = new NextRequest('http://localhost/api/session?sessionId=TEST1234', {
        method: 'POST',
        body: JSON.stringify({
          hostId: 'HOST5678'
        })
      });

      await handler(createReq);

      // Then delete it
      const deleteReq = new NextRequest('http://localhost/api/session?sessionId=TEST1234', {
        method: 'DELETE'
      });

      const response = await handler(deleteReq);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Session deleted successfully');
    });

    it('should return 404 for non-existent session deletion', async () => {
      const req = new NextRequest('http://localhost/api/session?sessionId=NONEXISTENT', {
        method: 'DELETE'
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Session not found');
    });

    it('should reject deletion without sessionId', async () => {
      const req = new NextRequest('http://localhost/api/session', {
        method: 'DELETE'
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('sessionId is required');
    });
  });

  describe('Method Validation', () => {
    it('should reject unsupported methods', async () => {
      const req = new NextRequest('http://localhost/api/session?sessionId=TEST1234', {
        method: 'PATCH'
      });

      const response = await handler(req);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Method not allowed');
    });
  });
});