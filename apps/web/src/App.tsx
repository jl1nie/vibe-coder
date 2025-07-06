import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Settings,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  ArrowUp,
  ArrowDown,
  CornerDownLeft
} from 'lucide-react';
import { DEFAULT_PLAYLIST } from '@vibe-coder/shared';
import type { ConnectionStatus, SignalMessage } from '@vibe-coder/shared';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

type ExecutionStatus = 'idle' | 'running' | 'awaitingInput' | 'cancelled' | 'completed';
type AuthStatus = 'unauthenticated' | 'entering_host_id' | 'entering_totp' | 'authenticated';

interface AuthState {
  status: AuthStatus;
  hostId: string;
  sessionId: string | null;
  totpSecret: string | null;
  jwt: string | null;
  error: string | null;
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
  peerConnection: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  auth: AuthState;
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
  peerConnection: null,
  dataChannel: null,
  auth: {
    status: 'unauthenticated',
    hostId: '',
    sessionId: null,
    totpSecret: null,
    jwt: null,
    error: null,
  },
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(initialState);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const executionStateRef = useRef(state.executionStatus);

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
  const initWebRTCConnection = () => {
    const SIGNALING_SERVER_URL = 'http://localhost:8080';
    let pc: RTCPeerConnection | null = null;
    let dc: RTCDataChannel | null = null;
    let sessionId: string | null = null;

    const createPeerConnection = async () => {
      pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          // Send ICE candidate to signaling server
          console.log('Sending ICE candidate:', event.candidate);
          const signalMessage: SignalMessage = {
            type: 'candidate',
            sessionId: sessionId || '',
            hostId: 'vibe-coder-host',
            candidate: event.candidate.toJSON(),
          };
          fetch(`${SIGNALING_SERVER_URL}/api/webrtc/signal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(signalMessage),
          }).catch(error => console.error('Failed to send ICE candidate:', error));
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc?.iceConnectionState);
        setState(prev => ({
          ...prev,
          connectionStatus: { isConnected: pc?.iceConnectionState === 'connected' },
        }));
      };

      pc.ondatachannel = (event) => {
        dc = event.channel;
        console.log('Data channel created:', dc);
        setState(prev => ({ ...prev, dataChannel: dc }));

        dc.onmessage = (event) => {
          console.log('Data channel message:', event.data);
          try {
            const message = JSON.parse(event.data);
            
            if (xtermRef.current) {
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
                    promptMessage: message.message 
                  }));
                  break;
                default:
                  // Fallback for plain text messages
                  xtermRef.current.write(event.data);
              }
            }
          } catch (e) {
            // Handle plain text messages
            if (xtermRef.current) {
              xtermRef.current.write(event.data);
            }
          }
        };

        dc.onopen = () => {
          console.log('Data channel opened');
          if (xtermRef.current) {
            xtermRef.current.write('\r\nWebRTC Data Channel connected.\r\n');
          }
        };

        dc.onclose = () => {
          console.log('Data channel closed');
          if (xtermRef.current) {
            xtermRef.current.write('\r\nWebRTC Data Channel disconnected.\r\n');
          }
          setState(prev => ({ ...prev, dataChannel: null }));
        };

        dc.onerror = (error) => {
          console.error('Data channel error:', error);
          if (xtermRef.current) {
            xtermRef.current.write(`\r\nData Channel Error: ${error instanceof Error ? error.message : 'Unknown error'}\r\n`);
          }
        };
      };

      // Create data channel for sending messages
      dc = pc.createDataChannel('terminal');
      setState(prev => ({ ...prev, dataChannel: dc }));

      // TODO: Implement offer/answer exchange with signaling server
      // For now, just log initial state
      console.log('Peer connection created.');
    };

    const initWebRTC = async () => {
      // Generate a unique session ID (for simplicity, using a timestamp)
      sessionId = `session-${Date.now()}`;

      // Create a new session on the signaling server using unified API
      try {
        const createSessionMessage: SignalMessage = {
          type: 'create-session',
          sessionId: sessionId || '',
          hostId: 'vibe-coder-host',
        };
        
        const sessionResponse = await fetch(`${SIGNALING_SERVER_URL}/api/webrtc/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createSessionMessage),
        });
        const sessionData = await sessionResponse.json();
        if (!sessionData.success) {
          throw new Error(`Failed to create session: ${sessionData.error}`);
        }
        console.log('Session created successfully');

