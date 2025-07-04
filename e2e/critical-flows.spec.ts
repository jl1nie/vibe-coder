/**
 * Critical User Flows E2E Tests
 * Test Pyramid Level: E2E (70%+ critical path coverage)
 */

import { test, expect } from '@playwright/test';
import { connectToTestServer, executeCommand, simulateVoiceInput } from './helpers/test-helpers';

test.describe('Critical User Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for PWA to load
    await page.waitForLoadState('networkidle');
  });

  test('初回接続からコマンド実行までの完全フロー', async ({ page }) => {
    // PWA loading確認
    await expect(page).toHaveTitle(/Vibe Coder/);
    await expect(page.getByText(/Mobile-first Claude Code/i)).toBeVisible();

    // 接続フロー
    await page.getByRole('button', { name: /connect/i }).click();
    await expect(page.getByText(/Enter Server ID/i)).toBeVisible();

    const serverIdInput = page.getByPlaceholder(/server id/i);
    await serverIdInput.fill('TEST-SERVER-123');
    await page.getByRole('button', { name: /connect/i }).click();

    // WebRTC接続確立を待機
    await expect(page.getByText(/Connecting/i)).toBeVisible();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 15000 });

    // ターミナルページ表示確認
    await expect(page.getByRole('region', { name: /terminal/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Enter command/i)).toBeVisible();

    // クイックコマンド実行
    const loginButton = page.getByRole('button', { name: /login/i });
    await expect(loginButton).toBeVisible();
    await loginButton.click();

    // コマンド実行確認
    await expect(page.getByText(/Executing.*authentication/i)).toBeVisible();
    await expect(page.getByText(/Claude Code analyzing/i)).toBeVisible({ timeout: 10000 });
  });

  test('音声入力によるコマンド実行フロー', async ({ page }) => {
    // 事前条件: サーバーに接続
    await connectToTestServer(page);

    // 音声入力ボタンクリック
    const voiceButton = page.getByRole('button', { name: /voice input/i });
    await voiceButton.click();

    // 音声入力モーダル表示確認
    await expect(page.getByRole('dialog', { name: /voice input/i })).toBeVisible();
    await expect(page.getByText(/Listening/i)).toBeVisible();

    // 音声認識シミュレーション
    await simulateVoiceInput(page, 'create a contact form component');

    // 認識結果確認
    const recognizedText = page.getByDisplayValue(/create a contact form component/i);
    await expect(recognizedText).toBeVisible();

    // コマンド実行
    await page.getByRole('button', { name: /execute/i }).click();

    // 実行結果確認
    await expect(page.getByText(/Executing.*contact form/i)).toBeVisible();
    await expect(page.getByText(/Creating component/i)).toBeVisible({ timeout: 20000 });
  });

  test('プレイリスト発見・インポート・使用フロー', async ({ page }) => {
    // メニューを開く
    await page.getByRole('button', { name: /menu/i }).click();
    await page.getByRole('menuitem', { name: /playlists/i }).click();

    // プレイリストページ表示確認
    await expect(page.getByText(/Discover Playlists/i)).toBeVisible();
    await expect(page.getByText(/Popular Playlists/i)).toBeVisible();

    // プレイリスト検索
    const searchInput = page.getByPlaceholder(/search playlists/i);
    await searchInput.fill('frontend');
    await page.keyboard.press('Enter');

    // 検索結果確認
    await expect(page.getByText(/Frontend Vibes/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/@ui_ninja/i)).toBeVisible();

    // プレイリストをインポート
    const firstPlaylist = page.getByTestId('playlist-card').first();
    await firstPlaylist.getByRole('button', { name: /import/i }).click();

    // インポート確認ダイアログ
    await expect(page.getByText(/Import.*Frontend Vibes/i)).toBeVisible();
    await expect(page.getByText(/12 commands/i)).toBeVisible();
    await page.getByRole('button', { name: /import/i }).click();

    // インポート成功確認
    await expect(page.getByText(/Playlist imported successfully/i)).toBeVisible();
    await expect(page.getByText(/12 new commands available/i)).toBeVisible();

    // ターミナルに戻る
    await page.getByRole('button', { name: /terminal/i }).click();

    // 新しいコマンドが利用可能
    await expect(page.getByRole('button', { name: /polish/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /responsive/i })).toBeVisible();
  });

  test('ファイル変更監視フロー', async ({ page }) => {
    // 事前条件: サーバーに接続
    await connectToTestServer(page);

    // ファイル監視開始
    await page.getByRole('button', { name: /files/i }).click();
    await expect(page.getByText(/File Monitoring Active/i)).toBeVisible();

    // ファイル作成コマンド実行
    await executeCommand(page, 'create a new React component called UserProfile');

    // ファイル作成通知確認
    await expect(page.getByText(/File created:.*UserProfile/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/\.jsx$/i)).toBeVisible();

    // ファイル編集コマンド実行
    await executeCommand(page, 'add props validation to UserProfile component');

    // ファイル変更通知確認
    await expect(page.getByText(/File modified:.*UserProfile/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/PropTypes added/i)).toBeVisible();

    // ファイル一覧表示
    const fileList = page.getByRole('region', { name: /file list/i });
    await expect(fileList).toBeVisible();
    await expect(fileList.getByText(/UserProfile\.jsx/i)).toBeVisible();
  });

  test('エラー発生と回復フロー', async ({ page }) => {
    // 無効なサーバーIDでの接続試行
    await page.getByRole('button', { name: /connect/i }).click();
    await page.getByPlaceholder(/server id/i).fill('INVALID-SERVER-999');
    await page.getByRole('button', { name: /connect/i }).click();

    // エラー表示確認
    await expect(page.getByText(/Connection failed/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Server not found/i)).toBeVisible();

    // 再試行
    await page.getByPlaceholder(/server id/i).fill('TEST-SERVER-123');
    await page.getByRole('button', { name: /retry/i }).click();

    // 接続成功確認
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 15000 });

    // 危険なコマンド実行試行
    await executeCommand(page, 'rm -rf /');

    // セキュリティエラー確認
    await expect(page.getByText(/Dangerous command detected/i)).toBeVisible();
    await expect(page.getByText(/Command blocked for security/i)).toBeVisible();

    // 安全なコマンド実行
    await executeCommand(page, 'create a safe hello world function');

    // 正常実行確認
    await expect(page.getByText(/Executing.*hello world/i)).toBeVisible();
    await expect(page.getByText(/Function created successfully/i)).toBeVisible({ timeout: 20000 });
  });

  test('セッション永続化フロー', async ({ page }) => {
    // 接続してコマンド実行
    await connectToTestServer(page);
    await executeCommand(page, 'create a variable called sessionTest');

    // セッション情報確認
    await expect(page.getByText(/Session ID:.*TEST-SERVER-123/i)).toBeVisible();
    await expect(page.getByText(/sessionTest.*created/i)).toBeVisible({ timeout: 15000 });

    // ページをリロード
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 自動再接続確認
    await expect(page.getByText(/Reconnecting/i)).toBeVisible();
    await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 10000 });

    // セッション復元確認
    await expect(page.getByText(/Session restored/i)).toBeVisible();

    // 以前のセッションデータが利用可能
    await executeCommand(page, 'show me the sessionTest variable');
    await expect(page.getByText(/sessionTest.*found/i)).toBeVisible({ timeout: 15000 });
  });

  test('複数コマンド並行実行フロー', async ({ page }) => {
    // 事前条件: サーバーに接続
    await connectToTestServer(page);

    // 複数のコマンドを素早く実行
    const commands = [
      'create a utility function',
      'add error handling',
      'write unit tests',
      'update documentation'
    ];

    // コマンドキューに追加
    for (const command of commands) {
      await page.getByPlaceholder(/enter command/i).fill(command);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500); // 短い間隔で実行
    }

    // 並行実行確認
    await expect(page.getByText(/4 commands queued/i)).toBeVisible();
    await expect(page.getByText(/Executing.*utility function/i)).toBeVisible();

    // 全コマンド完了確認
    for (const command of commands) {
      await expect(page.getByText(new RegExp(command.split(' ')[1]))).toBeVisible({ timeout: 60000 });
    }

    await expect(page.getByText(/All commands completed/i)).toBeVisible();
  });
});