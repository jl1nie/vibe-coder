import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Download, 
  Star, 
  Users, 
  Calendar,
  ExternalLink,
  Heart,
  Filter,
  Grid,
  List,
  Shuffle
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import { Command } from '@vibe-coder/shared';

interface Playlist {
  id: string;
  name: string;
  description: string;
  author: string;
  commands: Command[];
  downloads: number;
  rating: number;
  tags: string[];
  createdAt: string;
  isCustom: boolean;
  isInstalled: boolean;
}

export function PlaylistsPage() {
  const navigate = useNavigate();
  const { state, actions } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(false);
  const [discoveredPlaylists, setDiscoveredPlaylists] = useState<Playlist[]>([]);

  // カテゴリフィルター
  const categories = [
    { id: 'all', label: 'すべて', icon: '📂' },
    { id: 'frontend', label: 'フロントエンド', icon: '🎨' },
    { id: 'backend', label: 'バックエンド', icon: '⚙️' },
    { id: 'mobile', label: 'モバイル', icon: '📱' },
    { id: 'devops', label: 'DevOps', icon: '🚀' },
    { id: 'ai', label: 'AI/ML', icon: '🤖' },
    { id: 'custom', label: 'カスタム', icon: '✨' },
  ];

  // サンプルプレイリストデータ
  const samplePlaylists: Playlist[] = [
    {
      id: 'frontend-vibes',
      name: 'Frontend Vibes',
      description: 'React、Vue、Angularの開発を加速するコマンド集',
      author: 'ui_ninja',
      commands: [
        {
          id: 'component',
          icon: '🧩',
          label: 'コンポーネント',
          command: 'claude-code "create a reusable React component"',
          description: '再利用可能なReactコンポーネントを作成',
          isCustom: false,
        },
        {
          id: 'styling',
          icon: '🎨',
          label: 'スタイリング',
          command: 'claude-code "add responsive CSS styling"',
          description: 'レスポンシブCSSスタイリングを追加',
          isCustom: false,
        },
        {
          id: 'testing',
          icon: '🧪',
          label: 'テスト',
          command: 'claude-code "write unit tests for this component"',
          description: 'このコンポーネントのユニットテストを作成',
          isCustom: false,
        },
      ],
      downloads: 1250,
      rating: 4.8,
      tags: ['react', 'vue', 'css', 'ui'],
      createdAt: '2024-03-15',
      isCustom: false,
      isInstalled: false,
    },
    {
      id: 'backend-powertools',
      name: 'Backend PowerTools',
      description: 'API、データベース、サーバー開発の効率化ツール',
      author: 'server_master',
      commands: [
        {
          id: 'api',
          icon: '🔌',
          label: 'API作成',
          command: 'claude-code "create REST API endpoints"',
          description: 'REST APIエンドポイントを作成',
          isCustom: false,
        },
        {
          id: 'db',
          icon: '🗄️',
          label: 'DB設計',
          command: 'claude-code "design database schema"',
          description: 'データベーススキーマを設計',
          isCustom: false,
        },
      ],
      downloads: 892,
      rating: 4.6,
      tags: ['api', 'database', 'node', 'express'],
      createdAt: '2024-03-10',
      isCustom: false,
      isInstalled: true,
    },
    {
      id: 'ai-assistant',
      name: 'AI Assistant Toolkit',
      description: 'AI・機械学習プロジェクト開発支援コマンド',
      author: 'ml_wizard',
      commands: [
        {
          id: 'model',
          icon: '🧠',
          label: 'モデル作成',
          command: 'claude-code "create machine learning model"',
          description: '機械学習モデルを作成',
          isCustom: false,
        },
      ],
      downloads: 567,
      rating: 4.9,
      tags: ['ai', 'ml', 'python', 'tensorflow'],
      createdAt: '2024-03-20',
      isCustom: false,
      isInstalled: false,
    },
  ];

  useEffect(() => {
    setDiscoveredPlaylists(samplePlaylists);
  }, []);

  // プレイリストの検索とフィルタリング
  const filteredPlaylists = discoveredPlaylists.filter(playlist => {
    const matchesSearch = playlist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         playlist.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         playlist.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || 
                           (selectedCategory === 'custom' && playlist.isCustom) ||
                           playlist.tags.includes(selectedCategory);
    
    return matchesSearch && matchesCategory;
  });

  const handleInstallPlaylist = async (playlist: Playlist) => {
    setIsLoading(true);
    
    try {
      // プレイリストをインストール
      await new Promise(resolve => setTimeout(resolve, 1000)); // 模擬的な遅延
      
      // アプリ状態に追加
      actions.dispatch({
        type: 'ADD_PLAYLIST',
        payload: {
          id: playlist.id,
          name: playlist.name,
          commands: playlist.commands,
          isCustom: false,
        }
      });

      // ローカル状態を更新
      setDiscoveredPlaylists(prev => 
        prev.map(p => 
          p.id === playlist.id 
            ? { ...p, isInstalled: true, downloads: p.downloads + 1 }
            : p
        )
      );

    } catch (error) {
      console.error('Failed to install playlist:', error);
      alert('プレイリストのインストールに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUninstallPlaylist = async (playlist: Playlist) => {
    if (!confirm(`"${playlist.name}"をアンインストールしますか？`)) {
      return;
    }

    try {
      actions.dispatch({
        type: 'REMOVE_PLAYLIST',
        payload: playlist.id
      });

      setDiscoveredPlaylists(prev => 
        prev.map(p => 
          p.id === playlist.id 
            ? { ...p, isInstalled: false }
            : p
        )
      );

    } catch (error) {
      console.error('Failed to uninstall playlist:', error);
    }
  };

  const handleCreatePlaylist = () => {
    // プレイリスト作成画面に遷移（将来実装）
    alert('プレイリスト作成機能は近日公開予定です');
  };

  const PlaylistCard = ({ playlist }: { playlist: Playlist }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      {/* ヘッダー */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              {playlist.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {playlist.description}
            </p>
          </div>
          
          {playlist.isInstalled && (
            <div className="ml-3 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded-full">
              インストール済み
            </div>
          )}
        </div>

        {/* 統計情報 */}
        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>@{playlist.author}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Download className="w-4 h-4" />
            <span>{playlist.downloads.toLocaleString()}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-current text-yellow-500" />
            <span>{playlist.rating}</span>
          </div>
        </div>
      </div>

      {/* コマンドプレビュー */}
      <div className="p-4">
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {playlist.commands.slice(0, 3).map(command => (
            <div
              key={command.id}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs"
            >
              <span>{command.icon}</span>
              <span className="text-gray-700 dark:text-gray-300">{command.label}</span>
            </div>
          ))}
          {playlist.commands.length > 3 && (
            <div className="flex-shrink-0 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-500 dark:text-gray-400">
              +{playlist.commands.length - 3}
            </div>
          )}
        </div>

        {/* タグ */}
        <div className="flex flex-wrap gap-2 mb-4">
          {playlist.tags.slice(0, 4).map(tag => (
            <span
              key={tag}
              className="px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-xs rounded"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* アクションボタン */}
        <div className="flex gap-2">
          {playlist.isInstalled ? (
            <button
              onClick={() => handleUninstallPlaylist(playlist)}
              className="flex-1 py-2 px-4 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
            >
              アンインストール
            </button>
          ) : (
            <button
              onClick={() => handleInstallPlaylist(playlist)}
              disabled={isLoading}
              className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {isLoading ? 'インストール中...' : 'インストール'}
            </button>
          )}
          
          <button
            onClick={() => window.open(`https://gist.github.com/${playlist.author}/${playlist.id}`, '_blank')}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="playlists-page min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ヘッダー */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="safe-area-top px-4 pt-6 pb-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              プレイリスト
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              コマンドセットを発見・管理
            </p>
          </div>

          <button
            onClick={handleCreatePlaylist}
            className="p-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* 検索バー */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="プレイリストを検索..."
            className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </motion.header>

      {/* フィルターバー */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">カテゴリ</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedCategory === category.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span>{category.icon}</span>
              <span>{category.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* メインコンテンツ */}
      <main className="px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {/* 結果ヘッダー */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-between mb-6"
          >
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {filteredPlaylists.length}件のプレイリスト
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedCategory !== 'all' && `"${categories.find(c => c.id === selectedCategory)?.label}" `}
                {searchQuery && `"${searchQuery}" で検索中`}
              </p>
            </div>

            <button
              onClick={() => {
                const shuffled = [...filteredPlaylists].sort(() => Math.random() - 0.5);
                setDiscoveredPlaylists(shuffled);
              }}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <Shuffle className="w-5 h-5" />
            </button>
          </motion.div>

          {/* プレイリストグリッド */}
          <AnimatePresence>
            {filteredPlaylists.length > 0 ? (
              <motion.div
                layout
                className={`grid gap-6 ${
                  viewMode === 'grid'
                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-1'
                }`}
              >
                {filteredPlaylists.map(playlist => (
                  <PlaylistCard key={playlist.id} playlist={playlist} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  プレイリストが見つかりません
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  検索条件を変更するか、新しいプレイリストを作成してみてください
                </p>
                <button
                  onClick={handleCreatePlaylist}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  プレイリストを作成
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}