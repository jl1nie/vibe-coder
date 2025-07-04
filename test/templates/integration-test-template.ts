/**
 * Integration Test Template for Vibe Coder
 * Test Pyramid Level: Integration (80%+ coverage target)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { WebSocket } from 'ws';

// === API Integration Test Template ===
describe('API Integration', () => {
  let app: Express.Application;
  let server: Server;
  
  beforeAll(async () => {
    // Setup test environment
    app = await createTestApp();
    server = app.listen(0); // Random port
  });

  afterAll(async () => {
    // Cleanup test environment
    await server.close();
  });

  beforeEach(async () => {
    // Reset database state
    await resetTestDatabase();
  });

  // === RESTful API Integration ===
  describe('REST API Endpoints', () => {
    it('POST /api/sessions - セッション作成フロー', async () => {
      // Arrange
      const sessionData = {
        sessionId: 'test-session-001',
        workspaceDir: '/tmp/test-workspace',
      };

      // Act
      const response = await request(app)
        .post('/api/sessions')
        .send(sessionData)
        .expect(201);

      // Assert
      expect(response.body).toMatchObject({
        message: 'Session created successfully',
        session: {
          id: sessionData.sessionId,
          workspaceDir: sessionData.workspaceDir,
          isActive: true,
        },
      });

      // Verify database state
      const session = await findSessionById(sessionData.sessionId);
      expect(session).toBeTruthy();
    });

    it('POST /api/sessions/:id/execute - コマンド実行フロー', async () => {
      // Arrange - 事前にセッションを作成
      const sessionId = await createTestSession();
      const command = 'claude-code "create a hello world function"';

      // Act
      const response = await request(app)
        .post(`/api/sessions/${sessionId}/execute`)
        .send({ command })
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        message: 'Command executed successfully',
        result: {
          command,
          exitCode: expect.any(Number),
          duration: expect.any(Number),
        },
      });
    });

    it('DELETE /api/sessions/:id - セッション削除フロー', async () => {
      // Arrange
      const sessionId = await createTestSession();

      // Act
      const response = await request(app)
        .delete(`/api/sessions/${sessionId}`)
        .expect(200);

      // Assert
      expect(response.body.message).toBe('Session terminated successfully');
      
      // Verify cleanup
      const session = await findSessionById(sessionId);
      expect(session).toBeFalsy();
    });
  });

  // === Error Handling Integration ===
  describe('Error Handling', () => {
    it('無効なセッションIDでエラーレスポンス', async () => {
      await request(app)
        .get('/api/sessions/invalid-session-id')
        .expect(404)
        .expect((res) => {
          expect(res.body.error).toBe('Session not found');
        });
    });

    it('セキュリティ違反で403レスポンス', async () => {
      const maliciousCommand = 'rm -rf /';
      const sessionId = await createTestSession();

      await request(app)
        .post(`/api/sessions/${sessionId}/execute`)
        .send({ command: maliciousCommand })
        .expect(403)
        .expect((res) => {
          expect(res.body.error).toContain('Dangerous command');
        });
    });
  });

  // === WebSocket Integration ===
  describe('WebSocket Integration', () => {
    let wsClient: WebSocket;

    beforeEach(() => {
      const wsUrl = `ws://localhost:${server.address().port}/ws`;
      wsClient = new WebSocket(wsUrl);
    });

    afterEach(() => {
      wsClient?.close();
    });

    it('WebSocket接続→メッセージ送受信→切断フロー', (done) => {
      let messageCount = 0;

      wsClient.on('open', () => {
        // Send test message
        wsClient.send(JSON.stringify({
          type: 'create-session',
          payload: { sessionId: 'ws-test-session' },
        }));
      });

      wsClient.on('message', (data) => {
        messageCount++;
        const message = JSON.parse(data.toString());
        
        if (messageCount === 1) {
          // First message should be connection confirmation
          expect(message.type).toBe('connection-established');
        } else if (messageCount === 2) {
          // Second message should be session created
          expect(message.type).toBe('session-created');
          wsClient.close();
          done();
        }
      });

      wsClient.on('error', done);
    });
  });
});

// === Component Integration Test Template ===
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('Component Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  // === TerminalPage Integration ===
  describe('TerminalPage統合', () => {
    it('VoiceInput + Terminal + QuickCommands連携', async () => {
      // Arrange
      const user = userEvent.setup();
      renderWithProviders(<TerminalPage />);

      // Act 1: Voice input simulation
      const voiceButton = screen.getByRole('button', { name: /voice/i });
      await user.click(voiceButton);

      // Mock speech recognition
      mockSpeechRecognition.mockResult('create a login page');
      
      // Act 2: Trigger speech result
      await waitFor(() => {
        expect(screen.getByDisplayValue('create a login page')).toBeInTheDocument();
      });

      // Act 3: Execute command
      const executeButton = screen.getByRole('button', { name: /execute/i });
      await user.click(executeButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/executing command/i)).toBeInTheDocument();
      });
    });

    it('エラー発生時の統合的な処理', async () => {
      // Arrange
      const user = userEvent.setup();
      mockApiClient.post.mockRejectedValue(new Error('Network error'));
      
      renderWithProviders(<TerminalPage />);

      // Act
      const quickCommand = screen.getByRole('button', { name: /login/i });
      await user.click(quickCommand);

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network error');
      });
    });
  });

  // === Playlist Management Integration ===
  describe('Playlist Management統合', () => {
    it('プレイリスト検索→選択→インポートフロー', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockPlaylists = [
        {
          id: 'playlist-1',
          metadata: { name: 'Frontend Vibes', author: 'ui_ninja' },
          commands: [{ icon: '🎨', label: 'Style', command: 'fix styles' }],
        },
      ];
      mockApiClient.get.mockResolvedValue({ data: { playlists: mockPlaylists } });

      renderWithProviders(<PlaylistsPage />);

      // Act 1: Search
      const searchInput = screen.getByPlaceholderText(/search playlists/i);
      await user.type(searchInput, 'Frontend');

      // Wait for search results
      await waitFor(() => {
        expect(screen.getByText('Frontend Vibes')).toBeInTheDocument();
      });

      // Act 2: Import
      const importButton = screen.getByRole('button', { name: /import/i });
      await user.click(importButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/playlist imported successfully/i)).toBeInTheDocument();
      });
    });
  });
});

// === Database Integration Test Template ===
describe('Database Integration', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  it('セッションデータの永続化', async () => {
    // Arrange
    const sessionData = {
      id: 'test-session',
      workspaceDir: '/tmp/workspace',
      isActive: true,
      createdAt: Date.now(),
    };

    // Act
    await saveSession(sessionData);
    const retrieved = await findSessionById(sessionData.id);

    // Assert
    expect(retrieved).toMatchObject(sessionData);
  });

  it('セッション期限切れの自動クリーンアップ', async () => {
    // Arrange - Create expired session
    const expiredSession = {
      id: 'expired-session',
      workspaceDir: '/tmp/workspace',
      isActive: false,
      createdAt: Date.now() - (24 * 60 * 60 * 1000), // 24 hours ago
    };
    await saveSession(expiredSession);

    // Act
    await runSessionCleanup();

    // Assert
    const retrieved = await findSessionById(expiredSession.id);
    expect(retrieved).toBeFalsy();
  });
});

// === External Service Integration ===
describe('External Service Integration', () => {
  describe('Claude API Integration', () => {
    it('Claude APIレスポンスの統合処理', async () => {
      // Arrange
      const mockClaudeResponse = {
        type: 'message',
        content: [{ type: 'text', text: 'Login page created successfully' }],
      };
      mockClaudeAPI.messages.create.mockResolvedValue(mockClaudeResponse);

      // Act
      const result = await executeClaudeCommand('create a login page');

      // Assert
      expect(result).toMatchObject({
        success: true,
        output: expect.stringContaining('Login page created'),
      });
    });

    it('Claude APIエラー時の処理', async () => {
      // Arrange
      mockClaudeAPI.messages.create.mockRejectedValue(
        new Error('Claude API rate limit exceeded')
      );

      // Act & Assert
      await expect(executeClaudeCommand('test command'))
        .rejects.toThrow('Claude API rate limit exceeded');
    });
  });

  describe('GitHub API Integration', () => {
    it('プレイリスト発見の統合フロー', async () => {
      // Arrange
      const mockGitHubResponse = {
        items: [
          {
            name: 'vibe-coder-playlist.json',
            download_url: 'https://example.com/playlist.json',
            repository: { full_name: 'user/repo' },
          },
        ],
      };
      mockGitHubAPI.search.code.mockResolvedValue(mockGitHubResponse);

      // Act
      const playlists = await discoverPlaylists();

      // Assert
      expect(playlists).toHaveLength(1);
      expect(playlists[0]).toMatchObject({
        source: { type: 'github', repository: 'user/repo' },
      });
    });
  });
});

// === Test Utilities ===
async function createTestApp(): Promise<Express.Application> {
  // Create test application instance
  const app = express();
  // Setup test middleware and routes
  return app;
}

async function createTestSession(): Promise<string> {
  const sessionId = `test-session-${Date.now()}`;
  await request(app)
    .post('/api/sessions')
    .send({ sessionId, workspaceDir: '/tmp/test' });
  return sessionId;
}

async function resetTestDatabase(): Promise<void> {
  // Reset database to clean state
}

async function setupTestDatabase(): Promise<void> {
  // Initialize test database
}

async function cleanupTestDatabase(): Promise<void> {
  // Cleanup test database
}

const mockSpeechRecognition = {
  mockResult: (text: string) => {
    // Mock speech recognition result
  },
};

const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
};

const mockClaudeAPI = {
  messages: {
    create: vi.fn(),
  },
};

const mockGitHubAPI = {
  search: {
    code: vi.fn(),
  },
};

export {
  createTestApp,
  createTestSession,
  resetTestDatabase,
  mockSpeechRecognition,
  mockApiClient,
};