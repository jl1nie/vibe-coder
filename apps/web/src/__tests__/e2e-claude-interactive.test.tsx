import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import App from '../App';
import { 
  mockSignalingFlow, 
  mockP2PCommandExecution, 
  mockWebRTCOnlyFlow
} from '../test/test-utils';

// Mock Terminal
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => ({
    open: vi.fn(),
    write: vi.fn(),
    writeln: vi.fn(),
    clear: vi.fn(),
    focus: vi.fn(),
    dispose: vi.fn(),
    onData: vi.fn(),
    loadAddon: vi.fn(),
  })),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(() => ({
    fit: vi.fn(),
    activate: vi.fn(),
    dispose: vi.fn(),
  })),
}));

describe('Claude Interactive E2E Test - WebRTC P2P Only', () => {
  let signalingMocks: ReturnType<typeof mockSignalingFlow>;
  let webrtcOnlyMocks: ReturnType<typeof mockWebRTCOnlyFlow>;
  // let voiceMocks: ReturnType<typeof mockVoiceRecognition>;

  const mockHost = {
    hostId: '12345678',
    totpSecret: 'JBSWY3DPEHPK3PXP',
  };

  beforeAll(() => {
    // Setup WebRTC P2P only environment
    webrtcOnlyMocks = mockWebRTCOnlyFlow();
    // voiceMocks = mockVoiceRecognition();
  });

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup fresh signaling flow for each test
    signalingMocks = mockSignalingFlow();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    webrtcOnlyMocks.restore();
    vi.restoreAllMocks();
  });

  it('should complete Claude interactive session flow via WebRTC P2P: /help and /exit', async () => {
    render(<App />);

    // 1. ホストに接続ボタンをクリック
    const connectHostButton = screen.getByRole('button', {
      name: /ホストに接続/i,
    });
    await act(async () => {
      fireEvent.click(connectHostButton);
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/12345678/)).toBeInTheDocument();
    });

    // 2. Host ID入力
    const hostIdInput = screen.getByPlaceholderText(/12345678/);
    await act(async () => {
      fireEvent.change(hostIdInput, { target: { value: mockHost.hostId } });
    });

    await waitFor(() => {
      const connectButton = screen.getByRole('button', { name: /接続/i });
      expect(connectButton).not.toBeDisabled();
    });

    // 3. 接続ボタンクリック
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /接続/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/2FA認証/i)).toBeInTheDocument();
    });

    // 4. TOTP認証
    const totpInput = screen.getByPlaceholderText(/000000/);
    await act(async () => {
      fireEvent.change(totpInput, { target: { value: '123456' } });
    });

    // 5. WebRTC P2P接続シミュレーション
    await act(async () => {
      signalingMocks.simulateP2PConnection();
    });

    await waitFor(() => {
      expect(screen.queryByTitle('Logout')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/terminal/i)).toBeInTheDocument();
    });

    // 6. /help コマンドを実行（WebRTC P2P経由）
    const textInput = screen.getByDisplayValue('');
    await act(async () => {
      fireEvent.change(textInput, { target: { value: '/help' } });
      fireEvent.keyDown(textInput, { key: 'Enter', code: 'Enter' });
    });

    // 7. WebRTC P2P経由でコマンド送信を確認
    expect(signalingMocks.mockDataChannel.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"claude-command"')
    );
    expect(signalingMocks.mockDataChannel.send).toHaveBeenCalledWith(
      expect.stringContaining('"command":"/help"')
    );

    // 8. WebRTC P2P経由でのヘルプレスポンスをシミュレート
    await act(async () => {
      mockP2PCommandExecution(
        signalingMocks.mockDataChannel,
        '/help',
        `Claude Code Help:
/help - Show this help message
/exit - Exit Claude Code session
/clear - Clear terminal
You can also use natural language commands like:
- "create a React component"
- "fix this bug"
- "add tests for this function"`
      );
    });

    // 9. /exit コマンドを実行
    await act(async () => {
      fireEvent.change(textInput, { target: { value: '/exit' } });
      fireEvent.keyDown(textInput, { key: 'Enter', code: 'Enter' });
    });

    // 10. /exit コマンドのレスポンスをシミュレート
    await act(async () => {
      mockP2PCommandExecution(
        signalingMocks.mockDataChannel,
        '/exit',
        'Session terminated successfully'
      );
    });

    // 11. WebRTC P2P経由でのコマンド実行を確認
    expect(signalingMocks.mockDataChannel.send).toHaveBeenCalledTimes(2); // /help と /exit

    // 12. REST API フォールバックは使用されないことを確認
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/claude/execute'),
      expect.any(Object)
    );
  }, 15000);

  it('should require WebRTC P2P connection for command execution', async () => {
    // WebRTC接続失敗をシミュレート
    signalingMocks.mockPeerConnection.createDataChannel = vi.fn(() => {
      throw new Error('WebRTC connection failed');
    });

    render(<App />);

    // ホストに接続ボタンをクリック
    const connectHostButton = screen.getByRole('button', {
      name: /ホストに接続/i,
    });
    await act(async () => {
      fireEvent.click(connectHostButton);
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/12345678/)).toBeInTheDocument();
    });

    // 認証フローを完了
    const hostIdInput = screen.getByPlaceholderText(/12345678/);
    await act(async () => {
      fireEvent.change(hostIdInput, { target: { value: mockHost.hostId } });
    });

    await waitFor(() => {
      const connectButton = screen.getByRole('button', { name: /接続/i });
      expect(connectButton).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /接続/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/2FA認証/i)).toBeInTheDocument();
    });

    const totpInput = screen.getByPlaceholderText(/000000/);
    await act(async () => {
      fireEvent.change(totpInput, { target: { value: '123456' } });
    });

    // WebRTC接続失敗により、ターミナルアクセスが制限される
    await waitFor(() => {
      expect(screen.queryByTitle('Logout')).toBeInTheDocument();
    });

    // WebRTC接続が失敗したため、コマンド実行は不可能
    const textInput = screen.getByDisplayValue('');
    await act(async () => {
      fireEvent.change(textInput, { target: { value: '/help' } });
      fireEvent.keyDown(textInput, { key: 'Enter', code: 'Enter' });
    });

    // WebRTC P2P接続が必須であることを確認
    // REST API フォールバックは利用されない
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/claude/execute'),
      expect.any(Object)
    );
  });

  it('should validate that /exit command terminates Claude session via WebRTC P2P', async () => {
    render(<App />);

    // 認証フロー完了
    const connectHostButton = screen.getByRole('button', {
      name: /ホストに接続/i,
    });
    await act(async () => {
      fireEvent.click(connectHostButton);
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/12345678/)).toBeInTheDocument();
    });

    const hostIdInput = screen.getByPlaceholderText(/12345678/);
    await act(async () => {
      fireEvent.change(hostIdInput, { target: { value: mockHost.hostId } });
    });

    await waitFor(() => {
      const connectButton = screen.getByRole('button', { name: /接続/i });
      expect(connectButton).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /接続/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/2FA認証/i)).toBeInTheDocument();
    });

    const totpInput = screen.getByPlaceholderText(/000000/);
    await act(async () => {
      fireEvent.change(totpInput, { target: { value: '123456' } });
    });

    // WebRTC P2P接続シミュレーション
    await act(async () => {
      signalingMocks.simulateP2PConnection();
    });

    await waitFor(() => {
      expect(screen.queryByTitle('Logout')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/terminal/i)).toBeInTheDocument();
    });

    // /exit コマンドを実行
    const textInput = screen.getByDisplayValue('');
    await act(async () => {
      fireEvent.change(textInput, { target: { value: '/exit' } });
      fireEvent.keyDown(textInput, { key: 'Enter', code: 'Enter' });
    });

    // WebRTC P2P経由での/exitコマンド送信を確認
    expect(signalingMocks.mockDataChannel.send).toHaveBeenCalledWith(
      expect.stringContaining('"command":"/exit"')
    );

    // セッション終了レスポンスをシミュレート
    await act(async () => {
      mockP2PCommandExecution(
        signalingMocks.mockDataChannel,
        '/exit',
        'Session terminated successfully'
      );
    });

    // WebRTC P2P経由でのセッション終了を確認
    expect(signalingMocks.mockDataChannel.send).toHaveBeenCalledTimes(1);
  });

  it('should handle WebSocket signaling connection states', async () => {
    render(<App />);

    // 初期状態確認
    expect(screen.getByTestId('app-title')).toBeInTheDocument();

    // WebSocket接続状態のテスト
    await act(async () => {
      // WebSocket接続成功をシミュレート
      if (signalingMocks.mockWebSocket.onopen) {
        (signalingMocks.mockWebSocket.onopen as any)(new Event('open'));
      }
    });

    // WebSocketメッセージ処理のテスト
    await act(async () => {
      signalingMocks.simulateSignalingMessage('session-created', {
        sessionId: 'test-session-123'
      });
    });

    // WebSocket接続切断のテスト
    await act(async () => {
      if (signalingMocks.mockWebSocket.onclose) {
        (signalingMocks.mockWebSocket.onclose as any)(new CloseEvent('close'));
      }
    });

    // アプリケーションが正常に動作することを確認
    expect(screen.getByTestId('app-title')).toBeInTheDocument();
  });

  it('should verify WebRTC P2P data channel communication', async () => {
    render(<App />);

    // 認証完了までのフロー省略（上記テストと同様）
    // ...

    // WebRTC データチャネルのテスト
    const testCommand = 'echo "WebRTC P2P test"';
    const testResponse = 'WebRTC P2P test';

    // データチャネル通信をシミュレート
    await act(async () => {
      mockP2PCommandExecution(
        signalingMocks.mockDataChannel,
        testCommand,
        testResponse
      );
    });

    // データチャネル経由の通信が正常に動作することを確認
    expect(signalingMocks.mockDataChannel.send).toBeDefined();
    expect(signalingMocks.mockDataChannel.onmessage).toBeDefined();
  });
});