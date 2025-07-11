import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebRTCService } from '../services/webrtc-service';
import { SessionManager } from '../services/session-manager';
import { ClaudeService } from '../services/claude-service';
import { ClaudeInteractiveService } from '../services/claude-interactive-service';

// Mock Simple Peer
const mockPeer = {
  on: vi.fn(),
  signal: vi.fn(),
  send: vi.fn(),
  destroy: vi.fn(),
};

vi.mock('simple-peer', () => ({
  default: vi.fn(() => mockPeer),
}));

// Mock wrtc module for Node.js WebRTC support
vi.mock('wrtc', () => ({
  RTCPeerConnection: vi.fn(),
  RTCSessionDescription: vi.fn(),
  RTCIceCandidate: vi.fn(),
  RTCDataChannel: vi.fn(),
}));

// Mock ClaudeInteractiveService
vi.mock('../services/claude-interactive-service');

describe('WebRTC Claude Integration', () => {
  let webrtcService: WebRTCService;
  let sessionManager: SessionManager;
  let claudeService: ClaudeService;
  let mockDataHandler: (data: any) => void;
  let mockClaudeInteractiveService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    sessionManager = new SessionManager();
    claudeService = new ClaudeService();
    
    // Mock ClaudeInteractiveService
    mockClaudeInteractiveService = {
      getSession: vi.fn().mockReturnValue(null), // セッションが存在しない場合
      createSession: vi.fn().mockResolvedValue({
        isReady: true,
        onOutput: vi.fn(),
        onError: vi.fn(),
        onReady: vi.fn(),
      }),
      sendCommand: vi.fn().mockResolvedValue({
        output: 'Hello! I can help you with development tasks.',
        error: null,
        executionTime: 1500
      }),
    };
    
    vi.mocked(ClaudeInteractiveService).mockImplementation(() => mockClaudeInteractiveService);
    
    webrtcService = new WebRTCService(sessionManager, claudeService);

    // Capture the data handler for simulating messages
    mockPeer.on.mockImplementation((event: string, handler: any) => {
      if (event === 'data') {
        mockDataHandler = handler;
      }
    });
  });

  afterEach(() => {
    sessionManager.destroy();
    claudeService.destroy();
  });

  it('should handle WebRTC claude-command messages', async () => {
    // Mock session and Claude service response
    const mockSession = {
      isReady: true,
      onOutput: vi.fn(),
      onError: vi.fn(),
      onReady: vi.fn(),
    };
    
    mockClaudeInteractiveService.getSession.mockReturnValue(mockSession);
    mockClaudeInteractiveService.sendCommand.mockResolvedValue({
      success: true,
      output: 'Hello! I can help you with development tasks.',
      executionTime: 1000
    });

    // Create WebRTC connection
    const connection = await webrtcService.createConnection('TEST-SESSION');
    connection.isConnected = true;
    expect(connection).toBeDefined();
    expect(connection.sessionId).toBe('TEST-SESSION');

    // Simulate receiving a claude-command message
    const commandMessage = {
      type: 'claude-command',
      command: 'help me fix this bug',
      timestamp: Date.now(),
    };

    // Trigger data handler with command message
    if (mockDataHandler) {
      mockDataHandler(Buffer.from(JSON.stringify(commandMessage)));
    }

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify Claude Interactive service was called
    expect(mockClaudeInteractiveService.sendCommand).toHaveBeenCalledWith(
      'TEST-SESSION',
      'help me fix this bug'
    );

    // Verify peer received output message
    expect(mockPeer.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"output"')
    );

    // Verify peer received completion message  
    expect(mockPeer.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"completed"')
    );
  });

  it('should handle Claude service errors gracefully', async () => {
    // Mock Claude service error
    mockClaudeInteractiveService.sendCommand.mockRejectedValue(new Error('Claude execution failed'));
    
    const mockSession = {
      isReady: true,
      onOutput: undefined,
      onError: undefined,
      onReady: undefined,
    };
    
    mockClaudeInteractiveService.getSession.mockImplementation((sessionId: string) => {
      return sessionId === 'TEST-SESSION' ? mockSession : null;
    });

    // Create WebRTC connection
    const connection = await webrtcService.createConnection('TEST-SESSION');
    connection.isConnected = true;

    // Simulate receiving a claude-command message
    const commandMessage = {
      type: 'claude-command',
      command: 'invalid command',
      timestamp: Date.now(),
    };

    if (mockDataHandler) {
      mockDataHandler(Buffer.from(JSON.stringify(commandMessage)));
    }

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify some response was sent to peer
    expect(mockPeer.send).toHaveBeenCalled();
  });

  it('should handle ping/pong messages', async () => {
    // Create WebRTC connection
    const connection = await webrtcService.createConnection('TEST-SESSION');
    connection.isConnected = true;

    // Simulate receiving a ping message
    const pingMessage = {
      type: 'ping',
      timestamp: Date.now(),
    };

    if (mockDataHandler) {
      mockDataHandler(Buffer.from(JSON.stringify(pingMessage)));
    }

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify pong response was sent
    expect(mockPeer.send).toHaveBeenCalled();
  });

  it('should handle malformed messages gracefully', async () => {
    // Create WebRTC connection
    const connection = await webrtcService.createConnection('TEST-SESSION');
    connection.isConnected = true;

    // Simulate receiving malformed data
    if (mockDataHandler) {
      mockDataHandler(Buffer.from('invalid json'));
    }

    // Should not throw error and should continue working
    expect(() => {
      // Connection should still be valid (we set it as connected for testing)
      expect(connection.isConnected).toBe(true);
    }).not.toThrow();
  });

  it('should handle multiple concurrent commands', async () => {
    // Mock Claude service responses
    mockClaudeInteractiveService.sendCommand
      .mockResolvedValueOnce({ output: 'First command result', error: null })
      .mockResolvedValueOnce({ output: 'Second command result', error: null });
      
    const mockSession = {
      isReady: true,
      onOutput: undefined,
      onError: undefined,
      onReady: undefined,
    };
    
    mockClaudeInteractiveService.getSession.mockImplementation((sessionId: string) => {
      return sessionId === 'TEST-SESSION' ? mockSession : null;
    });

    // Create WebRTC connection
    const connection = await webrtcService.createConnection('TEST-SESSION');
    connection.isConnected = true;

    // Send multiple commands
    const command1 = {
      type: 'claude-command',
      command: 'first command',
      timestamp: Date.now(),
    };
    
    const command2 = {
      type: 'claude-command',
      command: 'second command',
      timestamp: Date.now() + 1,
    };

    if (mockDataHandler) {
      mockDataHandler(Buffer.from(JSON.stringify(command1)));
      mockDataHandler(Buffer.from(JSON.stringify(command2)));
    }

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify both commands were executed
    expect(mockClaudeInteractiveService.sendCommand).toHaveBeenCalledTimes(2);
    expect(mockClaudeInteractiveService.sendCommand).toHaveBeenNthCalledWith(1, 'TEST-SESSION', 'first command');
    expect(mockClaudeInteractiveService.sendCommand).toHaveBeenNthCalledWith(2, 'TEST-SESSION', 'second command');

    // Verify peer received responses for both commands
    expect(mockPeer.send).toHaveBeenCalled();
    expect(mockPeer.send.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});