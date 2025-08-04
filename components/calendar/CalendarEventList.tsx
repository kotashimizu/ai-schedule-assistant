'use client';

import { useState, useEffect } from 'react';
import { GoogleCalendarEvent } from '@/types/shared';

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
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // イベント取得
  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (startDate) params.append('start', startDate);
      if (endDate) params.append('end', endDate);
      if (todayOnly) params.append('todayOnly', 'true');
      params.append('maxResults', maxResults.toString());

      const response = await fetch(`/api/calendar/events?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'イベント取得に失敗しました');
      }

      const data = await response.json();
      
      if (data.success) {
        setEvents(data.events);
        setLastSynced(data.synced_at);
        onEventsFetch?.(data.events);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // 初回ロード
  useEffect(() => {
    fetchEvents();
  }, [todayOnly, startDate, endDate, maxResults]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {todayOnly ? '今日の予定' : 'カレンダー'}
          </h3>
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        </div>
        <p className="text-gray-600">イベントを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {todayOnly ? '今日の予定' : 'カレンダー'}
        </h3>
        <div className="flex items-center space-x-2">
          {lastSynced && (
            <span className="text-xs text-gray-500">
              {new Date(lastSynced).toLocaleTimeString('ja-JP')} 同期
            </span>
          )}
          <button
            onClick={fetchEvents}
            disabled={loading}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
          >
            更新
          </button>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
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