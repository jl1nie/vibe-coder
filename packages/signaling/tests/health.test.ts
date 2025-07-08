import { describe, it, expect, vi } from 'vitest';
import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../pages/api/health';

describe('Health API', () => {
  it('should return health status on GET request', async () => {
    const mockReq = {
      method: 'GET',
    } as NextApiRequest;

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as NextApiResponse;

    await handler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Signaling server is healthy',
        timestamp: expect.any(String),
      })
    );
  });

  it('should return 405 for non-GET requests', async () => {
    const mockReq = {
      method: 'POST',
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
});