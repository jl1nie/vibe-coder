import { describe, it, expect, vi } from 'vitest';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../pages/api/signal';

describe('Signal API', () => {
  it('should create a new session', async () => {
    const mockReq = {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
      },
      body: {
        type: 'create-session',
        sessionId: 'test-session',
        hostId: 'test-host',
      },
    } as NextApiRequest;

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as NextApiResponse;

    await handler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      message: 'Session created successfully',
    });
  });

  it('should store offer data', async () => {
    const mockReq = {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
      },
      body: {
        type: 'offer',
        sessionId: 'test-session',
        hostId: 'test-host',
        offer: {
          type: 'offer',
          sdp: 'test-sdp',
        },
      },
    } as NextApiRequest;

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as NextApiResponse;

    await handler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      message: 'Offer stored successfully',
    });
  });

  it('should store answer data', async () => {
    // First create a session
    const createReq = {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
      },
      body: {
        type: 'create-session',
        sessionId: 'test-session',
        hostId: 'test-host',
      },
    } as NextApiRequest;

    const createRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as NextApiResponse;

    await handler(createReq, createRes);

    // Then store answer
    const mockReq = {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
      },
      body: {
        type: 'answer',
        sessionId: 'test-session',
        hostId: 'test-host',
        answer: {
          type: 'answer',
          sdp: 'test-sdp',
        },
      },
    } as NextApiRequest;

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as NextApiResponse;

    await handler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      message: 'Answer stored successfully',
    });
  });

  it('should return 405 for non-POST requests', async () => {
    const mockReq = {
      method: 'GET',
      headers: {
        origin: 'http://localhost:5173',
      },
    } as NextApiRequest;

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as NextApiResponse;

    await handler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(405);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Method not allowed',
    });
  });

  it('should return 400 for invalid request format', async () => {
    const mockReq = {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
      },
      body: {
        invalidField: 'test',
      },
    } as NextApiRequest;

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as NextApiResponse;

    await handler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid request format',
    });
  });

  it('should return 404 for non-existent session when getting offer', async () => {
    const mockReq = {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
      },
      body: {
        type: 'get-offer',
        sessionId: 'non-existent-session',
        hostId: 'test-host',
      },
    } as NextApiRequest;

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as NextApiResponse;

    await handler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Offer not found',
    });
  });

  it('should persist sessions across function calls (Edge Function stateless fix)', async () => {
    // First call - create session
    const createReq = {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
      },
      body: {
        type: 'create-session',
        sessionId: 'persistent-session',
        hostId: 'test-host',
      },
    } as NextApiRequest;

    const createRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as NextApiResponse;

    await handler(createReq, createRes);

    // Second call - store offer (should find existing session)
    const offerReq = {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
      },
      body: {
        type: 'offer',
        sessionId: 'persistent-session',
        hostId: 'test-host',
        offer: {
          type: 'offer',
          sdp: 'persistent-sdp',
        },
      },
    } as NextApiRequest;

    const offerRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as NextApiResponse;

    await handler(offerReq, offerRes);

    // Third call - get offer (should retrieve from persistent session)
    const getReq = {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
      },
      body: {
        type: 'get-offer',
        sessionId: 'persistent-session',
        hostId: 'test-host',
      },
    } as NextApiRequest;

    const getRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as NextApiResponse;

    await handler(getReq, getRes);

    // Verify session persistence
    expect(createRes.status).toHaveBeenCalledWith(200);
    expect(offerRes.status).toHaveBeenCalledWith(200);
    expect(getRes.status).toHaveBeenCalledWith(200);
    expect(getRes.json).toHaveBeenCalledWith({
      success: true,
      offer: {
        type: 'offer',
        sdp: 'persistent-sdp',
      },
    });
  });

  it('should handle ICE candidates storage and retrieval', async () => {
    // Create session first
    const createReq = {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
      },
      body: {
        type: 'create-session',
        sessionId: 'ice-session',
        hostId: 'test-host',
      },
    } as NextApiRequest;

    const createRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as NextApiResponse;

    await handler(createReq, createRes);

    // Store ICE candidate
    const candidateReq = {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
      },
      body: {
        type: 'candidate',
        sessionId: 'ice-session',
        hostId: 'test-host',
        candidate: {
          candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 54400 typ host',
          sdpMLineIndex: 0,
          sdpMid: '0',
        },
      },
    } as NextApiRequest;

    const candidateRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as NextApiResponse;

    await handler(candidateReq, candidateRes);

    // Get ICE candidates
    const getReq = {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
      },
      body: {
        type: 'get-candidate',
        sessionId: 'ice-session',
        hostId: 'client-host', // Different hostId to get host's candidates
      },
    } as NextApiRequest;

    const getRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as NextApiResponse;

    await handler(getReq, getRes);

    expect(candidateRes.status).toHaveBeenCalledWith(200);
    expect(getRes.status).toHaveBeenCalledWith(200);
    expect(getRes.json).toHaveBeenCalledWith({
      success: true,
      candidates: expect.any(Array),
    });
  });
});