import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Moon, 
  Sun, 
  Mic, 
  Bell, 
  Globe, 
  Palette, 
  Wifi,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Info,
  Github,
  Coffee
} from 'lucide-react';
import { useApp } from '../hooks/useApp';

export function SettingsPage() {
  const navigate = useNavigate();
  const { state, actions } = useApp();
  const [isResetting, setIsResetting] = useState(false);

  const handleSettingChange = (key: string, value: any) => {
    actions.dispatch({
      type: 'UPDATE_SETTINGS',
      payload: { [key]: value }
    });
  };

  const handleReset = async () => {
    if (!confirm('すべての設定をリセットしますか？この操作は取り消せません。')) {
      return;
    }

    setIsResetting(true);
    
    try {
      // ローカルストレージをクリア
      localStorage.removeItem('vibe-coder-settings');
      localStorage.removeItem('vibe-coder-playlists');
      localStorage.removeItem('vibe-coder-sessions');
      
      // 状態をリセット
      actions.dispatch({ type: 'RESET_STATE' });
      
      // 少し待ってから完了
      setTimeout(() => {
        setIsResetting(false);
        alert('設定がリセットされました');
      }, 1000);
      
    } catch (error) {
      console.error('Reset failed:', error);
      setIsResetting(false);
    }
  };

  const handleExportSettings = () => {
    try {
      const exportData = {
        settings: state.settings,
        playlists: state.playlists,
        quickCommands: state.quickCommands,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vibe-coder-settings-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export failed:', error);
      alert('エクスポートに失敗しました');
    }
  };

  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string);
        
        if (importData.settings) {
          actions.dispatch({
            type: 'UPDATE_SETTINGS',
            payload: importData.settings
          });
        }

        if (importData.playlists) {
          actions.dispatch({
            type: 'SET_PLAYLISTS',
            payload: importData.playlists
          });
        }

        if (importData.quickCommands) {
          actions.dispatch({
            type: 'SET_QUICK_COMMANDS',
            payload: importData.quickCommands
          });
        }

        alert('設定をインポートしました');
        
      } catch (error) {
        console.error('Import failed:', error);
        alert('インポートに失敗しました。ファイル形式を確認してください。');
      }
    };

    reader.readAsText(file);
    event.target.value = ''; // リセット
  };

  const settingSections = [
    {
      title: '外観',
      icon: <Palette className="w-5 h-5" />,
      items: [
        {
          label: 'ダークモード',
          description: 'ダークテーマを使用',
          type: 'toggle',
          value: state.isDarkMode,
          onChange: () => actions.dispatch({ type: 'TOGGLE_DARK_MODE' }),
          icon: state.isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />
        },
        {
          label: 'ターミナルテーマ',
          description: 'ターミナルの配色設定',
          type: 'select',
          value: state.settings.terminalTheme,
          onChange: (value: string) => handleSettingChange('terminalTheme', value),
          options: [
            { value: 'dark', label: 'ダーク' },
            { value: 'light', label: 'ライト' },
            { value: 'terminal', label: 'ターミナル' },
            { value: 'matrix', label: 'マトリックス' }
          ]
        }
      ]
    },
    {
      title: '音声・入力',
      icon: <Mic className="w-5 h-5" />,
      items: [
        {
          label: '音声認識',
          description: '音声コマンド入力を有効化',
          type: 'toggle',
          value: state.settings.enableVoiceRecognition,
          onChange: (value: boolean) => handleSettingChange('enableVoiceRecognition', value),
          icon: <Mic className="w-4 h-4" />
        },
        {
          label: '言語設定',
          description: '音声認識の言語',
          type: 'select',
          value: state.settings.preferredLanguage,
          onChange: (value: string) => handleSettingChange('preferredLanguage', value),
          options: [
            { value: 'ja-JP', label: '日本語' },
            { value: 'en-US', label: 'English (US)' },
            { value: 'en-GB', label: 'English (UK)' },
            { value: 'zh-CN', label: '中文' },
            { value: 'ko-KR', label: '한국어' }
          ],
          icon: <Globe className="w-4 h-4" />
        }
      ]
    },
    {
      title: '通知・動作',
      icon: <Bell className="w-5 h-5" />,
      items: [
        {
          label: '通知',
          description: 'プッシュ通知を有効化',
          type: 'toggle',
          value: state.settings.enableNotifications,
          onChange: (value: boolean) => handleSettingChange('enableNotifications', value),
          icon: <Bell className="w-4 h-4" />
        },
        {
          label: '自動接続',
          description: '前回のサーバーに自動接続',
          type: 'toggle',
          value: state.settings.autoConnect,
          onChange: (value: boolean) => handleSettingChange('autoConnect', value),
          icon: <Wifi className="w-4 h-4" />
        }
      ]
    }
  ];

  return (
    <div className="settings-page min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ヘッダー */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="safe-area-top px-4 pt-6 pb-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              設定
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              アプリの動作をカスタマイズ
            </p>
          </div>
        </div>
      </motion.header>

      {/* メインコンテンツ */}
      <main className="px-4 py-6">
        <div className="max-w-md mx-auto space-y-6">
          
          {/* 設定セクション */}
          {settingSections.map((section, sectionIndex) => (
            <motion.section
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sectionIndex * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg text-primary-600 dark:text-primary-400">
                    {section.icon}
                  </div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    {section.title}
                  </h2>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {section.items.map((item, itemIndex) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {item.icon}
                        <label className="font-medium text-gray-900 dark:text-white">
                          {item.label}
                        </label>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {item.description}
                      </p>
                    </div>

                    <div className="ml-4">
                      {item.type === 'toggle' && (
                        <button
                          onClick={() => item.onChange(!item.value)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            item.value 
                              ? 'bg-primary-600' 
                              : 'bg-gray-200 dark:bg-gray-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              item.value ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      )}

                      {item.type === 'select' && (
                        <select
                          value={item.value}
                          onChange={(e) => item.onChange(e.target.value)}
                          className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          {item.options?.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>
          ))}

          {/* データ管理 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg text-blue-600 dark:text-blue-400">
                  <Download className="w-5 h-5" />
                </div>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  データ管理
                </h2>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <button
                onClick={handleExportSettings}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                設定をエクスポート
              </button>

              <label className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                設定をインポート
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportSettings}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleReset}
                disabled={isResetting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isResetting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {isResetting ? 'リセット中...' : 'すべてリセット'}
              </button>
            </div>
          </motion.section>

          {/* アプリ情報 */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                  <Info className="w-5 h-5" />
                </div>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  アプリ情報
                </h2>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">バージョン</span>
                <span className="font-mono text-sm text-gray-900 dark:text-white">
                  v{__APP_VERSION__ || '1.0.0'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">ビルド日時</span>
                <span className="font-mono text-sm text-gray-900 dark:text-white">
                  {new Date(__BUILD_TIME__ || Date.now()).toLocaleDateString('ja-JP')}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">接続状態</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    state.isConnected ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {state.isConnected ? '接続中' : '未接続'}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-3">
                  <button
                    onClick={() => window.open('https://github.com/vibe-coder/vibe-coder', '_blank')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    <Github className="w-4 h-4" />
                    GitHub
                  </button>
                  
                  <button
                    onClick={() => window.open('https://ko-fi.com/vibecoder', '_blank')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    <Coffee className="w-4 h-4" />
                    支援
                  </button>
                </div>
              </div>
            </div>
          </motion.section>

          {/* フッター */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center py-6"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">
              © 2024 Vibe Coder Team. All rights reserved.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              スマホで始めるClaude Code体験
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}