        await createPeerConnection();

        // Create offer and send to signaling server
        const offer = await pc?.createOffer();
        await pc?.setLocalDescription(offer);

        const signalMessage: SignalMessage = {
          type: 'offer',
          sessionId: sessionId || '',
          hostId: 'vibe-coder-host',
          offer: { type: offer?.type as "offer", sdp: offer?.sdp || '' },
        };

        const signalResponse = await fetch(`${SIGNALING_SERVER_URL}/api/webrtc/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signalMessage),
        });
        const signalData = await signalResponse.json();
        if (!signalData.success) {
          throw new Error(`Failed to send offer: ${signalData.error}`);
        }
        console.log('Offer sent to signaling server.');

        // Poll for answer and ICE candidates from signaling server
        let answerReceived = false;
        
        const pollForAnswer = async () => {
          if (answerReceived) return;
          
          const getAnswerMessage: SignalMessage = {
            type: 'get-answer',
            sessionId: sessionId || '',
            hostId: 'vibe-coder-host',
          };
          
          const answerResponse = await fetch(`${SIGNALING_SERVER_URL}/api/webrtc/signal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(getAnswerMessage),
          });
          const answerData = await answerResponse.json();

          if (answerData.success && answerData.answer) {
            console.log('Received answer:', answerData.answer);
            const remoteDesc = new RTCSessionDescription(answerData.answer);
            await pc?.setRemoteDescription(remoteDesc);
            answerReceived = true;
            if (xtermRef.current) {
              xtermRef.current.write('\r\nWebRTC connection established.\r\n');
            }
          } else {
            setTimeout(pollForAnswer, 1000); // Poll every 1 second
          }
        };

        const pollForCandidates = async () => {
          const getCandidatesMessage: SignalMessage = {
            type: 'get-candidate',
            sessionId: sessionId || '',
            hostId: 'vibe-coder-host',
          };
          
          try {
            const candidatesResponse = await fetch(`${SIGNALING_SERVER_URL}/api/webrtc/signal`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(getCandidatesMessage),
            });
            const candidatesData = await candidatesResponse.json();

            if (candidatesData.success && candidatesData.candidates?.length > 0) {
              console.log('Received ICE candidates:', candidatesData.candidates);
              for (const candidateData of candidatesData.candidates) {
                try {
                  const candidate = JSON.parse(candidateData.candidate);
                  await pc?.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                  console.error('Failed to add ICE candidate:', error);
                }
              }
            }
          } catch (error) {
            console.error('Failed to fetch ICE candidates:', error);
          }
          
          // Continue polling for more candidates
          setTimeout(pollForCandidates, 2000);
        };

        pollForAnswer();
        pollForCandidates();

      } catch (error: any) {
        console.error('WebRTC initialization error:', error);
        if (xtermRef.current) {
          xtermRef.current.write(`\r\nWebRTC Init Error: ${error instanceof Error ? error.message : 'Unknown error'}\r\n`);
        }
        setState(prev => ({ ...prev, connectionStatus: { isConnected: false } }));
      }
    };

    initWebRTC();

    return () => {
      if (pc) {
        pc.close();
      }
      if (dc) {
        dc.close();
      }
    };
  };

  // Auto-initialize WebRTC connection after authentication
  useEffect(() => {
    if (state.auth.status === 'authenticated' && !state.peerConnection) {
      console.log('Authentication successful, initializing WebRTC connection...');
      initWebRTCConnection();
    }
  }, [state.auth.status]);

  // Check voice recognition support
  useEffect(() => {
    const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setState(prev => ({ ...prev, voiceSupported: supported }));
  }, []);

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

  const executeCommand = async (command: string) => {
    if (!state.auth.jwt) {
      if (xtermRef.current) {
        xtermRef.current.write('\r\nError: Not authenticated. Please login first.\r\n');
      }
      return;
    }

    if (xtermRef.current) {
      xtermRef.current.write(`user@localhost:~/project$ claude-code "${command}"\r\n`);
      xtermRef.current.write('🤖 Executing command...\r\n');
    }
    
    setState(prev => ({
      ...prev,
      executionStatus: 'running',
    }));

    try {
      // Execute command via REST API (fallback) or WebRTC (if available)
      if (state.dataChannel && state.dataChannel.readyState === 'open') {
        // Use WebRTC data channel for real-time communication
        state.dataChannel.send(JSON.stringify({ 
          type: 'claude-command', 
          command,
          timestamp: Date.now()
        }));
      } else {
        // Use REST API as fallback
        const response = await fetch('http://localhost:8080/api/claude/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.auth.jwt}`
          },
          body: JSON.stringify({ command })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (xtermRef.current) {
          if (result.output) {
            xtermRef.current.write(result.output + '\r\n');
          }
          if (result.error) {
            xtermRef.current.write(`Error: ${result.error}\r\n`);
          }
          xtermRef.current.write('user@localhost:~/project$ ');
        }

        setState(prev => ({ ...prev, executionStatus: 'idle' }));
      }
    } catch (error) {
      if (xtermRef.current) {
        xtermRef.current.write(`\r\nError: ${error instanceof Error ? error.message : 'Unknown error'}\r\n`);
        xtermRef.current.write('user@localhost:~/project$ ');
      }
      setState(prev => ({ ...prev, executionStatus: 'idle' }));
    }
  };

  const handlePromptResponse = async (response: string) => {
    if (xtermRef.current) {
      xtermRef.current.write(`${response}\r\n`);
    }

    if (state.dataChannel && state.dataChannel.readyState === 'open') {
      state.dataChannel.send(JSON.stringify({ type: 'response', response }));
    } else {
      if (xtermRef.current) {
        xtermRef.current.write('\r\nWebRTC Data Channel is not open.\r\n');
      }
      setState(prev => ({ ...prev, executionStatus: 'idle' }));
    }
  };
  
  // Authentication functions
  const handleHostIdSubmit = async () => {
    if (!state.auth.hostId.trim() || state.auth.hostId.length !== 8) {
      setState(prev => ({ 
        ...prev, 
        auth: { ...prev.auth, error: '8桁のHost IDを入力してください' }
      }));
      return;
    }

    try {
      setState(prev => ({ 
        ...prev, 
        auth: { ...prev.auth, error: null }
      }));
      
      // Create session with host server
      const response = await fetch('http://localhost:8080/api/auth/sessions', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('セッションの作成に失敗しました');
      }
      
      const data = await response.json();
      
      setState(prev => ({ 
        ...prev, 
        auth: { 
          ...prev.auth, 
          status: 'entering_totp',
          sessionId: data.sessionId,
          totpSecret: data.totpSecret,
        }
      }));

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        auth: { ...prev.auth, error: error instanceof Error ? error.message : '接続エラー' }
      }));
    }
  };

  const handleTotpSubmit = async (totpCode: string) => {
    if (!state.auth.sessionId) return;

    try {
      setState(prev => ({ 
        ...prev, 
        auth: { ...prev.auth, error: null }
      }));

      const response = await fetch(`http://localhost:8080/api/auth/sessions/${state.auth.sessionId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totpCode }),
      });

      if (!response.ok) {
        throw new Error('認証に失敗しました');
      }

      const data = await response.json();
      
      if (data.success) {
        setState(prev => ({ 
          ...prev, 
          auth: { 
            ...prev.auth, 
            status: 'authenticated',
            jwt: data.token,
          }
        }));
        
        // Start WebRTC connection after successful authentication
        setTimeout(() => {
          initWebRTCConnection();
        }, 1000);
      } else {
        throw new Error(data.message || '認証に失敗しました');
      }

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        auth: { ...prev.auth, error: error instanceof Error ? error.message : '認証エラー' }
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
  
  const scrollCommands = (direction: 'left' | 'right') => {
    const currentCommands = DEFAULT_PLAYLIST.commands;
    if (direction === 'left') {
      setState(prev => ({ ...prev, currentCommandIndex: Math.max(0, prev.currentCommandIndex - 1) }));
    } else {
      setState(prev => ({ ...prev, currentCommandIndex: Math.min(currentCommands.length - 5, prev.currentCommandIndex + 1) }));
    }
  };
  
  const currentCommands = DEFAULT_PLAYLIST.commands;
  const visibleCommands = currentCommands.slice(state.currentCommandIndex, state.currentCommandIndex + 5);
  const isExecuting = state.executionStatus === 'running' || state.executionStatus === 'awaitingInput';
  
  // Render authentication screens
  const renderAuthScreen = () => {
    if (state.auth.status === 'entering_host_id') {
      return (
        <div className="flex-1 p-6 flex flex-col items-center justify-center">
          <div className="glass-morphism rounded-xl p-6 w-full max-w-md">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">ホスト接続</h2>
              <p className="text-sm opacity-80">8桁のHost IDを入力してください</p>
            </div>
            
            <div className="space-y-4">
              <input
                type="text"
                value={state.auth.hostId}
                onChange={(e) => setState(prev => ({ 
                  ...prev, 
                  auth: { ...prev.auth, hostId: e.target.value.replace(/\D/g, '').slice(0, 8) }
                }))}
                onKeyDown={(e) => e.key === 'Enter' && handleHostIdSubmit()}
                className="w-full p-4 bg-white/10 rounded-lg text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="12345678"
                maxLength={8}
                autoFocus
              />
              
              {state.auth.error && (
                <p className="text-red-400 text-sm text-center">{state.auth.error}</p>
              )}
              
              <button
                onClick={handleHostIdSubmit}
                disabled={state.auth.hostId.length !== 8}
                className="w-full p-4 glass-morphism rounded-lg hover:bg-white/20 transition-all touch-friendly disabled:opacity-50 disabled:cursor-not-allowed"
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
              <p className="text-sm opacity-80 mb-4">TOTP秘密鍵をAuthenticatorアプリに登録してください</p>
              
              {state.auth.totpSecret && (
                <div className="bg-white/5 rounded-lg p-3 mb-4">
                  <p className="text-xs opacity-60 mb-2">TOTP秘密鍵:</p>
                  <p className="font-mono text-sm break-all select-all">{state.auth.totpSecret}</p>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <input
                type="text"
                onChange={(e) => {
                  const code = e.target.value.replace(/\D/g, '').slice(0, 6);
                  if (code.length === 6) {
                    handleTotpSubmit(code);
                  }
                }}
                className="w-full p-4 bg-white/10 rounded-lg text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="123456"
                maxLength={6}
                autoFocus
              />
              
              {state.auth.error && (
                <p className="text-red-400 text-sm text-center">{state.auth.error}</p>
              )}
              
              <button
                onClick={() => setState(prev => ({ 
                  ...prev, 
                  auth: { ...prev.auth, status: 'entering_host_id', error: null }
                }))}
                className="w-full p-3 glass-morphism rounded-lg hover:bg-white/20 transition-all touch-friendly text-sm opacity-80"
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
          <h2 className="text-3xl font-bold mb-4">Vibe Coder</h2>
          <p className="text-lg opacity-80 mb-2">スマホでClaude Codeを実行</p>
          <p className="text-sm opacity-60">まずはホストサーバーに接続してください</p>
        </div>
        
        <button
          onClick={() => setState(prev => ({ 
            ...prev, 
            auth: { ...prev.auth, status: 'entering_host_id' }
          }))}
          className="glass-morphism rounded-xl p-6 hover:bg-white/20 transition-all touch-friendly"
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
            <h1 className="text-lg font-bold">Vibe Coder</h1>
            <p className="text-xs opacity-80">Claude Code Mobile</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            {state.connectionStatus.isConnected ? (
              <Wifi className="w-4 h-4 text-green-400" data-testid="wifi-on" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" data-testid="wifi-off" />
            )}
          </div>
          
          <button 
            onClick={() => setState(prev => ({ ...prev, isRecording: !prev.isRecording }))}
            className={`touch-friendly rounded-full backdrop-blur-sm transition-all ${state.isRecording ? 'bg-red-500 pulse-recording' : 'glass-morphism hover:bg-white/20'} ${!state.voiceSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={state.voiceSupported ? 'Voice input' : 'Voice input not supported'}
            disabled={!state.voiceSupported}
          >
            <Mic className="w-4 h-4" />
          </button>
          
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
          <span className="text-xs opacity-70">
            {state.executionStatus === 'running' && 'Running...'}
            {state.executionStatus === 'awaitingInput' && 'Awaiting input...'}
            {state.executionStatus === 'idle' && 'Ready'}
            {state.executionStatus === 'completed' && 'Ready'}
            {state.executionStatus === 'cancelled' && 'Ready'}
          </span>
        </div>
        
        <div 
          ref={terminalRef}
          className="glass-morphism rounded-lg p-3 flex-1 overflow-y-auto terminal-output cursor-pointer hover:border-gray-600 transition-colors custom-scrollbar min-h-0"
        >
          {/* xterm.js will render here */}
        </div>
      </div>

      {/* Text Input Area */}
      <div className={`relative z-10 px-3 py-2 glass-morphism border-t border-white/10 flex-shrink-0 ${isExecuting ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center">
          <input
            type="text"
            value={state.textInput}
            onChange={(e) => setState(prev => ({ ...prev, textInput: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
            className="flex-1 bg-transparent text-white outline-none"
            disabled={isExecuting}
          />
          <button
            onClick={handleTextSubmit}
            className="ml-2 touch-friendly glass-morphism rounded-full hover:bg-white/20"
            title="Execute Command"
            disabled={isExecuting}
          >
            <CornerDownLeft className="w-4 h-4" />
          </button>
          {/* Cursor Control */}
          <div className="flex items-center ml-2">
            <button
              onClick={() => {
                if (xtermRef.current) {
                  xtermRef.current.write('\x1b[A'); // Simulate Up arrow key
                }
              }}
              className="touch-friendly glass-morphism rounded-md w-6 h-6 flex items-center justify-center mr-1"
              title="Cursor Up"
              disabled={isExecuting}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (xtermRef.current) {
                  xtermRef.current.write('\x1b[B'); // Simulate Down arrow key
                }
              }}
              className="touch-friendly glass-morphism rounded-md w-6 h-6 flex items-center justify-center"
              title="Cursor Down"
              disabled={isExecuting}
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Command Selector */}
      <div className={`relative z-10 glass-morphism border-t border-white/10 pb-3 flex flex-col flex-shrink-0 ${isExecuting ? 'opacity-50 pointer-events-none' : ''}`}>
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
                    <span className="text-xs font-medium text-center leading-tight">{task.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => scrollCommands('right')}
              disabled={state.currentCommandIndex >= currentCommands.length - 5}
              className={`touch-friendly rounded-full transition-colors ${state.currentCommandIndex >= currentCommands.length - 5 ? 'bg-gray-700 text-gray-500' : 'glass-morphism text-white hover:bg-white/20'}`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex justify-center mt-1 space-x-1">
            {Array.from({ length: Math.ceil(currentCommands.length / 5) }).map((_, idx) => (
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
                onClick={() => setState(prev => ({ ...prev, showSettings: false }))}
                className="text-gray-400 hover:text-white touch-friendly"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-white/5 rounded-lg">
              <h4 className="font-medium mb-2">Voice Recognition</h4>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${state.voiceSupported ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-sm">{state.voiceSupported ? 'Available' : 'Not supported'}</span>
              </div>
              <p className="text-xs opacity-60 mt-1">
                {state.voiceSupported ? 'Tap microphone button and speak your command' : 'Voice recognition is not supported in this browser'}
              </p>
            </div>

            <h4 className="font-medium mb-2">Command Playlists</h4>
            <div className="space-y-2 flex-1 overflow-y-auto mb-4">
              <div className="w-full p-3 rounded-lg text-left bg-blue-600 text-white">
                <div className="flex items-start space-x-3">
                  <span className="text-lg">🤖</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{DEFAULT_PLAYLIST.metadata.name}</div>
                    <div className="text-xs opacity-80">Built-in</div>
                    <div className="text-xs opacity-60 mt-1">{DEFAULT_PLAYLIST.metadata.description}</div>
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