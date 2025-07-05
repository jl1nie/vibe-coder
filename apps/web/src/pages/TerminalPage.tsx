import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Mic, 
  Send, 
  Settings, 
  Maximize2, 
  Minimize2,
  WifiOff,
  Upload,
  Download
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import { Terminal } from '../components/Terminal';
import { VoiceInput } from '../components/VoiceInput';
import { QuickCommands } from '../components/QuickCommands';
import { Command } from '@vibe-coder/shared';

export function TerminalPage() {
  const navigate = useNavigate();
  const { state, actions } = useApp();
  const [inputValue, setInputValue] = useState('');
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showQuickCommands, setShowQuickCommands] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // デフォルトのクイックコマンド
  const defaultCommands: Command[] = [
    {
      id: 'login',
      icon: '🔐',
      label: 'ログイン',
      command: 'claude-code add authentication system',
      description: '認証システムを追加',
      isCustom: false,
    },
    {
      id: 'bug-fix',
      icon: '🐛',
      label: 'バグ修正',
      command: 'claude-code fix the bug in the current file',
      description: '現在のファイルのバグを修正',
      isCustom: false,
    },
    {
      id: 'test',
      icon: '🧪',
      label: 'テスト',
      command: 'claude-code write tests for this code',
      description: 'テストコードを作成',
      isCustom: false,
    },
    {
      id: 'refactor',
      icon: '♻️',
      label: 'リファクタ',
      command: 'claude-code refactor this code to be more readable',
      description: 'コードをリファクタリング',
      isCustom: false,
    },
    {
      id: 'docs',
      icon: '📚',
      label: 'ドキュメント',
      command: 'claude-code add documentation to this code',
      description: 'ドキュメントを追加',
      isCustom: false,
    },
  ];

  // 接続確認
  useEffect(() => {
    if (!state.isConnected && !state.isConnecting) {
      navigate('/connect', { replace: true });
    }
  }, [state.isConnected, state.isConnecting, navigate]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Enter でコマンド実行
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        handleSubmit();
      }
      
      // Ctrl+L でターミナルクリア
      if (event.ctrlKey && event.key === 'l') {
        event.preventDefault();
        // TODO: ターミナルクリア実装
      }

      // Ctrl+` でクイックコマンド表示切り替え
      if (event.ctrlKey && event.key === '`') {
        event.preventDefault();
        setShowQuickCommands(!showQuickCommands);
      }

      // F11 でフルスクリーン切り替え
      if (event.key === 'F11') {
        event.preventDefault();
        setIsFullscreen(!isFullscreen);
      }

      // Escape でフルスクリーン解除
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showQuickCommands, isFullscreen]);

  const handleSubmit = async () => {
    const command = inputValue.trim();
    if (!command) return;

    try {
      await actions.executeCommand(command);
      setInputValue('');
    } catch (error) {
      console.error('Command execution failed:', error);
    }
  };

  const handleQuickCommand = async (command: Command) => {
    try {
      await actions.executeCommand(command.command);
    } catch (error) {
      console.error('Quick command execution failed:', error);
    }
  };

  const handleVoiceSubmit = async (transcript: string) => {
    setShowVoiceInput(false);
    
    if (transcript.trim()) {
      try {
        await actions.executeCommand(transcript);
      } catch (error) {
        console.error('Voice command execution failed:', error);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      // ファイルアップロード処理（将来実装）
      console.log('Uploading file:', file.name);
    });
  };

  if (!state.isConnected) {
    return (
      <div className="terminal-page min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <WifiOff className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-semibold mb-2">接続が切断されました</h2>
          <p className="text-gray-400 mb-4">サーバーとの接続を確認してください</p>
          <button
            onClick={() => navigate('/connect')}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            再接続
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`terminal-page min-h-screen bg-gray-900 text-white flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* ヘッダー */}
      {!isFullscreen && (
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="safe-area-top px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div>
              <h1 className="font-semibold">Terminal</h1>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Server: {state.serverId}</span>
                {state.latency > 0 && (
                  <span>• {Math.round(state.latency)}ms</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => navigate('/settings')}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </motion.header>
      )}

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ターミナル */}
        <div className="flex-1 relative">
          <Terminal
            output={state.terminalOutput}
            isExecuting={state.isExecuting}
            className="h-full"
          />
          
          {/* フルスクリーンコントロール */}
          {isFullscreen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute top-4 right-4 flex gap-2"
            >
              <button
                onClick={() => setShowQuickCommands(!showQuickCommands)}
                className="p-2 bg-gray-800/80 text-white rounded-lg hover:bg-gray-700/80 transition-colors backdrop-blur-sm"
              >
                📱
              </button>
              
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-2 bg-gray-800/80 text-white rounded-lg hover:bg-gray-700/80 transition-colors backdrop-blur-sm"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </div>

        {/* クイックコマンド */}
        <AnimatePresence>
          {showQuickCommands && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-gray-800 border-t border-gray-700 px-4 py-3"
            >
              <QuickCommands
                commands={state.quickCommands.length > 0 ? state.quickCommands : defaultCommands}
                onExecute={handleQuickCommand}
                maxVisible={5}
                enableSwipe={true}
                showActions={false}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 入力エリア */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="safe-area-bottom bg-gray-800 border-t border-gray-700 p-4"
        >
          <div className="flex gap-3 items-end">
            {/* メイン入力 */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="コマンドを入力... (Ctrl+Enter で実行)"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                disabled={state.isExecuting}
              />
              
              {/* 送信ボタン */}
              <button
                onClick={handleSubmit}
                disabled={!inputValue.trim() || state.isExecuting}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            {/* 音声入力ボタン */}
            <button
              onClick={() => setShowVoiceInput(true)}
              disabled={state.isExecuting}
              className="p-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* ファイルアップロードボタン */}
            <label className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
              <Upload className="w-5 h-5" />
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                disabled={state.isExecuting}
              />
            </label>
          </div>

          {/* ヒント */}
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <div className="flex gap-4">
              <span>Ctrl+Enter: 実行</span>
              <span>Ctrl+`: コマンド表示</span>
              <span>F11: フルスクリーン</span>
            </div>
            
            {state.isExecuting && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                <span>実行中...</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* 音声入力モーダル */}
      <AnimatePresence>
        {showVoiceInput && (
          <VoiceInput
            onSubmit={handleVoiceSubmit}
            onCancel={() => setShowVoiceInput(false)}
            placeholder="音声でコマンドを入力してください..."
            language="ja-JP"
            autoSubmit={false}
            showWaveform={true}
          />
        )}
      </AnimatePresence>
    </div>
  );
}