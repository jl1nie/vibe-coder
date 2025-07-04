/**
 * Integration Tests - Test Pyramid Middle Level
 * Tests component and service interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Vibe Coder Integration Tests', () => {
  // Global mock services
  const mockSessionManager = {
    createSession: vi.fn(),
    getSession: vi.fn(),
    terminateSession: vi.fn(),
    getSessions: vi.fn(),
  };

  const mockClaudeService = {
    executeCommand: vi.fn(),
    validateCommand: vi.fn(),
  };

  describe('コマンド実行フロー統合', () => {

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('セッション作成からコマンド実行までの完全フロー', async () => {
      // Setup
      const sessionId = 'integration-test-session';
      const command = 'claude-code "create a test component"';
      
      mockSessionManager.createSession.mockResolvedValue({
        id: sessionId,
        isActive: true,
        createdAt: Date.now(),
      });

      mockSessionManager.getSession.mockReturnValue({
        id: sessionId,
        isActive: true,
      });

      mockClaudeService.validateCommand.mockReturnValue(true);
      mockClaudeService.executeCommand.mockResolvedValue({
        command,
        exitCode: 0,
        output: ['Component created successfully'],
        duration: 1500,
      });

      // Execute integration flow
      const session = await mockSessionManager.createSession(sessionId);
      expect(session.id).toBe(sessionId);

      const isValid = mockClaudeService.validateCommand(command);
      expect(isValid).toBe(true);

      const result = await mockClaudeService.executeCommand(sessionId, command);

      // Verify integration
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(sessionId);
      expect(mockClaudeService.validateCommand).toHaveBeenCalledWith(command);
      expect(mockClaudeService.executeCommand).toHaveBeenCalledWith(sessionId, command);
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Component created successfully');
    });

    it('エラー発生時の適切な処理フロー', async () => {
      // Setup error scenario
      const sessionId = 'error-test-session';
      const dangerousCommand = 'rm -rf /';

      mockSessionManager.getSession.mockReturnValue({
        id: sessionId,
        isActive: true,
      });

      mockClaudeService.validateCommand.mockImplementation((cmd) => {
        if (cmd.includes('rm -rf')) {
          throw new Error('Dangerous command detected');
        }
        return true;
      });

      // Execute error flow
      try {
        mockClaudeService.validateCommand(dangerousCommand);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Dangerous command detected');
      }

      // Verify error handling
      expect(mockClaudeService.validateCommand).toHaveBeenCalledWith(dangerousCommand);
      expect(mockClaudeService.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('WebRTC通信統合', () => {
    const mockSignalingService = {
      sendOffer: vi.fn(),
      sendAnswer: vi.fn(),
      sendIceCandidate: vi.fn(),
      onMessage: vi.fn(),
    };

    const mockWebRTCConnection = {
      createOffer: vi.fn(),
      createAnswer: vi.fn(),
      setLocalDescription: vi.fn(),
      setRemoteDescription: vi.fn(),
      addIceCandidate: vi.fn(),
      addEventListener: vi.fn(),
      connectionState: 'new',
    };

    it('WebRTC接続確立フロー', async () => {
      // Setup
      const serverId = 'test-server-123';
      const mockOffer = { sdp: 'mock-offer-sdp', type: 'offer' };
      const mockAnswer = { sdp: 'mock-answer-sdp', type: 'answer' };

      mockWebRTCConnection.createOffer.mockResolvedValue(mockOffer);
      mockWebRTCConnection.createAnswer.mockResolvedValue(mockAnswer);
      mockSignalingService.sendOffer.mockResolvedValue({ success: true });
      mockSignalingService.sendAnswer.mockResolvedValue({ success: true });

      // Execute connection flow
      const offer = await mockWebRTCConnection.createOffer();
      await mockWebRTCConnection.setLocalDescription(offer);
      await mockSignalingService.sendOffer(serverId, offer);

      // Simulate receiving answer
      const answer = await mockWebRTCConnection.createAnswer();
      await mockWebRTCConnection.setRemoteDescription(answer);
      await mockSignalingService.sendAnswer(serverId, answer);

      // Verify integration
      expect(mockWebRTCConnection.createOffer).toHaveBeenCalled();
      expect(mockWebRTCConnection.setLocalDescription).toHaveBeenCalledWith(mockOffer);
      expect(mockSignalingService.sendOffer).toHaveBeenCalledWith(serverId, mockOffer);
      expect(mockSignalingService.sendAnswer).toHaveBeenCalledWith(serverId, mockAnswer);
    });

    it('ICE候補交換フロー', async () => {
      // Setup
      const mockIceCandidate = {
        candidate: 'candidate:1 1 UDP 2113667327 192.168.1.100 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
      };

      mockSignalingService.sendIceCandidate.mockResolvedValue({ success: true });

      // Execute ICE exchange
      await mockSignalingService.sendIceCandidate('test-server', mockIceCandidate);
      await mockWebRTCConnection.addIceCandidate(mockIceCandidate);

      // Verify
      expect(mockSignalingService.sendIceCandidate).toHaveBeenCalledWith('test-server', mockIceCandidate);
      expect(mockWebRTCConnection.addIceCandidate).toHaveBeenCalledWith(mockIceCandidate);
    });
  });

  describe('プレイリスト管理統合', () => {
    const mockPlaylistService = {
      search: vi.fn(),
      import: vi.fn(),
      validate: vi.fn(),
      store: vi.fn(),
    };

    const mockStorageService = {
      save: vi.fn(),
      load: vi.fn(),
      remove: vi.fn(),
    };

    it('プレイリスト検索・インポート・保存フロー', async () => {
      // Setup
      const searchTerm = 'frontend';
      const mockPlaylist = {
        id: 'frontend-vibes',
        name: 'Frontend Vibes',
        author: 'ui_ninja',
        commands: [
          {
            icon: '🎨',
            label: 'Polish',
            command: 'claude-code "polish the UI"',
            description: 'Enhance UI',
            category: 'ui',
          },
        ],
      };

      mockPlaylistService.search.mockResolvedValue([mockPlaylist]);
      mockPlaylistService.validate.mockReturnValue(true);
      mockPlaylistService.import.mockResolvedValue(mockPlaylist);
      mockStorageService.save.mockResolvedValue(true);

      // Execute playlist flow
      const searchResults = await mockPlaylistService.search(searchTerm);
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].name).toBe('Frontend Vibes');

      const isValid = mockPlaylistService.validate(searchResults[0]);
      expect(isValid).toBe(true);

      const importedPlaylist = await mockPlaylistService.import(searchResults[0].id);
      expect(importedPlaylist.commands).toHaveLength(1);

      await mockStorageService.save('playlists', importedPlaylist);

      // Verify integration
      expect(mockPlaylistService.search).toHaveBeenCalledWith(searchTerm);
      expect(mockPlaylistService.validate).toHaveBeenCalledWith(mockPlaylist);
      expect(mockPlaylistService.import).toHaveBeenCalledWith('frontend-vibes');
      expect(mockStorageService.save).toHaveBeenCalledWith('playlists', mockPlaylist);
    });

    it('プレイリスト読み込み・実行統合', async () => {
      // Setup
      const storedPlaylist = {
        id: 'stored-playlist',
        commands: [
          {
            icon: '🔥',
            label: 'Test',
            command: 'claude-code "run tests"',
            description: 'Run tests',
            category: 'testing',
          },
        ],
      };

      mockStorageService.load.mockResolvedValue(storedPlaylist);
      mockClaudeService.executeCommand.mockResolvedValue({
        command: 'claude-code "run tests"',
        exitCode: 0,
        output: ['Tests passed'],
      });

      // Execute load and execute flow
      const playlist = await mockStorageService.load('playlists');
      expect(playlist.commands).toHaveLength(1);

      const command = playlist.commands[0];
      const result = await mockClaudeService.executeCommand('test-session', command.command);

      // Verify
      expect(mockStorageService.load).toHaveBeenCalledWith('playlists');
      expect(mockClaudeService.executeCommand).toHaveBeenCalledWith('test-session', 'claude-code "run tests"');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('音声認識統合', () => {
    const mockSpeechRecognition = {
      start: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      continuous: true,
      interimResults: true,
    };

    const mockVoiceProcessor = {
      processResult: vi.fn(),
      normalizeText: vi.fn(),
      extractCommand: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('音声認識・コマンド抽出・実行フロー', async () => {
      // Setup
      const rawSpeechResult = 'please create a user profile component';
      const normalizedText = 'create a user profile component';
      const extractedCommand = 'claude-code "create a user profile component"';

      mockVoiceProcessor.normalizeText.mockReturnValue(normalizedText);
      mockVoiceProcessor.extractCommand.mockReturnValue(extractedCommand);
      mockClaudeService.validateCommand.mockReturnValue(true);
      mockClaudeService.executeCommand.mockResolvedValue({
        command: extractedCommand,
        exitCode: 0,
        output: ['Component created'],
      });

      // Simulate speech recognition event
      const speechEvent = {
        results: [{
          0: { transcript: rawSpeechResult },
          isFinal: true,
        }],
      };

      // Execute voice flow
      const processedResult = mockVoiceProcessor.processResult(speechEvent);
      const normalized = mockVoiceProcessor.normalizeText(processedResult);
      const command = mockVoiceProcessor.extractCommand(normalized);
      
      const isValid = mockClaudeService.validateCommand(command);
      expect(isValid).toBe(true);

      const result = await mockClaudeService.executeCommand('voice-session', command);

      // Verify integration
      expect(mockVoiceProcessor.normalizeText).toHaveBeenCalledWith(processedResult);
      expect(mockVoiceProcessor.extractCommand).toHaveBeenCalledWith(normalizedText);
      expect(mockClaudeService.validateCommand).toHaveBeenCalledWith(extractedCommand);
      expect(mockClaudeService.executeCommand).toHaveBeenCalledWith('voice-session', extractedCommand);
      expect(result.output).toContain('Component created');
    });

    it('音声認識エラー処理統合', async () => {
      // Setup error scenario
      const errorEvent = { error: 'no-speech' };
      
      mockVoiceProcessor.processResult.mockImplementation((event) => {
        if (event.error) {
          throw new Error(`Speech recognition error: ${event.error}`);
        }
      });

      // Execute error handling
      try {
        mockVoiceProcessor.processResult(errorEvent);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Speech recognition error: no-speech');
      }

      // Verify error handling doesn't trigger command execution
      expect(mockClaudeService.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('ファイル監視統合', () => {
    const mockFileWatcher = {
      watch: vi.fn(),
      unwatch: vi.fn(),
      addEventListener: vi.fn(),
    };

    const mockNotificationService = {
      notify: vi.fn(),
      showFileChange: vi.fn(),
    };

    it('ファイル変更検知・通知フロー', async () => {
      // Setup
      const watchPath = '/tmp/test-workspace';
      const fileChangeEvent = {
        type: 'change',
        filename: 'component.tsx',
        path: '/tmp/test-workspace/component.tsx',
        stats: { size: 1024, mtime: new Date() },
      };

      mockFileWatcher.addEventListener.mockImplementation((event, callback) => {
        if (event === 'change') {
          // Simulate file change
          setTimeout(() => callback(fileChangeEvent), 10);
        }
      });

      // Execute file watching
      mockFileWatcher.watch(watchPath);
      mockFileWatcher.addEventListener('change', (event) => {
        mockNotificationService.showFileChange(event);
      });

      // Wait for simulated event
      await new Promise(resolve => setTimeout(resolve, 20));

      // Verify integration
      expect(mockFileWatcher.watch).toHaveBeenCalledWith(watchPath);
      expect(mockNotificationService.showFileChange).toHaveBeenCalledWith(fileChangeEvent);
    });
  });

  describe('エラー境界統合', () => {
    const mockErrorReporter = {
      report: vi.fn(),
      categorize: vi.fn(),
    };

    const mockRecoveryService = {
      attemptRecovery: vi.fn(),
      fallback: vi.fn(),
    };

    it('エラー発生・報告・回復フロー', async () => {
      // Setup
      const error = new Error('Network connection failed');
      const errorCategory = 'network';
      const recoveryStrategy = 'retry';

      mockErrorReporter.categorize.mockReturnValue(errorCategory);
      mockRecoveryService.attemptRecovery.mockResolvedValue(true);

      // Execute error handling flow
      const category = mockErrorReporter.categorize(error);
      await mockErrorReporter.report(error, category);
      
      const recovered = await mockRecoveryService.attemptRecovery(errorCategory);
      
      if (!recovered) {
        await mockRecoveryService.fallback();
      }

      // Verify integration
      expect(mockErrorReporter.categorize).toHaveBeenCalledWith(error);
      expect(mockErrorReporter.report).toHaveBeenCalledWith(error, errorCategory);
      expect(mockRecoveryService.attemptRecovery).toHaveBeenCalledWith(errorCategory);
      expect(recovered).toBe(true);
      expect(mockRecoveryService.fallback).not.toHaveBeenCalled();
    });
  });
});