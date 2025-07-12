import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getConfig, getOrCreateHostId } from '../utils/config';

// Mock fs module
vi.mock('fs');

describe('Config Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any environment variables
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.HOST;
    delete process.env.LOG_LEVEL;
    delete process.env.WORKSPACE_PATH;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getConfig', () => {
    it('should return default configuration', () => {
      const config = getConfig();

      expect(config).toEqual({
        port: 8080,
        host: '0.0.0.0',
        logLevel: 'info',
        workspacePath: '/app/workspace',
        isDevelopment: false,
        isProduction: false,
        isTest: false,
      });
    });

    it('should override with environment variables', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';
      process.env.HOST = '127.0.0.1';
      process.env.LOG_LEVEL = 'debug';
      process.env.WORKSPACE_PATH = '/custom/workspace';

      const config = getConfig();

      expect(config).toEqual({
        port: 3000,
        host: '127.0.0.1',
        logLevel: 'debug',
        workspacePath: '/custom/workspace',
        isDevelopment: false,
        isProduction: true,
        isTest: false,
      });
    });

    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';

      const config = getConfig();

      expect(config.isDevelopment).toBe(true);
      expect(config.isProduction).toBe(false);
      expect(config.isTest).toBe(false);
    });

    it('should detect test environment', () => {
      process.env.NODE_ENV = 'test';

      const config = getConfig();

      expect(config.isDevelopment).toBe(false);
      expect(config.isProduction).toBe(false);
      expect(config.isTest).toBe(true);
    });

    it('should handle invalid port gracefully', () => {
      process.env.PORT = 'invalid';

      const config = getConfig();

      expect(config.port).toBe(8080); // Should fall back to default
    });

    it('should handle zero port', () => {
      process.env.PORT = '0';

      const config = getConfig();

      expect(config.port).toBe(8080); // Should fall back to default
    });

    it('should handle negative port', () => {
      process.env.PORT = '-1';

      const config = getConfig();

      expect(config.port).toBe(8080); // Should fall back to default
    });

    it('should handle port above valid range', () => {
      process.env.PORT = '70000';

      const config = getConfig();

      expect(config.port).toBe(8080); // Should fall back to default
    });

    it('should accept valid port range', () => {
      process.env.PORT = '65535';

      const config = getConfig();

      expect(config.port).toBe(65535);
    });
  });

  describe('getOrCreateHostId', () => {
    const hostIdPath = '/app/workspace/.vibe-coder-host-id';

    it('should return existing host ID from file', () => {
      const existingId = '12345678';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(existingId);

      const hostId = getOrCreateHostId();

      expect(hostId).toBe(existingId);
      expect(fs.existsSync).toHaveBeenCalledWith(hostIdPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(hostIdPath, 'utf8');
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should create new host ID if file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const hostId = getOrCreateHostId();

      expect(hostId).toMatch(/^\d{8}$/); // Should be 8 digits
      expect(fs.existsSync).toHaveBeenCalledWith(hostIdPath);
      expect(fs.readFileSync).not.toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        hostIdPath,
        hostId,
        { mode: 0o600 }
      );
    });

    it('should create new host ID if file is empty', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('');

      const hostId = getOrCreateHostId();

      expect(hostId).toMatch(/^\d{8}$/);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        hostIdPath,
        hostId,
        { mode: 0o600 }
      );
    });

    it('should create new host ID if file contains whitespace only', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('   \n\t  ');

      const hostId = getOrCreateHostId();

      expect(hostId).toMatch(/^\d{8}$/);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        hostIdPath,
        hostId,
        { mode: 0o600 }
      );
    });

    it('should create new host ID if file contains invalid format', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid123');

      const hostId = getOrCreateHostId();

      expect(hostId).toMatch(/^\d{8}$/);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        hostIdPath,
        hostId,
        { mode: 0o600 }
      );
    });

    it('should trim whitespace from existing host ID', () => {
      const existingId = '12345678';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`  ${existingId}  \n`);

      const hostId = getOrCreateHostId();

      expect(hostId).toBe(existingId);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should handle file read errors gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const hostId = getOrCreateHostId();

      expect(hostId).toMatch(/^\d{8}$/);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle file write errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const hostId = getOrCreateHostId();

      expect(hostId).toMatch(/^\d{8}$/);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Warning: Could not save host ID to file:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should generate different IDs on subsequent calls when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const hostId1 = getOrCreateHostId();
      const hostId2 = getOrCreateHostId();

      expect(hostId1).not.toBe(hostId2);
      expect(hostId1).toMatch(/^\d{8}$/);
      expect(hostId2).toMatch(/^\d{8}$/);
    });

    it('should handle directory creation for workspace path', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => {});

      const hostId = getOrCreateHostId();

      expect(hostId).toMatch(/^\d{8}$/);
      // The function should attempt to create the directory structure
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should use custom workspace path from config', () => {
      process.env.WORKSPACE_PATH = '/custom/workspace';
      const customHostIdPath = '/custom/workspace/.vibe-coder-host-id';
      
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const hostId = getOrCreateHostId();

      expect(hostId).toMatch(/^\d{8}$/);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        customHostIdPath,
        hostId,
        { mode: 0o600 }
      );
    });

    it('should validate host ID format correctly', () => {
      const testCases = [
        { input: '12345678', valid: true },
        { input: '00000000', valid: true },
        { input: '99999999', valid: true },
        { input: '1234567', valid: false },  // Too short
        { input: '123456789', valid: false }, // Too long
        { input: '1234567a', valid: false }, // Contains letter
        { input: '1234-567', valid: false }, // Contains hyphen
        { input: '', valid: false },         // Empty
      ];

      testCases.forEach(({ input, valid }) => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(input);

        const hostId = getOrCreateHostId();

        if (valid) {
          expect(hostId).toBe(input);
          expect(fs.writeFileSync).not.toHaveBeenCalled();
        } else {
          expect(hostId).toMatch(/^\d{8}$/);
          expect(hostId).not.toBe(input);
          expect(fs.writeFileSync).toHaveBeenCalled();
        }

        vi.clearAllMocks();
      });
    });
  });
});