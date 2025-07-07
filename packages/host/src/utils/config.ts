import { HostConfig } from '../types';
import { generateSessionSecret } from './security';
import { generateHostId } from '../../../shared/src';
import speakeasy from 'speakeasy';
import path from 'path';
import fs from 'fs';

// Simplified configuration - no environment variables needed
// Everything uses sensible defaults

function getOrCreateSessionSecret(): string {
  // Look for saved session secret in .claude directory (most user-friendly)
  const claudeConfigPath = process.env.CLAUDE_CONFIG_PATH || path.join(process.env.HOME || '~', '.claude');
  const sessionInClaude = path.join(claudeConfigPath, 'vibe-coder-session-secret');
  
  // Fallback paths
  const projectRoot = path.resolve(__dirname, '../../../../..');
  const secretPath = path.resolve(projectRoot, '.session-secret');
  const fallbackSecretPath = path.resolve(process.cwd(), '.session-secret');
  
  for (const secretFile of [sessionInClaude, secretPath, fallbackSecretPath]) {
    try {
      if (fs.existsSync(secretFile)) {
        const savedSecret = fs.readFileSync(secretFile, 'utf8').trim();
        if (savedSecret.length >= 32) {
          console.log(`Using saved session secret (from ${secretFile})`);
          return savedSecret;
        }
      }
    } catch (error) {
      // Continue to next path or generate new secret
    }
  }

  // Generate new session secret
  const newSecret = generateSessionSecret();
  
  // Try to save to .claude directory first (most user-friendly), then fallbacks
  for (const secretFile of [sessionInClaude, secretPath, fallbackSecretPath]) {
    try {
      // Ensure directory exists
      const dir = path.dirname(secretFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
      }
      
      fs.writeFileSync(secretFile, newSecret, { mode: 0o600 }); // Secure file permissions
      console.log(`Generated and saved new session secret (to ${secretFile})`);
      return newSecret;
    } catch (error) {
      console.warn(`Failed to save session secret to ${secretFile}:`, (error as Error).message);
      continue;
    }
  }

  // If we can't save to file, use in-memory (warn user)
  console.warn('Warning: Could not save session secret to file. Using in-memory secret (sessions will not persist across restarts)');
  return newSecret;
}

function getOrCreateTotpSecret(): string {
  // Look for saved TOTP secret in .claude directory (most user-friendly)
  const claudeConfigPath = process.env.CLAUDE_CONFIG_PATH || path.join(process.env.HOME || '~', '.claude');
  const totpInClaude = path.join(claudeConfigPath, 'vibe-coder-totp-secret');
  
  // Fallback paths
  const projectRoot = path.resolve(__dirname, '../../../../..');
  const secretPath = path.resolve(projectRoot, '.totp-secret');
  const fallbackSecretPath = path.resolve(process.cwd(), '.totp-secret');
  
  for (const secretFile of [totpInClaude, secretPath, fallbackSecretPath]) {
    try {
      if (fs.existsSync(secretFile)) {
        const savedSecret = fs.readFileSync(secretFile, 'utf8').trim();
        if (savedSecret.length >= 16) {
          console.log(`Using saved TOTP secret (from ${secretFile})`);
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
  
  // Try to save to .claude directory first (most user-friendly), then fallbacks
  for (const secretFile of [totpInClaude, secretPath, fallbackSecretPath]) {
    try {
      // Ensure directory exists
      const dir = path.dirname(secretFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
      }
      
      fs.writeFileSync(secretFile, newSecret, { mode: 0o600 }); // Secure file permissions
      console.log(`Generated and saved new TOTP secret (to ${secretFile})`);
      return newSecret;
    } catch (error) {
      console.warn(`Failed to save TOTP secret to ${secretFile}:`, (error as Error).message);
      continue;
    }
  }

  // If we can't save to file, use in-memory (warn user)
  console.warn('Warning: Could not save TOTP secret to file. TOTP will regenerate on restart');
  return newSecret;
}

function getOrCreateHostId(): string {
  // Look for saved Host ID in .claude directory (most user-friendly)
  const claudeConfigPath = process.env.CLAUDE_CONFIG_PATH || path.join(process.env.HOME || '~', '.claude');
  const hostIdInClaude = path.join(claudeConfigPath, 'vibe-coder-host-id');
  
  // Fallback paths
  const projectRoot = path.resolve(__dirname, '../../../../..');
  const hostIdPath = path.resolve(projectRoot, '.host-id');
  const fallbackHostIdPath = path.resolve(process.cwd(), '.host-id');
  
  for (const hostIdFile of [hostIdInClaude, hostIdPath, fallbackHostIdPath]) {
    try {
      if (fs.existsSync(hostIdFile)) {
        const savedHostId = fs.readFileSync(hostIdFile, 'utf8').trim();
        if (savedHostId.length === 8 && /^\d{8}$/.test(savedHostId)) {
          console.log(`Using saved Host ID: ${savedHostId} (from ${hostIdFile})`);
          return savedHostId;
        }
      }
    } catch (error) {
      // Continue to next path or generate new host ID
    }
  }

  // Generate new Host ID
  const newHostId = generateHostId();
  
  // Try to save to .claude directory first (most user-friendly), then fallbacks
  for (const hostIdFile of [hostIdInClaude, hostIdPath, fallbackHostIdPath]) {
    try {
      // Ensure directory exists
      const dir = path.dirname(hostIdFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
      }
      
      fs.writeFileSync(hostIdFile, newHostId, { mode: 0o600 }); // Secure file permissions
      console.log(`Generated and saved new Host ID: ${newHostId} (to ${hostIdFile})`);
      return newHostId;
    } catch (error) {
      console.warn(`Failed to save Host ID to ${hostIdFile}:`, (error as Error).message);
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