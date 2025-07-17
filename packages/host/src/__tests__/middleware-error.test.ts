import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler, asyncHandler, ApiError } from '../middleware/error';

// Mock logger
vi.mock('../utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

describe('Error Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      url: '/test',
      method: 'GET',
      ip: '127.0.0.1',
    };
    
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  describe('errorHandler', () => {
    it('should handle basic error with default status 500', () => {
      const error = new Error('Test error') as ApiError;
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Test error',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String),
      });
    });

    it('should handle error with custom status and code', () => {
      const error = new Error('Custom error') as ApiError;
      error.status = 400;
      error.code = 'VALIDATION_ERROR';
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Custom error',
        code: 'VALIDATION_ERROR',
        timestamp: expect.any(String),
      });
    });

    it('should handle error without message', () => {
      const error = new Error() as ApiError;
      error.message = '';
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String),
      });
    });

    it('should return valid ISO timestamp', () => {
      const error = new Error('Test error') as ApiError;
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      const jsonCall = (mockRes.json as any).mock.calls[0][0];
      expect(jsonCall.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should log error details', async () => {
      const logger = await import('../utils/logger');
      const error = new Error('Test error') as ApiError;
      error.stack = 'Test stack trace';
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(logger.default.error).toHaveBeenCalledWith('API Error', {
        error: 'Test error',
        stack: 'Test stack trace',
        url: '/test',
        method: 'GET',
        ip: '127.0.0.1',
      });
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 with proper error message', () => {
      notFoundHandler(mockReq as Request, mockRes as Response);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Endpoint not found',
        code: 'NOT_FOUND',
        timestamp: expect.any(String),
      });
    });

    it('should return valid ISO timestamp', () => {
      notFoundHandler(mockReq as Request, mockRes as Response);
      
      const jsonCall = (mockRes.json as any).mock.calls[0][0];
      expect(jsonCall.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async function', async () => {
      const asyncFn = vi.fn().mockResolvedValue('success');
      const wrappedFn = asyncHandler(asyncFn);
      
      await wrappedFn(mockReq as Request, mockRes as Response, mockNext);
      
      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle async function that throws error', async () => {
      const error = new Error('Async error');
      const asyncFn = vi.fn().mockRejectedValue(error);
      const wrappedFn = asyncHandler(asyncFn);
      
      // Call the wrapped function and wait for async completion
      const result = wrappedFn(mockReq as Request, mockRes as Response, mockNext);
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for next tick
      
      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle sync function that throws error', async () => {
      const error = new Error('Sync error');
      const asyncFn = vi.fn().mockImplementation(() => {
        throw error;
      });
      const wrappedFn = asyncHandler(asyncFn);
      
      // The wrapped function should not throw - it should pass errors to next()
      expect(() => {
        wrappedFn(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();
      
      // Give time for Promise.resolve().catch() to execute
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle promise rejection', async () => {
      const error = new Error('Promise rejection');
      const asyncFn = vi.fn().mockImplementation(() => Promise.reject(error));
      const wrappedFn = asyncHandler(asyncFn);
      
      wrappedFn(mockReq as Request, mockRes as Response, mockNext);
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should preserve function return value for successful calls', async () => {
      const returnValue = { success: true };
      const asyncFn = vi.fn().mockResolvedValue(returnValue);
      const wrappedFn = asyncHandler(asyncFn);
      
      const result = await wrappedFn(mockReq as Request, mockRes as Response, mockNext);
      
      expect(result).toBeUndefined(); // Express middleware doesn't return values
      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    });
  });
});