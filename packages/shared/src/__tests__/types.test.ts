import { describe, it, expect } from 'vitest';
import {
  PlaylistCommandSchema,
  PlaylistMetadataSchema,
  PlaylistSchema,
  SessionSchema,
  WebRTCOfferSchema,
  WebRTCAnswerSchema,
  WebRTCIceCandidateSchema,
  CommandExecutionSchema,
  CommandResponseSchema,
  AuthRequestSchema,
  AuthResponseSchema,
} from '../types';

describe('Schema Validation', () => {
  describe('PlaylistCommandSchema', () => {
    it('should validate valid playlist command', () => {
      const validCommand = {
        icon: '🔐',
        label: 'Login',
        command: 'add authentication',
        description: 'Add login functionality',
      };

      const result = PlaylistCommandSchema.safeParse(validCommand);
      expect(result.success).toBe(true);
    });

    it('should validate command without description', () => {
      const command = {
        icon: '🔐',
        label: 'Login',
        command: 'add authentication',
      };

      const result = PlaylistCommandSchema.safeParse(command);
      expect(result.success).toBe(true);
    });

    it('should reject invalid command', () => {
      const invalidCommand = {
        icon: '🔐',
        label: 'Login',
        // missing command field
      };

      const result = PlaylistCommandSchema.safeParse(invalidCommand);
      expect(result.success).toBe(false);
    });
  });

  describe('PlaylistMetadataSchema', () => {
    it('should validate valid metadata', () => {
      const validMetadata = {
        name: 'Test Playlist',
        description: 'A test playlist',
        author: 'Test Author',
        version: '1.0.0',
        tags: ['test', 'demo'],
      };

      const result = PlaylistMetadataSchema.safeParse(validMetadata);
      expect(result.success).toBe(true);
    });

    it('should validate metadata without optional fields', () => {
      const metadata = {
        name: 'Test Playlist',
        author: 'Test Author',
        version: '1.0.0',
      };

      const result = PlaylistMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
    });
  });

  describe('PlaylistSchema', () => {
    it('should validate complete playlist', () => {
      const validPlaylist = {
        schema: 'vibe-coder-playlist-v1',
        metadata: {
          name: 'Test Playlist',
          author: 'Test Author',
          version: '1.0.0',
        },
        commands: [
          {
            icon: '🔐',
            label: 'Login',
            command: 'add authentication',
          },
        ],
      };

      const result = PlaylistSchema.safeParse(validPlaylist);
      expect(result.success).toBe(true);
    });

    it('should reject playlist with wrong schema', () => {
      const invalidPlaylist = {
        schema: 'wrong-schema',
        metadata: {
          name: 'Test Playlist',
          author: 'Test Author',
          version: '1.0.0',
        },
        commands: [],
      };

      const result = PlaylistSchema.safeParse(invalidPlaylist);
      expect(result.success).toBe(false);
    });
  });

  describe('SessionSchema', () => {
    it('should validate valid session', () => {
      const validSession = {
        id: 'ABCD1234',
        hostId: '12345678',
        clientId: 'CLIENT01',
        status: 'connected',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = SessionSchema.safeParse(validSession);
      expect(result.success).toBe(true);
    });

    it('should validate session without clientId', () => {
      const session = {
        id: 'ABCD1234',
        hostId: '12345678',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = SessionSchema.safeParse(session);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const invalidSession = {
        id: 'ABCD1234',
        hostId: '12345678',
        status: 'invalid-status',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = SessionSchema.safeParse(invalidSession);
      expect(result.success).toBe(false);
    });
  });

  describe('WebRTC Schemas', () => {
    it('should validate WebRTC offer', () => {
      const offer = {
        type: 'offer' as const,
        sdp: 'sdp-offer-data',
      };

      const result = WebRTCOfferSchema.safeParse(offer);
      expect(result.success).toBe(true);
    });

    it('should validate WebRTC answer', () => {
      const answer = {
        type: 'answer' as const,
        sdp: 'sdp-answer-data',
      };

      const result = WebRTCAnswerSchema.safeParse(answer);
      expect(result.success).toBe(true);
    });

    it('should validate ICE candidate', () => {
      const candidate = {
        sessionId: 'ABCD1234',
        candidate: 'ice-candidate-data',
        timestamp: Date.now(),
      };

      const result = WebRTCIceCandidateSchema.safeParse(candidate);
      expect(result.success).toBe(true);
    });
  });

  describe('Command Schemas', () => {
    it('should validate command execution', () => {
      const execution = {
        command: 'claude-code help',
        timestamp: Date.now(),
        sessionId: 'ABCD1234',
      };

      const result = CommandExecutionSchema.safeParse(execution);
      expect(result.success).toBe(true);
    });

    it('should validate command response', () => {
      const response = {
        id: 'response-123',
        output: 'Command executed successfully',
        timestamp: Date.now(),
      };

      const result = CommandResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate command response with error', () => {
      const response = {
        id: 'response-123',
        output: 'Command failed',
        error: 'Permission denied',
        exitCode: 1,
        timestamp: Date.now(),
      };

      const result = CommandResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('Auth Schemas', () => {
    it('should validate auth request', () => {
      const request = {
        sessionId: 'ABCD1234',
        totpCode: '123456',
        timestamp: Date.now(),
      };

      const result = AuthRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate successful auth response', () => {
      const response = {
        sessionId: 'ABCD1234',
        success: true,
        token: 'jwt-token-here',
        timestamp: Date.now(),
      };

      const result = AuthResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate failed auth response', () => {
      const response = {
        sessionId: 'ABCD1234',
        success: false,
        timestamp: Date.now(),
      };

      const result = AuthResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate auth response with QR code', () => {
      const response = {
        sessionId: 'ABCD1234',
        success: false,
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
        timestamp: Date.now(),
      };

      const result = AuthResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});