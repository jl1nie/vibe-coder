import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Mock dependencies
vi.mock('winston', () => ({
  default: {
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
  },
}));

vi.mock('fs');
vi.mock('path');

describe('Logger Utils', () => {
  let mockLogger: any;
  let mockConsoleTransport: any;
  let mockFileTransport: any;

  beforeEach(() => {
    mockLogger = {
      add: vi.fn(),
    };

    mockConsoleTransport = vi.fn();
    mockFileTransport = vi.fn();

    (winston.createLogger as any).mockReturnValue(mockLogger);
    (winston.transports.Console as any).mockImplementation(() => mockConsoleTransport);
    (winston.transports.File as any).mockImplementation(() => mockFileTransport);

    // Mock winston format functions
    (winston.format.combine as any).mockReturnValue('combined-format');
    (winston.format.timestamp as any).mockReturnValue('timestamp-format');
    (winston.format.errors as any).mockReturnValue('errors-format');
    (winston.format.json as any).mockReturnValue('json-format');
    (winston.format.colorize as any).mockReturnValue('colorize-format');
    (winston.format.simple as any).mockReturnValue('simple-format');
    (winston.format.printf as any).mockReturnValue('printf-format');

    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  describe('Logger Initialization', () => {
    it('should create logger with correct configuration', () => {
      // Import logger to trigger initialization
      require('../utils/logger');

      expect(winston.createLogger).toHaveBeenCalledWith({
        level: 'info',
        format: 'combined-format',
        defaultMeta: { service: 'vibe-coder-host' },
        transports: [mockConsoleTransport],
      });
    });

    it('should configure console transport with correct format', () => {
      require('../utils/logger');

      expect(winston.transports.Console).toHaveBeenCalledWith({
        format: 'combined-format',
      });
    });

    it('should use printf format for console output', () => {
      require('../utils/logger');

      expect(winston.format.printf).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Production File Logging', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      (fs.existsSync as any).mockReturnValue(true);
      (fs.mkdirSync as any).mockImplementation(() => {});
      (path.join as any).mockImplementation((...args) => args.join('/'));
    });

    it('should add file transports in production', () => {
      require('../utils/logger');

      expect(mockLogger.add).toHaveBeenCalledTimes(2);
      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: '/app/logs/error.log',
        level: 'error',
      });
      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: '/app/logs/combined.log',
      });
    });

    it('should create log directory if it does not exist', () => {
      (fs.existsSync as any).mockReturnValue(false);

      require('../utils/logger');

      expect(fs.mkdirSync).toHaveBeenCalledWith('/app/logs', { recursive: true });
    });

    it('should not create directory if it already exists', () => {
      (fs.existsSync as any).mockReturnValue(true);

      require('../utils/logger');

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should handle log directory creation errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      require('../utils/logger');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Could not create log files, using console logging only:',
        expect.any(Error)
      );
      expect(mockLogger.add).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle file transport addition errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (fs.existsSync as any).mockReturnValue(true);
      mockLogger.add.mockImplementation(() => {
        throw new Error('File transport error');
      });

      require('../utils/logger');

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

    it('should not add file transports in development', () => {
      require('../utils/logger');

      expect(mockLogger.add).not.toHaveBeenCalled();
      expect(winston.transports.File).not.toHaveBeenCalled();
    });
  });

  describe('Default Environment', () => {
    it('should not add file transports when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;

      require('../utils/logger');

      expect(mockLogger.add).not.toHaveBeenCalled();
      expect(winston.transports.File).not.toHaveBeenCalled();
    });
  });

  describe('Printf Format Function', () => {
    let printfFunction: any;

    beforeEach(() => {
      require('../utils/logger');
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
    it('should export the logger instance', () => {
      const logger = require('../utils/logger').default;

      expect(logger).toBe(mockLogger);
    });

    it('should be a singleton instance', () => {
      const logger1 = require('../utils/logger').default;
      const logger2 = require('../utils/logger').default;

      expect(logger1).toBe(logger2);
    });
  });
});