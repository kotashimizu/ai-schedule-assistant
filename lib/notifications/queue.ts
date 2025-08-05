// 通知キューイングシステム - AI Schedule Assistant

export interface QueuedNotification {
  id: string;
  userId: string;
  type: 'task_reminder' | 'event_reminder' | 'urgent_task' | 'daily_summary' | 'custom';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  data: any;
  channels: ('browser' | 'discord')[];
  scheduledTime: Date;
  maxRetries: number;
  retryCount: number;
  status: 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled';
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

export interface NotificationQueue {
  notifications: QueuedNotification[];
  isProcessing: boolean;
  lastProcessedAt?: Date;
}

export interface NotificationFilter {
  allowUrgent: boolean;
  maxPerHour: number;
  quietHours?: {
    start: string; // HH:MM
    end: string;   // HH:MM
  };
  focusMode?: {
    enabled: boolean;
    start: string; // HH:MM
    end: string;   // HH:MM
    allowUrgent: boolean;
  };
}

class NotificationQueueManager {
  private queue: Map<string, NotificationQueue> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly PROCESSING_INTERVAL = 30000; // 30秒間隔

  /**
   * 通知をキューに追加
   */
  async enqueue(notification: Omit<QueuedNotification, 'id' | 'retryCount' | 'status' | 'createdAt'>): Promise<string> {
    const notificationId = this.generateId();
    const queuedNotification: QueuedNotification = {
      ...notification,
      id: notificationId,
      retryCount: 0,
      status: 'queued',
      createdAt: new Date()
    };

    // ユーザー別のキューを取得または作成
    if (!this.queue.has(notification.userId)) {
      this.queue.set(notification.userId, {
        notifications: [],
        isProcessing: false
      });
    }

    const userQueue = this.queue.get(notification.userId)!;
    userQueue.notifications.push(queuedNotification);

    // 優先度順にソート
    userQueue.notifications.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // 同じ優先度の場合は予定時刻順
      return a.scheduledTime.getTime() - b.scheduledTime.getTime();
    });

