import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, Search, Compass } from 'lucide-react';

export function NotFoundPage() {
  const navigate = useNavigate();

  const quickActions = [
    {
      label: 'ホーム',
      description: 'トップページに戻る',
      icon: <Home className="w-5 h-5" />,
      action: () => navigate('/'),
      primary: true,
    },
    {
      label: '戻る',
      description: '前のページに戻る',
      icon: <ArrowLeft className="w-5 h-5" />,
      action: () => navigate(-1),
      primary: false,
    },
    {
      label: '接続',
      description: 'サーバーに接続',
      icon: <Compass className="w-5 h-5" />,
      action: () => navigate('/connect'),
      primary: false,
    },
  ];

  return (
    <div className="not-found-page min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900 flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 text-center">
        
        {/* 404 イラスト */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-8"
        >
          <div className="relative">
            {/* メインの404テキスト */}
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-8xl font-bold text-gray-200 dark:text-gray-700 mb-4"
            >
              404
            </motion.div>
            
            {/* アニメーション要素 */}
            <motion.div
              animate={{ 
                rotate: [0, 5, -5, 0],
                scale: [1, 1.05, 1] 
              }}
              transition={{ 
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <div className="text-6xl">📱</div>
            </motion.div>
          </div>
        </motion.div>

        {/* エラーメッセージ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            ページが見つかりません
          </h1>
          
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            お探しのページは存在しないか、
            <br />
            移動または削除された可能性があります。
          </p>
        </motion.div>

        {/* 考えられる原因 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8"
        >
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-orange-500" />
            考えられる原因
          </h2>
          
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
              <span>URLが間違っている</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
              <span>リンクが古くなっている</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
              <span>ページが開発中または準備中</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
              <span>アクセス権限が不足している</span>
            </div>
          </div>
        </motion.div>

        {/* アクションボタン */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="space-y-3"
        >
          {quickActions.map((action, index) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 + index * 0.1, duration: 0.6 }}
              onClick={action.action}
              className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all duration-200 ${
                action.primary
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              } active:scale-95`}
            >
              <div className={`p-2 rounded-lg ${
                action.primary 
                  ? 'bg-white/20' 
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                {action.icon}
              </div>
              
              <div className="flex-1 text-left">
                <div className="font-medium">{action.label}</div>
                <div className={`text-sm ${
                  action.primary 
                    ? 'text-white/80' 
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {action.description}
                </div>
              </div>
            </motion.button>
          ))}
        </motion.div>

        {/* 追加情報 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700"
        >
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            問題が解決しない場合は
          </p>
          
          <div className="flex justify-center gap-4 text-sm">
            <button
              onClick={() => window.open('https://github.com/vibe-coder/vibe-coder/issues', '_blank')}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              不具合を報告
            </button>
            
            <span className="text-gray-300 dark:text-gray-600">•</span>
            
            <button
              onClick={() => navigate('/about')}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              ヘルプを見る
            </button>
          </div>
        </motion.div>

        {/* フローティング要素 */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-blue-400 dark:bg-blue-600 rounded-full opacity-20"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}