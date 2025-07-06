import { z } from 'zod';

export const PlaylistCommandSchema = z.object({
  icon: z.string(),
  label: z.string(),
  command: z.string(),
  description: z.string().optional(),
});

export const PlaylistMetadataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  author: z.string(),
  version: z.string(),
  tags: z.array(z.string()).optional(),
});

export const PlaylistSchema = z.object({
  schema: z.literal('vibe-coder-playlist-v1'),
  metadata: PlaylistMetadataSchema,
  commands: z.array(PlaylistCommandSchema),
});

export const SessionSchema = z.object({
  id: z.string(),
  hostId: z.string(),
  clientId: z.string().optional(),
  status: z.enum(['pending', 'connecting', 'connected', 'disconnected']),
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date(),
});

export const WebRTCOfferSchema = z.object({
  type: z.literal('offer'),
  sessionId: z.string().optional(),
  sdp: z.string(),
  timestamp: z.number().optional(),
});

export const WebRTCAnswerSchema = z.object({
  type: z.literal('answer'),
  sessionId: z.string().optional(),
  sdp: z.string(),
  timestamp: z.number().optional(),
});

export const WebRTCIceCandidateSchema = z.object({
  sessionId: z.string(),
  candidate: z.string(),
  timestamp: z.number(),
});

export const CommandExecutionSchema = z.object({
  command: z.string(),
  timestamp: z.number(),
  sessionId: z.string(),
});

export const CommandResponseSchema = z.object({
  id: z.string(),
  output: z.string(),
  error: z.string().optional(),
  exitCode: z.number().optional(),
  timestamp: z.number(),
});

export const AuthRequestSchema = z.object({
  sessionId: z.string(),
  totpCode: z.string(),
  timestamp: z.number(),
});

export const AuthResponseSchema = z.object({
  sessionId: z.string(),
  success: z.boolean(),
  token: z.string().optional(),
  timestamp: z.number(),
});

export type PlaylistCommand = z.infer<typeof PlaylistCommandSchema>;
export type PlaylistMetadata = z.infer<typeof PlaylistMetadataSchema>;
export type Playlist = z.infer<typeof PlaylistSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type WebRTCOffer = z.infer<typeof WebRTCOfferSchema>;
export type WebRTCAnswer = z.infer<typeof WebRTCAnswerSchema>;
export type WebRTCIceCandidate = z.infer<typeof WebRTCIceCandidateSchema>;
export type CommandExecution = z.infer<typeof CommandExecutionSchema>;
export type CommandResponse = z.infer<typeof CommandResponseSchema>;
export type AuthRequest = z.infer<typeof AuthRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export interface VoiceRecognitionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
}

export interface TerminalOutput {
  id: string;
  type: 'command' | 'success' | 'error' | 'info' | 'system' | 'prompt';
  text: string;
  timestamp: Date;
}

export interface ConnectionStatus {
  isConnected: boolean;
  sessionId?: string;
  lastPing?: Date;
  rtcState?: RTCPeerConnectionState;
}

export interface HostInfo {
  id: string;
  version: string;
  status: 'online' | 'offline' | 'connecting';
  capabilities: string[];
  createdAt: Date;
}

// シグナリングサーバー用の型定義
export const SignalMessageSchema = z.object({
  type: z.enum(['create-session', 'offer', 'answer', 'get-offer', 'get-answer', 'candidate', 'get-candidate']),
  sessionId: z.string(),
  hostId: z.string(),
  offer: WebRTCOfferSchema.optional(),
  answer: WebRTCAnswerSchema.optional(),
  candidate: z.any().optional(), // RTCIceCandidateInit is not directly available in Zod
});

export const SignalResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  offer: WebRTCOfferSchema.optional(),
  answer: WebRTCAnswerSchema.optional(),
  candidates: z.array(WebRTCIceCandidateSchema).optional(), // 追加
});

export const SessionInfoSchema = z.object({
  sessionId: z.string(),
  hostId: z.string(),
  status: z.enum(['waiting', 'connected', 'disconnected']),
  createdAt: z.number(),
  connectedClients: z.number(),
});

export const SessionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  sessionInfo: SessionInfoSchema.optional(),
});

export interface SignalMessage {
  type: 'create-session' | 'offer' | 'answer' | 'get-offer' | 'get-answer' | 'candidate' | 'get-candidate';
  sessionId: string;
  hostId: string;
  offer?: WebRTCOffer;
  answer?: WebRTCAnswer;
  candidate?: any; // RTCIceCandidateInit
}

export interface SignalResponse {
  success: boolean;
  message?: string;
  offer?: WebRTCOffer;
  answer?: WebRTCAnswer;
  candidates?: WebRTCIceCandidate[];
}
export type SessionInfo = z.infer<typeof SessionInfoSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;