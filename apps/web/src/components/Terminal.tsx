import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TerminalOutput } from '@vibe-coder/shared';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { Copy, Download, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';

interface TerminalProps {
  output: TerminalOutput[];
  isExecuting?: boolean;
  className?: string;
  enableSwipeScroll?: boolean;
  showActions?: boolean;
  onCopy?: () => void;
  onClear?: () => void;
  onDownload?: () => void;
  onToggleFullscreen?: () => void;
}

export function Terminal({
  output,
  isExecuting = false,
  className = '',
  enableSwipeScroll = true,
  showActions = true,
  onCopy,
  onClear,
  onDownload,
  onToggleFullscreen,
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [swipeStartY, setSwipeStartY] = useState(0);

  // スワイプジェスチャーのハンドラー
  const swipeHandlers = {
    onSwipeStart: (startX: number, startY: number) => {
      setSwipeStartY(startY);
      setAutoScroll(false); // スワイプ開始時は自動スクロールを無効
    },

    onSwipeMove: (deltaX: number, deltaY: number, currentX: number, currentY: number) => {
      if (!contentRef.current || !enableSwipeScroll) return;

      // 垂直スワイプでスクロール
      const element = contentRef.current;
      const newScrollTop = element.scrollTop - deltaY * 0.5; // スワイプの感度調整
      
      element.scrollTop = Math.max(
        0,
        Math.min(newScrollTop, element.scrollHeight - element.clientHeight)
      );
      
      setScrollPosition(element.scrollTop);
    },

    onSwipeEnd: () => {
      // スワイプ終了時、底部近くにいる場合は自動スクロールを再開
      if (contentRef.current) {
        const element = contentRef.current;
        const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 50;
        setAutoScroll(isNearBottom);
      }
    },
  };

  const { attachToElement } = useSwipeGesture(swipeHandlers, {
    threshold: 20,
    velocity: 0.1,
    restraint: 50,
  });

  // ターミナル要素にスワイプを適用
  useEffect(() => {
    if (terminalRef.current && enableSwipeScroll) {
      attachToElement(terminalRef.current);
    }
  }, [attachToElement, enableSwipeScroll]);

  // 新しい出力があった場合の自動スクロール
  useEffect(() => {
    if (autoScroll && contentRef.current) {
      const element = contentRef.current;
      element.scrollTop = element.scrollHeight;
    }
  }, [output, autoScroll]);

  // スクロール位置の監視
  const handleScroll = useCallback(() => {
    if (!contentRef.current) return;

    const element = contentRef.current;
    const newScrollPosition = element.scrollTop;
    setScrollPosition(newScrollPosition);

    // 底部近くにいる場合は自動スクロールを有効
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 50;
    setAutoScroll(isNearBottom);
  }, []);

  // ANSI エスケープシーケンスの処理
  const parseAnsiColors = (text: string) => {
    // ANSI カラーコードのマッピング（xterm-256color対応）
    const ansiColorMap: Record<number, string> = {
      // 基本8色
      30: 'text-gray-900', 31: 'text-red-500', 32: 'text-green-500', 33: 'text-yellow-500',
      34: 'text-blue-500', 35: 'text-purple-500', 36: 'text-cyan-500', 37: 'text-gray-300',
      // 明るい8色
      90: 'text-gray-600', 91: 'text-red-400', 92: 'text-green-400', 93: 'text-yellow-400',
      94: 'text-blue-400', 95: 'text-purple-400', 96: 'text-cyan-400', 97: 'text-white',
      // 背景色
      40: 'bg-gray-900', 41: 'bg-red-500', 42: 'bg-green-500', 43: 'bg-yellow-500',
      44: 'bg-blue-500', 45: 'bg-purple-500', 46: 'bg-cyan-500', 47: 'bg-gray-300',
      100: 'bg-gray-600', 101: 'bg-red-400', 102: 'bg-green-400', 103: 'bg-yellow-400',
      104: 'bg-blue-400', 105: 'bg-purple-400', 106: 'bg-cyan-400', 107: 'bg-white',
    };

    // ANSI エスケープシーケンスを解析
    const ansiRegex = /\x1b\[([0-9;]*)([a-zA-Z])/g;
    const parts: Array<{ text: string; classes: string[] }> = [];
    let lastIndex = 0;
    let currentClasses: string[] = [];

    let match;
    while ((match = ansiRegex.exec(text)) !== null) {
      // エスケープシーケンス前のテキスト
      if (match.index > lastIndex) {
        const textBefore = text.slice(lastIndex, match.index);
        if (textBefore) {
          parts.push({ text: textBefore, classes: [...currentClasses] });
        }
      }

      const codes = match[1] ? match[1].split(';').map(Number) : [0];
      const command = match[2];

      if (command === 'm') { // カラーコマンド
        for (const code of codes) {
          if (code === 0) {
            // リセット
            currentClasses = [];
          } else if (code === 1) {
            // 太字
            currentClasses.push('font-bold');
          } else if (code === 3) {
            // イタリック
            currentClasses.push('italic');
          } else if (code === 4) {
            // アンダーライン
            currentClasses.push('underline');
          } else if (ansiColorMap[code]) {
            // カラーコード
            // 既存の同じタイプ（テキスト/背景）のクラスを削除
            const isBackground = code >= 40;
            currentClasses = currentClasses.filter(cls => 
              isBackground ? !cls.startsWith('bg-') : !cls.startsWith('text-')
            );
            currentClasses.push(ansiColorMap[code]);
          } else if (code === 38) {
            // 256色対応（38;5;n）- 簡略実装
            // 実際の256色は複雑なので、基本色にマッピング
          }
        }
      }

      lastIndex = ansiRegex.lastIndex;
    }

    // 残りのテキスト
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex);
      if (remainingText) {
        parts.push({ text: remainingText, classes: [...currentClasses] });
      }
    }

    // テキストがない場合は元のテキストをそのまま返す
    if (parts.length === 0) {
      return [{ text, classes: [] }];
    }

    return parts;
  };

  // 出力の整形（ANSI対応）
  const formatOutput = (output: TerminalOutput[]) => {
    return output.map((line, index) => {
      const timestamp = new Date(line.timestamp).toLocaleTimeString('ja-JP', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      let defaultTextColor = 'text-terminal-text';
      let bgColor = '';

      switch (line.type) {
        case 'stderr':
          defaultTextColor = 'text-red-400';
          break;
        case 'exit':
          defaultTextColor = 'text-blue-400';
          break;
        case 'error':
          defaultTextColor = 'text-red-500';
          bgColor = 'bg-red-900/20';
          break;
      }

      // ANSI カラーコードを解析
      const parsedParts = parseAnsiColors(line.data);

      return (
        <div
          key={`${line.sessionId}-${index}`}
          className={`terminal-line flex ${bgColor} hover:bg-gray-800/30 transition-colors`}
        >
          <span className="text-gray-500 text-xs mr-3 font-mono select-none flex-shrink-0 w-16">
            {timestamp}
          </span>
          <pre className="font-mono text-sm whitespace-pre-wrap break-words flex-1 selectable">
            {parsedParts.map((part, partIndex) => {
              const classes = part.classes.length > 0 
                ? part.classes.join(' ')
                : defaultTextColor;
              return (
                <span key={partIndex} className={classes}>
                  {part.text}
                </span>
              );
            })}
          </pre>
        </div>
      );
    });
  };

  // アクション関数
  const handleCopy = async () => {
    if (!output.length) return;

    try {
      const text = output.map(line => line.data).join('');
      await navigator.clipboard.writeText(text);
      onCopy?.();
    } catch (error) {
      console.error('Failed to copy terminal output:', error);
    }
  };

  const handleDownload = () => {
    if (!output.length) return;

    const text = output.map(line => {
      const timestamp = new Date(line.timestamp).toISOString();
      return `[${timestamp}] ${line.type.toUpperCase()}: ${line.data}`;
    }).join('');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal-output-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    onDownload?.();
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    onToggleFullscreen?.();
  };

  return (
    <div
      className={`terminal-container relative bg-terminal-bg rounded-lg border border-gray-700 overflow-hidden ${className} ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
    >
      {/* ターミナルヘッダー */}
      {showActions && (
        <div className="terminal-header flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="text-gray-400 text-sm font-mono ml-2">Terminal</span>
          </div>

          <div className="flex items-center gap-2">
            {/* スクロール位置インジケータ */}
            {contentRef.current && (
              <div className="text-xs text-gray-500 font-mono">
                {Math.round((scrollPosition / (contentRef.current.scrollHeight - contentRef.current.clientHeight)) * 100) || 0}%
              </div>
            )}

            {/* アクションボタン */}
            <button
              onClick={handleCopy}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              title="コピー"
            >
              <Copy className="w-4 h-4" />
            </button>

            <button
              onClick={onClear}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              title="クリア"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={handleDownload}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              title="ダウンロード"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={handleToggleFullscreen}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              title={isFullscreen ? '最小化' : '全画面'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* ターミナル本体 */}
      <div
        ref={terminalRef}
        className="terminal-body relative h-full"
        style={{ height: isFullscreen ? 'calc(100vh - 60px)' : '400px' }}
      >
        {/* スクロール可能なコンテンツ */}
        <div
          ref={contentRef}
          className="terminal-content h-full overflow-y-auto custom-scrollbar p-4 font-mono text-sm leading-relaxed"
          onScroll={handleScroll}
          style={{
            scrollBehavior: autoScroll ? 'smooth' : 'auto',
          }}
        >
          {/* ターミナル出力 */}
          {output.length > 0 ? (
            formatOutput(output)
          ) : (
            <div className="text-gray-500 text-center py-8">
              <div className="text-lg mb-2">🖥️</div>
              <div>ターミナル出力がここに表示されます</div>
              <div className="text-sm mt-1">スワイプでスクロールできます</div>
            </div>
          )}

          {/* 実行中インジケータ */}
          {isExecuting && (
            <div className="flex items-center gap-2 text-yellow-400 animate-pulse">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
              <span className="text-sm">実行中...</span>
            </div>
          )}

          {/* カーソル */}
          <div className="terminal-cursor-line flex items-center">
            <span className="text-green-400 mr-2">$</span>
            <div className="terminal-cursor w-2 h-4 bg-terminal-cursor animate-blink"></div>
          </div>
        </div>

        {/* スワイプヒント（最初の数秒間表示） */}
        <div className="absolute top-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none opacity-70">
          ↕️ スワイプでスクロール
        </div>

        {/* 自動スクロール無効時の通知 */}
        {!autoScroll && (
          <div className="absolute bottom-4 right-4 bg-yellow-600/90 text-white text-xs px-2 py-1 rounded">
            自動スクロール無効
          </div>
        )}
      </div>
    </div>
  );
}