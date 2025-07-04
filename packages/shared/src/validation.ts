import { z } from 'zod';

export const CommandSchema = z.object({
  id: z.string().uuid(),
  icon: z.string().min(1),
  label: z.string().min(1).max(100),
  description: z.string().max(500),
  command: z.string().min(1).max(1000),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isCustom: z.boolean().optional(),
});

export const PlaylistSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  author: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  commands: z.array(CommandSchema).max(50),
  tags: z.array(z.string()).max(10),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  downloadCount: z.number().int().min(0).optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const PlaylistFileSchema = z.object({
  schema: z.literal('vibe-coder-playlist-v1'),
  metadata: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    author: z.string().min(1).max(100),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    tags: z.array(z.string()).max(10),
  }),
  commands: z.array(CommandSchema).max(50),
});

export const WebRTCSignalMessageSchema = z.object({
  type: z.enum(['offer', 'answer', 'ice-candidate', 'close']),
  serverId: z.string().min(1),
  clientId: z.string().min(1),
  data: z.any(),
  timestamp: z.number().int().positive(),
});

export const ClaudeSessionSchema = z.object({
  id: z.string().uuid(),
  workspaceDir: z.string().min(1),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  lastActivity: z.string().datetime(),
  commands: z.array(z.object({
    id: z.string().uuid(),
    command: z.string().min(1),
    output: z.string(),
    exitCode: z.number().int(),
    timestamp: z.string().datetime(),
    duration: z.number().int().min(0),
  })),
});

export const TerminalOutputSchema = z.object({
  type: z.enum(['stdout', 'stderr', 'exit', 'error']),
  data: z.string(),
  timestamp: z.number().int().positive(),
  sessionId: z.string().uuid(),
});

export const HostConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  capabilities: z.array(z.string()),
  maxSessions: z.number().int().min(1).max(10),
  workspaceDir: z.string().min(1),
  signalServerUrl: z.string().url(),
});

export const ClientConfigSchema = z.object({
  serverUrl: z.string().url(),
  retryAttempts: z.number().int().min(1).max(10),
  timeout: z.number().int().min(1000).max(60000),
  enableVoiceRecognition: z.boolean(),
  preferredLanguage: z.string().min(2).max(5),
});

export const validateCommand = (command: unknown): command is z.infer<typeof CommandSchema> => {
  try {
    CommandSchema.parse(command);
    return true;
  } catch {
    return false;
  }
};

export const validatePlaylist = (playlist: unknown): playlist is z.infer<typeof PlaylistSchema> => {
  try {
    PlaylistSchema.parse(playlist);
    return true;
  } catch {
    return false;
  }
};

export const validatePlaylistFile = (
  playlistFile: unknown
): playlistFile is z.infer<typeof PlaylistFileSchema> => {
  try {
    PlaylistFileSchema.parse(playlistFile);
    return true;
  } catch {
    return false;
  }
};

export const validateWebRTCSignalMessage = (
  message: unknown
): message is z.infer<typeof WebRTCSignalMessageSchema> => {
  try {
    WebRTCSignalMessageSchema.parse(message);
    return true;
  } catch {
    return false;
  }
};

export const validateHostConfig = (
  config: unknown
): config is z.infer<typeof HostConfigSchema> => {
  try {
    HostConfigSchema.parse(config);
    return true;
  } catch {
    return false;
  }
};

export const validateClientConfig = (
  config: unknown
): config is z.infer<typeof ClientConfigSchema> => {
  try {
    ClientConfigSchema.parse(config);
    return true;
  } catch {
    return false;
  }
};