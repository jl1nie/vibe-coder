import type { ConnectionStatus } from '@vibe-coder/shared';
import { WebRTCManager } from './websocket-webrtc';
import { DEFAULT_PLAYLIST } from '@vibe-coder/shared';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  LogOut,
  Mic,
  Power,
  Settings,
  Wifi,
  WifiOff,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API type declarations
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
    | null;
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any)
    | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare const SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

type ExecutionStatus =
  | 'idle'
  | 'running'
  | 'awaitingInput'
  | 'cancelled'
  | 'completed';
type AuthStatus =
  | 'unauthenticated'
  | 'entering_host_id'
  | 'entering_totp'
  | 'authenticated';

interface AuthState {
  status: AuthStatus;
  hostId: string;
  sessionId: string | null;
  jwt: string | null;
  error: string | null;
  totpInput: string;
}

interface AppState {
  isRecording: boolean;
  textInput: string;
  currentCommandIndex: number;
  showSettings: boolean;
  connectionStatus: ConnectionStatus;
  voiceSupported: boolean;
  executionStatus: ExecutionStatus;
  promptMessage: string | null;
  webrtcManager: WebRTCManager | null;
  auth: AuthState;
  voiceCommandPending: boolean;
}

const initialState: AppState = {
  isRecording: false,
  textInput: '',
  currentCommandIndex: 0,
  showSettings: false,
  connectionStatus: {
    isConnected: false,
  },
  voiceSupported: false,
  executionStatus: 'idle',
  promptMessage: null,
  webrtcManager: null,
  auth: {
    status: 'unauthenticated',
    hostId: '',
    sessionId: null,
    jwt: null,
    error: null,
    totpInput: '',
  },
  voiceCommandPending: false,
};

