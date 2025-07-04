/**
 * Unit Tests for QuickCommands Component
 * Test Pyramid Level: Unit (90%+ coverage target)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickCommands } from '../QuickCommands';

// Mock types
const mockCommands = [
  {
    icon: '🔐',
    label: 'Login',
    command: 'claude-code "add authentication to the app"',
    description: 'Add login functionality',
    category: 'auth',
  },
  {
    icon: '🐛',
    label: 'Fix Bug',
    command: 'claude-code "fix the reported bug"',
    description: 'Debug and fix issues',
    category: 'debug',
  },
  {
    icon: '🎨',
    label: 'Style',
    command: 'claude-code "improve the UI styling"',
    description: 'Enhance visual design',
    category: 'ui',
  },
];

describe('QuickCommands', () => {
  const mockOnExecute = vi.fn();
  const mockOnEdit = vi.fn();
  const defaultProps = {
    commands: mockCommands,
    onExecute: mockOnExecute,
    onEdit: mockOnEdit,
    isLoading: false,
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // === 基本機能テスト ===
  describe('基本機能', () => {
    it('すべてのコマンドボタンが正しくレンダリングされる', () => {
      render(<QuickCommands {...defaultProps} />);

      mockCommands.forEach(command => {
        expect(screen.getByRole('button', { name: new RegExp(command.label, 'i') })).toBeInTheDocument();
        expect(screen.getByText(command.icon)).toBeInTheDocument();
      });
    });

    it('コマンドクリック時にonExecuteが正しい引数で呼び出される', async () => {
      const user = userEvent.setup();
      render(<QuickCommands {...defaultProps} />);

      const loginButton = screen.getByRole('button', { name: /login/i });
      await user.click(loginButton);

      expect(mockOnExecute).toHaveBeenCalledTimes(1);
      expect(mockOnExecute).toHaveBeenCalledWith(mockCommands[0].command);
    });

    it('長押し時にonEditが呼び出される', async () => {
      const user = userEvent.setup();
      render(<QuickCommands {...defaultProps} />);

      const loginButton = screen.getByRole('button', { name: /login/i });
      
      // 長押しのシミュレーション
      await user.pointer([
        { keys: '[MouseLeft>]', target: loginButton },
        { delay: 1500 }, // 1.5秒待機
        { keys: '[/MouseLeft]' },
      ]);

      expect(mockOnEdit).toHaveBeenCalledTimes(1);
      expect(mockOnEdit).toHaveBeenCalledWith(mockCommands[0]);
    });

    it('空のコマンドリストでも正常に表示される', () => {
      render(<QuickCommands {...defaultProps} commands={[]} />);
      
      expect(screen.getByText(/no commands available/i)).toBeInTheDocument();
    });
  });

  // === 状態管理テスト ===
  describe('状態管理', () => {
    it('ローディング状態でボタンが無効化される', () => {
      render(<QuickCommands {...defaultProps} isLoading={true} />);

      mockCommands.forEach(command => {
        const button = screen.getByRole('button', { name: new RegExp(command.label, 'i') });
        expect(button).toBeDisabled();
      });
    });

    it('disabled状態でボタンが無効化される', () => {
      render(<QuickCommands {...defaultProps} disabled={true} />);

      mockCommands.forEach(command => {
        const button = screen.getByRole('button', { name: new RegExp(command.label, 'i') });
        expect(button).toBeDisabled();
      });
    });

    it('ローディング中にスピナーが表示される', () => {
      render(<QuickCommands {...defaultProps} isLoading={true} />);
      
      expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
    });
  });

  // === アクセシビリティテスト ===
  describe('アクセシビリティ', () => {
    it('すべてのボタンに適切なARIA属性が設定される', () => {
      render(<QuickCommands {...defaultProps} />);

      mockCommands.forEach(command => {
        const button = screen.getByRole('button', { name: new RegExp(command.label, 'i') });
        
        expect(button).toHaveAttribute('aria-label');
        expect(button).toHaveAttribute('tabIndex', '0');
        
        if (command.description) {
          expect(button).toHaveAttribute('aria-describedby');
        }
      });
    });

    it('キーボードナビゲーションが動作する', async () => {
      const user = userEvent.setup();
      render(<QuickCommands {...defaultProps} />);

      // Tab キーでフォーカス移動
      await user.tab();
      expect(screen.getByRole('button', { name: /login/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /fix bug/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /style/i })).toHaveFocus();
    });

    it('Enter キーでコマンドが実行される', async () => {
      const user = userEvent.setup();
      render(<QuickCommands {...defaultProps} />);

      const loginButton = screen.getByRole('button', { name: /login/i });
      loginButton.focus();
      
      await user.keyboard('{Enter}');

      expect(mockOnExecute).toHaveBeenCalledWith(mockCommands[0].command);
    });

    it('Space キーでコマンドが実行される', async () => {
      const user = userEvent.setup();
      render(<QuickCommands {...defaultProps} />);

      const loginButton = screen.getByRole('button', { name: /login/i });
      loginButton.focus();
      
      await user.keyboard(' ');

      expect(mockOnExecute).toHaveBeenCalledWith(mockCommands[0].command);
    });

    it('高コントラストモードで適切に表示される', () => {
      // 高コントラストモードのシミュレーション
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(<QuickCommands {...defaultProps} />);
      
      // 高コントラスト用のCSSクラスが適用されることを確認
      const container = screen.getByRole('list');
      expect(container).toHaveClass('high-contrast');
    });
  });

  // === タッチ操作テスト ===
  describe('タッチ操作', () => {
    it('タッチイベントでコマンドが実行される', async () => {
      render(<QuickCommands {...defaultProps} />);

      const loginButton = screen.getByRole('button', { name: /login/i });
      
      fireEvent.touchStart(loginButton);
      fireEvent.touchEnd(loginButton);

      expect(mockOnExecute).toHaveBeenCalledWith(mockCommands[0].command);
    });

    it('スワイプジェスチャーでコマンドリストをスクロールできる', async () => {
      // 多数のコマンドでスクロール可能な状態を作成
      const manyCommands = Array.from({ length: 20 }, (_, i) => ({
        icon: `🔥`,
        label: `Command ${i + 1}`,
        command: `claude-code "command ${i + 1}"`,
        description: `Description ${i + 1}`,
        category: 'test',
      }));

      render(<QuickCommands {...defaultProps} commands={manyCommands} />);

      const container = screen.getByRole('list');
      
      // スワイプジェスチャーのシミュレーション
      fireEvent.touchStart(container, {
        touches: [{ clientX: 200, clientY: 0 }],
      });
      fireEvent.touchMove(container, {
        touches: [{ clientX: 50, clientY: 0 }],
      });
      fireEvent.touchEnd(container);

      // スクロール位置が変更されることを確認
      expect(container.scrollLeft).toBeGreaterThan(0);
    });
  });

  // === エラーハンドリングテスト ===
  describe('エラーハンドリング', () => {
    it('onExecuteでエラーが発生しても処理が継続される', async () => {
      const mockOnExecuteWithError = vi.fn().mockImplementation(() => {
        throw new Error('Execution failed');
      });
      
      // エラーをコンソールに出力しないようにモック
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<QuickCommands {...defaultProps} onExecute={mockOnExecuteWithError} />);

      const loginButton = screen.getByRole('button', { name: /login/i });
      await userEvent.click(loginButton);

      expect(mockOnExecuteWithError).toHaveBeenCalled();
      // エラー後もコンポーネントが正常に表示される
      expect(loginButton).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });

    it('無効なコマンドデータでも正常に表示される', () => {
      const invalidCommands = [
        { icon: '', label: '', command: '', description: '', category: '' },
        { icon: '🔥', label: 'Valid', command: 'valid command', description: 'Valid desc', category: 'valid' },
      ];

      render(<QuickCommands {...defaultProps} commands={invalidCommands} />);

      // 有効なコマンドのみ表示される
      expect(screen.getByRole('button', { name: /valid/i })).toBeInTheDocument();
    });
  });

  // === パフォーマンステスト ===
  describe('パフォーマンス', () => {
    it('大量のコマンドでもレンダリング時間が許容範囲内', () => {
      const manyCommands = Array.from({ length: 100 }, (_, i) => ({
        icon: `🔥`,
        label: `Command ${i + 1}`,
        command: `claude-code "command ${i + 1}"`,
        description: `Description ${i + 1}`,
        category: 'performance-test',
      }));

      const startTime = performance.now();
      render(<QuickCommands {...defaultProps} commands={manyCommands} />);
      const renderTime = performance.now() - startTime;

      // レンダリング時間が100ms以内であることを確認
      expect(renderTime).toBeLessThan(100);
    });

    it('頻繁なpropsの変更でも安定動作する', async () => {
      const { rerender } = render(<QuickCommands {...defaultProps} />);

      // 100回props変更を繰り返す
      for (let i = 0; i < 100; i++) {
        rerender(
          <QuickCommands
            {...defaultProps}
            isLoading={i % 2 === 0}
            disabled={i % 3 === 0}
          />
        );
      }

      // 最終状態でも正常に動作することを確認
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    });
  });

  // === カスタマイゼーションテスト ===
  describe('カスタマイゼーション', () => {
    it('カスタムCSSクラスが適用される', () => {
      render(<QuickCommands {...defaultProps} className="custom-commands" />);
      
      const container = screen.getByRole('list');
      expect(container).toHaveClass('custom-commands');
    });

    it('カスタムスタイルが適用される', () => {
      const customStyle = { backgroundColor: 'red' };
      render(<QuickCommands {...defaultProps} style={customStyle} />);
      
      const container = screen.getByRole('list');
      expect(container).toHaveStyle('background-color: red');
    });

    it('カテゴリでフィルタリングが動作する', () => {
      render(<QuickCommands {...defaultProps} filterCategory="auth" />);
      
      // authカテゴリのコマンドのみ表示される
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /fix bug/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /style/i })).not.toBeInTheDocument();
    });
  });

  // === インテグレーションポイント ===
  describe('統合ポイント', () => {
    it('ボイス入力からのコマンド実行が動作する', async () => {
      render(<QuickCommands {...defaultProps} />);

      // カスタムイベントでボイス入力をシミュレーション
      const voiceEvent = new CustomEvent('voiceCommand', {
        detail: { command: mockCommands[0].command },
      });
      
      fireEvent(window, voiceEvent);

      expect(mockOnExecute).toHaveBeenCalledWith(mockCommands[0].command);
    });

    it('外部からのコマンド追加が反映される', () => {
      const { rerender } = render(<QuickCommands {...defaultProps} />);

      const newCommand = {
        icon: '🚀',
        label: 'Deploy',
        command: 'claude-code "deploy the application"',
        description: 'Deploy to production',
        category: 'deployment',
      };

      rerender(
        <QuickCommands {...defaultProps} commands={[...mockCommands, newCommand]} />
      );

      expect(screen.getByRole('button', { name: /deploy/i })).toBeInTheDocument();
    });
  });
});

// === テストユーティリティ ===
function expectButtonToBeAccessible(button: HTMLElement) {
  expect(button).toHaveAttribute('role', 'button');
  expect(button).toHaveAttribute('tabIndex', '0');
  expect(button).toHaveAttribute('aria-label');
}

function simulateLongPress(element: HTMLElement) {
  fireEvent.mouseDown(element);
  // 長押しのシミュレーション（実際のタイマーは使わない）
  fireEvent.mouseUp(element);
}

export { mockCommands, expectButtonToBeAccessible, simulateLongPress };