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
    return {
      port: 8080,
      claudeConfigPath: './.claude',
      signalingUrl: 'http://localhost:5174/api/signal',
      sessionSecret: 'test-session-secret-32-chars-long',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      maxConcurrentSessions: 10,
      commandTimeout: 30000,
      enableSecurity: true,
      logLevel: 'info' as const,
      hostId: '12345678',
    };
  }

  return {
    port: getRequiredEnvInt('VIBE_CODER_PORT'),
    claudeConfigPath: getRequiredEnv('VIBE_CODER_CLAUDE_PATH'),
    signalingUrl: getRequiredEnv('VIBE_CODER_SIGNALING_URL'),
    sessionSecret: getOrCreateSessionSecret(),
    totpSecret: getOrCreateTotpSecret(),
    maxConcurrentSessions: 10,
    commandTimeout: 30000,
    enableSecurity: true,
    logLevel: 'info' as const,
    hostId: getOrCreateHostId(), // 永続化されたHost ID
  };
}

export const hostConfig = createDefaultConfig();

// No environment variable helpers needed anymore - everything uses defaults