const App: React.FC = () => {
  // Server URLs configuration - Use environment variables or defaults
  // WebSocket signaling server URL
  const SIGNALING_URL = import.meta.env.VITE_SIGNALING_SERVER_URL || 
    (window.location.origin.includes('localhost')
      ? 'ws://172.20.243.72:5175'
      : 'wss://signaling.vibe-coder.space');

  const [state, setState] = useState<AppState>(initialState);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const executionStateRef = useRef(state.executionStatus);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    executionStateRef.current = state.executionStatus;
  }, [state.executionStatus]);

  // Initialize xterm.js terminal
  useEffect(() => {
    if (terminalRef.current && !xtermRef.current) {
      const term = new Terminal({
        fontFamily: 'monospace',
        fontSize: 14,
        theme: {
          background: '#0f172a',
          foreground: '#e2e8f0',
          cursor: '#e2e8f0',
          selectionBackground: 'rgba(255, 255, 255, 0.3)',
        },
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Initial mock output to xterm.js
      term.write('Vibe Coder initialized\r\n');
      term.write('🤖 Claude Code ready\r\n');
      term.write('user@localhost:~/project$ ');

      // Handle resize
      const handleResize = () => {
        fitAddon.fit();
      };
      window.addEventListener('resize', handleResize);

      return () => {
        term.dispose();
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  // WebRTC Connection Management
  const initWebRTCConnection = async () => {
    const sessionId = state.auth.sessionId;
    const hostId = state.auth.hostId;
    
    if (!sessionId) {
      console.error('❌ No authenticated sessionId');
      return;
    }

    console.log('🚀 Initializing WebRTC connection with WebSocket signaling...');

    try {
      // Initialize WebRTC manager
      const webrtcManager = new WebRTCManager({
        signalingUrl: SIGNALING_URL,
        sessionId,
        hostId,
        onMessage: (data: string) => {
          if (xtermRef.current) {
            try {
              const message = JSON.parse(data);
              switch (message.type) {
                case 'output':
                  xtermRef.current.write(message.data);
                  break;
                case 'error':
                  xtermRef.current.write(`\r\nError: ${message.error}\r\n`);
                  break;
                case 'completed':
                  xtermRef.current.write('\r\nuser@localhost:~/project$ ');
                  setState(prev => ({ ...prev, executionStatus: 'idle' }));
                  break;
                case 'prompt':
                  setState(prev => ({
                    ...prev,
                    executionStatus: 'awaitingInput',
                    promptMessage: message.message,
                  }));
                  break;
                default:
                  xtermRef.current.write(data);
              }
            } catch (e) {
              xtermRef.current.write(data);
            }
          }
        },
        onConnectionChange: (connected: boolean) => {
          setState(prev => ({
            ...prev,
            connectionStatus: { isConnected: connected },
          }));
        },
        onError: (error: string) => {
          if (xtermRef.current) {
            xtermRef.current.write(`\r\nWebRTC Error: ${error}\r\n`);
          }
        }
      });

      // Connect to WebRTC
      const success = await webrtcManager.connect();
      
      if (success) {
        setState(prev => ({ ...prev, webrtcManager }));
        console.log('✅ WebRTC connection initialized successfully');
      } else {
        console.error('❌ WebRTC connection failed');
        setState(prev => ({
          ...prev,
          connectionStatus: { isConnected: false },
        }));
      }

    } catch (error) {
      console.error('❌ WebRTC initialization failed:', error);
      if (xtermRef.current) {
        xtermRef.current.write(`\r\nWebRTC connection failed: ${error instanceof Error ? error.message : 'Unknown error'}\r\n`);
      }
      setState(prev => ({
        ...prev,
        connectionStatus: { isConnected: false },
        webrtcManager: null,
      }));
    }
  };

  // Auto-initialize WebRTC connection after authentication
  useEffect(() => {
    if (state.auth.status === 'authenticated' && !state.webrtcManager) {
      console.log(
        'Authentication successful, initializing WebRTC connection...'
      );
      initWebRTCConnection();
    }
  }, [state.auth.status, state.webrtcManager]);

  // Check voice recognition support and initialize
  useEffect(() => {
    const SpeechRecognitionAPI =
      window.webkitSpeechRecognition || window.SpeechRecognition;
    const supported = !!SpeechRecognitionAPI;

    setState(prev => ({ ...prev, voiceSupported: supported }));

    if (supported) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'ja-JP'; // Japanese primary, will fallback to browser default
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log('Voice recognition started');
        setState(prev => ({ ...prev, isRecording: true }));
        if (xtermRef.current) {
          xtermRef.current.write('\r\n🎤 Listening...\r\n');
        }
      };

      recognition.onresult = event => {
        const transcript = event.results[0][0].transcript;
        console.log('Voice recognition result:', transcript);

        if (xtermRef.current) {
          xtermRef.current.write(`🗣️ "${transcript}"\r\n`);
        }

        // Execute the voice command automatically
        setState(prev => ({
          ...prev,
          textInput: transcript,
          voiceCommandPending: true,
        }));
      };

      recognition.onerror = event => {
        console.error('Voice recognition error:', event.error);
        setState(prev => ({ ...prev, isRecording: false }));
        if (xtermRef.current) {
          xtermRef.current.write(`\r\n❌ Voice error: ${event.error}\r\n`);
        }
      };

      recognition.onend = () => {
        console.log('Voice recognition ended');
        setState(prev => ({ ...prev, isRecording: false }));
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [state.auth.jwt]);

  const executeCommand = useCallback(
    async (command: string) => {
      if (!state.auth.jwt) {
        if (xtermRef.current) {
          xtermRef.current.write(
            '\r\nError: Not authenticated. Please login first.\r\n'
          );
        }
        return;
      }

      if (xtermRef.current) {
        xtermRef.current.write(
          `user@localhost:~/project$ claude-code "${command}"\r\n`
        );
        xtermRef.current.write('🤖 Executing command...\r\n');
      }

      setState(prev => ({
        ...prev,
        executionStatus: 'running',
      }));

      try {
        // Execute command via WebRTC P2P connection only
        if (state.webrtcManager) {
          const webrtcState = state.webrtcManager.getState();
          if (webrtcState.dataChannel && webrtcState.dataChannel.readyState === 'open') {
            // Use WebRTC data channel for real-time communication
            const success = state.webrtcManager.sendMessage(
              JSON.stringify({
                type: 'claude-command',
                command,
                timestamp: Date.now(),
              })
            );
            if (success) {
              console.log('✅ Command sent via WebRTC');
              return; // Exit early if WebRTC succeeded
            }
          }
        }
        
        // WebRTC is required - no fallback to REST API
        if (xtermRef.current) {
          xtermRef.current.write('\r\n❌ WebRTC P2P connection required. Please check connection.\r\n');
          xtermRef.current.write('user@localhost:~/project$ ');
        }
        setState(prev => ({ ...prev, executionStatus: 'idle' }));
      } catch (error) {
        if (xtermRef.current) {
          xtermRef.current.write(
            `\r\nError: ${error instanceof Error ? error.message : 'Unknown error'}\r\n`
          );
          xtermRef.current.write('user@localhost:~/project$ ');
        }
        setState(prev => ({ ...prev, executionStatus: 'idle' }));
      }
    },
    [state.auth.jwt, state.webrtcManager]
  );

  const handlePromptResponse = async (response: string) => {
    if (xtermRef.current) {
      xtermRef.current.write(`${response}\r\n`);
    }

    if (state.webrtcManager) {
      state.webrtcManager.sendMessage(JSON.stringify({ type: 'response', response }));
    } else {
      if (xtermRef.current) {
        xtermRef.current.write('\r\nWebRTC Data Channel is not open.\r\n');
      }
      setState(prev => ({ ...prev, executionStatus: 'idle' }));
    }
  };

  // Handle voice command execution
  useEffect(() => {
    if (state.voiceCommandPending && state.textInput.trim()) {
      executeCommand(state.textInput);
      setState(prev => ({
        ...prev,
        voiceCommandPending: false,
        textInput: '',
      }));
    }
  }, [state.voiceCommandPending, state.textInput, executeCommand]);

  // Handle ESC key for interruption
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && executionStateRef.current === 'running') {
        if (xtermRef.current) {
          xtermRef.current.write('\r\nExecution cancelled by user.\r\n');
          xtermRef.current.write('user@localhost:~/project$ ');
        }
        setState(prev => ({
          ...prev,
          executionStatus: 'cancelled',
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Authentication functions
  const handleHostIdSubmit = async () => {
    if (!state.auth.hostId.trim() || state.auth.hostId.length !== 8) {
      setState(prev => ({
        ...prev,
        auth: { ...prev.auth, error: '8桁のHost IDを入力してください' },
      }));
      return;
    }

    try {
      setState(prev => ({
        ...prev,
        auth: { ...prev.auth, error: null },
      }));

      // Create WebRTC manager for authentication via signaling
      const webrtcManager = new WebRTCManager({
        sessionId: 'temp-session', // Temporary session ID
        signalingUrl: SIGNALING_URL,
        hostId: state.auth.hostId,
        onMessage: () => {}, // Temporary empty handler
        onConnectionChange: () => {}
      });

      // Authenticate with host via WebSocket signaling
      const authResult = await webrtcManager.authenticateHost(state.auth.hostId);

      // Go directly to TOTP input
      setState(prev => ({
        ...prev,
        auth: {
          ...prev.auth,
          status: 'entering_totp',
          sessionId: authResult.sessionId,
          totpInput: '', // Clear TOTP input
        },
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        auth: {
          ...prev.auth,
          error: error instanceof Error ? error.message : '接続エラー',
        },
      }));
    }
  };

  const handleTotpSubmit = async (totpCode: string) => {
    try {
      console.log('handleTotpSubmit called with:', totpCode);
      setState(prev => ({
        ...prev,
        auth: { ...prev.auth, error: null },
      }));

      // If no sessionId, authentication flow should start from host ID again
      if (!state.auth.sessionId) {
        throw new Error('セッションIDがありません。Host IDから再度認証してください。');
      }

      // Create WebRTC manager for TOTP verification via signaling
      const webrtcManager = new WebRTCManager({
        sessionId: state.auth.sessionId || 'temp-session',
        signalingUrl: SIGNALING_URL,
        hostId: state.auth.hostId,
        onMessage: () => {}, // Temporary empty handler
        onConnectionChange: () => {}
      });

      // Verify TOTP via WebSocket signaling
      const verifyResult = await webrtcManager.verifyTotp(state.auth.sessionId!, totpCode);

      setState(prev => ({
        ...prev,
        auth: {
          ...prev.auth,
          status: 'authenticated',
          jwt: verifyResult.token,
        },
      }));

      console.log('✅ TOTP verification successful via signaling');
    } catch (error) {
      console.error('handleTotpSubmit error:', error);
      setState(prev => ({
        ...prev,
        auth: {
          ...prev.auth,
          error: error instanceof Error ? error.message : '認証エラー',
          totpInput: '', // Clear TOTP input on error
        },
      }));
    }
  };

  const handleTextSubmit = () => {
    if (state.textInput.trim()) {
      if (state.executionStatus === 'awaitingInput') {
        handlePromptResponse(state.textInput);
      } else {
        executeCommand(state.textInput);
      }
      setState(prev => ({ ...prev, textInput: '' }));
    }
  };

  const handleVoiceToggle = () => {
    if (!state.voiceSupported || !recognitionRef.current) return;

    if (state.isRecording) {
      // Stop recording
      recognitionRef.current.stop();
    } else {
      // Start recording
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start voice recognition:', error);
        if (xtermRef.current) {
          xtermRef.current.write(
            `\r\n❌ Voice recognition failed to start\r\n`
          );
        }
      }
    }
  };

  const handleLogout = () => {
    // Close WebRTC connections
    if (state.webrtcManager) {
      state.webrtcManager.cleanup();
    }

    // Return to 2FA screen (keep hostId and session info)
    setState(prev => ({
      ...prev,
      auth: {
        ...prev.auth,
        status: 'entering_totp',
        jwt: null,
        error: null,
        totpInput: '', // Clear TOTP input
      },
      connectionStatus: { isConnected: false },
      webrtcManager: null,
      executionStatus: 'idle',
      promptMessage: null,
    }));

    // Clear terminal
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.write(
        'Logged out. Please enter 2FA code to reconnect.\r\n'
      );
    }
  };

  const scrollCommands = (direction: 'left' | 'right') => {
    const currentCommands = DEFAULT_PLAYLIST.commands;
    if (direction === 'left') {
      setState(prev => ({
        ...prev,
        currentCommandIndex: Math.max(0, prev.currentCommandIndex - 1),
      }));
    } else {
      setState(prev => ({
        ...prev,
        currentCommandIndex: Math.min(
          currentCommands.length - 5,
          prev.currentCommandIndex + 1
        ),
      }));
    }
  };

  const currentCommands = DEFAULT_PLAYLIST.commands;
  const visibleCommands = currentCommands.slice(
    state.currentCommandIndex,
    state.currentCommandIndex + 5
  );
  const isExecuting =
    state.executionStatus === 'running' ||
    state.executionStatus === 'awaitingInput';

  // Render authentication screens
  const renderAuthScreen = () => {
    if (state.auth.status === 'entering_host_id') {
      return (
        <div className="flex-1 p-6 flex flex-col items-center justify-center">
          <div className="glass-morphism rounded-xl p-6 w-full max-w-md">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">ホスト接続</h2>
              <p className="text-sm opacity-80">
                8桁のHost IDを入力してください
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={state.auth.hostId}
                onChange={e =>
                  setState(prev => ({
                    ...prev,
                    auth: {
                      ...prev.auth,
                      hostId: e.target.value.replace(/\D/g, '').slice(0, 8),
                    },
                  }))
                }
                onKeyDown={e => e.key === 'Enter' && handleHostIdSubmit()}
                className="w-full p-4 bg-white/10 rounded-lg text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="12345678"
                maxLength={8}
                autoFocus
                data-testid="host-id-input"
              />

              {state.auth.error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-red-400 text-lg">❌</span>
                    <p className="text-red-400 text-sm font-medium">
                      {state.auth.error}
                    </p>
                  </div>
                  <p className="text-red-300 text-xs mt-1 opacity-80">
                    ホストサーバーが起動していることを確認してください。
                  </p>
                </div>
              )}

              <button
                onClick={handleHostIdSubmit}
                disabled={state.auth.hostId.length !== 8}
                className="w-full p-4 glass-morphism rounded-lg hover:bg-white/20 transition-all touch-friendly disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="connect-button"
              >
                接続
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (state.auth.status === 'entering_totp') {
      return (
        <div className="flex-1 p-6 flex flex-col items-center justify-center">
          <div className="glass-morphism rounded-xl p-6 w-full max-w-md">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">2FA認証</h2>
              <p className="text-sm opacity-80 mb-4">
                Authenticatorアプリから6桁の認証コードを入力してください
              </p>
              <p className="text-xs opacity-60">
                2FA設定がまだの場合は、ホストマシンから<br />
                http://localhost:8080/setup にアクセスしてください
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={state.auth.totpInput}
                onChange={e => {
                  const code = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setState(prev => ({
                    ...prev,
                    auth: { ...prev.auth, totpInput: code },
                  }));
                  if (code.length === 6) {
                    handleTotpSubmit(code);
                  }
                }}
                className="w-full p-4 bg-white/10 rounded-lg text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="000000"
                maxLength={6}
                autoFocus
                data-testid="totp-input"
              />

              <button
                onClick={() => handleTotpSubmit(state.auth.totpInput)}
                disabled={state.auth.totpInput.length !== 6}
                className="w-full p-4 glass-morphism rounded-lg hover:bg-white/20 transition-all touch-friendly disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                data-testid="authenticate-button"
              >
                認証
              </button>

              {state.auth.error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-red-400 text-lg">❌</span>
                    <p className="text-red-400 text-sm font-medium">
                      {state.auth.error}
                    </p>
                  </div>
                  <p className="text-red-300 text-xs mt-1 opacity-80">
                    認証コードを確認してください。時間切れの場合は新しいコードを入力してください。
                  </p>
                </div>
              )}

              <button
                onClick={() =>
                  setState(prev => ({
                    ...prev,
                    auth: {
                      ...prev.auth,
                      status: 'entering_host_id',
                      error: null,
                      sessionId: null,
                      hostId: '', // Clear Host ID input
                      totpInput: '', // Clear TOTP input
                    },
                  }))
                }
                className="w-full p-3 glass-morphism rounded-lg hover:bg-white/20 transition-all touch-friendly text-sm opacity-80"
                data-testid="back-button"
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Default: show host ID entry button
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4" data-testid="welcome-title">Welcome</h2>
          <p className="text-lg opacity-80 mb-2">スマホでClaude Codeを実行</p>
          <p className="text-sm opacity-60">
            まずはホストサーバーに接続してください
          </p>
        </div>

        <button
          onClick={() =>
            setState(prev => ({
              ...prev,
              auth: { ...prev.auth, status: 'entering_host_id' },
            }))
          }
          className="glass-morphism rounded-xl p-6 hover:bg-white/20 transition-all touch-friendly"
          data-testid="connect-to-host-button"
        >
          <div className="text-center">
            <div className="text-4xl mb-3">🔗</div>
            <div className="text-lg font-medium">ホストに接続</div>
            <div className="text-sm opacity-80">8桁のHost IDで接続</div>
          </div>
        </button>
      </div>
    );
  };

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-white flex flex-col relative overflow-hidden mobile-optimized full-height-mobile">
      {/* Header */}
      <div className="relative z-10 h-16 p-3 flex items-center justify-between glass-morphism safe-area-inset-top">
        <div className="flex items-center space-x-2">
          {/* <Terminal className="w-5 h-5 text-green-400" /> */}
          <div>
            <h1 className="text-lg font-bold" data-testid="app-title">Vibe Coder</h1>
            <p className="text-xs opacity-80">Claude Code Mobile</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            {state.connectionStatus.isConnected ? (
              <Wifi className="w-4 h-4 text-green-400" data-testid="wifi-on" />
            ) : (
              <WifiOff
                className="w-4 h-4 text-red-400"
                data-testid="wifi-off"
              />
            )}
          </div>
          <button
            onClick={() => executeCommand('/exit')}
            className="touch-friendly glass-morphism rounded-full hover:bg-white/20 ml-2"
            title="セッション終了 (/exit)"
            disabled={isExecuting}
          >
            <Power className="w-4 h-4" />
          </button>
          {state.auth.status === 'authenticated' && (
            <button
              onClick={handleLogout}
              className="touch-friendly glass-morphism rounded-full hover:bg-white/20"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setState(prev => ({ ...prev, showSettings: true }))}
            className="touch-friendly glass-morphism rounded-full hover:bg-white/20"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Show authentication screens or main terminal interface */}
      {state.auth.status !== 'authenticated' ? (
        renderAuthScreen()
      ) : (
        <>
          {/* Terminal Section */}
          <div className="relative z-10 p-3 flex flex-col min-h-0 flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center">
                Terminal
              </span>
              <span className="text-xs opacity-70" data-testid="connection-status">
                {state.executionStatus === 'running' && 'Running...'}
                {state.executionStatus === 'awaitingInput' &&
                  'Awaiting input...'}
                {state.executionStatus === 'idle' && 'Ready'}
                {state.executionStatus === 'completed' && 'Ready'}
                {state.executionStatus === 'cancelled' && 'Ready'}
              </span>
            </div>

            <div
              ref={terminalRef}
              data-testid="terminal-container"
              className="glass-morphism rounded-lg p-3 flex-1 overflow-y-auto terminal-output cursor-pointer hover:border-gray-600 transition-colors custom-scrollbar min-h-0"
            >
              {/* xterm.js will render here */}
            </div>
          </div>

          {/* Text Input Area */}
          <div
            className={`relative z-10 px-3 py-2 glass-morphism border-t border-white/10 flex-shrink-0 ${isExecuting ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className="flex items-center">
              <input
                type="text"
                value={state.textInput}
                onChange={e =>
                  setState(prev => ({ ...prev, textInput: e.target.value }))
                }
                onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
                className="flex-1 bg-transparent text-white outline-none"
                disabled={isExecuting}
                data-testid="command-input"
                placeholder="Enter command..."
              />
              <button
                onClick={handleTextSubmit}
                className="ml-2 touch-friendly glass-morphism rounded-full hover:bg-white/20"
                title="Execute Command"
                disabled={isExecuting}
              >
                <CornerDownLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (xtermRef.current) {
                    xtermRef.current.write('\x1b[A'); // Up arrow
                  }
                }}
                className="touch-friendly glass-morphism rounded-md w-6 h-6 flex items-center justify-center ml-2"
                title="Cursor Up"
                disabled={isExecuting}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (xtermRef.current) {
                    xtermRef.current.write('\x1b[B'); // Down arrow
                  }
                }}
                className="touch-friendly glass-morphism rounded-md w-6 h-6 flex items-center justify-center"
                title="Cursor Down"
                disabled={isExecuting}
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                onClick={handleVoiceToggle}
                className={`ml-2 touch-friendly rounded-full backdrop-blur-sm transition-all ${state.isRecording ? 'bg-red-500 pulse-recording' : 'glass-morphism hover:bg-white/20'} ${!state.voiceSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={
                  state.voiceSupported
                    ? state.isRecording
                      ? 'Stop recording'
                      : 'Start voice input'
                    : 'Voice input not supported'
                }
                disabled={!state.voiceSupported}
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Command Selector */}
          <div
            className={`relative z-10 glass-morphism border-t border-white/10 pb-3 flex flex-col flex-shrink-0 ${isExecuting ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className="p-3 flex-1">
              <div className="flex items-center justify-between h-full">
                <button
                  onClick={() => scrollCommands('left')}
                  disabled={state.currentCommandIndex === 0}
                  className={`touch-friendly rounded-full transition-colors ${state.currentCommandIndex === 0 ? 'bg-gray-700 text-gray-500' : 'glass-morphism text-white hover:bg-white/20'}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex-1 mx-3 overflow-hidden">
                  <div className="flex transition-transform duration-300 ease-out">
                    {visibleCommands.map((task, idx) => (
                      <button
                        key={state.currentCommandIndex + idx}
                        onClick={() => executeCommand(task.command)}
                        className="flex-shrink-0 w-16 flex flex-col items-center p-2 mx-1 glass-morphism rounded-lg hover:bg-white/10 transition-all touch-friendly no-select"
                      >
                        <span className="text-xl mb-1">{task.icon}</span>
                        <span className="text-xs font-medium text-center leading-tight">
                          {task.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => scrollCommands('right')}
                  disabled={
                    state.currentCommandIndex >= currentCommands.length - 5
                  }
                  className={`touch-friendly rounded-full transition-colors ${state.currentCommandIndex >= currentCommands.length - 5 ? 'bg-gray-700 text-gray-500' : 'glass-morphism text-white hover:bg-white/20'}`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex justify-center mt-1 space-x-1">
                {Array.from({
                  length: Math.ceil(currentCommands.length / 5),
                }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1 h-1 rounded-full transition-colors ${Math.floor(state.currentCommandIndex / 5) === idx ? 'bg-white' : 'bg-white/30'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Settings Modal */}
      {state.showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-morphism rounded-xl p-4 w-full max-w-sm max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Settings</h3>
              <button
                onClick={() =>
                  setState(prev => ({ ...prev, showSettings: false }))
                }
                className="text-gray-400 hover:text-white touch-friendly"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 p-3 bg-white/5 rounded-lg">
              <h4 className="font-medium mb-2">Voice Recognition</h4>
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${state.voiceSupported ? 'bg-green-400' : 'bg-red-400'}`}
                ></div>
                <span className="text-sm">
                  {state.voiceSupported ? 'Available' : 'Not supported'}
                </span>
              </div>
              <p className="text-xs opacity-60 mt-1">
                {state.voiceSupported
                  ? 'Tap microphone button and speak commands in Japanese or English'
                  : 'Voice recognition is not supported in this browser'}
              </p>
            </div>

            <h4 className="font-medium mb-2">Command Playlists</h4>
            <div className="space-y-2 flex-1 overflow-y-auto mb-4">
              <div className="w-full p-3 rounded-lg text-left bg-blue-600 text-white">
                <div className="flex items-start space-x-3">
                  <span className="text-lg">🤖</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {DEFAULT_PLAYLIST.metadata.name}
                    </div>
                    <div className="text-xs opacity-80">Built-in</div>
                    <div className="text-xs opacity-60 mt-1">
                      {DEFAULT_PLAYLIST.metadata.description}
                    </div>
                  </div>
                </div>
              </div>

              <button className="w-full p-3 rounded-lg text-left bg-gray-700 hover:bg-gray-600 transition-colors border-2 border-dashed border-gray-500">
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-lg">📁</span>
                  <span className="text-sm">Upload Playlist JSON</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
