import { GoogleCalendarEvent } from '@/types/shared';

/**
 * オフライン時のカレンダーデータ管理
 * ブラウザのIndexedDBを使用してローカルストレージを管理
 */
export class CalendarOfflineManager {
  private dbName = 'TaskFlowCalendar';
  private version = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  /**
   * IndexedDB初期化
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = () => {
        const db = request.result;

        // イベントキャッシュストア
        if (!db.objectStoreNames.contains('events')) {
          const eventStore = db.createObjectStore('events', { keyPath: 'id' });
          eventStore.createIndex('date', 'date', { unique: false });
          eventStore.createIndex('synced_at', 'synced_at', { unique: false });
        }

        // 同期キューストア
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
          queueStore.createIndex('created_at', 'created_at', { unique: false });
          queueStore.createIndex('retry_count', 'retry_count', { unique: false });
        }

        // メタデータストア
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * イベントをローカルキャッシュに保存
   */
  async cacheEvents(events: GoogleCalendarEvent[], syncTime: Date = new Date()): Promise<void> {
    if (!this.db) await this.initDB();
    if (!this.db) throw new Error('データベース初期化失敗');

    const transaction = this.db.transaction(['events'], 'readwrite');
    const store = transaction.objectStore('events');

    for (const event of events) {
      const cachedEvent = {
        ...event,
        synced_at: syncTime.toISOString(),
        date: event.start.dateTime?.split('T')[0] || new Date().toISOString().split('T')[0],
      };
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(cachedEvent);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    // 最後の同期時間を保存
    await this.setMetadata('last_sync', syncTime.toISOString());
  }

  /**
   * キャッシュされたイベントを取得
   */
  async getCachedEvents(startDate?: string, endDate?: string): Promise<GoogleCalendarEvent[]> {
    if (!this.db) await this.initDB();
    if (!this.db) return [];

    const transaction = this.db.transaction(['events'], 'readonly');
    const store = transaction.objectStore('events');

    return new Promise((resolve, reject) => {
      const events: GoogleCalendarEvent[] = [];
      let request: IDBRequest;

      if (startDate && endDate) {
        const index = store.index('date');
        request = index.openCursor(IDBKeyRange.bound(startDate.split('T')[0], endDate.split('T')[0]));
      } else {
        request = store.openCursor();
      }

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          events.push(cursor.value);
          cursor.continue();
        } else {
          resolve(events);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 今日のキャッシュされたイベントを取得
   */
  async getTodayCachedEvents(): Promise<GoogleCalendarEvent[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.getCachedEvents(`${today}T00:00:00`, `${today}T23:59:59`);
  }

  /**
   * 同期キューに操作を追加
   */
  async addToSyncQueue(operation: {
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    eventData: any;
    originalId?: string;
  }): Promise<void> {
    if (!this.db) await this.initDB();
    if (!this.db) throw new Error('データベース初期化失敗');

    const transaction = this.db.transaction(['sync_queue'], 'readwrite');
    const store = transaction.objectStore('sync_queue');

    const queueItem = {
      ...operation,
      created_at: new Date().toISOString(),
      retry_count: 0,
      last_error: null,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.add(queueItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 同期キューの処理
   */
  async processSyncQueue(): Promise<{ processed: number; failed: number }> {
    if (!this.db) await this.initDB();
    if (!this.db) return { processed: 0, failed: 0 };

    const transaction = this.db.transaction(['sync_queue'], 'readwrite');
    const store = transaction.objectStore('sync_queue');

    const queueItems = await new Promise<any[]>((resolve, reject) => {
      const items: any[] = [];
      const request = store.openCursor();
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          items.push(cursor.value);
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      
      request.onerror = () => reject(request.error);
    });

    let processed = 0;
    let failed = 0;

    for (const item of queueItems) {
      try {
        // TODO: 実際のAPI呼び出し実装
        // await this.executeSyncOperation(item);
        
        // 処理成功時はキューから削除
        await new Promise<void>((resolve, reject) => {
          const deleteRequest = store.delete(item.id);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
        });
        
        processed++;
      } catch (error) {
        failed++;
        
        // リトライ回数を増やして更新
        item.retry_count++;
        item.last_error = error instanceof Error ? error.message : 'Unknown error';
        
        if (item.retry_count < 3) {
          await new Promise<void>((resolve, reject) => {
            const updateRequest = store.put(item);
            updateRequest.onsuccess = () => resolve();
            updateRequest.onerror = () => reject(updateRequest.error);
          });
        } else {
          // 3回失敗したら削除
          await new Promise<void>((resolve, reject) => {
            const deleteRequest = store.delete(item.id);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
          });
        }
      }
    }

    return { processed, failed };
  }

  /**
   * メタデータの保存
   */
  async setMetadata(key: string, value: any): Promise<void> {
    if (!this.db) await this.initDB();
    if (!this.db) throw new Error('データベース初期化失敗');

    const transaction = this.db.transaction(['metadata'], 'readwrite');
    const store = transaction.objectStore('metadata');

    await new Promise<void>((resolve, reject) => {
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * メタデータの取得
   */
  async getMetadata(key: string): Promise<any> {
    if (!this.db) await this.initDB();
    if (!this.db) return null;

    const transaction = this.db.transaction(['metadata'], 'readonly');
    const store = transaction.objectStore('metadata');

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        resolve(request.result?.value || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 最後の同期時間を取得
   */
  async getLastSyncTime(): Promise<Date | null> {
    const lastSync = await this.getMetadata('last_sync');
    return lastSync ? new Date(lastSync) : null;
  }

  /**
   * オフライン状態判定
   */
  isOffline(): boolean {
    return !navigator.onLine;
  }

  /**
   * キャッシュクリア
   */
  async clearCache(): Promise<void> {
    if (!this.db) await this.initDB();
    if (!this.db) return;

    const transaction = this.db.transaction(['events', 'sync_queue', 'metadata'], 'readwrite');
    
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('events').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('sync_queue').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('metadata').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
    ]);
  }
}

// シングルトンインスタンス
export const calendarOfflineManager = new CalendarOfflineManager();
