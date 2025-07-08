import { describe, it, expect, vi } from 'vitest';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../pages/api/signal';

describe('Signal API', () => {
  it('should create a new session', async () => {
    const mockReq = {
      method: 'POST',
      body: {
        type: 'create-session',
        sessionId: 'test-session',
        hostId: 'test-host',
      },
    } as NextApiRequest;

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
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
      body: {
        type: 'create-session',
        sessionId: 'test-session',
        hostId: 'test-host',
      },
    } as NextApiRequest;

    const createRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as NextApiResponse;

    await handler(createReq, createRes);

    // Then store answer
    const mockReq = {
      method: 'POST',
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
    } as NextApiRequest;

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
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
      body: {
        invalidField: 'test',
      },
    } as NextApiRequest;

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
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
      body: {
        type: 'get-offer',
        sessionId: 'non-existent-session',
        hostId: 'test-host',
      },
    } as NextApiRequest;

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as NextApiResponse;

    await handler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Offer not found',
    });
  });
});