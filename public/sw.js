// AI Schedule Assistant - Service Worker
// バージョン管理とキャッシュ戦略

const CACHE_NAME = 'ai-schedule-assistant-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Service Worker インストール
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Service Worker アクティベート
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// プッシュ通知の処理
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  let notificationData = {
    title: 'AI Schedule Assistant',
    body: 'タスクの時間です！',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: 'task-reminder',
    requireInteraction: false,
    data: {
      timestamp: Date.now(),
      url: '/'
    }
  };

  // プッシュデータがある場合はパース
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = {
        ...notificationData,
        ...pushData
      };
    } catch (error) {
      console.error('Service Worker: Failed to parse push data', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
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
      silent: false
    })
  );
});

// 通知クリックの処理
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event.action);
  
  event.notification.close();

  if (event.action === 'view') {
    // アプリを開く
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then((clientList) => {
          // 既にアプリが開いている場合はフォーカス
          for (const client of clientList) {
            if (client.url === event.notification.data.url || client.url.includes('localhost:3000')) {
              return client.focus();
            }
          }
          // アプリが開いていない場合は新しいタブを開く
          if (clients.openWindow) {
            return clients.openWindow(event.notification.data.url || '/dashboard');
          }
        })
    );
  } else if (event.action === 'dismiss') {
    // 通知を閉じるだけ（何もしない）
    console.log('Service Worker: Notification dismissed');
  } else {
    // デフォルトアクション（通知をクリック）
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url.includes('localhost:3000')) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow('/dashboard');
          }
        })
    );
  }
});

// 通知を閉じた時の処理
self.addEventListener('notificationclose', (event) => {
  console.log('Service Worker: Notification closed', event.notification.tag);
  
  // 通知が閉じられたことを分析データとして記録
  event.waitUntil(
    fetch('/api/analytics/notification-interaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'close',
        tag: event.notification.tag,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      })
    }).catch((error) => {
      console.error('Service Worker: Failed to log notification close', error);
    })
  );
});

// バックグラウンド同期（オフライン時のデータ同期用）
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'background-notification-check') {
    event.waitUntil(
      checkPendingNotifications()
    );
  }
});

// 未送信の通知をチェックする関数
async function checkPendingNotifications() {
  try {
    const response = await fetch('/api/notifications/pending');
    if (response.ok) {
      const pendingNotifications = await response.json();
      
      for (const notification of pendingNotifications.notifications || []) {
        await self.registration.showNotification(notification.title, {
          body: notification.body,
          icon: notification.icon || '/icons/icon-192.png',
          tag: notification.tag || 'pending-notification',
          data: notification.data || {}
        });
      }
    }
  } catch (error) {
    console.error('Service Worker: Failed to check pending notifications', error);
  }
}

// 定期的な通知チェック用のメッセージハンドラー
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, scheduleTime, data } = event.data;
    const delay = scheduleTime - Date.now();
    
    if (delay > 0) {
      setTimeout(() => {
        self.registration.showNotification(title, {
          body,
          icon: '/icons/icon-192.png',
          data: data || {},
          tag: `scheduled-${Date.now()}`
        });
      }, delay);
    }
  } else if (event.data && event.data.type === 'CHECK_NOTIFICATIONS') {
    event.waitUntil(checkPendingNotifications());
  }
});

// フェッチイベント（キャッシュ戦略）
self.addEventListener('fetch', (event) => {
  // 通知関連のAPIリクエストは常にネットワークから取得
  if (event.request.url.includes('/api/notifications/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Network unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 静的アセットのキャッシュ戦略
  if (event.request.method === 'GET' && STATIC_ASSETS.some(asset => event.request.url.endsWith(asset))) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request);
        })
    );
  }
});