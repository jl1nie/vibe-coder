import { HostConfig } from '../types';
import { generateSessionSecret } from './security';
import { generateHostId } from '../../../shared/src';
import speakeasy from 'speakeasy';
import path from 'path';
import fs from 'fs';

// Simplified configuration - no environment variables needed
// Everything uses sensible defaults

function getOrCreateSessionSecret(): string {
  // Look for saved session secret in project root
  const projectRoot = path.resolve(__dirname, '../../../../..');
  const secretPath = path.resolve(projectRoot, '.session-secret');
  const fallbackSecretPath = path.resolve(process.cwd(), '.session-secret');
  
  for (const secretFile of [secretPath, fallbackSecretPath]) {
    try {
      if (fs.existsSync(secretFile)) {
        const savedSecret = fs.readFileSync(secretFile, 'utf8').trim();
        if (savedSecret.length >= 32) {
          console.log(`Using saved session secret`);
          return savedSecret;
        }
      }
    } catch (error) {
      // Continue to next path or generate new secret
    }
  }

  // Generate new session secret
  const newSecret = generateSessionSecret();
  
  // Try to save to project root first, fallback to current directory
  for (const secretFile of [secretPath, fallbackSecretPath]) {
    try {
      fs.writeFileSync(secretFile, newSecret, { mode: 0o600 }); // Secure file permissions
      console.log(`Generated and saved new session secret`);
      return newSecret;
    } catch (error) {
      console.warn(`Failed to save session secret:`, (error as Error).message);
      continue;
    }
  }

  // If we can't save to file, use in-memory (warn user)
  console.warn('Warning: Could not save session secret to file. Using in-memory secret (sessions will not persist across restarts)');
  return newSecret;
}

function getOrCreateTotpSecret(): string {
  // Look for saved TOTP secret in project root
  const projectRoot = path.resolve(__dirname, '../../../../..');
  const secretPath = path.resolve(projectRoot, '.totp-secret');
  const fallbackSecretPath = path.resolve(process.cwd(), '.totp-secret');
  
  for (const secretFile of [secretPath, fallbackSecretPath]) {
    try {
      if (fs.existsSync(secretFile)) {
        const savedSecret = fs.readFileSync(secretFile, 'utf8').trim();
        if (savedSecret.length >= 16) {
          console.log(`Using saved TOTP secret`);
          return savedSecret;
        }
      }
    } catch (error) {
      // Continue to next path or generate new secret
    }
  }

  // Generate new TOTP secret (using speakeasy for consistency)
  const secret = speakeasy.generateSecret({
    name: 'Vibe Coder Host',
    issuer: 'Vibe Coder',
    length: 32,
  });
  
  const newSecret = secret.base32!;
  
  // Try to save to project root first, fallback to current directory
  for (const secretFile of [secretPath, fallbackSecretPath]) {
    try {
      fs.writeFileSync(secretFile, newSecret, { mode: 0o600 }); // Secure file permissions
      console.log(`Generated and saved new TOTP secret`);
      return newSecret;
    } catch (error) {
      console.warn(`Failed to save TOTP secret:`, (error as Error).message);
      continue;
    }
  }

  // If we can't save to file, use in-memory (warn user)
  console.warn('Warning: Could not save TOTP secret to file. TOTP will regenerate on restart');
  return newSecret;
}

function getOrCreateHostId(): string {
  // Look for saved Host ID in project root
  const projectRoot = path.resolve(__dirname, '../../../../..');
  const hostIdPath = path.resolve(projectRoot, '.host-id');
  const fallbackHostIdPath = path.resolve(process.cwd(), '.host-id');
  
  for (const hostIdFile of [hostIdPath, fallbackHostIdPath]) {
    try {
      if (fs.existsSync(hostIdFile)) {
        const savedHostId = fs.readFileSync(hostIdFile, 'utf8').trim();
        if (savedHostId.length === 8 && /^\d{8}$/.test(savedHostId)) {
          console.log(`Using saved Host ID: ${savedHostId}`);
          return savedHostId;
        }
      }
    } catch (error) {
      // Continue to next path or generate new host ID
    }
  }

  // Generate new Host ID
  const newHostId = generateHostId();
  
  // Try to save to project root first, fallback to current directory
  for (const hostIdFile of [hostIdPath, fallbackHostIdPath]) {
    try {
      fs.writeFileSync(hostIdFile, newHostId, { mode: 0o600 }); // Secure file permissions
      console.log(`Generated and saved new Host ID: ${newHostId}`);
      return newHostId;
    } catch (error) {
      console.warn(`Failed to save Host ID:`, (error as Error).message);
      continue;
    }
  }

  // If we can't save to file, use in-memory (warn user)
  console.warn('Warning: Could not save Host ID to file. Host ID will regenerate on restart');
  return newHostId;
}

function createDefaultConfig(): HostConfig {
  return {
    port: 8080,
    claudeConfigPath: '/app/.claude',
    signalingUrl: 'https://vibe-coder.space/api/signal',
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