    console.log(`Notification queued: ${notificationId} for user ${notification.userId}`);
    return notificationId;
  }

  /**
   * 通知をキューから削除（キャンセル）
   */
  async cancel(userId: string, notificationId: string): Promise<boolean> {
    const userQueue = this.queue.get(userId);
    if (!userQueue) return false;

    const index = userQueue.notifications.findIndex(n => n.id === notificationId);
    if (index === -1) return false;

    const notification = userQueue.notifications[index];
    if (notification.status === 'processing') {
      notification.status = 'cancelled';
      return true;
    }

    userQueue.notifications.splice(index, 1);
    console.log(`Notification cancelled: ${notificationId}`);
    return true;
  }

  /**
   * ユーザーのキューを取得
   */
  getUserQueue(userId: string): QueuedNotification[] {
    const userQueue = this.queue.get(userId);
    return userQueue ? [...userQueue.notifications] : [];
  }

  /**
   * キューのクリーンアップ（古い通知の削除）
   */
  cleanup(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    for (const [userId, userQueue] of this.queue.entries()) {
      const originalLength = userQueue.notifications.length;
      
      userQueue.notifications = userQueue.notifications.filter(notification => {
        const shouldKeep = notification.createdAt > cutoffTime || 
                          notification.status === 'queued' || 
                          notification.status === 'processing';
        return shouldKeep;
      });

      const removedCount = originalLength - userQueue.notifications.length;
      if (removedCount > 0) {
        console.log(`Cleaned up ${removedCount} old notifications for user ${userId}`);
      }

      // 空のキューを削除
      if (userQueue.notifications.length === 0 && !userQueue.isProcessing) {
        this.queue.delete(userId);
      }
    }
  }

  /**
   * 処理を開始
   */
  startProcessing(): void {
    if (this.processingInterval) return;

    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, this.PROCESSING_INTERVAL);

    console.log('Notification queue processing started');
  }

  /**
   * 処理を停止
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('Notification queue processing stopped');
    }
  }

  /**
   * キューの処理（内部メソッド）
   */
  private async processQueue(): Promise<void> {
    const now = new Date();

    for (const [userId, userQueue] of this.queue.entries()) {
      if (userQueue.isProcessing) continue;

      // 送信可能な通知を取得
      const readyNotifications = userQueue.notifications.filter(notification => 
        notification.status === 'queued' && 
        notification.scheduledTime <= now
      );

      if (readyNotifications.length === 0) continue;

      userQueue.isProcessing = true;

      try {
        // ユーザーの通知設定を取得してフィルタリング
        const filter = await this.getUserNotificationFilter(userId);
        const allowedNotifications = this.filterNotifications(readyNotifications, filter, now);

        // 許可された通知を処理
        for (const notification of allowedNotifications) {
          await this.processNotification(notification);
        }

        userQueue.lastProcessedAt = now;
      } catch (error) {
        console.error(`Error processing queue for user ${userId}:`, error);
      } finally {
        userQueue.isProcessing = false;
      }
    }

    // 定期的なクリーンアップ
    if (Math.random() < 0.1) { // 10%の確率で実行
      this.cleanup();
    }
  }

  /**
   * 通知のフィルタリング
   */
  private filterNotifications(
    notifications: QueuedNotification[], 
    filter: NotificationFilter, 
    now: Date
  ): QueuedNotification[] {
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // 静音時間のチェック
    if (filter.quietHours && this.isInTimeRange(currentTime, filter.quietHours.start, filter.quietHours.end)) {
      return notifications.filter(n => n.priority === 'urgent' && filter.allowUrgent);
    }

    // 集中モードのチェック
    if (filter.focusMode?.enabled && this.isInTimeRange(currentTime, filter.focusMode.start, filter.focusMode.end)) {
      return notifications.filter(n => n.priority === 'urgent' && filter.focusMode!.allowUrgent);
    }

    // 1時間あたりの通知数制限
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentNotifications = notifications.filter(n => 
      n.processedAt && n.processedAt > oneHourAgo && n.status === 'sent'
    );

    const remainingSlots = Math.max(0, filter.maxPerHour - recentNotifications.length);
    
    // 優先度順に制限内の通知を選択
    return notifications.slice(0, remainingSlots);
  }

  /**
   * 個別通知の処理
   */
  private async processNotification(notification: QueuedNotification): Promise<void> {
    notification.status = 'processing';

    try {
      // 通知の送信処理
      const success = await this.sendNotification(notification);

      if (success) {
        notification.status = 'sent';
        notification.processedAt = new Date();
        console.log(`Notification sent successfully: ${notification.id}`);
      } else {
        throw new Error('Failed to send notification');
      }

    } catch (error) {
      notification.retryCount++;
      notification.error = error instanceof Error ? error.message : 'Unknown error';

      if (notification.retryCount >= notification.maxRetries) {
        notification.status = 'failed';
        console.error(`Notification failed permanently: ${notification.id}`, error);
      } else {
        notification.status = 'queued';
        // 指数バックオフで再試行時刻を調整
        const backoffMinutes = Math.pow(2, notification.retryCount) * 5; // 5, 10, 20, 40分...
        notification.scheduledTime = new Date(Date.now() + backoffMinutes * 60 * 1000);
        console.log(`Notification retry scheduled: ${notification.id} (attempt ${notification.retryCount})`);
      }
    }
  }

  /**
   * 実際の通知送信処理
   */
  private async sendNotification(notification: QueuedNotification): Promise<boolean> {
    const promises: Promise<boolean>[] = [];

    // Discord通知
    if (notification.channels.includes('discord')) {
      promises.push(this.sendDiscordNotification(notification));
    }

    // ブラウザ通知
    if (notification.channels.includes('browser')) {
      promises.push(this.sendBrowserNotification(notification));
    }

    if (promises.length === 0) {
      throw new Error('No notification channels specified');
    }

    // 少なくとも1つのチャンネルで成功すれば成功とする
    const results = await Promise.allSettled(promises);
    return results.some(result => result.status === 'fulfilled' && result.value === true);
  }

  /**
   * Discord通知送信
   */
  private async sendDiscordNotification(notification: QueuedNotification): Promise<boolean> {
    try {
      const response = await fetch('/api/notifications/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: notification.type,
          data: notification.data,
          immediate: true
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Discord notification failed:', error);
      return false;
    }
  }

  /**
   * ブラウザ通知送信
   */
  private async sendBrowserNotification(notification: QueuedNotification): Promise<boolean> {
    // Service Workerまたはブラウザ通知APIを使用
    // 実装は環境に依存するため、ここではプレースホルダー
    console.log('Browser notification would be sent:', notification.data.title);
    return true;
  }

  /**
   * ユーザーの通知フィルター設定を取得
   */
  private async getUserNotificationFilter(userId: string): Promise<NotificationFilter> {
    try {
      const response = await fetch(`/api/notifications/settings?userId=${userId}`);
      if (response.ok) {
        const { settings } = await response.json();
        return {
          allowUrgent: true,
          maxPerHour: settings.maxNotificationsPerHour || 10,
          quietHours: settings.quietHoursEnabled ? {
            start: settings.quietHoursStart,
            end: settings.quietHoursEnd
          } : undefined,
          focusMode: settings.focusModeEnabled ? {
            enabled: true,
            start: settings.focusModeStart,
            end: settings.focusModeEnd,
            allowUrgent: settings.focusModeAllowUrgent
          } : undefined
        };
      }
    } catch (error) {
      console.error('Failed to fetch user notification filter:', error);
    }

    // デフォルトフィルター
    return {
      allowUrgent: true,
      maxPerHour: 10
    };
  }

  /**
   * 時間範囲内かどうかをチェック
   */
  private isInTimeRange(currentTime: string, startTime: string, endTime: string): boolean {
    const current = this.timeToMinutes(currentTime);
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);

    if (start <= end) {
      // 同日内の範囲
      return current >= start && current <= end;
    } else {
      // 日をまたぐ範囲
      return current >= start || current <= end;
    }
  }

  /**
   * HH:MM形式を分に変換
   */
  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * 一意のIDを生成
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * キューの統計情報を取得
   */
  getStats(): {
    totalQueues: number;
    totalNotifications: number;
    statusCounts: Record<string, number>;
    avgProcessingTime?: number;
  } {
    let totalNotifications = 0;
    const statusCounts: Record<string, number> = {};
    const processingTimes: number[] = [];

    for (const userQueue of this.queue.values()) {
      totalNotifications += userQueue.notifications.length;
      
      for (const notification of userQueue.notifications) {
        statusCounts[notification.status] = (statusCounts[notification.status] || 0) + 1;
        
        if (notification.processedAt && notification.createdAt) {
          const processingTime = notification.processedAt.getTime() - notification.createdAt.getTime();
          processingTimes.push(processingTime);
        }
      }
    }

    const avgProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : undefined;

    return {
      totalQueues: this.queue.size,
      totalNotifications,
      statusCounts,
      avgProcessingTime
    };
  }
}

// シングルトンインスタンス
export const notificationQueue = new NotificationQueueManager();