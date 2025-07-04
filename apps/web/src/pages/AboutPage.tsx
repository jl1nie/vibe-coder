import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Smartphone, 
  Zap, 
  Shield, 
  Globe, 
  Github, 
  ExternalLink,
  Heart,
  Coffee,
  Users,
  Star,
  Code,
  Mic,
  Wifi
} from 'lucide-react';

export function AboutPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Smartphone className="w-8 h-8" />,
      title: 'モバイルファースト設計',
      description: 'スマートフォンでの使用を前提とした直感的なUI/UXデザイン。タッチ操作に最適化されたインターフェース。',
      details: ['レスポンシブデザイン', 'ジェスチャー操作対応', 'ハプティックフィードバック']
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'ワンタップ実行',
      description: 'よく使うClaude Codeコマンドをアイコン化し、ワンタップで瞬時に実行できるクイックコマンド機能。',
      details: ['カスタマイズ可能', 'スワイプナビゲーション', 'プレイリスト対応']
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'プライベート接続',
      description: 'WebRTC P2P通信により、コードが外部サーバーを経由せず直接デバイス間で安全に通信。',
      details: ['エンドツーエンド暗号化', 'NAT越え対応', '低レイテンシ通信']
    },
    {
      icon: <Mic className="w-8 h-8" />,
      title: '音声操作',
      description: 'Web Speech APIを活用した自然言語での音声コマンド入力。多言語対応で直感的な操作を実現。',
      details: ['日本語・英語対応', 'リアルタイム認識', '波形可視化']
    },
    {
      icon: <Wifi className="w-8 h-8" />,
      title: 'リアルタイム同期',
      description: 'ターミナル出力、ファイル変更、セッション状態をリアルタイムで同期。どこからでも継続的な開発体験。',
      details: ['セッション永続化', 'マルチデバイス対応', '自動再接続']
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: 'プレイリスト共有',
      description: 'GitHub Gistベースのコマンドセット共有システム。コミュニティ作成のプレイリストを発見・利用可能。',
      details: ['GitHub連携', 'コミュニティ投稿', 'バージョン管理']
    }
  ];

  const techStack = [
    {
      category: 'フロントエンド',
      technologies: ['React 18', 'TypeScript', 'Tailwind CSS', 'Framer Motion', 'Workbox PWA']
    },
    {
      category: 'バックエンド', 
      technologies: ['Node.js', 'WebRTC (wrtc)', 'Docker', 'Claude Code CLI']
    },
    {
      category: 'インフラ',
      technologies: ['Vercel Edge Functions', 'Vercel KV', 'GitHub Actions', 'Docker Compose']
    },
    {
      category: 'API・通信',
      technologies: ['WebRTC P2P', 'Web Speech API', 'Service Worker', 'WebSocket']
    }
  ];

  const teamMembers = [
    {
      name: 'Claude',
      role: 'AI Development Assistant', 
      description: 'コード生成とアーキテクチャ設計を担当',
      avatar: '🤖'
    },
    {
      name: 'Community',
      role: 'Beta Testers & Contributors',
      description: 'フィードバックと機能改善に貢献',
      avatar: '👥'
    }
  ];

  return (
    <div className="about-page min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      {/* ヘッダー */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="safe-area-top px-4 pt-6 pb-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700"
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
              Vibe Coder について
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              スマホで始めるClaude Code体験
            </p>
          </div>
        </div>
      </motion.header>

      {/* メインコンテンツ */}
      <main className="px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-12">
          
          {/* ヒーローセクション */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <div className="w-32 h-32 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto mb-8 flex items-center justify-center">
              <Smartphone className="w-16 h-16 text-white" />
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              モバイル最適化された
              <br />
              リモート開発環境
            </h2>
            
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Vibe Coderは、スマートフォンからClaude Codeを直感的に操作できる革新的な開発ツールです。
              WebRTC P2P通信により、どこからでも安全に自宅の開発環境にアクセスできます。
            </p>
          </motion.section>

          {/* 主要機能 */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
              主要機能
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg text-blue-600 dark:text-blue-400 flex-shrink-0">
                      {feature.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                        {feature.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {feature.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {feature.details.map(detail => (
                          <span
                            key={detail}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded"
                          >
                            {detail}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* 技術スタック */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
              技術スタック
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {techStack.map((stack, index) => (
                <motion.div
                  key={stack.category}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                >
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Code className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    {stack.category}
                  </h4>
                  <div className="space-y-2">
                    {stack.technologies.map(tech => (
                      <div
                        key={tech}
                        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                      >
                        <div className="w-2 h-2 bg-primary-600 dark:bg-primary-400 rounded-full"></div>
                        {tech}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* チーム */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
              開発チーム
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {teamMembers.map((member, index) => (
                <motion.div
                  key={member.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 text-center"
                >
                  <div className="text-4xl mb-4">{member.avatar}</div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {member.name}
                  </h4>
                  <p className="text-sm text-primary-600 dark:text-primary-400 mb-2">
                    {member.role}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {member.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* オープンソース */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Heart className="w-8 h-8 text-white" />
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                オープンソースプロジェクト
              </h3>
              
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
                Vibe Coderはオープンソースプロジェクトです。
                コミュニティの皆様と一緒により良いツールを作り上げていきます。
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => window.open('https://github.com/vibe-coder/vibe-coder', '_blank')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                >
                  <Github className="w-5 h-5" />
                  GitHub で見る
                  <ExternalLink className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => window.open('https://ko-fi.com/vibecoder', '_blank')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  <Coffee className="w-5 h-5" />
                  開発を支援
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.section>

          {/* 統計情報 */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              { label: 'ダウンロード', value: '1,250+', icon: <Users className="w-5 h-5" /> },
              { label: '評価', value: '4.8', icon: <Star className="w-5 h-5" /> },
              { label: 'プレイリスト', value: '50+', icon: <Globe className="w-5 h-5" /> },
              { label: 'コントリビューター', value: '12', icon: <Heart className="w-5 h-5" /> },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 + index * 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 text-center"
              >
                <div className="flex items-center justify-center text-primary-600 dark:text-primary-400 mb-2">
                  {stat.icon}
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.section>

          {/* フッター */}
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="text-center py-8"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              © 2024 Vibe Coder Team. All rights reserved.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Built with ❤️ using Claude Code
            </p>
          </motion.footer>
        </div>
      </main>
    </div>
  );
}