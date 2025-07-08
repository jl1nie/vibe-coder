import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../hooks/useAuth';
import App from '../App';

// Mock WebRTC and related APIs
const mockWebRTC = {
  createConnection: vi.fn(),
  createOffer: vi.fn(),
  createAnswer: vi.fn(),
  setRemoteDescription: vi.fn(),
  addIceCandidate: vi.fn(),
};

global.RTCPeerConnection = vi.fn(() => mockWebRTC) as any;
global.navigator.mediaDevices = {
  getUserMedia: vi.fn(),
} as any;

// Mock fetch for API calls
global.fetch = vi.fn();

describe('Claude Code E2E Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/auth/sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            sessionId: 'TEST1234',
            totpSecret: 'TESTSECRET',
          }),
        });
      }
      
      if (url.includes('/verify')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            token: 'test-jwt-token',
          }),
        });
      }
      
      if (url.includes('/api/claude/execute')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            output: 'Hello! I can help you with your development tasks.',
            executionTime: 1500,
          }),
        });
      }
      
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('should show terminal after successful authentication', async () => {
    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    // 1. Enter Host ID
    const hostIdInput = screen.getByPlaceholder(/host.*id/i);
    fireEvent.change(hostIdInput, { target: { value: '12345678' } });
    
    const connectButton = screen.getByRole('button', { name: /connect/i });
    fireEvent.click(connectButton);

    // 2. Enter TOTP
    await waitFor(() => {
      expect(screen.getByPlaceholder(/6.*digit/i)).toBeInTheDocument();
    });
    
    const totpInput = screen.getByPlaceholder(/6.*digit/i);
    fireEvent.change(totpInput, { target: { value: '123456' } });
    
    const verifyButton = screen.getByRole('button', { name: /verify/i });
    fireEvent.click(verifyButton);

    // 3. Should show terminal interface
    await waitFor(() => {
      expect(screen.getByText(/terminal/i)).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Should show command palette
    expect(screen.getByText(/claude code essentials/i)).toBeInTheDocument();
  });

  it('should execute Claude Code commands from terminal', async () => {
    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    // Mock authenticated state by skipping auth steps
    const authState = {
      isAuthenticated: true,
      hostId: '12345678',
      sessionId: 'TEST1234',
      token: 'test-jwt-token',
    };

    // We need to mock the auth hook directly
    vi.doMock('../hooks/useAuth', () => ({
      useAuth: () => authState,
      AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    }));

    // Re-render with mocked auth
    render(<App />);

    // Should show terminal interface immediately
    await waitFor(() => {
      expect(screen.getByText(/terminal/i)).toBeInTheDocument();
    });

    // Click on terminal to open text input
    const terminal = screen.getByRole('region', { name: /terminal/i }) || 
                    screen.getByText(/terminal/i).closest('div');
    
    if (terminal) {
      fireEvent.click(terminal);
    }

    // Type a Claude Code command
    const textInput = screen.getByPlaceholder(/claude.*command/i);
    fireEvent.change(textInput, { target: { value: 'help me fix this bug' } });
    fireEvent.keyPress(textInput, { key: 'Enter', code: 'Enter' });

    // Should show command execution
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/claude/execute'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-jwt-token',
          }),
          body: expect.stringContaining('help me fix this bug'),
        })
      );
    });
  });

  it('should execute commands from playlist buttons', async () => {
    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    // Mock authenticated state
    const authState = {
      isAuthenticated: true,
      hostId: '12345678',
      sessionId: 'TEST1234',
      token: 'test-jwt-token',
    };

    vi.doMock('../hooks/useAuth', () => ({
      useAuth: () => authState,
      AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    }));

    render(<App />);

    // Should show terminal and command palette
    await waitFor(() => {
      expect(screen.getByText(/terminal/i)).toBeInTheDocument();
    });

    // Click on a command button (e.g., "Fix Bug")
    const fixBugButton = screen.getByText(/fix.*bug/i);
    fireEvent.click(fixBugButton);

    // Should execute the command
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/claude/execute'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('find and fix the bug'),
        })
      );
    });
  });

  it('should show command output in terminal', async () => {
    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    // Mock authenticated state
    const authState = {
      isAuthenticated: true,
      hostId: '12345678',
      sessionId: 'TEST1234',
      token: 'test-jwt-token',
    };

    vi.doMock('../hooks/useAuth', () => ({
      useAuth: () => authState,
      AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    }));

    render(<App />);

    // Wait for terminal to appear
    await waitFor(() => {
      expect(screen.getByText(/terminal/i)).toBeInTheDocument();
    });

    // Execute a command through the test interface
    const fixBugButton = screen.getByText(/fix.*bug/i);
    fireEvent.click(fixBugButton);

    // Should show the mocked response in terminal
    await waitFor(() => {
      expect(screen.getByText(/hello.*help.*development/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should handle command execution errors gracefully', async () => {
    // Mock API error response
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/claude/execute')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({
            success: false,
            error: 'Claude Code execution failed',
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    // Mock authenticated state
    const authState = {
      isAuthenticated: true,
      hostId: '12345678',
      sessionId: 'TEST1234',
      token: 'test-jwt-token',
    };

    vi.doMock('../hooks/useAuth', () => ({
      useAuth: () => authState,
      AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    }));

    render(<App />);

    // Wait for terminal and execute command
    await waitFor(() => {
      expect(screen.getByText(/terminal/i)).toBeInTheDocument();
    });

    const fixBugButton = screen.getByText(/fix.*bug/i);
    fireEvent.click(fixBugButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/execution.*failed/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});