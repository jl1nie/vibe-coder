import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { hostConfig } from '../utils/config';

// Mock fs module
vi.mock('fs');

describe('Config Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hostConfig', () => {
    it('should have required configuration properties', () => {
      expect(hostConfig).toBeDefined();
      expect(hostConfig.port).toBeDefined();
      expect(hostConfig.claudeConfigPath).toBeDefined();
      expect(hostConfig.signalingUrl).toBeDefined();
      expect(hostConfig.hostId).toBeDefined();
      expect(hostConfig.totpSecret).toBeDefined();
      expect(hostConfig.sessionSecret).toBeDefined();
    });

    it('should have valid default values', () => {
      expect(hostConfig.port).toBeGreaterThan(0);
      expect(hostConfig.port).toBeLessThanOrEqual(65535);
      expect(hostConfig.maxConcurrentSessions).toBeGreaterThan(0);
      expect(hostConfig.commandTimeout).toBeGreaterThan(0);
      expect(hostConfig.signalingConnectionTimeout).toBeGreaterThan(0);
      expect(hostConfig.signalingHeartbeatInterval).toBeGreaterThan(0);
    });

    it('should have valid WebRTC configuration', () => {
      expect(Array.isArray(hostConfig.webrtcStunServers)).toBe(true);
      expect(hostConfig.webrtcStunServers.length).toBeGreaterThan(0);
      expect(Array.isArray(hostConfig.webrtcTurnServers)).toBe(true);
    });

    it('should have valid signaling configuration', () => {
      expect(hostConfig.signalingUrl).toBeTruthy();
      expect(hostConfig.signalingWsPath).toBeTruthy();
    });

    it('should have security configuration', () => {
      expect(typeof hostConfig.enableSecurity).toBe('boolean');
      expect(hostConfig.sessionSecret).toBeTruthy();
      expect(hostConfig.totpSecret).toBeTruthy();
      expect(hostConfig.hostId).toMatch(/^\d{8}$/);
    });

    it('should have valid log level', () => {
      const validLogLevels = ['error', 'warn', 'info', 'debug'];
      expect(validLogLevels).toContain(hostConfig.logLevel);
    });
  });
});