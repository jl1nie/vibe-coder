import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Settings,
  Terminal,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  ArrowUp,
  ArrowDown,
  CornerDownLeft
} from 'lucide-react';
import { DEFAULT_PLAYLIST } from '@vibe-coder/shared';
import type { TerminalOutput, ConnectionStatus } from '@vibe-coder/shared';

type ExecutionStatus = 'idle' | 'running' | 'awaitingInput' | 'cancelled' | 'completed';

interface AppState {
  isRecording: boolean;
  terminalOutput: TerminalOutput[];
  textInput: string;
  currentCommandIndex: number;
  showSettings: boolean;
  connectionStatus: ConnectionStatus;
  voiceSupported: boolean;
  executionStatus: ExecutionStatus;
  promptMessage: string | null;
}

const initialState: AppState = {
  isRecording: false,
  terminalOutput: [],
  textInput: '',
  currentCommandIndex: 0,
  showSettings: false,
  connectionStatus: {
    isConnected: false,
  },
  voiceSupported: false,
  executionStatus: 'idle',
  promptMessage: null,
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(initialState);
  const terminalRef = useRef<HTMLDivElement>(null);
  const executionStateRef = useRef(state.executionStatus);

  useEffect(() => {
    executionStateRef.current = state.executionStatus;
  }, [state.executionStatus]);

  // Initialize mock terminal output
  useEffect(() => {
    const mockOutput: TerminalOutput[] = [
      { id: '1', type: 'system', text: 'Vibe Coder initialized', timestamp: new Date() },
      { id: '2', type: 'info', text: '🤖 Claude Code ready', timestamp: new Date() },
      { id: '3', type: 'prompt', text: 'user@localhost:~/project$ ', timestamp: new Date() },
    ];
    setState(prev => ({ ...prev, terminalOutput: mockOutput }));
  }, []);
  
  // Check voice recognition support
  useEffect(() => {
    const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setState(prev => ({ ...prev, voiceSupported: supported }));
  }, []);
  
  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [state.terminalOutput]);

  // Handle ESC key for interruption
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && executionStateRef.current === 'running') {
        setState(prev => ({
          ...prev,
          executionStatus: 'cancelled',
          terminalOutput: [
            ...prev.terminalOutput,
            { id: Date.now().toString(), type: 'error', text: 'Execution cancelled by user.', timestamp: new Date() },
            { id: (Date.now() + 1).toString(), type: 'prompt', text: 'user@localhost:~/project$ ', timestamp: new Date() },
          ],
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const addOutput = (line: any) => {
    setState(prev => ({
      ...prev,
      terminalOutput: [
        ...prev.terminalOutput,
        { ...(line as any), id: Date.now().toString(), timestamp: new Date() } as TerminalOutput
      ]
    }));
  };

  const executeCommand = async (command: string) => {
    setState(prev => ({
      ...prev,
      executionStatus: 'running',
      terminalOutput: [
        ...prev.terminalOutput,
        { id: Date.now().toString(), type: 'command', text: `claude-code "${command}"`, timestamp: new Date() }
      ]
    }));

    await new Promise(r => setTimeout(r, 1000));
    if (executionStateRef.current !== 'running') return;
    addOutput({ type: 'info', text: '🤖 Analyzing project...' });

    await new Promise(r => setTimeout(r, 1500));
    if (executionStateRef.current !== 'running') return;
    addOutput({ type: 'info', text: 'Found potential issues in 2 files. Do you want to proceed with the changes? [y/n]' });
    
    setState(prev => ({ ...prev, executionStatus: 'awaitingInput', promptMessage: 'y/n' }));
  };

  const handlePromptResponse = async (response: string) => {
    addOutput({ type: 'command', text: response, timestamp: new Date() });

    if (response.toLowerCase() === 'y') {
      setState(prev => ({ ...prev, executionStatus: 'running', promptMessage: null }));
      
      await new Promise(r => setTimeout(r, 1000));
      if (executionStateRef.current !== 'running') return;
      addOutput({ type: 'success', text: '✨ Generating code...' });

      await new Promise(r => setTimeout(r, 2000));
      if (executionStateRef.current !== 'running') return;
      addOutput({ type: 'success', text: '🚀 Task completed successfully!' });

    } else {
      addOutput({ type: 'error', text: 'Operation aborted by user.' });
    }

    setState(prev => ({
      ...prev,
      executionStatus: 'completed',
      promptMessage: null,
      terminalOutput: [
        ...prev.terminalOutput,
        { id: (Date.now() + 1).toString(), type: 'prompt', text: 'user@localhost:~/project$ ', timestamp: new Date() },
      ]
    }));
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
  
  const getOutputStyle = (type: TerminalOutput['type']) => {
    switch (type) {
      case 'command': return 'text-white font-bold';
      case 'success': return 'command-success';
      case 'error': return 'command-error';
      case 'info': return 'command-info';
      case 'system': return 'command-warning';
      case 'prompt': return 'command-prompt';
      default: return 'text-gray-300';
    }
  };
  
  const currentCommands = DEFAULT_PLAYLIST.commands;
  const visibleCommands = currentCommands.slice(state.currentCommandIndex, state.currentCommandIndex + 5);
  const isExecuting = state.executionStatus === 'running' || state.executionStatus === 'awaitingInput';
  
  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-white flex flex-col relative overflow-hidden mobile-optimized full-height-mobile">
      {/* Header */}
      <div className="relative z-10 h-16 p-3 flex items-center justify-between glass-morphism safe-area-inset-top">
        <div className="flex items-center space-x-2">
          <Terminal className="w-5 h-5 text-green-400" />
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
          {state.terminalOutput.map((line) => (
            <div key={line.id} className={`mb-1 ${getOutputStyle(line.type)}`}>
              <span className="opacity-50 text-xs mr-2">
                {line.timestamp.toLocaleTimeString().slice(0, 5)}
              </span>
              {line.text}
              {line.type === 'prompt' && state.executionStatus === 'running' && (
                <span className="animate-pulse text-green-400">▊</span>
              )}
            </div>
          ))}
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
              onClick={() => addOutput({ type: 'info', text: 'Simulating cursor move: UP' })}
              className="touch-friendly glass-morphism rounded-md w-6 h-6 flex items-center justify-center mr-1"
              title="Cursor Up"
              disabled={isExecuting}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => addOutput({ type: 'info', text: 'Simulating cursor move: DOWN' })}
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

