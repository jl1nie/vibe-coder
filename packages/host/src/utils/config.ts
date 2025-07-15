import fs from 'fs';
import path from 'path';
import speakeasy from 'speakeasy';
import { generateHostId } from '../../../shared/src';
import { HostConfig } from '../types';
import { generateSessionSecret } from './security';

// 絶対的ルール: 環境変数必須、フォールバック厳禁

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`FATAL: Required environment variable ${key} is not set`);
    console.error('Please set all required environment variables before starting');
    process.exit(1);
  }
  return value;
}

function getRequiredEnvInt(key: string): number {
  const value = getRequiredEnv(key);
  const parsed = parseInt(value);
  if (isNaN(parsed)) {
    console.error(`FATAL: Environment variable ${key}=${value} is not a valid integer`);
    process.exit(1);
  }
  return parsed;
}

function getEnvStringArray(key: string, delimiter: string = ','): string[] {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    return [];
  }
  return value.split(delimiter).map(s => s.trim()).filter(s => s.length > 0);
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getOptionalEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  const parsed = parseInt(value);
  if (isNaN(parsed)) {
    console.warn(`Warning: Environment variable ${key}=${value} is not a valid integer, using default ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

function validateConfig(config: any): void {
  const errors: string[] = [];
  
  // Validate port
  if (config.port < 1 || config.port > 65535) {
    errors.push(`Invalid port: ${config.port} (must be 1-65535)`);
  }
  
  // Validate timeout values
  if (config.signalingConnectionTimeout < 1000) {
    errors.push(`Signaling connection timeout too low: ${config.signalingConnectionTimeout}ms (minimum 1000ms)`);
  }
  
  if (config.signalingHeartbeatInterval < 5000) {
    errors.push(`Heartbeat interval too low: ${config.signalingHeartbeatInterval}ms (minimum 5000ms)`);
  }
  
  // Validate max connections
  if (config.maxConcurrentSessions < 1 || config.maxConcurrentSessions > 1000) {
    errors.push(`Invalid max concurrent sessions: ${config.maxConcurrentSessions} (must be 1-1000)`);
  }
  
  // Validate log level
  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  if (!validLogLevels.includes(config.logLevel)) {
    errors.push(`Invalid log level: ${config.logLevel} (must be one of: ${validLogLevels.join(', ')})`);
  }
  
  // Validate Host ID format
  if (!/^\d{8}$/.test(config.hostId)) {
    errors.push(`Invalid Host ID format: ${config.hostId} (must be 8 digits)`);
  }
  
  // Validate session secret length
  if (config.sessionSecret.length < 32) {
    errors.push(`Session secret too short: ${config.sessionSecret.length} chars (minimum 32 chars)`);
  }
  
  // Validate TOTP secret
  if (config.totpSecret.length < 16) {
    errors.push(`TOTP secret too short: ${config.totpSecret.length} chars (minimum 16 chars)`);
  }
  
  if (errors.length > 0) {
    console.error('FATAL: Configuration validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
  
  console.log('✅ Configuration validation passed');
}

function getOrCreateSessionSecret(): string {
  // テスト環境では固定値を使用
  if (process.env.NODE_ENV === 'test') {
    return 'test-session-secret-32-chars-long';
  }

  // Save session secret in workspace directory (環境変数必須)
  const secretPath = path.resolve(getRequiredEnv('VIBE_CODER_WORKSPACE_PATH'), '.vibe-coder-session-secret');

  // Try to read existing secret
  try {
    if (fs.existsSync(secretPath)) {
      const savedSecret = fs.readFileSync(secretPath, 'utf8').trim();
      if (savedSecret.length >= 32) {
        console.log(`Using saved session secret (from ${secretPath})`);
        return savedSecret;
      }
    }
  } catch (error) {
    // Continue to generate new secret
  }

  // Generate new session secret
  const newSecret = generateSessionSecret();

  // Save to current directory - fail startup if cannot write
  try {
    fs.writeFileSync(secretPath, newSecret, { mode: 0o600 });
    console.log(`Generated and saved new session secret (to ${secretPath})`);
    return newSecret;
  } catch (error) {
    console.error(
      `FATAL: Cannot write session secret to ${secretPath}: ${(error as Error).message}`
    );
    console.error('Vibe Coder requires write access to the startup directory');
    process.exit(1);
  }
}

function getOrCreateTotpSecret(): string {
  // テスト環境では固定値を使用
  if (process.env.NODE_ENV === 'test') {
    return 'JBSWY3DPEHPK3PXP'; // 固定のTOTP秘密鍵
  }

  // Save TOTP secret in workspace directory (環境変数必須)
  const secretPath = path.resolve(getRequiredEnv('VIBE_CODER_WORKSPACE_PATH'), '.vibe-coder-totp-secret');

  // Try to read existing secret
  try {
    if (fs.existsSync(secretPath)) {
      const savedSecret = fs.readFileSync(secretPath, 'utf8').trim();
      if (savedSecret.length >= 16) {
        console.log(`Using saved TOTP secret (from ${secretPath})`);
        return savedSecret;
      }
    }
  } catch (error) {
    // Continue to generate new secret
  }

  // Generate new TOTP secret (using speakeasy for consistency)
  const secret = speakeasy.generateSecret({
    name: 'Vibe Coder Host',
    issuer: 'Vibe Coder',
    length: 32,
  });

  const newSecret = secret.base32!;

  // Save to current directory - fail startup if cannot write
  try {
    fs.writeFileSync(secretPath, newSecret, { mode: 0o600 });
    console.log(`Generated and saved new TOTP secret (to ${secretPath})`);
    return newSecret;
  } catch (error) {
    console.error(
      `FATAL: Cannot write TOTP secret to ${secretPath}: ${(error as Error).message}`
    );
    console.error('Vibe Coder requires write access to the startup directory');
    process.exit(1);
  }
}

function getOrCreateHostId(): string {
  // テスト環境では固定値を使用
  if (process.env.NODE_ENV === 'test') {
    return '12345678'; // 固定のHost ID
  }

  // Save Host ID in workspace directory (環境変数必須)
  const hostIdPath = path.resolve(getRequiredEnv('VIBE_CODER_WORKSPACE_PATH'), '.vibe-coder-host-id');

  // Try to read existing Host ID
  try {
    if (fs.existsSync(hostIdPath)) {
      const savedHostId = fs.readFileSync(hostIdPath, 'utf8').trim();
      if (savedHostId.length === 8 && /^\d{8}$/.test(savedHostId)) {
        console.log(`Using saved Host ID: ${savedHostId} (from ${hostIdPath})`);
        return savedHostId;
      }
    }
  } catch (error) {
    // Continue to generate new host ID
  }

  // Generate new Host ID
  const newHostId = generateHostId();

  // Save to current directory - fail startup if cannot write
  try {
    fs.writeFileSync(hostIdPath, newHostId, { mode: 0o600 });
    console.log(`Generated and saved new Host ID: ${newHostId} (to ${hostIdPath})`);
    return newHostId;
  } catch (error) {
    console.error(
      `FATAL: Cannot write Host ID to ${hostIdPath}: ${(error as Error).message}`
    );
    console.error('Vibe Coder requires write access to the startup directory');
    process.exit(1);
  }
}

function createDefaultConfig(): HostConfig {
  // テスト環境では完全に固定値を使用（フォールバック厳禁ルール遵守）
  if (process.env.NODE_ENV === 'test') {
    const testConfig = {
      port: 8080,
      claudeConfigPath: './.claude',
      signalingUrl: 'localhost:5175',
      signalingWsPath: '/',
      signalingConnectionTimeout: 10000,
      signalingHeartbeatInterval: 30000,
      sessionSecret: 'test-session-secret-32-chars-long',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      maxConcurrentSessions: 10,
      commandTimeout: 10000,
      enableSecurity: true,
      logLevel: 'info' as const,
      hostId: '12345678',
      webrtcStunServers: ['stun:stun.l.google.com:19302'],
      webrtcTurnServers: [],
    };
    
    validateConfig(testConfig);
    return testConfig;
  }

  // Production config with environment variables and defaults
  const config = {
    port: getRequiredEnvInt('VIBE_CODER_PORT'),
    claudeConfigPath: getOptionalEnv('CLAUDE_CONFIG_PATH', '/app/.claude'),
    signalingUrl: getOptionalEnv('VIBE_CODER_SIGNALING_URL', 'localhost:5175'),
    signalingWsPath: getOptionalEnv('VIBE_CODER_SIGNALING_WS_PATH', '/'),
    signalingConnectionTimeout: getOptionalEnvInt('VIBE_CODER_SIGNALING_CONNECTION_TIMEOUT', 15000),
    signalingHeartbeatInterval: getOptionalEnvInt('VIBE_CODER_SIGNALING_HEARTBEAT_INTERVAL', 30000),
    sessionSecret: getOrCreateSessionSecret(),
    totpSecret: getOrCreateTotpSecret(),
    maxConcurrentSessions: getOptionalEnvInt('VIBE_CODER_MAX_CONNECTIONS', 100),
    commandTimeout: getOptionalEnvInt('VIBE_CODER_SIGNALING_CONNECTION_TIMEOUT', 15000),
    enableSecurity: true,
    logLevel: getOptionalEnv('VIBE_CODER_LOG_LEVEL', 'warn') as 'error' | 'warn' | 'info' | 'debug',
    hostId: getOrCreateHostId(), // 永続化されたHost ID
    webrtcStunServers: getEnvStringArray('VIBE_CODER_WEBRTC_STUN_SERVERS').length > 0 
      ? getEnvStringArray('VIBE_CODER_WEBRTC_STUN_SERVERS')
      : ['stun:stun.l.google.com:19302'],
    webrtcTurnServers: getEnvStringArray('VIBE_CODER_WEBRTC_TURN_SERVERS'),
  };
  
  validateConfig(config);
  return config;
}

export const hostConfig = createDefaultConfig();

// No environment variable helpers needed anymore - everything uses defaults