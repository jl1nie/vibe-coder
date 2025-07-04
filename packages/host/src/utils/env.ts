import { z } from 'zod';

// 環境変数のスキーマ定義
const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().default('0.0.0.0'),
  WEBRTC_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  
  // Claude API設定
  CLAUDE_API_KEY: z.string().min(1).optional(),
  CLAUDE_API_URL: z.string().url().default('https://api.anthropic.com'),
  CLAUDE_MODEL: z.string().default('claude-3-sonnet-20240229'),
  CLAUDE_MAX_TOKENS: z.coerce.number().int().min(1).max(100000).default(4096),
  
  // ワークスペース設定
  WORKSPACE_DIR: z.string().default('./workspace'),
  MAX_WORKSPACE_SIZE: z.coerce.number().int().min(1).default(1024 * 1024 * 1024), // 1GB
  ALLOWED_FILE_EXTENSIONS: z.string().default('.js,.ts,.jsx,.tsx,.py,.java,.go,.rs,.cpp,.c,.h,.css,.html,.md,.json,.yaml,.yml,.toml,.sql,.sh,.dockerfile'),
  
  // セキュリティ設定
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(15 * 60 * 1000), // 15分
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(100),
  MAX_COMMAND_LENGTH: z.coerce.number().int().min(1).max(10000).default(2000),
  COMMAND_TIMEOUT_MS: z.coerce.number().int().min(1000).default(120000), // 2分
  
  // WebRTC設定
  ICE_SERVERS: z.string().default(JSON.stringify([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ])),
  SIGNALING_SERVER_URL: z.string().url().optional(),
  
  // ログ設定
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),
  LOG_FILE_PATH: z.string().optional(),
  
  // CORS設定
  CORS_ORIGINS: z.string().default('http://localhost:3000,https://vibe-coder.space'),
  
  // その他
  SESSION_CLEANUP_INTERVAL_MS: z.coerce.number().int().min(60000).default(5 * 60 * 1000), // 5分
  MAX_CONCURRENT_SESSIONS: z.coerce.number().int().min(1).default(10),
  HEALTH_CHECK_INTERVAL_MS: z.coerce.number().int().min(1000).default(30000), // 30秒
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(): Environment {
  try {
    const env = environmentSchema.parse(process.env);
    
    // 追加的な検証
    validateAdditionalConstraints(env);
    
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join('\n');
      
      throw new Error(`Environment validation failed:\n${formattedErrors}`);
    }
    throw error;
  }
}

function validateAdditionalConstraints(env: Environment): void {
  // ポートの重複チェック
  if (env.WEBRTC_PORT && env.WEBRTC_PORT === env.PORT) {
    throw new Error('WEBRTC_PORT cannot be the same as PORT');
  }
  
  // 本番環境での必須設定チェック
  if (env.NODE_ENV === 'production') {
    if (!env.CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY is required in production');
    }
    
    if (env.LOG_LEVEL === 'debug') {
      console.warn('⚠️  DEBUG log level is not recommended for production');
    }
  }
  
  // CORS Origins の検証
  try {
    const origins = env.CORS_ORIGINS.split(',').map(origin => origin.trim());
    origins.forEach(origin => {
      if (origin !== '*' && !isValidOrigin(origin)) {
        throw new Error(`Invalid CORS origin: ${origin}`);
      }
    });
  } catch (error) {
    throw new Error(`Invalid CORS_ORIGINS format: ${error.message}`);
  }
  
  // ICE Servers の検証
  try {
    const iceServers = JSON.parse(env.ICE_SERVERS);
    if (!Array.isArray(iceServers)) {
      throw new Error('ICE_SERVERS must be an array');
    }
    
    iceServers.forEach((server, index) => {
      if (!server.urls) {
        throw new Error(`ICE server at index ${index} missing 'urls' field`);
      }
    });
  } catch (error) {
    throw new Error(`Invalid ICE_SERVERS format: ${error.message}`);
  }
}

function isValidOrigin(origin: string): boolean {
  try {
    // localhost の場合
    if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
      return true;
    }
    
    // 正規のURL形式
    new URL(origin);
    return true;
  } catch {
    return false;
  }
}

// 環境変数の表示用（機密情報をマスク）
export function getDisplayableEnvironment(env: Environment): Record<string, any> {
  const displayEnv = { ...env };
  
  // 機密情報をマスク
  if (displayEnv.CLAUDE_API_KEY) {
    displayEnv.CLAUDE_API_KEY = '***' + displayEnv.CLAUDE_API_KEY.slice(-4);
  }
  
  return displayEnv;
}

// デフォルト値の取得
export function getDefaultEnvironment(): Partial<Environment> {
  return {
    NODE_ENV: 'development',
    PORT: 8080,
    HOST: '0.0.0.0',
    CLAUDE_API_URL: 'https://api.anthropic.com',
    CLAUDE_MODEL: 'claude-3-sonnet-20240229',
    CLAUDE_MAX_TOKENS: 4096,
    WORKSPACE_DIR: './workspace',
    MAX_WORKSPACE_SIZE: 1024 * 1024 * 1024,
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    MAX_COMMAND_LENGTH: 2000,
    COMMAND_TIMEOUT_MS: 120000,
    LOG_LEVEL: 'info',
    LOG_FORMAT: 'pretty',
    CORS_ORIGINS: 'http://localhost:3000,https://vibe-coder.space',
    SESSION_CLEANUP_INTERVAL_MS: 5 * 60 * 1000,
    MAX_CONCURRENT_SESSIONS: 10,
    HEALTH_CHECK_INTERVAL_MS: 30000,
  };
}