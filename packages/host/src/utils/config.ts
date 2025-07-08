import fs from 'fs';
import path from 'path';
import speakeasy from 'speakeasy';
import { generateHostId } from '../../../shared/src';
import { HostConfig } from '../types';
import { generateSessionSecret } from './security';

// Simplified configuration - no environment variables needed
// Everything uses sensible defaults

function getOrCreateSessionSecret(): string {
  // テスト環境では固定値を使用
  if (process.env.NODE_ENV === 'test') {
    return 'test-session-secret-32-chars-long';
  }

  // Save session secret in workspace directory (user's current directory)
  const secretPath = path.resolve(process.env.NODE_ENV === 'development' ? process.cwd() : '/app/workspace', '.vibe-coder-session-secret');

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

  // Save TOTP secret in workspace directory (user's current directory)
  const secretPath = path.resolve(process.env.NODE_ENV === 'development' ? process.cwd() : '/app/workspace', '.vibe-coder-totp-secret');

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

  // Save Host ID in workspace directory (user's current directory)
  const hostIdPath = path.resolve(process.env.NODE_ENV === 'development' ? process.cwd() : '/app/workspace', '.vibe-coder-host-id');

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
  return {
    port: process.env.NODE_ENV === 'development' ? 8081 : (process.env.PORT ? parseInt(process.env.PORT) : 8080),
    claudeConfigPath: process.env.NODE_ENV === 'development' ? process.cwd() + '/.claude' : '/app/.claude',
    signalingUrl: process.env.NODE_ENV === 'development' ? 'http://localhost:5174/api/signal' : 'https://www.vibe-coder.space/api/signal',
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