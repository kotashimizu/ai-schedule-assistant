'use client';

// Service Worker管理とプッシュ通知のユーティリティ

export interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: any;
  scheduleTime?: number;
}

export interface NotificationPermissionState {
  permission: NotificationPermission;
  supported: boolean;
  serviceWorkerRegistered: boolean;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isInitialized = false;

  /**
   * Service Workerの初期化
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker is not supported');
      return false;
    }

    try {
      // Service Workerの登録
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });

      console.log('Service Worker registered successfully');

      // Service Workerの更新チェック
      this.registration.addEventListener('updatefound', () => {
        console.log('Service Worker update found');
        const newWorker = this.registration?.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New Service Worker installed, reload required');
              // 新しいService Workerが利用可能になったことをユーザーに通知
              this.notifyUpdateAvailable();
            }
          });
        }
      });

      // Service Workerからのメッセージを受信
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Message from Service Worker:', event.data);
        this.handleServiceWorkerMessage(event.data);
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  /**
   * 通知権限の確認と要求
   */
  async requestNotificationPermission(): Promise<NotificationPermissionState> {
    const state: NotificationPermissionState = {
      permission: 'default',
      supported: 'Notification' in window,
      serviceWorkerRegistered: !!this.registration
    };

    if (!state.supported) {
      console.warn('Notifications are not supported');
      return state;
    }

    try {
      // 既に権限がある場合
      if (Notification.permission === 'granted') {
        state.permission = 'granted';
        return state;
      }

      // 権限が拒否されている場合
      if (Notification.permission === 'denied') {
        state.permission = 'denied';
        return state;
      }

      // 権限を要求
      const permission = await Notification.requestPermission();
      state.permission = permission;

      if (permission === 'granted') {
        console.log('Notification permission granted');
        // テスト通知を表示
        await this.showWelcomeNotification();
      } else {
        console.log('Notification permission denied');
      }

      return state;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      state.permission = 'denied';
      return state;
    }
  }

  /**
   * 即座に通知を表示
   */
  async showNotification(data: NotificationData): Promise<boolean> {
    if (!this.registration) {
      console.error('Service Worker not registered');
      return false;
    }

    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return false;
    }

    try {
      await this.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || '/icons/icon-192.png',
        badge: data.badge || '/icons/badge-72.png',
        tag: data.tag || `notification-${Date.now()}`,
        requireInteraction: data.requireInteraction || false,
        data: data.data || {},
        actions: [
          {
            action: 'view',
            title: '確認する',
            icon: '/icons/check-24.png'
          },
          {
            action: 'dismiss',
            title: '閉じる',
            icon: '/icons/close-24.png'
          }
        ],
        vibrate: [200, 100, 200],
        silent: false,
        timestamp: Date.now()
      });

      // 通知表示をログに記録
      this.logNotificationShown(data);
      return true;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  }

  /**
   * 予定された時間に通知を表示
   */
  async scheduleNotification(data: NotificationData & { scheduleTime: number }): Promise<boolean> {
    if (!this.registration) {
      console.error('Service Worker not registered');
      return false;
    }

    const delay = data.scheduleTime - Date.now();
    
    if (delay <= 0) {
      // 既に時間が過ぎている場合は即座に表示
      return this.showNotification(data);
    }

    try {
      // Service Workerにメッセージを送信してスケジュール
      this.registration.active?.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        title: data.title,
        body: data.body,
        scheduleTime: data.scheduleTime,
        data: data.data
      });

      console.log(`Notification scheduled for ${new Date(data.scheduleTime).toLocaleString()}`);
      return true;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      return false;
    }
  }

  /**
   * 未送信通知のチェックを要求
   */
  async checkPendingNotifications(): Promise<void> {
    if (!this.registration) {
      return;
    }

    try {
      this.registration.active?.postMessage({
        type: 'CHECK_NOTIFICATIONS'
      });
    } catch (error) {
      console.error('Failed to check pending notifications:', error);
    }
  }

  /**
   * ウェルカム通知の表示
   */
  private async showWelcomeNotification(): Promise<void> {
    await this.showNotification({
      title: 'AI Schedule Assistant',
      body: '通知が有効になりました！タスクやイベントのリマインダーをお送りします。',
      tag: 'welcome',
      requireInteraction: false,
      data: { type: 'welcome' }
    });
  }

  /**
   * Service Workerからのメッセージ処理
   */
  private handleServiceWorkerMessage(data: any): void {
    switch (data?.type) {
      case 'NOTIFICATION_CLICKED':
        console.log('Notification clicked:', data);
        // 必要に応じてアプリの状態を更新
        break;
      case 'CACHE_UPDATED':
        console.log('Cache updated');
        break;
      default:
        console.log('Unknown message from Service Worker:', data);
    }
  }

  /**
   * 更新通知
   */
  private notifyUpdateAvailable(): void {
    // ユーザーに新しいバージョンが利用可能であることを通知
    console.log('New version available');
    // 必要に応じてUIで更新通知を表示
  }

  /**
   * 通知表示のログ記録
   */
  private async logNotificationShown(data: NotificationData): Promise<void> {
    try {
      await fetch('/api/analytics/notification-interaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'show',
          title: data.title,
          tag: data.tag,
          timestamp: Date.now(),
          userAgent: navigator.userAgent
        })
      });
    } catch (error) {
      console.error('Failed to log notification:', error);
    }
  }

  /**
   * Service Worker登録状態の確認
   */
  getRegistrationState(): {
    registered: boolean;
    active: boolean;
    registration: ServiceWorkerRegistration | null;
  } {
    return {
      registered: !!this.registration,
      active: !!this.registration?.active,
      registration: this.registration
    };
  }
}

// シングルトンインスタンス
export const serviceWorkerManager = new ServiceWorkerManager();

/**
 * Service Workerの初期化フック（クライアントサイドでのみ使用）
 */
export function useServiceWorkerInit() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermissionState>({
    permission: 'default',
    supported: false,
    serviceWorkerRegistered: false
  });

  useEffect(() => {
    const initializeServiceWorker = async () => {
      const success = await serviceWorkerManager.initialize();
      setIsInitialized(success);
      
      if (success) {
        const state = await serviceWorkerManager.requestNotificationPermission();
        setPermissionState(state);
      }
    };

    initializeServiceWorker();
  }, []);

  return {
    isInitialized,
    permissionState,
    showNotification: serviceWorkerManager.showNotification.bind(serviceWorkerManager),
    scheduleNotification: serviceWorkerManager.scheduleNotification.bind(serviceWorkerManager),
    requestPermission: serviceWorkerManager.requestNotificationPermission.bind(serviceWorkerManager)
  };
}

// React import for useState and useEffect
import { useState, useEffect } from 'react';