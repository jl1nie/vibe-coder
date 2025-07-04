import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { 
  Command, 
  ClaudeSession,
  TerminalOutput,
  createLogger 
} from '@vibe-coder/shared';
import { useWebRTC } from './useWebRTC';

const logger = createLogger('app-context');

// アプリケーション状態の型定義
export interface AppState {
  // 接続状態
  isConnected: boolean;
  isConnecting: boolean;
  connectionError?: string;
  serverId?: string;
  
  // セッション状態
  currentSession?: ClaudeSession;
  sessions: ClaudeSession[];
  
  // ターミナル状態
  terminalOutput: TerminalOutput[];
  isExecuting: boolean;
  
  // UI状態
  isDarkMode: boolean;
  isOffline: boolean;
  showSidebar: boolean;
  
  // ユーザー設定
  settings: {
    enableVoiceRecognition: boolean;
    enableNotifications: boolean;
    preferredLanguage: string;
    terminalTheme: string;
    autoConnect: boolean;
    lastServerId?: string;
  };
  
  // プレイリスト
  playlists: Array<{
    id: string;
    name: string;
    commands: Command[];
    isCustom: boolean;
  }>;
  quickCommands: Command[];
}

// アクションタイプ
export type AppAction =
  | { type: 'SET_CONNECTION_STATUS'; payload: { isConnected: boolean; isConnecting: boolean; error?: string } }
  | { type: 'SET_SERVER_ID'; payload: string }
  | { type: 'SET_CURRENT_SESSION'; payload: ClaudeSession | undefined }
  | { type: 'ADD_SESSION'; payload: ClaudeSession }
  | { type: 'REMOVE_SESSION'; payload: string }
  | { type: 'ADD_TERMINAL_OUTPUT'; payload: TerminalOutput }
  | { type: 'CLEAR_TERMINAL_OUTPUT' }
  | { type: 'SET_EXECUTING'; payload: boolean }
  | { type: 'TOGGLE_DARK_MODE' }
  | { type: 'SET_OFFLINE'; payload: boolean }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppState['settings']> }
  | { type: 'SET_PLAYLISTS'; payload: AppState['playlists'] }
  | { type: 'ADD_PLAYLIST'; payload: AppState['playlists'][0] }
  | { type: 'REMOVE_PLAYLIST'; payload: string }
  | { type: 'SET_QUICK_COMMANDS'; payload: Command[] }
  | { type: 'RESET_STATE' };

// 初期状態
const initialState: AppState = {
  isConnected: false,
  isConnecting: false,
  sessions: [],
  terminalOutput: [],
  isExecuting: false,
  isDarkMode: false,
  isOffline: !navigator.onLine,
  showSidebar: false,
  settings: {
    enableVoiceRecognition: true,
    enableNotifications: true,
    preferredLanguage: 'ja-JP',
    terminalTheme: 'dark',
    autoConnect: false,
  },
  playlists: [],
  quickCommands: [],
};

// リデューサー
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        isConnected: action.payload.isConnected,
        isConnecting: action.payload.isConnecting,
        connectionError: action.payload.error,
      };

    case 'SET_SERVER_ID':
      return {
        ...state,
        serverId: action.payload,
        settings: {
          ...state.settings,
          lastServerId: action.payload,
        },
      };

    case 'SET_CURRENT_SESSION':
      return {
        ...state,
        currentSession: action.payload,
      };

    case 'ADD_SESSION':
      return {
        ...state,
        sessions: [...state.sessions, action.payload],
      };

    case 'REMOVE_SESSION':
      return {
        ...state,
        sessions: state.sessions.filter(session => session.id !== action.payload),
        currentSession: state.currentSession?.id === action.payload ? undefined : state.currentSession,
      };

    case 'ADD_TERMINAL_OUTPUT':
      return {
        ...state,
        terminalOutput: [...state.terminalOutput, action.payload].slice(-1000), // 最新1000行を保持
      };

    case 'CLEAR_TERMINAL_OUTPUT':
      return {
        ...state,
        terminalOutput: [],
      };

    case 'SET_EXECUTING':
      return {
        ...state,
        isExecuting: action.payload,
      };

    case 'TOGGLE_DARK_MODE':
      return {
        ...state,
        isDarkMode: !state.isDarkMode,
      };

    case 'SET_OFFLINE':
      return {
        ...state,
        isOffline: action.payload,
      };

    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        showSidebar: !state.showSidebar,
      };

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
        },
      };

    case 'SET_PLAYLISTS':
      return {
        ...state,
        playlists: action.payload,
      };

    case 'ADD_PLAYLIST':
      return {
        ...state,
        playlists: [...state.playlists, action.payload],
      };

    case 'REMOVE_PLAYLIST':
      return {
        ...state,
        playlists: state.playlists.filter(playlist => playlist.id !== action.payload),
      };

    case 'SET_QUICK_COMMANDS':
      return {
        ...state,
        quickCommands: action.payload,
      };

    case 'RESET_STATE':
      return {
        ...initialState,
        settings: state.settings, // 設定は保持
      };

    default:
      return state;
  }
}

