import { EventEmitter } from 'events';
import { watch, FSWatcher } from 'chokidar';
import { promises as fs } from 'fs';
import path from 'path';
import { createLogger, LogTimer } from '../utils/logger';
import { Environment } from '../utils/env';

const logger = createLogger('file-watcher');

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  sessionId: string;
  timestamp: number;
  size?: number;
  isDirectory?: boolean;
}

export interface WatchedSession {
  sessionId: string;
  workspaceDir: string;
  watcher: FSWatcher;
  isActive: boolean;
  createdAt: number;
  fileCount: number;
  lastActivity: number;
}

export interface FileWatcherEvents {
  fileChanged: (event: FileChangeEvent) => void;
  sessionWatchStarted: (sessionId: string, workspaceDir: string) => void;
  sessionWatchStopped: (sessionId: string) => void;
  error: (sessionId: string, error: Error) => void;
}

export class FileWatcherService extends EventEmitter {
  private sessions = new Map<string, WatchedSession>();
  private env: Environment;
  private cleanupInterval: NodeJS.Timeout;
  private allowedExtensions: Set<string>;

  constructor(env: Environment) {
    super();
    this.env = env;
    
    // 許可されたファイル拡張子の設定
    this.allowedExtensions = new Set(
      env.ALLOWED_FILE_EXTENSIONS.split(',').map(ext => ext.trim().toLowerCase())
    );

    this.startCleanup();

    logger.info('File Watcher Service initialized', {
      allowedExtensions: Array.from(this.allowedExtensions),
      cleanupInterval: env.SESSION_CLEANUP_INTERVAL_MS,
    });
  }

