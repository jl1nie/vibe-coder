import { Workbox } from 'workbox-window';

export interface PWAInstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export class PWAManager {
  private wb: Workbox | null = null;
  private installPrompt: PWAInstallPrompt | null = null;
  private updateAvailable = false;

  public async initialize(): Promise<void> {
    // Service Worker登録
    if ('serviceWorker' in navigator) {
      this.wb = new Workbox('/sw.js', {
        scope: '/',
      });

      // Service Worker更新時の処理
      this.wb.addEventListener('waiting', () => {
        this.updateAvailable = true;
        this.showUpdateNotification();
      });

      // Service Worker制御開始時
      this.wb.addEventListener('controlling', () => {
        window.location.reload();
      });

      // Service Worker登録
      try {
        await this.wb.register();
        console.log('✅ Service Worker registered successfully');
      } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
      }
    }

    // PWAインストール可能チェック
    this.checkInstallability();

    // ネットワーク状態監視
    this.setupNetworkMonitoring();

    // アプリ更新チェック
    this.setupUpdateCheck();
  }

  public handleInstallPrompt(event: PWAInstallPrompt): void {
    this.installPrompt = event;
    this.showInstallPrompt();
  }

  public async installApp(): Promise<boolean> {
    if (!this.installPrompt) {
      return false;
    }

    try {
      await this.installPrompt.prompt();
      const choice = await this.installPrompt.userChoice;
      
      if (choice.outcome === 'accepted') {
        console.log('✅ PWA installed successfully');
        this.hideInstallPrompt();
        return true;
      } else {
        console.log('ℹ️ PWA installation declined');
        return false;
      }
    } catch (error) {
      console.error('❌ PWA installation failed:', error);
      return false;
    } finally {
      this.installPrompt = null;
    }
  }

  public async updateApp(): Promise<void> {
    if (!this.wb || !this.updateAvailable) {
      return;
    }

    try {
      // 新しいService Workerをアクティブ化
      this.wb.addEventListener('controlling', () => {
        window.location.reload();
      });

      this.wb.messageSkipWaiting();
    } catch (error) {
      console.error('❌ App update failed:', error);
    }
  }

  public isInstalled(): boolean {
    // PWAがインストールされているかチェック
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true ||
           document.referrer.includes('android-app://');
  }

  public isInstallable(): boolean {
    return this.installPrompt !== null;
  }

  public getNetworkStatus(): {
    online: boolean;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  } {
    const nav = navigator as any;
    return {
      online: navigator.onLine,
      effectiveType: nav.connection?.effectiveType,
      downlink: nav.connection?.downlink,
      rtt: nav.connection?.rtt,
    };
  }

  private checkInstallability(): void {
    // インストール可能性をチェック
    if (this.isInstalled()) {
      console.log('✅ PWA is already installed');
      return;
    }

    // iOS Safari でのインストール案内
    if (this.isIOSSafari() && !this.isInstalled()) {
      setTimeout(() => {
        this.showIOSInstallGuide();
      }, 3000); // 3秒後に表示
    }
  }

  private isIOSSafari(): boolean {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent) && /safari/.test(userAgent) && !/crios|fxios/.test(userAgent);
  }

  private showInstallPrompt(): void {
    const promptElement = document.getElementById('pwa-install-prompt');
    if (promptElement) {
      promptElement.style.display = 'block';
      
      // インストールボタンのイベント
      const installButton = document.getElementById('install-button');
      if (installButton) {
        installButton.onclick = () => this.installApp();
      }

      // 閉じるボタンのイベント
      const dismissButton = document.getElementById('dismiss-button');
      if (dismissButton) {
        dismissButton.onclick = () => this.hideInstallPrompt();
      }
    }
  }

  private hideInstallPrompt(): void {
    const promptElement = document.getElementById('pwa-install-prompt');
    if (promptElement) {
      promptElement.style.display = 'none';
    }
  }

  private showIOSInstallGuide(): void {
    // iOS Safariでのインストール案内を表示
    this.showToast(
      'ホーム画面に追加',
      '共有ボタン → ホーム画面に追加 でアプリをインストールできます',
      'info',
      8000
    );
  }

  private showUpdateNotification(): void {
    this.showToast(
      'アップデートが利用可能',
      '新しいバージョンが利用可能です。更新しますか？',
      'info',
      0, // 永続表示
      [
        {
          text: '更新',
          action: () => this.updateApp(),
        },
        {
          text: '後で',
          action: () => {}, // 何もしない
        }
      ]
    );
  }

  private setupNetworkMonitoring(): void {
    const updateOnlineStatus = () => {
      const status = this.getNetworkStatus();
      
      // オフライン状態の通知
      if (!status.online) {
        this.showToast(
          'オフライン',
          'インターネット接続がありません。一部機能が制限されます。',
          'warning',
          0
        );
      } else {
        // オンライン復帰時の通知
        this.showToast(
          'オンライン',
          'インターネット接続が復旧しました。',
          'success',
          3000
        );
      }

      // カスタムイベント発火
      window.dispatchEvent(new CustomEvent('networkchange', {
        detail: status
      }));
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Connection API対応ブラウザでの詳細監視
    if ('connection' in navigator) {
      (navigator as any).connection.addEventListener('change', () => {
        const status = this.getNetworkStatus();
        console.log('📶 Network status changed:', status);
        
        window.dispatchEvent(new CustomEvent('networkchange', {
          detail: status
        }));
      });
    }
  }

  private setupUpdateCheck(): void {
    // 定期的にアップデートをチェック（1時間ごと）
    setInterval(async () => {
      if (this.wb) {
        try {
          const registration = await this.wb.getSW();
          if (registration) {
            registration.update();
          }
        } catch (error) {
          console.error('❌ Update check failed:', error);
        }
      }
    }, 60 * 60 * 1000); // 1時間

    // ページフォーカス時にもチェック
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden && this.wb) {
        try {
          const registration = await this.wb.getSW();
          if (registration) {
            registration.update();
          }
        } catch (error) {
          console.error('❌ Update check failed:', error);
        }
      }
    });
  }

  private showToast(
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    duration = 5000,
    actions: Array<{ text: string; action: () => void }> = []
  ): void {
    // トースト通知を表示（実装は将来的にToastコンポーネントで行う）
    console.log(`🔔 Toast [${type}]: ${title} - ${message}`);
    
    // カスタムイベントとして発火
    window.dispatchEvent(new CustomEvent('toast', {
      detail: { title, message, type, duration, actions }
    }));
  }

  public async shareContent(data: {
    title?: string;
    text?: string;
    url?: string;
  }): Promise<boolean> {
    if ('share' in navigator) {
      try {
        await (navigator as any).share(data);
        return true;
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('❌ Share failed:', error);
        }
        return false;
      }
    }

    // フォールバック: クリップボードにコピー
    if ('clipboard' in navigator && data.url) {
      try {
        await navigator.clipboard.writeText(data.url);
        this.showToast('コピー完了', 'URLをクリップボードにコピーしました', 'success');
        return true;
      } catch (error) {
        console.error('❌ Clipboard copy failed:', error);
        return false;
      }
    }

    return false;
  }

  public async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const granted = await navigator.storage.persist();
        if (granted) {
          console.log('✅ Persistent storage granted');
        } else {
          console.log('ℹ️ Persistent storage not granted');
        }
        return granted;
      } catch (error) {
        console.error('❌ Persistent storage request failed:', error);
        return false;
      }
    }
    return false;
  }

  public async getStorageEstimate(): Promise<{
    quota?: number;
    usage?: number;
    usagePercentage?: number;
  } | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const quota = estimate.quota || 0;
        const usage = estimate.usage || 0;
        const usagePercentage = quota > 0 ? (usage / quota) * 100 : 0;

        return {
          quota,
          usage,
          usagePercentage,
        };
      } catch (error) {
        console.error('❌ Storage estimate failed:', error);
        return null;
      }
    }
    return null;
  }
}