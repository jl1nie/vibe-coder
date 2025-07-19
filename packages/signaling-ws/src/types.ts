export interface WebSocketMessage {
  type: string;
  timestamp: number;
  sessionId?: string;
  clientId?: string;
  hostId?: string;
}

export interface RegisterHostMessage extends WebSocketMessage {
  type: 'register-host';
  sessionId: string;
  hostId: string;
}

export interface JoinSessionMessage extends WebSocketMessage {
  type: 'join-session';
  sessionId: string;
  clientId: string;
}

export interface OfferMessage extends WebSocketMessage {
  type: 'offer';
  sessionId: string;
  clientId: string;
  offer: RTCSessionDescriptionInit;
}

export interface AnswerMessage extends WebSocketMessage {
  type: 'answer';
  sessionId: string;
  clientId: string;
  answer: RTCSessionDescriptionInit;
}

export interface IceCandidateMessage extends WebSocketMessage {
  type: 'ice-candidate';
  sessionId: string;
  clientId: string;
  candidate: RTCIceCandidateInit;
}

export interface HeartbeatMessage extends WebSocketMessage {
  type: 'heartbeat';
}

export interface HeartbeatAckMessage extends WebSocketMessage {
  type: 'heartbeat-ack';
}

export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  error: string;
  sessionId?: string;
}

export interface SuccessMessage extends WebSocketMessage {
  type: 'host-registered' | 'session-joined' | 'connected' | 'host-authenticated' | 'totp-required';
  sessionId?: string;
  clientId?: string;
  message?: string;
}

// Authentication Messages
export interface AuthenticateHostMessage extends WebSocketMessage {
  type: 'authenticate-host';
  hostId: string;
}

export interface VerifyTotpMessage extends WebSocketMessage {
  type: 'verify-totp';
  sessionId: string;
  totpCode: string;
}

export interface ConnectToHostMessage extends WebSocketMessage {
  type: 'connect-to-host';
  hostId: string;
}

export interface AuthSuccessMessage extends WebSocketMessage {
  type: 'auth-success';
  sessionId: string;
  message?: string;
}

export interface WebRTCOfferMessage extends WebSocketMessage {
  type: 'webrtc-offer';
  sessionId: string;
  offer: RTCSessionDescriptionInit;
}

export interface WebRTCAnswerMessage extends WebSocketMessage {
  type: 'webrtc-answer';
  sessionId: string;
  answer: RTCSessionDescriptionInit;
}

export type SignalingMessage = 
  | RegisterHostMessage
  | IceCandidateMessage
  | HeartbeatMessage
  | HeartbeatAckMessage
  | ErrorMessage
  | SuccessMessage
  | ConnectToHostMessage
  | VerifyTotpMessage
  | AuthSuccessMessage
  | WebRTCOfferMessage
  | WebRTCAnswerMessage;

export interface SignalingSession {
  sessionId: string;
  hostId: string;
  clients: Set<string>;
  offers: Map<string, RTCSessionDescriptionInit>;
  answers: Map<string, RTCSessionDescriptionInit>;
  candidates: Map<string, RTCIceCandidateInit[]>;
  createdAt: number;
  lastActivity: number;
}

export interface ClientConnection {
  clientId: string;
  sessionId?: string;
  hostId?: string;
  isHost: boolean;
  ws: any; // WebSocket instance
  lastPing: number;
  connectedAt: number;
}

// WebRTC types for Node.js environment
export interface RTCSessionDescriptionInit {
  type: 'answer' | 'offer' | 'pranswer' | 'rollback';
  sdp?: string;
}

export interface RTCIceCandidateInit {
  candidate?: string;
  sdpMLineIndex?: number;
  sdpMid?: string;
  usernameFragment?: string;
}

export interface SignalingServerConfig {
  port: number;
  host: string;
  heartbeatInterval: number;
  sessionTimeout: number;
  clientTimeout: number;
  corsOrigins: (string | RegExp)[];
}