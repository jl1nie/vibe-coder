import { HostConfig } from '../types';
import { generateSessionSecret } from './security';
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

function createDefaultConfig(): HostConfig {
  return {
    port: 8080,
    claudeConfigPath: '/app/.claude',
    signalingUrl: 'https://vibe-coder.space/api/signal',
    sessionSecret: getOrCreateSessionSecret(),
    maxConcurrentSessions: 10,
    commandTimeout: 30000,
    enableSecurity: true,
    logLevel: 'info' as const,
    hostId: '', // SessionManager で生成される
  };
}

export const hostConfig = createDefaultConfig();

// No environment variable helpers needed anymore - everything uses defaults