  // セッションの監視開始
  async startWatching(sessionId: string, workspaceDir: string): Promise<void> {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} is already being watched`);
    }

    const timer = new LogTimer(logger, 'startWatching', { sessionId, workspaceDir });

    try {
      // ワークスペースディレクトリの存在確認
      await this.validateWorkspaceDirectory(workspaceDir);

      // Chokidarの設定
      const watcher = watch(workspaceDir, {
        ignored: this.getIgnorePatterns(),
        persistent: true,
        ignoreInitial: false,
        followSymlinks: false,
        depth: 10,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
        atomic: true,
      });

      const session: WatchedSession = {
        sessionId,
        workspaceDir,
        watcher,
        isActive: true,
        createdAt: Date.now(),
        fileCount: 0,
        lastActivity: Date.now(),
      };

      // ウォッチャーイベントの設定
      this.setupWatcherEvents(session);

      this.sessions.set(sessionId, session);
      this.emit('sessionWatchStarted', sessionId, workspaceDir);

      timer.finish({ watchedSessions: this.sessions.size });

      logger.info('Started watching session workspace', {
        sessionId,
        workspaceDir,
        watchedSessions: this.sessions.size,
      });

    } catch (error) {
      timer.error(error as Error);
      throw error;
    }
  }

  // セッションの監視停止
  async stopWatching(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Attempted to stop watching unknown session', { sessionId });
      return;
    }

    const timer = new LogTimer(logger, 'stopWatching', { sessionId });

    try {
      session.isActive = false;
      await session.watcher.close();

      this.sessions.delete(sessionId);
      this.emit('sessionWatchStopped', sessionId);

      timer.finish({
        watchedSessions: this.sessions.size,
        sessionDuration: Date.now() - session.createdAt,
        fileCount: session.fileCount,
      });

      logger.info('Stopped watching session workspace', {
        sessionId,
        workspaceDir: session.workspaceDir,
        watchedSessions: this.sessions.size,
        sessionDuration: Date.now() - session.createdAt,
        totalFiles: session.fileCount,
      });

    } catch (error) {
      timer.error(error as Error);
      throw error;
    }
  }

  // ウォッチャーイベントの設定
  private setupWatcherEvents(session: WatchedSession): void {
    const { sessionId, watcher } = session;

    watcher.on('add', async (filePath) => {
      await this.handleFileEvent('add', filePath, session);
    });

    watcher.on('change', async (filePath) => {
      await this.handleFileEvent('change', filePath, session);
    });

    watcher.on('unlink', async (filePath) => {
      await this.handleFileEvent('unlink', filePath, session);
    });

    watcher.on('addDir', async (dirPath) => {
      await this.handleFileEvent('addDir', dirPath, session);
    });

    watcher.on('unlinkDir', async (dirPath) => {
      await this.handleFileEvent('unlinkDir', dirPath, session);
    });

    watcher.on('error', (error) => {
      logger.error('File watcher error', { sessionId, error });
      this.emit('error', sessionId, error);
    });

    watcher.on('ready', () => {
      logger.debug('File watcher ready', { sessionId });
    });
  }

  // ファイルイベントの処理
  private async handleFileEvent(
    eventType: FileChangeEvent['type'],
    filePath: string,
    session: WatchedSession
  ): Promise<void> {
    try {
      // 相対パスに変換
      const relativePath = path.relative(session.workspaceDir, filePath);
      
      // ファイル拡張子チェック
      if (!this.isAllowedFile(filePath)) {
        logger.debug('Ignored file change (not allowed extension)', {
          sessionId: session.sessionId,
          path: relativePath,
          eventType,
        });
        return;
      }

      // ファイル情報の取得
      let size: number | undefined;
      let isDirectory = false;

      if (eventType === 'add' || eventType === 'change') {
        try {
          const stats = await fs.stat(filePath);
          size = stats.size;
          isDirectory = stats.isDirectory();
        } catch (error) {
          // ファイルが既に削除されている可能性
          logger.debug('Failed to get file stats', {
            sessionId: session.sessionId,
            path: relativePath,
            error,
          });
        }
      } else if (eventType === 'addDir' || eventType === 'unlinkDir') {
        isDirectory = true;
      }

      // ファイルサイズ制限チェック
      if (size && size > 10 * 1024 * 1024) { // 10MB制限
        logger.warn('Large file detected', {
          sessionId: session.sessionId,
          path: relativePath,
          size,
          eventType,
        });
        return;
      }

      // イベントの作成
      const event: FileChangeEvent = {
        type: eventType,
        path: relativePath,
        sessionId: session.sessionId,
        timestamp: Date.now(),
        size,
        isDirectory,
      };

      // セッション統計の更新
      session.lastActivity = Date.now();
      if (eventType === 'add') {
        session.fileCount++;
      } else if (eventType === 'unlink') {
        session.fileCount = Math.max(0, session.fileCount - 1);
      }

      this.sessions.set(session.sessionId, session);
      this.emit('fileChanged', event);

      logger.debug('File change event processed', {
        sessionId: session.sessionId,
        eventType,
        path: relativePath,
        size,
        isDirectory,
      });

    } catch (error) {
      logger.error('Failed to handle file event', {
        sessionId: session.sessionId,
        eventType,
        path: filePath,
        error,
      });
    }
  }

  // 許可されたファイルかチェック
  private isAllowedFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    
    // 拡張子なしのファイル（設定ファイルなど）は許可
    if (!ext) {
      const basename = path.basename(filePath).toLowerCase();
      const allowedNoExt = [
        'dockerfile', 'makefile', 'readme', 'license', 'changelog',
        'package.json', 'tsconfig.json', 'vite.config.js', '.gitignore',
      ];
      return allowedNoExt.some(name => basename.includes(name));
    }

    return this.allowedExtensions.has(ext);
  }

  // 無視パターンの取得
  private getIgnorePatterns(): (string | RegExp)[] {
    return [
      // Node.js
      'node_modules/**',
      '**/.npm/**',
      '**/npm-debug.log*',
      
      // Git
      '**/.git/**',
      '**/.gitignore',
      
      // IDE/Editor
      '**/.vscode/**',
      '**/.idea/**',
      '**/.*swp',
      '**/.*swo',
      
      // OS
      '**/.DS_Store',
      '**/Thumbs.db',
      
      // Build outputs
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/target/**',
      
      // Logs
      '**/logs/**',
      '**/*.log',
      
      // Temporary files
      '**/tmp/**',
      '**/temp/**',
      '**/*~',
      
      // Large files
      /\.(zip|tar|gz|bz2|7z|rar|dmg|iso)$/,
      /\.(jpg|jpeg|png|gif|bmp|tiff|webp|svg)$/,
      /\.(mp4|avi|mkv|mov|wmv|flv|webm)$/,
      /\.(mp3|wav|flac|aac|ogg|wma)$/,
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/,
    ];
  }

  // ワークスペースディレクトリの検証
  private async validateWorkspaceDirectory(workspaceDir: string): Promise<void> {
    try {
      const stats = await fs.stat(workspaceDir);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${workspaceDir}`);
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`Workspace directory does not exist: ${workspaceDir}`);
      }
      throw error;
    }
  }

  // 監視中のセッション一覧
  getWatchedSessions(): WatchedSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  // セッション情報の取得
  getSession(sessionId: string): WatchedSession | undefined {
    return this.sessions.get(sessionId);
  }

  // 統計情報の取得
  getStats(): Record<string, any> {
    const sessions = this.getWatchedSessions();
    const now = Date.now();

    return {
      totalSessions: this.sessions.size,
      activeSessions: sessions.length,
      totalFiles: sessions.reduce((sum, session) => sum + session.fileCount, 0),
      averageSessionAge: sessions.length > 0
        ? sessions.reduce((sum, session) => sum + (now - session.createdAt), 0) / sessions.length
        : 0,
      allowedExtensions: Array.from(this.allowedExtensions),
    };
  }

  // 古いセッションのクリーンアップ
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60 * 60 * 1000; // 1時間

      for (const [sessionId, session] of this.sessions) {
        if (now - session.lastActivity > timeout) {
          logger.info('Cleaning up inactive file watcher session', {
            sessionId,
            lastActivity: new Date(session.lastActivity).toISOString(),
            ageMinutes: Math.round((now - session.lastActivity) / 60000),
          });

          this.stopWatching(sessionId).catch(error => {
            logger.error('Failed to cleanup file watcher session', { sessionId, error });
          });
        }
      }
    }, this.env.SESSION_CLEANUP_INTERVAL_MS);

    logger.debug('File watcher cleanup monitor started');
  }

  // クリーンアップ
  async cleanup(): Promise<void> {
    logger.info('Starting File Watcher Service cleanup');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // すべてのセッション監視を停止
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map(id => this.stopWatching(id)));

    logger.info('File Watcher Service cleanup completed');
  }
}

// ファクトリー関数
export function setupFileWatcher(env: Environment): FileWatcherService {
  return new FileWatcherService(env);
}