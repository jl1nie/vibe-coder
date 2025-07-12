import { describe, it, expect } from 'vitest';
import type {
  Session,
  AuthenticatedRequest,
  WebRTCConnection,
  WebRTCMessage,
  ClaudeExecutionResult,
  ClaudeCommandMessage,
  ClaudeOutputMessage,
  ClaudeErrorMessage,
  ClaudeCompletedMessage,
} from '../types';

describe('Type Definitions', () => {
  describe('Session', () => {
    it('should define Session interface correctly', () => {
      const session: Session = {
        id: 'TEST1234',
        hostId: '12345678',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        expiresAt: new Date(),
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      expect(session.id).toBe('TEST1234');
      expect(session.hostId).toBe('12345678');
      expect(session.totpSecret).toBe('JBSWY3DPEHPK3PXP');
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastActivity).toBeInstanceOf(Date);
    });

    it('should require all Session properties', () => {
      // This test ensures TypeScript compilation would fail if required properties are missing
      const sessionProperties = [
        'id',
        'hostId',
        'totpSecret',
        'expiresAt',
        'createdAt',
        'lastActivity',
      ];

      const session: Session = {
        id: 'TEST1234',
        hostId: '12345678',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        expiresAt: new Date(),
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      sessionProperties.forEach(prop => {
        expect(session).toHaveProperty(prop);
      });
    });
  });

  describe('AuthenticatedRequest', () => {
    it('should extend Express Request with auth properties', () => {
      // Create a mock authenticated request
      const authReq: AuthenticatedRequest = {
        sessionId: 'TEST1234',
        hostId: '12345678',
        // Express Request properties (minimal mock)
        method: 'GET',
        url: '/test',
        headers: {},
      } as AuthenticatedRequest;

      expect(authReq.sessionId).toBe('TEST1234');
      expect(authReq.hostId).toBe('12345678');
      expect(authReq.method).toBe('GET');
      expect(authReq.url).toBe('/test');
    });
  });

  describe('WebRTCConnection', () => {
    it('should define WebRTCConnection interface correctly', () => {
      const connection: WebRTCConnection = {
        id: 'conn-123',
        sessionId: 'TEST1234',
        isConnected: true,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      expect(connection.id).toBe('conn-123');
      expect(connection.sessionId).toBe('TEST1234');
      expect(connection.isConnected).toBe(true);
      expect(connection.createdAt).toBeInstanceOf(Date);
      expect(connection.lastActivity).toBeInstanceOf(Date);
    });

    it('should handle disconnected state', () => {
      const connection: WebRTCConnection = {
        id: 'conn-456',
        sessionId: 'TEST5678',
        isConnected: false,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      expect(connection.isConnected).toBe(false);
    });
  });

  describe('WebRTCMessage', () => {
    it('should define base WebRTCMessage interface', () => {
      const message: WebRTCMessage = {
        type: 'test',
        timestamp: new Date(),
      };

      expect(message.type).toBe('test');
      expect(message.timestamp).toBeInstanceOf(Date);
    });

    it('should allow additional properties', () => {
      const message: WebRTCMessage & { data: string } = {
        type: 'custom',
        timestamp: new Date(),
        data: 'test data',
      };

      expect(message.data).toBe('test data');
    });
  });

  describe('ClaudeExecutionResult', () => {
    it('should define successful execution result', () => {
      const result: ClaudeExecutionResult = {
        success: true,
        output: 'Command executed successfully',
        executionTime: 1500,
      };

      expect(result.success).toBe(true);
      expect(result.output).toBe('Command executed successfully');
      expect(result.executionTime).toBe(1500);
      expect(result.error).toBeUndefined();
    });

    it('should define failed execution result', () => {
      const result: ClaudeExecutionResult = {
        success: false,
        error: 'Command failed',
        executionTime: 500,
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Command failed');
      expect(result.executionTime).toBe(500);
      expect(result.output).toBeUndefined();
    });

    it('should allow both output and error in result', () => {
      const result: ClaudeExecutionResult = {
        success: false,
        output: 'Partial output',
        error: 'Execution failed',
        executionTime: 750,
      };

      expect(result.success).toBe(false);
      expect(result.output).toBe('Partial output');
      expect(result.error).toBe('Execution failed');
      expect(result.executionTime).toBe(750);
    });
  });

  describe('Claude Message Types', () => {
    it('should define ClaudeCommandMessage', () => {
      const message: ClaudeCommandMessage = {
        type: 'command',
        sessionId: 'TEST1234',
        connectionId: 'conn-123',
        command: 'echo "hello world"',
      };

      expect(message.type).toBe('command');
      expect(message.sessionId).toBe('TEST1234');
      expect(message.connectionId).toBe('conn-123');
      expect(message.command).toBe('echo "hello world"');
    });

    it('should define ClaudeOutputMessage', () => {
      const message: ClaudeOutputMessage = {
        type: 'output',
        sessionId: 'TEST1234',
        connectionId: 'conn-123',
        output: 'hello world\n',
      };

      expect(message.type).toBe('output');
      expect(message.sessionId).toBe('TEST1234');
      expect(message.connectionId).toBe('conn-123');
      expect(message.output).toBe('hello world\n');
    });

    it('should define ClaudeErrorMessage', () => {
      const message: ClaudeErrorMessage = {
        type: 'error',
        sessionId: 'TEST1234',
        connectionId: 'conn-123',
        error: 'Command not found',
      };

      expect(message.type).toBe('error');
      expect(message.sessionId).toBe('TEST1234');
      expect(message.connectionId).toBe('conn-123');
      expect(message.error).toBe('Command not found');
    });

    it('should define ClaudeCompletedMessage', () => {
      const message: ClaudeCompletedMessage = {
        type: 'completed',
        sessionId: 'TEST1234',
        connectionId: 'conn-123',
        exitCode: 0,
        executionTime: 1200,
      };

      expect(message.type).toBe('completed');
      expect(message.sessionId).toBe('TEST1234');
      expect(message.connectionId).toBe('conn-123');
      expect(message.exitCode).toBe(0);
      expect(message.executionTime).toBe(1200);
    });

    it('should handle non-zero exit codes', () => {
      const message: ClaudeCompletedMessage = {
        type: 'completed',
        sessionId: 'TEST1234',
        connectionId: 'conn-123',
        exitCode: 1,
        executionTime: 800,
      };

      expect(message.exitCode).toBe(1);
    });
  });

  describe('Type Compatibility', () => {
    it('should allow Session to be used in type assertions', () => {
      const obj: unknown = {
        id: 'TEST1234',
        hostId: '12345678',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        expiresAt: new Date(),
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      const session = obj as Session;
      expect(session.id).toBe('TEST1234');
    });

    it('should allow WebRTCConnection to be serialized', () => {
      const connection: WebRTCConnection = {
        id: 'conn-123',
        sessionId: 'TEST1234',
        isConnected: true,
        createdAt: new Date('2024-01-01T12:00:00Z'),
        lastActivity: new Date('2024-01-01T12:05:00Z'),
      };

      const serialized = JSON.stringify(connection);
      const parsed = JSON.parse(serialized);

      expect(parsed.id).toBe('conn-123');
      expect(parsed.sessionId).toBe('TEST1234');
      expect(parsed.isConnected).toBe(true);
      expect(parsed.createdAt).toBe('2024-01-01T12:00:00.000Z');
      expect(parsed.lastActivity).toBe('2024-01-01T12:05:00.000Z');
    });

    it('should allow ClaudeExecutionResult union types', () => {
      const results: ClaudeExecutionResult[] = [
        { success: true, output: 'OK', executionTime: 100 },
        { success: false, error: 'Failed', executionTime: 50 },
        { success: false, output: 'Partial', error: 'Error', executionTime: 75 },
      ];

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(false);
    });

    it('should allow message type discrimination', () => {
      const messages = [
        { type: 'command', sessionId: 'TEST', connectionId: 'conn', command: 'ls' } as ClaudeCommandMessage,
        { type: 'output', sessionId: 'TEST', connectionId: 'conn', output: 'file1\n' } as ClaudeOutputMessage,
        { type: 'error', sessionId: 'TEST', connectionId: 'conn', error: 'Not found' } as ClaudeErrorMessage,
        { type: 'completed', sessionId: 'TEST', connectionId: 'conn', exitCode: 0, executionTime: 500 } as ClaudeCompletedMessage,
      ];

      messages.forEach(message => {
        switch (message.type) {
          case 'command':
            expect(message.command).toBeDefined();
            break;
          case 'output':
            expect(message.output).toBeDefined();
            break;
          case 'error':
            expect(message.error).toBeDefined();
            break;
          case 'completed':
            expect(message.exitCode).toBeDefined();
            expect(message.executionTime).toBeDefined();
            break;
        }
      });
    });
  });
});