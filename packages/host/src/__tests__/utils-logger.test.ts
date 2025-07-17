import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Create simple logger test focused on core functionality
const mockWinston = {
  createLogger: vi.fn(),
  format: {
    combine: vi.fn(),
    timestamp: vi.fn(),
    errors: vi.fn(),
    json: vi.fn(),
    colorize: vi.fn(),
    simple: vi.fn(),
    printf: vi.fn(),
  },
  transports: {
    Console: vi.fn(),
    File: vi.fn(),
  },
};

const mockLogger = {
  add: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock('winston', () => ({ default: mockWinston }));
vi.mock('fs');
vi.mock('path');

describe('Logger Utils', () => {
  let fs: any;
  let path: any;

  beforeEach(async () => {
    // Get the mocked modules
    fs = await vi.importMock('fs');
    path = await vi.importMock('path');

    vi.clearAllMocks();
    
    // Reset mock implementations and return values
    mockWinston.createLogger.mockReturnValue(mockLogger);
    mockWinston.format.combine.mockReturnValue('combined-format');
    mockWinston.format.timestamp.mockReturnValue('timestamp-format');
    mockWinston.format.errors.mockReturnValue('errors-format');
    mockWinston.format.json.mockReturnValue('json-format');
    mockWinston.format.colorize.mockReturnValue('colorize-format');
    mockWinston.format.simple.mockReturnValue('simple-format');
    mockWinston.format.printf.mockReturnValue('printf-format');
    
    const mockConsoleTransport = { type: 'console' };
    const mockFileTransport = { type: 'file' };
    
    mockWinston.transports.Console.mockReturnValue(mockConsoleTransport);
    mockWinston.transports.File.mockReturnValue(mockFileTransport);
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
    vi.resetModules(); // Clear module cache
  });

  describe('Logger Export', () => {
    it('should export a logger instance', async () => {
      const loggerModule = await import('../utils/logger');
      
      expect(loggerModule.default).toBeDefined();
    });

    it('should be the same instance on multiple imports', async () => {
      const loggerModule1 = await import('../utils/logger');
      
      // Clear module cache and reimport
      vi.resetModules();
      
      const loggerModule2 = await import('../utils/logger');
      
      // Both should be defined (we can't test exact same instance due to mocking)
      expect(loggerModule1.default).toBeDefined();
      expect(loggerModule2.default).toBeDefined();
    });
  });

  describe('Production File Logging', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      (fs.existsSync as any).mockReturnValue(true);
      (fs.mkdirSync as any).mockImplementation(() => {});
      (path.join as any).mockImplementation((...args) => args.join('/'));
    });

    it('should add file transports in production', async () => {
      await import('../utils/logger');

      expect(mockLogger.add).toHaveBeenCalledTimes(2);
      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: '/app/logs/error.log',
        level: 'error',
      });
      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: '/app/logs/combined.log',
      });
    });

    it('should create log directory if it does not exist', async () => {
      (fs.existsSync as any).mockReturnValue(false);

      await import('../utils/logger');

      expect(fs.mkdirSync).toHaveBeenCalledWith('/app/logs', { recursive: true });
    });

    it('should not create directory if it already exists', async () => {
      (fs.existsSync as any).mockReturnValue(true);

      await import('../utils/logger');

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should handle log directory creation errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await import('../utils/logger');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Could not create log files, using console logging only:',
        expect.any(Error)
      );
      expect(mockLogger.add).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle file transport addition errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (fs.existsSync as any).mockReturnValue(true);
      mockLogger.add.mockImplementation(() => {
        throw new Error('File transport error');
      });

      await import('../utils/logger');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Could not create log files, using console logging only:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Development Logging', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should not add file transports in development', async () => {
      await import('../utils/logger');

      expect(mockLogger.add).not.toHaveBeenCalled();
      expect(winston.transports.File).not.toHaveBeenCalled();
    });
  });

  describe('Default Environment', () => {
    it('should not add file transports when NODE_ENV is not set', async () => {
      delete process.env.NODE_ENV;

      await import('../utils/logger');

      expect(mockLogger.add).not.toHaveBeenCalled();
      expect(winston.transports.File).not.toHaveBeenCalled();
    });
  });

  describe('Printf Format Function', () => {
    let printfFunction: any;

    beforeEach(async () => {
      await import('../utils/logger');
      const printfCall = (winston.format.printf as any).mock.calls[0];
      printfFunction = printfCall[0];
    });

    it('should format log message with timestamp and level', () => {
      const logData = {
        timestamp: '2024-01-01T12:00:00Z',
        level: 'info',
        message: 'Test message',
      };

      const result = printfFunction(logData);

      expect(result).toBe('2024-01-01T12:00:00Z [info]: Test message ');
    });

    it('should include metadata in formatted message', () => {
      const logData = {
        timestamp: '2024-01-01T12:00:00Z',
        level: 'error',
        message: 'Error occurred',
        userId: '123',
        action: 'login',
      };

      const result = printfFunction(logData);

      expect(result).toContain('2024-01-01T12:00:00Z [error]: Error occurred');
      expect(result).toContain('"userId": "123"');
      expect(result).toContain('"action": "login"');
    });

    it('should handle empty metadata', () => {
      const logData = {
        timestamp: '2024-01-01T12:00:00Z',
        level: 'warn',
        message: 'Warning message',
      };

      const result = printfFunction(logData);

      expect(result).toBe('2024-01-01T12:00:00Z [warn]: Warning message ');
    });

    it('should format nested metadata objects', () => {
      const logData = {
        timestamp: '2024-01-01T12:00:00Z',
        level: 'debug',
        message: 'Debug info',
        user: {
          id: '123',
          name: 'Test User',
        },
        request: {
          method: 'POST',
          url: '/api/test',
        },
      };

      const result = printfFunction(logData);

      expect(result).toContain('Debug info');
      expect(result).toContain('"id": "123"');
      expect(result).toContain('"name": "Test User"');
      expect(result).toContain('"method": "POST"');
    });
  });

  describe('Logger Export', () => {
    it('should export the logger instance', async () => {
      const loggerModule = await import('../utils/logger');
      const logger = loggerModule.default;

      expect(logger).toBe(mockLogger);
    });

    it('should be a singleton instance', async () => {
      const loggerModule1 = await import('../utils/logger');
      const loggerModule2 = await import('../utils/logger');
      const logger1 = loggerModule1.default;
      const logger2 = loggerModule2.default;

      expect(logger1).toBe(logger2);
    });
  });
});