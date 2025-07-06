import { config } from 'dotenv';
import { z } from 'zod';
import { HostConfig } from '../types';
import path from 'path';

// Load environment variables from project root  
// Try multiple possible .env locations
const possibleEnvPaths = [
  path.resolve(process.cwd(), '../../.env'), // from host package
  path.resolve(__dirname, '../../../../.env'), // from compiled dist
  path.resolve(process.cwd(), '.env'), // from current directory
];

for (const envPath of possibleEnvPaths) {
  try {
    require('fs').accessSync(envPath);
    config({ path: envPath });
    console.log(`Using .env file: ${envPath}`);
    break;
  } catch (e) {
    // Continue to next path
  }
}

const ConfigSchema = z.object({
  PORT: z.string().default('8080'),
  SIGNALING_SERVER_URL: z.string().url().default('https://vibe-coder.space/api/signal'),
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  MAX_CONCURRENT_SESSIONS: z.string().default('10'),
  COMMAND_TIMEOUT: z.string().default('30000'),
  ENABLE_SECURITY: z.string().default('true'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  CLAUDE_CONFIG_PATH: z.string().default('/app/.claude'),
});

function validateConfig(): HostConfig {
  try {
    const env = ConfigSchema.parse(process.env);
    
    return {
      port: parseInt(env.PORT, 10),
      claudeConfigPath: env.CLAUDE_CONFIG_PATH,
      signalingUrl: env.SIGNALING_SERVER_URL,
      sessionSecret: env.SESSION_SECRET,
      maxConcurrentSessions: parseInt(env.MAX_CONCURRENT_SESSIONS, 10),
      commandTimeout: parseInt(env.COMMAND_TIMEOUT, 10),
      enableSecurity: env.ENABLE_SECURITY === 'true',
      logLevel: env.LOG_LEVEL,
      hostId: '', // SessionManager で生成される
    };
  } catch (error) {
    console.error('Configuration validation failed:', error);
    process.exit(1);
  }
}

export const hostConfig = validateConfig();

export function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

export function getOptionalEnvVar(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}