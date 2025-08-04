'use client';

import { useState, useEffect } from 'react';
import { GoogleCalendarEvent } from '@/types/shared';
import { useCalendarSync } from '@/lib/hooks/useCalendarSync';
import { CalendarErrorBanner } from './CalendarErrorBanner';

interface CalendarEventListProps {
  todayOnly?: boolean;
  startDate?: string;
  endDate?: string;
  maxResults?: number;
  onEventsFetch?: (events: GoogleCalendarEvent[]) => void;
}

export function CalendarEventList({ 
  todayOnly = false, 
  startDate, 
  endDate, 
  maxResults = 50,
  onEventsFetch 
}: CalendarEventListProps) {
  const [showErrorBanner, setShowErrorBanner] = useState(true);

  // useCalendarSyncフックを使用してオフライン対応とエラーハンドリングを実装
  const {
    events,
    isLoading,
    error,
    lastSynced,
    isConnected,
    isOffline,
    usingCachedData,
    retryCount,
    syncEvents,
    syncTodayEvents,
    syncMonthEvents,
    retrySync,
    clearError,
    getRecoverySteps,
  } = useCalendarSync({
    autoSync: true,
    syncInterval: 5,
    onSyncSuccess: (events) => {
      onEventsFetch?.(events);
      setShowErrorBanner(true); // 成功時はエラーバナーを再表示可能にする
    },
    onSyncError: (errorMessage) => {
      console.error('Calendar sync error:', errorMessage);
    },
  });

  // 手動更新
  const handleRefresh = () => {
    if (todayOnly) {
      syncTodayEvents();
    } else {
      syncEvents({ startDate, endDate });
    }
  };

  // 初回ロード時とパラメータ変更時に同期
  useEffect(() => {
    if (todayOnly) {
      syncTodayEvents();
    } else {
      syncEvents({ startDate, endDate });
    }
  }, [todayOnly, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // 時間フォーマット
  const formatTime = (dateTime: string) => {
    try {
      const date = new Date(dateTime);
      return date.toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return dateTime;
    }
  };

  // 日付フォーマット
  const formatDate = (dateTime: string) => {
    try {
      const date = new Date(dateTime);
      return date.toLocaleDateString('ja-JP', {
        month: 'short',
        day: 'numeric',
        weekday: 'short'
      });
    } catch {
      return dateTime;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {todayOnly ? '今日の予定' : 'カレンダー'}
        </h3>
        <div className="flex items-center space-x-2">
          {/* 接続状態表示 */}
          <div className="flex items-center space-x-1">
            {isOffline ? (
              <div className="flex items-center text-orange-600">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 000 2h11.586l-4.293 4.293a1 1 0 101.414 1.414L16 7.414V19a1 1 0 102 0V7.414l4.293 4.293a1 1 0 001.414-1.414L19.414 6H18V4a1 1 0 10-2 0v2H4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs">オフライン</span>
              </div>
            ) : isConnected ? (
              <div className="flex items-center text-green-600">
                <div className="w-2 h-2 bg-green-600 rounded-full mr-1"></div>
                <span className="text-xs">接続中</span>
              </div>
            ) : (
              <div className="flex items-center text-gray-400">
                <div className="w-2 h-2 bg-gray-400 rounded-full mr-1"></div>
                <span className="text-xs">未接続</span>
              </div>
            )}
          </div>

          {lastSynced && (
            <span className="text-xs text-gray-500">
              {new Date(lastSynced).toLocaleTimeString('ja-JP')} 同期
            </span>
          )}
          
          {usingCachedData && (
            <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
              キャッシュ
            </span>
          )}
          
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50 flex items-center"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-1"></div>
            ) : (
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            更新
          </button>
        </div>
      </div>

      {/* エラーバナー表示 */}
      {error && showErrorBanner && (
        <CalendarErrorBanner
          error={error}
          isOffline={isOffline}
          usingCachedData={usingCachedData}
          lastSynced={lastSynced}
          onRetry={retrySync}
          onDismiss={() => setShowErrorBanner(false)}
          recoverySteps={getRecoverySteps()}
        />
      )}

      {/* ローディング表示 */}
      {isLoading && events.length === 0 && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">イベントを読み込み中...</p>
          {retryCount > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              再試行中... ({retryCount}/3)
            </p>
          )}
        </div>
      )}

      {/* イベント一覧 */}
      {events.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-600">
            {todayOnly ? '今日の予定はありません' : '予定がありません'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div key={event.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {event.summary}
                  </h4>
                  
                  {/* 時間表示 */}
                  <div className="flex items-center mt-1 text-sm text-gray-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {!todayOnly && (
                      <span className="mr-2">{formatDate(event.start.dateTime)}</span>
                    )}
                    <span>
                      {formatTime(event.start.dateTime)} - {formatTime(event.end.dateTime)}
                    </span>
                  </div>

                  {/* 場所表示 */}
                  {event.location && (
                    <div className="flex items-center mt-1 text-sm text-gray-600">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}

                  {/* 説明表示（短縮版） */}
                  {event.description && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>

                {/* イベントタイプ表示 */}
                <div className="ml-4 flex-shrink-0">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Google
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* イベント数表示 */}
      {events.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            {events.length}件の予定を表示中
          </p>
        </div>
      )}
    </div>
  );
}