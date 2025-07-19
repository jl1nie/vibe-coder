import { SignalingSession, ClientConnection, SignalingServerConfig, RTCSessionDescriptionInit, RTCIceCandidateInit } from './types';

interface AuthSession {
  sessionId: string;
  clientId: string;
  hostId: string;
  createdAt: number;
}

export class SessionManager {
  private sessions = new Map<string, SignalingSession>();
  private clients = new Map<string, ClientConnection>();
  private authSessions = new Map<string, AuthSession>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private config: SignalingServerConfig) {
    this.startCleanupTimer();
  }

  /**
   * Create a new signaling session
   */
  createSession(sessionId: string, hostId: string): SignalingSession {
    const session: SignalingSession = {
      sessionId,
      hostId,
      clients: new Set(),
      offers: new Map(),
      answers: new Map(),
      candidates: new Map(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, session);
    console.log(`[SessionManager] Session created: ${sessionId} for host ${hostId}`);
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SignalingSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session activity timestamp
   */
  updateSessionActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      this.sessions.set(sessionId, session);
    }
  }

  /**
   * Add client to session
   */
  joinSession(sessionId: string, clientId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[SessionManager] Session not found: ${sessionId}`);
      return false;
    }

    session.clients.add(clientId);
    this.updateSessionActivity(sessionId);
    console.log(`[SessionManager] Client ${clientId} joined session ${sessionId}`);
    return true;
  }

  /**
   * Remove client from session
   */
  leaveSession(sessionId: string, clientId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.clients.delete(clientId);
    session.offers.delete(clientId);
    session.answers.delete(clientId);
    session.candidates.delete(clientId);

    // Remove session if no clients remain
    if (session.clients.size === 0) {
      this.sessions.delete(sessionId);
      console.log(`[SessionManager] Session ${sessionId} removed (no clients)`);
    } else {
      this.updateSessionActivity(sessionId);
      console.log(`[SessionManager] Client ${clientId} left session ${sessionId}`);
    }
  }

  /**
   * Store offer for a client
   */
  storeOffer(sessionId: string, clientId: string, offer: RTCSessionDescriptionInit): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.offers.set(clientId, offer);
    this.updateSessionActivity(sessionId);
    console.log(`[SessionManager] Offer stored for client ${clientId} in session ${sessionId}`);
    return true;
  }

  /**
   * Get offer for a client
   */
  getOffer(sessionId: string, clientId: string): RTCSessionDescriptionInit | undefined {
    const session = this.sessions.get(sessionId);
    return session?.offers.get(clientId);
  }

  /**
   * Store answer for a client
   */
  storeAnswer(sessionId: string, clientId: string, answer: RTCSessionDescriptionInit): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.answers.set(clientId, answer);
    this.updateSessionActivity(sessionId);
    console.log(`[SessionManager] Answer stored for client ${clientId} in session ${sessionId}`);
    return true;
  }

  /**
   * Get answer for a client
   */
  getAnswer(sessionId: string, clientId: string): RTCSessionDescriptionInit | undefined {
    const session = this.sessions.get(sessionId);
    return session?.answers.get(clientId);
  }

  /**
   * Store ICE candidate for a client
   */
  storeCandidate(sessionId: string, clientId: string, candidate: RTCIceCandidateInit): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (!session.candidates.has(clientId)) {
      session.candidates.set(clientId, []);
    }
    session.candidates.get(clientId)!.push(candidate);
    this.updateSessionActivity(sessionId);
    console.log(`[SessionManager] ICE candidate stored for client ${clientId} in session ${sessionId}`);
    return true;
  }

  /**
   * Get ICE candidates for other clients in the session
   */
  getCandidatesForClient(sessionId: string, excludeClientId: string): RTCIceCandidateInit[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const candidates: RTCIceCandidateInit[] = [];
    for (const [clientId, clientCandidates] of session.candidates) {
      if (clientId !== excludeClientId) {
        candidates.push(...clientCandidates);
      }
    }
    return candidates;
  }

  /**
   * Register a client connection
   */
  registerClient(clientId: string, ws: any, isHost: boolean): void {
    const client: ClientConnection = {
      clientId,
      isHost,
      ws,
      lastPing: Date.now(),
      connectedAt: Date.now(),
    };

    this.clients.set(clientId, client);
    console.log(`[SessionManager] Client registered: ${clientId} (host: ${isHost}, ws.readyState: ${ws.readyState})`);
  }

  /**
   * Update client session
   */
  updateClientSession(clientId: string, sessionId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.sessionId = sessionId;
      this.clients.set(clientId, client);
    }
  }

  /**
   * Update client ping timestamp
   */
  updateClientPing(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = Date.now();
      this.clients.set(clientId, client);
    }
  }

  /**
   * Remove client connection
   */
  unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client && client.sessionId) {
      this.leaveSession(client.sessionId, clientId);
    }
    this.clients.delete(clientId);
    console.log(`[SessionManager] Client unregistered: ${clientId}`);
  }

  /**
   * Get client connection
   */
  getClient(clientId: string): ClientConnection | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get all clients in a session
   */
  getClientsInSession(sessionId: string): ClientConnection[] {
    const clients: ClientConnection[] = [];
    for (const client of this.clients.values()) {
      if (client.sessionId === sessionId) {
        clients.push(client);
      }
    }
    return clients;
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: any): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(`[SessionManager] Cannot send message to client ${clientId} (client not found)`);
      return false;
    }
    
    // Check WebSocket state with detailed logging
    if (client.ws.readyState !== 1) { // WebSocket.OPEN = 1
      // For integration tests, just log the warning and continue
      // Don't fail the operation since this often happens during test cleanup
      if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
        console.debug(`[SessionManager] WebSocket not open for client ${clientId} (state: ${client.ws.readyState})`);
      } else {
        console.warn(`[SessionManager] Cannot send message to client ${clientId} (WebSocket state: ${client.ws.readyState}, expected: 1)`);
      }
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`[SessionManager] Failed to send message to client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Send message to all clients in a session except sender
   */
  broadcastToSession(sessionId: string, message: any, excludeClientId?: string): void {
    const clients = this.getClientsInSession(sessionId);
    for (const client of clients) {
      if (!excludeClientId || client.clientId !== excludeClientId) {
        this.sendToClient(client.clientId, message);
      }
    }
  }

  /**
   * Get session statistics
   */
  getStats(): {
    sessions: number;
    clients: number;
    activeSessions: number;
    activeClients: number;
  } {
    const now = Date.now();
    const activeThreshold = this.config.clientTimeout;

    let activeSessions = 0;
    let activeClients = 0;

    for (const session of this.sessions.values()) {
      if (now - session.lastActivity < this.config.sessionTimeout) {
        activeSessions++;
      }
    }

    for (const client of this.clients.values()) {
      if (now - client.lastPing < activeThreshold) {
        activeClients++;
      }
    }

    return {
      sessions: this.sessions.size,
      clients: this.clients.size,
      activeSessions,
      activeClients,
    };
  }

  /**
   * Start cleanup timer for expired sessions and clients
   */
  private startCleanupTimer(): void {
    const cleanupInterval = Math.min(this.config.sessionTimeout, this.config.clientTimeout) / 2;
    
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupInterval);

    console.log(`[SessionManager] Cleanup timer started (interval: ${cleanupInterval}ms)`);
  }

  /**
   * Clean up expired sessions and clients
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedSessions = 0;
    let cleanedClients = 0;

    // Clean up expired sessions
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity > this.config.sessionTimeout) {
        this.sessions.delete(sessionId);
        cleanedSessions++;
        console.log(`[SessionManager] Cleaned up expired session: ${sessionId}`);
      }
    }

    // Clean up inactive clients
    for (const [clientId, client] of this.clients) {
      if (now - client.lastPing > this.config.clientTimeout) {
        this.unregisterClient(clientId);
        cleanedClients++;
        console.log(`[SessionManager] Cleaned up inactive client: ${clientId}`);
      }
    }

    if (cleanedSessions > 0 || cleanedClients > 0) {
      console.log(`[SessionManager] Cleanup completed: ${cleanedSessions} sessions, ${cleanedClients} clients removed`);
    }

    // Clean up expired auth sessions
    for (const [sessionId, authSession] of this.authSessions) {
      if (now - authSession.createdAt > 300000) { // 5 minutes timeout
        this.authSessions.delete(sessionId);
        console.log(`[SessionManager] Cleaned up expired auth session: ${sessionId}`);
      }
    }
  }

  /**
   * Store authentication session
   */
  storeAuthSession(sessionId: string, clientId: string, hostId: string): void {
    const authSession: AuthSession = {
      sessionId,
      clientId,
      hostId,
      createdAt: Date.now()
    };
    
    this.authSessions.set(sessionId, authSession);
    console.log(`[SessionManager] Auth session stored: ${sessionId} for client ${clientId}`);
  }

  /**
   * Get authentication session
   */
  getAuthSession(sessionId: string): AuthSession | undefined {
    return this.authSessions.get(sessionId);
  }

  /**
   * Remove authentication session
   */
  removeAuthSession(sessionId: string): void {
    this.authSessions.delete(sessionId);
    console.log(`[SessionManager] Auth session removed: ${sessionId}`);
  }

  /**
   * Get host clients
   */
  getHostClients(): Map<string, ClientConnection> {
    const hostClients = new Map<string, ClientConnection>();
    for (const [clientId, client] of this.clients) {
      if (client.isHost) {
        hostClients.set(clientId, client);
      }
    }
    return hostClients;
  }

  /**
   * Find host session by hostId (シンプルプロトコル用)
   */
  findHostSession(hostId: string): ClientConnection | undefined {
    for (const client of this.clients.values()) {
      if (client.hostId === hostId && client.isHost) {
        return client;
      }
    }
    return undefined;
  }

  /**
   * Find client by sessionId (シンプルプロトコル用)
   */
  findClientBySession(sessionId: string): ClientConnection | undefined {
    for (const client of this.clients.values()) {
      if (client.sessionId === sessionId) {
        return client;
      }
    }
    return undefined;
  }

  /**
   * Find host client by sessionId (シンプルプロトコル用)
   */
  findHostBySession(sessionId: string): ClientConnection | undefined {
    for (const client of this.clients.values()) {
      if (client.sessionId === sessionId && client.isHost) {
        return client;
      }
    }
    return undefined;
  }

  /**
   * Send message with error handling (シンプルプロトコル用)
   */
  sendMessage(clientId: string, message: any): boolean {
    return this.sendToClient(clientId, message);
  }

  /**
   * Set hostId for client (シンプルプロトコル用)
   */
  setHostId(clientId: string, hostId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.hostId = hostId;
      this.clients.set(clientId, client);
    }
  }

  /**
   * Stop cleanup timer and clear all data
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.sessions.clear();
    this.clients.clear();
    console.log('[SessionManager] Destroyed');
  }
}