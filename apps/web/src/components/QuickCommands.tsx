import React, { useState, useRef, useEffect } from 'react';
import { Command } from '@vibe-coder/shared';
import { Plus, Edit, Trash2, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { useSwipeGesture } from '../hooks/useSwipeGesture';

interface QuickCommandsProps {
  commands: Command[];
  onExecute?: (command: Command) => void;
  onEdit?: (command: Command) => void;
  onDelete?: (commandId: string) => void;
  onAdd?: () => void;
  className?: string;
  maxVisible?: number;
  enableSwipe?: boolean;
  showActions?: boolean;
  isEditing?: boolean;
}

export function QuickCommands({
  commands,
  onExecute,
  onEdit,
  onDelete,
  onAdd,
  className = '',
  maxVisible = 5,
  enableSwipe = true,
  showActions = true,
  isEditing = false,
}: QuickCommandsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [pressedCommand, setPressedCommand] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // スワイプで左右にスクロール
  const swipeHandlers = {
    onSwipeLeft: () => {
      if (currentIndex < commands.length - maxVisible) {
        setCurrentIndex(currentIndex + 1);
      }
    },
    onSwipeRight: () => {
      if (currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    },
  };

  const { attachToElement } = useSwipeGesture(swipeHandlers, {
    threshold: 50,
    velocity: 0.3,
    restraint: 100,
  });

  useEffect(() => {
    if (containerRef.current && enableSwipe) {
      attachToElement(containerRef.current);
    }
  }, [attachToElement, enableSwipe]);

  // 表示するコマンドを計算
  const visibleCommands = commands.slice(currentIndex, currentIndex + maxVisible);
  const canScrollLeft = currentIndex > 0;
  const canScrollRight = currentIndex < commands.length - maxVisible;

  // ハプティックフィードバック
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30],
      };
      navigator.vibrate(patterns[type]);
    }
  };

  // 長押し検出
  const handleTouchStart = (command: Command, event: React.TouchEvent) => {
    if (isEditing) return;

    setPressedCommand(command.id);
    triggerHaptic('light');

    const timer = setTimeout(() => {
      triggerHaptic('medium');
      onEdit?.(command);
      setPressedCommand(null);
    }, 800); // 800ms長押し

    setLongPressTimer(timer);
  };

  const handleTouchEnd = (command: Command) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    if (pressedCommand === command.id) {
      // 通常のタップ
      triggerHaptic('light');
      onExecute?.(command);
    }

    setPressedCommand(null);
  };

  const handleTouchCancel = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setPressedCommand(null);
  };

  // ドラッグ操作
  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    setIsDragging(false);
    
    const threshold = 50;
    if (Math.abs(info.offset.x) > threshold) {
      if (info.offset.x > 0 && canScrollLeft) {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      } else if (info.offset.x < 0 && canScrollRight) {
        setCurrentIndex(Math.min(commands.length - maxVisible, currentIndex + 1));
      }
    }
  };

  // スクロールボタン
  const scrollLeft = () => {
    if (canScrollLeft) {
      setCurrentIndex(currentIndex - 1);
      triggerHaptic('light');
    }
  };

  const scrollRight = () => {
    if (canScrollRight) {
      setCurrentIndex(currentIndex + 1);
      triggerHaptic('light');
    }
  };

  // コマンドの複製
  const handleDuplicate = (command: Command) => {
    const duplicated = {
      ...command,
      id: `${command.id}-copy-${Date.now()}`,
      label: `${command.label} (コピー)`,
      isCustom: true,
    };
    // onAdd関数で複製を処理（実際の実装では親コンポーネントで処理）
    console.log('Duplicate command:', duplicated);
  };

  return (
    <div className={`quick-commands-container ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          クイックコマンド
        </h3>
        
        {showActions && (
          <div className="flex items-center gap-2">
            {/* インジケータ */}
            {commands.length > maxVisible && (
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.ceil(commands.length / maxVisible) }).map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      Math.floor(currentIndex / maxVisible) === index
                        ? 'bg-primary-600'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* 追加ボタン */}
            <button
              onClick={onAdd}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* コマンドグリッド */}
      <div className="relative">
        {/* 左スクロールボタン */}
        <AnimatePresence>
          {canScrollLeft && !isDragging && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onClick={scrollLeft}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* 右スクロールボタン */}
        <AnimatePresence>
          {canScrollRight && !isDragging && (
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onClick={scrollRight}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700"
            >
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* コマンドコンテナ */}
        <motion.div
          ref={containerRef}
          className="overflow-hidden px-8"
          drag={enableSwipe ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-5 gap-3 min-h-[100px]">
            <AnimatePresence mode="popLayout">
              {visibleCommands.map((command, index) => (
                <motion.div
                  key={command.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: index * 0.05 }}
                  className="quick-command-wrapper"
                >
                  <div className="relative group">
                    {/* メインコマンドボタン */}
                    <button
                      className={`
                        quick-command w-full h-20 relative overflow-hidden
                        ${pressedCommand === command.id ? 'scale-95 bg-primary-100 dark:bg-primary-900' : ''}
                        ${isEditing ? 'animate-pulse' : ''}
                      `}
                      onTouchStart={(e) => handleTouchStart(command, e)}
                      onTouchEnd={() => handleTouchEnd(command)}
                      onTouchCancel={handleTouchCancel}
                      onMouseDown={() => !isEditing && triggerHaptic('light')}
                      onClick={() => !isEditing && onExecute?.(command)}
                      disabled={isDragging}
                    >
                      {/* アイコン */}
                      <div className="quick-command-icon text-2xl mb-1">
                        {command.icon}
                      </div>
                      
                      {/* ラベル */}
                      <div className="quick-command-label text-xs font-medium text-gray-700 dark:text-gray-300 leading-tight">
                        {command.label}
                      </div>

                      {/* カスタムコマンドインジケータ */}
                      {command.isCustom && (
                        <div className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"></div>
                      )}

                      {/* 長押し進行インジケータ */}
                      {pressedCommand === command.id && (
                        <motion.div
                          className="absolute inset-0 bg-primary-600/20 rounded-xl"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.8 }}
                        />
                      )}
                    </button>

                    {/* 編集モード時のアクション */}
                    <AnimatePresence>
                      {isEditing && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="absolute -top-2 -right-2 flex gap-1"
                        >
                          {/* 編集ボタン */}
                          <button
                            onClick={() => onEdit?.(command)}
                            className="p-1 bg-blue-600 text-white rounded-full shadow-lg"
                          >
                            <Edit className="w-3 h-3" />
                          </button>

                          {/* 複製ボタン */}
                          <button
                            onClick={() => handleDuplicate(command)}
                            className="p-1 bg-green-600 text-white rounded-full shadow-lg"
                          >
                            <Copy className="w-3 h-3" />
                          </button>

                          {/* 削除ボタン */}
                          {command.isCustom && (
                            <button
                              onClick={() => onDelete?.(command.id)}
                              className="p-1 bg-red-600 text-white rounded-full shadow-lg"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}

              {/* 空のスロット（追加ボタン） */}
              {visibleCommands.length < maxVisible && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={onAdd}
                  className="quick-command border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400 transition-colors"
                >
                  <Plus className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    追加
                  </div>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* スワイプヒント */}
        {commands.length > maxVisible && !isDragging && (
          <div className="text-center mt-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              ← スワイプで移動 →
            </div>
          </div>
        )}
      </div>

      {/* 長押しヒント */}
      {!isEditing && (
        <div className="text-center mt-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            タップで実行 • 長押しで編集
          </div>
        </div>
      )}
    </div>
  );
}