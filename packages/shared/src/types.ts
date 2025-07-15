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
  candidate: z.any(), // RTCIceCandidateInit オブジェクト形式
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

// 統一WebSocketシグナリング型定義
export const WebSocketSignalMessageSchema = z.object({
  type: z.enum([
    'register-host', 'session-create', 'session-join', 'session-leave', 
    'join-session', 'leave-session',
    'offer', 'answer', 'ice-candidate',
    'peer-connected', 'peer-disconnected', 'error', 'heartbeat'
  ]),
  sessionId: z.string(),
  clientId: z.string(), // PWA or Host identifier
  offer: z.any().optional(), // RTCSessionDescriptionInit
  answer: z.any().optional(), // RTCSessionDescriptionInit
  candidate: z.any().optional(), // RTCIceCandidateInit
  timestamp: z.number(),
  messageId: z.string().optional(),
  error: z.string().optional(),
});

export const WebSocketSignalResponseSchema = z.object({
  type: z.enum([
    'session-created', 'session-joined', 'session-left',
    'offer-received', 'answer-received', 'candidate-received',
    'peer-connected', 'peer-disconnected', 'error', 'success'
  ]),
  sessionId: z.string(),
  clientId: z.string().optional(),
  offer: z.any().optional(),
  answer: z.any().optional(),
  candidate: z.any().optional(),
  timestamp: z.number(),
  messageId: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const SessionInfoSchema = z.object({
  sessionId: z.string(),
  hostId: z.string(),
  status: z.enum(['waiting', 'connected', 'disconnected']),
  createdAt: z.number(),
  connectedClients: z.number(),
});

// 統一WebSocketメッセージインターフェース
export interface WebSocketSignalMessage {
  type: 'register-host' | 'session-create' | 'session-join' | 'session-leave' |
        'join-session' | 'leave-session' |
        'offer' | 'answer' | 'ice-candidate' |
        'peer-connected' | 'peer-disconnected' | 'error' | 'heartbeat';
  sessionId: string;
  clientId: string; // PWA or Host identifier
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: any; // ICE候補は文字列またはオブジェクト形式
  timestamp: number;
  messageId?: string;
  error?: string;
}

export interface WebSocketSignalResponse {
  type: 'session-created' | 'session-joined' | 'session-left' |
        'offer-received' | 'answer-received' | 'candidate-received' |
        'offer' | 'answer' | 'ice-candidate' |
        'peer-connected' | 'peer-disconnected' | 'error' | 'success';
  sessionId: string;
  clientId?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: any; // ICE候補は文字列またはオブジェクト形式
  timestamp: number;
  messageId?: string;
  message?: string;
  error?: string;
}

// 旧型定義（後方互換性のため暫定保持）
export const SignalMessageSchema = z.object({
  type: z.enum(['create-session', 'offer', 'answer', 'get-offer', 'get-answer', 'candidate', 'get-candidate']),
  sessionId: z.string(),
  hostId: z.string(),
  offer: WebRTCOfferSchema.optional(),
  answer: WebRTCAnswerSchema.optional(),
  candidate: z.any().optional(),
});

export const SignalResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  offer: WebRTCOfferSchema.optional(),
  answer: WebRTCAnswerSchema.optional(),
  candidates: z.array(WebRTCIceCandidateSchema).optional(),
});

export interface SignalMessage {
  type: 'create-session' | 'offer' | 'answer' | 'get-offer' | 'get-answer' | 'candidate' | 'get-candidate';
  sessionId: string;
  hostId: string;
  clientId?: string; // PWA client identifier
  offer?: WebRTCOffer;
  answer?: WebRTCAnswer;
  candidate?: any;
}

export interface SignalResponse {
  success: boolean;
  message?: string;
  offer?: WebRTCOffer;
  answer?: WebRTCAnswer;
  candidates?: WebRTCIceCandidate[];
}
export type SessionInfo = z.infer<typeof SessionInfoSchema>;