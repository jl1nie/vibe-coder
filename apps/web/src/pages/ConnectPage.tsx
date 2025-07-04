import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Wifi, WifiOff, Loader, QrCode, Smartphone } from 'lucide-react';
import { useApp } from '../hooks/useApp';

export function ConnectPage() {
  const { serverId: urlServerId } = useParams();
  const navigate = useNavigate();
  const { state, actions } = useApp();
  const [serverId, setServerId] = useState(urlServerId || state.settings.lastServerId || '');
  const [showQrScanner, setShowQrScanner] = useState(false);

  // URLパラメータからサーバーIDが指定されている場合は自動接続
  useEffect(() => {
    if (urlServerId && urlServerId !== state.serverId && !state.isConnecting) {
      handleConnect(urlServerId);
    }
  }, [urlServerId]);

  const handleConnect = async (targetServerId?: string) => {
    const idToConnect = targetServerId || serverId.trim();
    
    if (!idToConnect) {
      alert('サーバーIDを入力してください');
      return;
    }

    try {
      await actions.connect(idToConnect);
      // 接続成功時はターミナルページに遷移
      navigate('/terminal');
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleQrScan = () => {
    // QRコードスキャナーの実装（将来）
    setShowQrScanner(true);
    setTimeout(() => {
      setShowQrScanner(false);
      // 模擬的なQRコード読み取り結果
      const mockServerId = 'DEMO-SERVER-12345';
      setServerId(mockServerId);
    }, 2000);
  };

  const getConnectionStatusIcon = () => {
    if (state.isConnecting) {
      return <Loader className="w-5 h-5 animate-spin text-yellow-500" />;
    }
    if (state.isConnected) {
      return <Wifi className="w-5 h-5 text-green-500" />;
    }
    return <WifiOff className="w-5 h-5 text-gray-400" />;
  };

  const getConnectionStatusText = () => {
    if (state.isConnecting) return '接続中...';
    if (state.isConnected) return '接続済み';
    return '未接続';
  };

  return (
    <div className="connect-page min-h-screen bg-gray-50 dark:bg-gray-900">
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
          
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              サーバーに接続
            </h1>
            <div className="flex items-center gap-2 mt-1">
              {getConnectionStatusIcon()}
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {getConnectionStatusText()}
              </span>
            </div>
          </div>
        </div>
      </motion.header>

      {/* メインコンテンツ */}
      <main className="px-4 py-6">
        <div className="max-w-sm mx-auto space-y-6">
          {/* 接続フォーム */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  サーバーID
                </label>
                <input
                  type="text"
                  value={serverId}
                  onChange={(e) => setServerId(e.target.value)}
                  placeholder="例: DEMO-SERVER-12345"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={state.isConnecting}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  ホストサーバーから提供されるIDを入力してください
                </p>
              </div>

              <button
                onClick={() => handleConnect()}
                disabled={state.isConnecting || !serverId.trim()}
                className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors active:scale-95"
              >
                {state.isConnecting ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader className="w-4 h-4 animate-spin" />
                    接続中...
                  </div>
                ) : (
                  '接続'
                )}
              </button>
            </div>
          </motion.section>

          {/* QRコードスキャン */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mx-auto mb-4 flex items-center justify-center">
                <QrCode className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                QRコードでかんたん接続
              </h3>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                ホストサーバーのQRコードをスキャンして自動接続
              </p>

              <button
                onClick={handleQrScan}
                disabled={state.isConnecting}
                className="bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors active:scale-95 disabled:opacity-50"
              >
                {showQrScanner ? (
                  <div className="flex items-center gap-2">
                    <Loader className="w-4 h-4 animate-spin" />
                    スキャン中...
                  </div>
                ) : (
                  'QRコードをスキャン'
                )}
              </button>
            </div>
          </motion.section>

          {/* 接続エラー */}
          {state.connectionError && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                <WifiOff className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800 dark:text-red-200">
                    接続に失敗しました
                  </h4>
                  <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                    {state.connectionError}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* 使い方ガイド */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-100 dark:bg-gray-800 rounded-xl p-6"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              接続の手順
            </h3>
            
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  1
                </div>
                <p>ホストサーバーを起動し、サーバーIDを確認</p>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  2
                </div>
                <p>上記のフォームにサーバーIDを入力</p>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  3
                </div>
                <p>接続ボタンをタップして接続開始</p>
              </div>
            </div>
          </motion.section>

          {/* デモモード */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-center"
          >
            <button
              onClick={() => handleConnect('DEMO-SERVER-12345')}
              disabled={state.isConnecting}
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium text-sm transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-center gap-2">
                <Smartphone className="w-4 h-4" />
                デモモードで試す
              </div>
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              実際のサーバーなしでUIを体験できます
            </p>
          </motion.section>
        </div>
      </main>
    </div>
  );
}