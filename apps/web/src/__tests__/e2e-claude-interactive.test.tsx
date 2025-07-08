import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

// Mock WebRTC and related APIs
const mockDataChannel = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 'open'
};

const mockPeerConnection = {
  createDataChannel: vi.fn(() => mockDataChannel),
  setLocalDescription: vi.fn(),
  setRemoteDescription: vi.fn(),
  addIceCandidate: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

// Mock RTCPeerConnection
Object.defineProperty(window, 'RTCPeerConnection', {
  writable: true,
  value: vi.fn(() => mockPeerConnection)
});

// Mock fetch for API calls
global.fetch = vi.fn();

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
    loadAddon: vi.fn()
  }))
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(() => ({
    fit: vi.fn(),
    dispose: vi.fn()
  }))
}));

// Mock QRCode
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,test'))
  }
}));

describe('Claude Interactive E2E Test', () => {
  let mockHost: any;
  
  beforeAll(() => {
    // モックホストサーバーをセットアップ
    mockHost = {
      hostId: '12345678',
      sessionId: 'TESTSES1',
      jwt: 'mock-jwt-token'
    };
    
    // fetch のモック応答を設定
    (global.fetch as any).mockImplementation((url: string, options?: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      
      // Host ID 取得
      if (urlStr.includes('/api/auth/sessions') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            sessionId: mockHost.sessionId,
            totpSecret: 'MOCK_TOTP_SECRET',
            qrCodeUrl: null
          })
        });
      }
      
      // TOTP 認証
      if (urlStr.includes('/verify') && options?.method === 'POST') {
        console.log('Mock: TOTP verification request received', { url: urlStr, options });
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            token: mockHost.jwt
          })
        });
      }
      
      // WebRTC シグナリング
      if (urlStr.includes('/api/webrtc/signal')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            message: 'Signal processed'
          })
        });
      }
      
      // Claude コマンド実行（フォールバック）
      if (urlStr.includes('/api/claude/execute')) {
        const body = JSON.parse(options?.body || '{}');
        const command = body.command;
        
        if (command === '/help') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              output: `Claude Code Help:
              
/help - Show this help message
/exit - Exit Claude Code session
/clear - Clear terminal
You can also use natural language commands like:
- "create a React component"
- "fix this bug"
- "add tests for this function"`,
              executionTime: 500
            })
          });
        }
        
        if (command === '/exit') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              output: 'Session terminated successfully',
              executionTime: 200
            })
          });
        }
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            output: 'Mock Claude response',
            executionTime: 1000
          })
        });
      }
      
      console.log('Mock: Unhandled fetch request', { url: urlStr, options });
      return Promise.reject(new Error('Unhandled fetch'));
    });
  });
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.clearAllTimers();
  });
  
  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('should complete Claude interactive session flow: /help and /exit', async () => {
    render(<App />);
    
    // 1. "ホストに接続" ボタンをクリックしてHost ID入力画面に遷移
    const connectHostButton = screen.getByRole('button', { name: /ホストに接続/i });
    fireEvent.click(connectHostButton);
    
    // Host ID入力フィールドが表示されるまで待機
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/12345678/)).toBeInTheDocument();
    });
    
    // 2. Host ID 入力
    const hostIdInput = screen.getByPlaceholderText(/12345678/);
    fireEvent.change(hostIdInput, { target: { value: mockHost.hostId } });
    
    // 接続ボタンが有効になるまで待機
    await waitFor(() => {
      const connectButton = screen.getByRole('button', { name: /接続/i });
      expect(connectButton).not.toBeDisabled();
    });
    
    const connectButton = screen.getByRole('button', { name: /接続/i });
    fireEvent.click(connectButton);
    
    // 2. TOTP 認証画面への遷移を待つ
    await waitFor(() => {
      expect(screen.getByText(/2FA認証/i)).toBeInTheDocument();
    });
    
    // 3. TOTP コード入力（6桁入力で自動認証）
    const totpInput = screen.getByPlaceholderText(/000000/);
    fireEvent.change(totpInput, { target: { value: '123456' } });
    
    // 認証完了の待機（エラーまたは成功画面の表示）
    await waitFor(() => {
      // エラーが表示されるか、ターミナル画面に遷移するまで待機
      const hasError = screen.queryByText(/認証コードが正しくありません/i);
      const hasTerminal = screen.queryByText('Terminal');
      const hasLogout = screen.queryByTitle('Logout');
      
      if (hasError) {
        console.log('Authentication failed');
      } else if (hasTerminal || hasLogout) {
        console.log('Authentication succeeded');
      } else {
        console.log('Still waiting for authentication response...');
      }
      
      return hasError || hasTerminal || hasLogout;
    }, { timeout: 8000 });
    
    // ターミナル画面が表示されることを確認
    expect(screen.getByText('Terminal')).toBeInTheDocument();
    
    // 5. WebRTC接続をシミュレート（データチャネル準備完了）
    await waitFor(() => {
      expect(mockPeerConnection.createDataChannel).toHaveBeenCalled();
    });
    
    // WebRTC 接続完了をシミュレート
    const connectHandler = mockPeerConnection.addEventListener.mock.calls
      .find(call => call[0] === 'connectionstatechange')?.[1];
    if (connectHandler) {
      Object.defineProperty(mockPeerConnection, 'connectionState', {
        value: 'connected'
      });
      connectHandler();
    }
    
    // データチャネル接続完了をシミュレート
    const dataChannelHandler = mockDataChannel.addEventListener.mock.calls
      .find(call => call[0] === 'open')?.[1];
    if (dataChannelHandler) {
      dataChannelHandler();
    }
    
    // 6. /help コマンドを実行
    const textInput = screen.getByPlaceholderText(/type.*command/i);
    fireEvent.change(textInput, { target: { value: '/help' } });
    fireEvent.keyPress(textInput, { key: 'Enter', code: 'Enter' });
    
    // 7. WebRTC経由でコマンド送信をシミュレート
    expect(mockDataChannel.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'claude-command',
        command: '/help',
        timestamp: expect.any(Number)
      })
    );
    
    // 8. WebRTC経由でのヘルプレスポンスをシミュレート
    const messageHandler = mockDataChannel.addEventListener.mock.calls
      .find(call => call[0] === 'message')?.[1];
    
    if (messageHandler) {
      // ヘルプレスポンスをシミュレート
      const helpResponse = {
        data: JSON.stringify({
          type: 'output',
          data: `Claude Code Help:
          
/help - Show this help message
/exit - Exit Claude Code session
/clear - Clear terminal
You can also use natural language commands like:
- "create a React component"
- "fix this bug"  
- "add tests for this function"`
        })
      };
      messageHandler(helpResponse);
      
      // コマンド完了通知
      const completedResponse = {
        data: JSON.stringify({
          type: 'completed',
          timestamp: Date.now()
        })
      };
      messageHandler(completedResponse);
    }
    
    // 9. ヘルプメッセージが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText(/claude code help/i)).toBeInTheDocument();
      expect(screen.getByText(/exit.*claude.*code.*session/i)).toBeInTheDocument();
    });
    
    // 10. 入力フィールドをクリア
    fireEvent.change(textInput, { target: { value: '' } });
    
    // 11. /exit コマンドを実行
    fireEvent.change(textInput, { target: { value: '/exit' } });
    fireEvent.keyPress(textInput, { key: 'Enter', code: 'Enter' });
    
    // 12. WebRTC経由で /exit コマンド送信をシミュレート
    expect(mockDataChannel.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'claude-command',
        command: '/exit',
        timestamp: expect.any(Number)
      })
    );
    
    // 13. WebRTC経由での終了レスポンスをシミュレート
    if (messageHandler) {
      const exitResponse = {
        data: JSON.stringify({
          type: 'output',
          data: 'Session terminated successfully'
        })
      };
      messageHandler(exitResponse);
      
      const exitCompleted = {
        data: JSON.stringify({
          type: 'completed',
          timestamp: Date.now()
        })
      };
      messageHandler(exitCompleted);
    }
    
    // 14. セッション終了メッセージが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText(/session terminated successfully/i)).toBeInTheDocument();
    });
    
    // 15. WebRTC接続が適切にクリーンアップされることを確認
    expect(mockDataChannel.send).toHaveBeenCalledTimes(2); // /help と /exit
  }, 15000);

  it('should handle WebRTC fallback to REST API', async () => {
    // WebRTC接続失敗をシミュレート
    mockPeerConnection.createDataChannel = vi.fn(() => {
      throw new Error('WebRTC connection failed');
    });
    
    render(<App />);
    
    // ホストに接続ボタンをクリック
    const connectHostButton = screen.getByRole('button', { name: /ホストに接続/i });
    fireEvent.click(connectHostButton);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/12345678/)).toBeInTheDocument();
    });
    
    // 認証フローを完了
    const hostIdInput = screen.getByPlaceholderText(/12345678/);
    fireEvent.change(hostIdInput, { target: { value: mockHost.hostId } });
    
    await waitFor(() => {
      const connectButton = screen.getByRole('button', { name: /接続/i });
      expect(connectButton).not.toBeDisabled();
    });
    
    fireEvent.click(screen.getByRole('button', { name: /接続/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/2FA認証/i)).toBeInTheDocument();
    });
    
    const totpInput = screen.getByPlaceholderText(/000000/);
    fireEvent.change(totpInput, { target: { value: '123456' } });
    
    await waitFor(() => {
      expect(screen.getByText(/terminal/i)).toBeInTheDocument();
    });
    
    // /help コマンドを実行（REST API フォールバック）
    const textInput = screen.getByPlaceholderText(/type.*command/i);
    fireEvent.change(textInput, { target: { value: '/help' } });
    fireEvent.keyPress(textInput, { key: 'Enter', code: 'Enter' });
    
    // REST API 経由でヘルプが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText(/claude code help/i)).toBeInTheDocument();
    });
  });

  it('should validate that /exit command terminates Claude session', async () => {
    render(<App />);
    
    // ホストに接続ボタンをクリック
    const connectHostButton = screen.getByRole('button', { name: /ホストに接続/i });
    fireEvent.click(connectHostButton);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/12345678/)).toBeInTheDocument();
    });
    
    // 認証完了まで省略（上記と同じフロー）
    const hostIdInput = screen.getByPlaceholderText(/12345678/);
    fireEvent.change(hostIdInput, { target: { value: mockHost.hostId } });
    
    await waitFor(() => {
      const connectButton = screen.getByRole('button', { name: /接続/i });
      expect(connectButton).not.toBeDisabled();
    });
    
    fireEvent.click(screen.getByRole('button', { name: /接続/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/2FA認証/i)).toBeInTheDocument();
    });
    
    const totpInput = screen.getByPlaceholderText(/000000/);
    fireEvent.change(totpInput, { target: { value: '123456' } });
    
    await waitFor(() => {
      expect(screen.getByText(/terminal/i)).toBeInTheDocument();
    });
    
    // /exit コマンドを実行
    const textInput = screen.getByPlaceholderText(/type.*command/i);
    fireEvent.change(textInput, { target: { value: '/exit' } });
    fireEvent.keyPress(textInput, { key: 'Enter', code: 'Enter' });
    
    // セッション終了が正しく処理されることを確認
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/claude/execute'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockHost.jwt}`
          }),
          body: JSON.stringify({ command: '/exit' })
        })
      );
    });
  });
});