// コンテキスト
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  actions: {
    connect: (serverId: string) => Promise<void>;
    disconnect: () => Promise<void>;
    executeCommand: (command: string) => Promise<void>;
    loadSettings: () => void;
    saveSettings: () => void;
    loadPlaylists: () => Promise<void>;
  };
} | null>(null);

// プロバイダーコンポーネント
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // WebRTC接続の設定
  const webrtc = useWebRTC({
    onTerminalOutput: (output) => {
      const terminalOutput: TerminalOutput = {
        type: output.type || 'stdout',
        data: output.data,
        timestamp: Date.now(),
        sessionId: state.currentSession?.id || 'default',
      };
      dispatch({ type: 'ADD_TERMINAL_OUTPUT', payload: terminalOutput });
    },
    onStatusUpdate: (status) => {
      logger.info('Status update:', status);
    },
    onError: (error) => {
      logger.error('WebRTC error:', error);
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: {
        isConnected: false,
        isConnecting: false,
        error: error.message,
      }});
    },
  });

  // 設定の永続化
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('vibe-coder-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
      }
    } catch (error) {
      logger.error('Failed to load settings:', error);
    }
  };

  const saveSettings = () => {
    try {
      localStorage.setItem('vibe-coder-settings', JSON.stringify(state.settings));
    } catch (error) {
      logger.error('Failed to save settings:', error);
    }
  };

  // WebRTC状態の同期
  React.useEffect(() => {
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: {
      isConnected: webrtc.state.isConnected,
      isConnecting: webrtc.state.isConnecting,
      error: webrtc.state.connectionError || undefined,
    }});
    
    if (webrtc.state.serverId) {
      dispatch({ type: 'SET_SERVER_ID', payload: webrtc.state.serverId });
    }
  }, [webrtc.state]);

  // アクション関数
  const actions = {
    connect: async (serverId: string) => {
      dispatch({ type: 'SET_SERVER_ID', payload: serverId });
      
      try {
        await webrtc.connect(serverId);
        logger.info('Connected to server:', serverId);
        
        // 接続成功時にデフォルトセッションを作成
        const defaultSession: ClaudeSession = {
          id: 'default',
          workspaceDir: '/workspace',
          isActive: true,
          createdAt: Date.now(),
          lastUsed: Date.now(),
        };
        
        dispatch({ type: 'ADD_SESSION', payload: defaultSession });
        dispatch({ type: 'SET_CURRENT_SESSION', payload: defaultSession });
      } catch (error) {
        logger.error('Connection failed:', error);
        throw error;
      }
    },

    disconnect: async () => {
      try {
        webrtc.disconnect();
        dispatch({ type: 'SET_CURRENT_SESSION', payload: undefined });
        dispatch({ type: 'CLEAR_TERMINAL_OUTPUT' });
        logger.info('Disconnected from server');
      } catch (error) {
        logger.error('Disconnect failed:', error);
      }
    },

    executeCommand: async (command: string) => {
      if (!webrtc.state.isConnected) {
        logger.warn('Not connected to server');
        return;
      }

      dispatch({ type: 'SET_EXECUTING', payload: true });

      try {
        // コマンド実行ログの出力
        const commandOutput: TerminalOutput = {
          type: 'input',
          data: `$ ${command}\n`,
          timestamp: Date.now(),
          sessionId: state.currentSession?.id || 'default',
        };
        dispatch({ type: 'ADD_TERMINAL_OUTPUT', payload: commandOutput });

        // WebRTC経由でコマンド送信
        webrtc.sendCommand(command);
        
      } catch (error) {
        const errorOutput: TerminalOutput = {
          type: 'stderr',
          data: `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`,
          timestamp: Date.now(),
          sessionId: state.currentSession?.id || 'default',
        };
        
        dispatch({ type: 'ADD_TERMINAL_OUTPUT', payload: errorOutput });
        dispatch({ type: 'SET_EXECUTING', payload: false });
        logger.error('Command execution failed:', error);
      }
    },

    loadPlaylists: async () => {
      try {
        // プレイリストの読み込み（将来実装）
        const playlists: AppState['playlists'] = [];
        dispatch({ type: 'SET_PLAYLISTS', payload: playlists });
      } catch (error) {
        logger.error('Failed to load playlists:', error);
      }
    },

    loadSettings,
    saveSettings,
  };

  // 初期化処理
  useEffect(() => {
    loadSettings();
    actions.loadPlaylists();

    // ネットワーク状態の監視
    const handleOnline = () => dispatch({ type: 'SET_OFFLINE', payload: false });
    const handleOffline = () => dispatch({ type: 'SET_OFFLINE', payload: true });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 設定変更時の保存
  useEffect(() => {
    saveSettings();
  }, [state.settings]);

  // ダークモードの適用
  useEffect(() => {
    if (state.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.isDarkMode]);

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
}

// カスタムフック
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}