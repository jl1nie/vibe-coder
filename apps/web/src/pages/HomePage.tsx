import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Smartphone, Zap, Shield, Globe, ArrowRight, Play } from 'lucide-react';

export function HomePage() {
  const features = [
    {
      icon: <Smartphone className="w-8 h-8" />,
      title: 'モバイルファースト',
      description: 'スマホに最適化された直感的なUI',
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'ワンタップ実行',
      description: 'よく使うコマンドをアイコンで瞬時実行',
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'プライベート接続',
      description: '完全P2P通信でコードが外部に漏れない',
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: '音声操作',
      description: '自然言語での音声コマンド入力',
    },
  ];

  return (
    <div className="home-page min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      {/* ヘッダー */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="safe-area-top px-4 pt-6 pb-4"
      >
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Vibe Coder
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                v{__APP_VERSION__}
              </p>
            </div>
          </div>
        </div>
      </motion.header>

      {/* メインコンテンツ */}
      <main className="px-4 pb-8">
        <div className="max-w-sm mx-auto space-y-8">
          {/* ヒーローセクション */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center py-8"
          >
            <div className="w-24 h-24 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto mb-6 flex items-center justify-center">
              <Smartphone className="w-12 h-12 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              スマホで始める
              <br />
              Claude Code
            </h2>
            
            <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
              モバイル最適化されたリモート開発環境で、
              どこからでも直感的にコーディングを始めましょう。
            </p>

            {/* CTAボタン */}
            <div className="space-y-4">
              <Link
                to="/connect"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
              >
                <Play className="w-5 h-5" />
                今すぐ始める
                <ArrowRight className="w-5 h-5" />
              </Link>

              <Link
                to="/about"
                className="w-full border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-4 px-6 rounded-xl font-semibold transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95"
              >
                詳細を見る
              </Link>
            </div>
          </motion.section>

          {/* 機能紹介 */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-6">
              主な機能
            </h3>

            <div className="grid grid-cols-1 gap-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg text-blue-600 dark:text-blue-400 flex-shrink-0">
                      {feature.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {feature.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* クイックアクション */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
              クイックアクション
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/playlists"
                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors active:scale-95"
              >
                <div className="text-2xl mb-2">🎵</div>
                <div className="font-medium text-gray-900 dark:text-white text-sm">
                  プレイリスト
                </div>
              </Link>

              <Link
                to="/settings"
                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors active:scale-95"
              >
                <div className="text-2xl mb-2">⚙️</div>
                <div className="font-medium text-gray-900 dark:text-white text-sm">
                  設定
                </div>
              </Link>
            </div>
          </motion.section>

          {/* 最近の接続 */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
              最近の接続
            </h3>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <div className="text-4xl mb-2">📱</div>
                <p className="text-sm">
                  まだ接続履歴がありません
                </p>
                <p className="text-xs mt-1">
                  最初の接続を開始しましょう
                </p>
              </div>
            </div>
          </motion.section>
        </div>
      </main>

      {/* フッター */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="safe-area-bottom px-4 py-6 text-center"
      >
        <p className="text-xs text-gray-500 dark:text-gray-400">
          © 2024 Vibe Coder Team. All rights reserved.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Built: {new Date(__BUILD_TIME__).toLocaleDateString('ja-JP')}
        </p>
      </motion.footer>
    </div>
  );
}