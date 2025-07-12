import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import { WebSocketServer } from 'ws';

// Mock all external dependencies
vi.mock('cors');
vi.mock('helmet');
vi.mock('qrcode');
vi.mock('ws');
vi.mock('./services/claude-service');
vi.mock('./services/session-manager');
vi.mock('./services/webrtc-service');
vi.mock('./utils/config');
vi.mock('./utils/logger');
vi.mock('./routes/auth');
vi.mock('./routes/claude');
vi.mock('./routes/health');
vi.mock('./routes/webrtc');
vi.mock('./middleware/error');

describe('VibeCoderHost', () => {
  let mockExpress: any;
  let mockServer: any;
  let mockSessionManager: any;
  let mockClaudeService: any;
  let mockWebRTCService: any;

  beforeEach(() => {
    // Mock express app
    mockExpress = {
      use: vi.fn(),
      get: vi.fn(),
      listen: vi.fn(),
    };

    // Mock HTTP server
    mockServer = {
      listen: vi.fn((port, host, callback) => {
        if (callback) callback();
      }),
      close: vi.fn((callback) => {
        if (callback) callback();
      }),
      on: vi.fn(),
      address: vi.fn(() => ({ port: 8080, address: '0.0.0.0' })),
    };

    // Mock services
    mockSessionManager = {
      getHostId: vi.fn(() => '12345678'),
      updateSessionActivity: vi.fn(),
      getActiveSessions: vi.fn(() => []),
      destroy: vi.fn(),
    };

    mockClaudeService = {
      destroy: vi.fn(),
    };

    mockWebRTCService = {
      cleanupInactiveConnections: vi.fn(),
      logDetailedStatus: vi.fn(),
      initializeSignaling: vi.fn(() => Promise.resolve(true)),
      destroy: vi.fn(),
    };

    // Mock WebSocket server
    const mockWSS = {
      on: vi.fn(),
      close: vi.fn(),
    };

    // Setup express and createServer mocks
    vi.mocked(express).mockReturnValue(mockExpress as any);
    vi.doMock('http', () => ({
      createServer: vi.fn(() => mockServer),
    }));
    vi.mocked(WebSocketServer).mockReturnValue(mockWSS as any);

    // Mock constructor dependencies
    vi.doMock('./services/session-manager', () => ({
      SessionManager: vi.fn(() => mockSessionManager),
    }));
    vi.doMock('./services/claude-service', () => ({
      ClaudeService: vi.fn(() => mockClaudeService),
    }));
    vi.doMock('./services/webrtc-service', () => ({
      WebRTCService: vi.fn(() => mockWebRTCService),
    }));

    // Mock config
    vi.doMock('./utils/config', () => ({
      hostConfig: {
        port: 8080,
        host: '0.0.0.0',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        signalingUrl: 'ws://localhost:5174',
        signalingWsPath: '/api/ws/signaling',
        signalingConnectionTimeout: 5000,
        signalingHeartbeatInterval: 30000,
        webrtcStunServers: ['stun:stun.l.google.com:19302'],
        webrtcTurnServers: [],
      },
    }));

    // Mock logger
    vi.doMock('./utils/logger', () => ({
      default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
    }));

    // Mock route creators
    vi.doMock('./routes/auth', () => ({
      createAuthRouter: vi.fn(() => mockExpress),
    }));
    vi.doMock('./routes/claude', () => ({
      createClaudeRouter: vi.fn(() => mockExpress),
    }));
    vi.doMock('./routes/health', () => ({
      createHealthRouter: vi.fn(() => mockExpress),
    }));
    vi.doMock('./routes/webrtc', () => ({
      createWebRTCRouter: vi.fn(() => mockExpress),
    }));

    // Mock middleware
    vi.doMock('./middleware/error', () => ({
      errorHandler: vi.fn(),
      notFoundHandler: vi.fn(),
    }));

    // Mock QRCode
    vi.doMock('qrcode', () => ({
      default: {
        toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,mock')),
      },
    }));

    // Mock fs for workspace operations
    vi.doMock('fs', () => ({
      existsSync: vi.fn(() => true),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
    }));

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize all services and middleware', async () => {
      // We need to dynamically import after setting up mocks
      const { default: VibeCoderHost } = await import('../index');

      expect(express).toHaveBeenCalled();
      expect(mockExpress.use).toHaveBeenCalled();
    });

    it('should setup middleware correctly', async () => {
      const { default: VibeCoderHost } = await import('../index');

      // Verify middleware setup calls
      expect(mockExpress.use).toHaveBeenCalled();
    });

    it('should setup routes correctly', async () => {
      const { default: VibeCoderHost } = await import('../index');

      // Verify route setup
      expect(mockExpress.use).toHaveBeenCalled();
      expect(mockExpress.get).toHaveBeenCalled();
    });
  });

  describe('Server Lifecycle', () => {
    it('should start server successfully', async () => {
      process.env.VIBE_CODER_WORKSPACE_PATH = '/test/workspace';

      const { default: VibeCoderHost } = await import('../index');
      const instance = new VibeCoderHost();

      await instance.start();

      expect(mockServer.listen).toHaveBeenCalledWith(
        8080,
        '0.0.0.0',
        expect.any(Function)
      );
    });

    it('should handle server start errors', async () => {
      mockServer.listen.mockImplementation(() => {
        throw new Error('Port already in use');
      });

      const { default: VibeCoderHost } = await import('../index');
      const instance = new VibeCoderHost();

      await expect(instance.start()).rejects.toThrow('Port already in use');
    });

    it('should stop server gracefully', async () => {
      const { default: VibeCoderHost } = await import('../index');
      const instance = new VibeCoderHost();

      await instance.stop();

      expect(mockClaudeService.destroy).toHaveBeenCalled();
      expect(mockSessionManager.destroy).toHaveBeenCalled();
      expect(mockWebRTCService.destroy).toHaveBeenCalled();
      expect(mockServer.close).toHaveBeenCalled();
    });
  });

  describe('WebSocket Handling', () => {
    it('should setup WebSocket server', async () => {
      const { default: VibeCoderHost } = await import('../index');

      expect(WebSocketServer).toHaveBeenCalledWith({ server: mockServer });
    });

    it('should handle WebSocket connections', async () => {
      const { default: VibeCoderHost } = await import('../index');

      expect(WebSocketServer).toHaveBeenCalled();
      const wsServerInstance = vi.mocked(WebSocketServer).mock.results[0].value;
      expect(wsServerInstance.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('Route Handlers', () => {
    it('should setup root route with Host ID display', async () => {
      const { default: VibeCoderHost } = await import('../index');

      expect(mockExpress.get).toHaveBeenCalledWith('/', expect.any(Function));
    });

    it('should setup setup route for 2FA configuration', async () => {
      const { default: VibeCoderHost } = await import('../index');

      expect(mockExpress.get).toHaveBeenCalledWith('/setup', expect.any(Function));
    });
  });

  describe('Cleanup and Monitoring', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should setup cleanup timer', async () => {
      const { default: VibeCoderHost } = await import('../index');

      // Fast forward 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(mockWebRTCService.cleanupInactiveConnections).toHaveBeenCalled();
    });

    it('should setup status monitoring timer', async () => {
      const { default: VibeCoderHost } = await import('../index');

      // Fast forward 15 minutes
      vi.advanceTimersByTime(15 * 60 * 1000);

      expect(mockWebRTCService.logDetailedStatus).toHaveBeenCalled();
    });
  });

  describe('System Status', () => {
    it('should format uptime correctly', async () => {
      const { default: VibeCoderHost } = await import('../index');
      const instance = new VibeCoderHost();

      // Test formatUptime method via system status (indirectly)
      const mockUptime = vi.spyOn(process, 'uptime').mockReturnValue(3661); // 1h 1m 1s
      const mockMemoryUsage = vi.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100 * 1024 * 1024, // 100MB
        heapUsed: 50 * 1024 * 1024, // 50MB
        heapTotal: 80 * 1024 * 1024, // 80MB
        external: 10 * 1024 * 1024, // 10MB
        arrayBuffers: 5 * 1024 * 1024, // 5MB
      });

      // Access private method for testing
      (instance as any).logSystemStatus();

      const logger = await import('../utils/logger');
      expect(logger.default.info).toHaveBeenCalledWith(
        'System Status Report',
        expect.objectContaining({
          uptime: expect.objectContaining({
            seconds: 3661,
            formatted: expect.any(String),
          }),
          memory: expect.objectContaining({
            rss: 100,
            heapUsed: 50,
            heapTotal: 80,
            external: 10,
          }),
        })
      );

      mockUptime.mockRestore();
      mockMemoryUsage.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle unhandled rejections', async () => {
      const { default: VibeCoderHost } = await import('../index');

      const logger = await import('../utils/logger');
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      // Simulate unhandled rejection
      process.emit('unhandledRejection', 'Test error', Promise.resolve());

      expect(logger.default.error).toHaveBeenCalledWith(
        'Unhandled rejection',
        expect.objectContaining({
          reason: 'Test error',
        })
      );

      mockExit.mockRestore();
    });

    it('should handle uncaught exceptions', async () => {
      const { default: VibeCoderHost } = await import('../index');

      const logger = await import('../utils/logger');
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      const testError = new Error('Test uncaught exception');
      process.emit('uncaughtException', testError);

      expect(logger.default.error).toHaveBeenCalledWith(
        'Uncaught exception',
        expect.objectContaining({
          error: 'Test uncaught exception',
          stack: expect.any(String),
        })
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
    });

    it('should handle graceful shutdown signals', async () => {
      const { default: VibeCoderHost } = await import('../index');

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const mockStop = vi.fn().mockResolvedValue(undefined);

      // Mock the host instance
      vi.doMock('../index', () => ({
        default: class MockVibeCoderHost {
          stop = mockStop;
          start = vi.fn().mockResolvedValue(undefined);
        },
      }));

      // Simulate SIGTERM
      process.emit('SIGTERM');

      // Small delay to allow async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });
  });

  describe('Configuration', () => {
    it('should use environment variables for configuration', async () => {
      process.env.CORS_ORIGIN = 'http://custom.domain.com,https://another.domain.com';

      const { default: VibeCoderHost } = await import('../index');

      // Verify CORS setup was called
      expect(mockExpress.use).toHaveBeenCalled();
    });

    it('should handle missing workspace path', async () => {
      delete process.env.VIBE_CODER_WORKSPACE_PATH;

      const { default: VibeCoderHost } = await import('../index');
      const instance = new VibeCoderHost();

      // Should not throw, but should warn
      await instance.start();
    });
  });

  describe('WebRTC Signaling Integration', () => {
    it('should initialize WebRTC signaling on start', async () => {
      const { default: VibeCoderHost } = await import('../index');
      const instance = new VibeCoderHost();

      await instance.start();

      expect(mockWebRTCService.initializeSignaling).toHaveBeenCalledWith(
        expect.objectContaining({
          signalingUrl: 'ws://localhost:5174',
          hostId: '12345678',
        })
      );
    });

    it('should handle signaling initialization failure gracefully', async () => {
      mockWebRTCService.initializeSignaling.mockResolvedValue(false);

      const { default: VibeCoderHost } = await import('../index');
      const instance = new VibeCoderHost();

      // Should not throw
      await expect(instance.start()).resolves.toBeUndefined();

      const logger = await import('../utils/logger');
      expect(logger.default.warn).toHaveBeenCalledWith(
        'WebSocket signaling initialization failed - continuing without signaling'
      );
    });
  });
});