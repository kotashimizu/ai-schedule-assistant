'use client';

import { useState, useEffect } from 'react';

interface TimelineEvent {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  type: 'meeting' | 'work' | 'other';
}

interface ScheduleTimelineProps {
  className?: string;
}

export function ScheduleTimeline({ className = '' }: ScheduleTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTodaySchedule();
  }, []);

  const fetchTodaySchedule = async () => {
    try {
      setIsLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      // Google Calendarのイベントを取得
      const response = await fetch(`/api/calendar/events?date=${today}`);
      if (response.ok) {
        const { events: calendarEvents } = await response.json();
        
        // タイムライン用にフォーマット
        const timelineEvents: TimelineEvent[] = calendarEvents.map((event: any) => ({
          id: event.id,
          title: event.title || event.summary || '（タイトルなし）',
          startTime: event.start_time || event.start?.dateTime || event.start?.date,
          endTime: event.end_time || event.end?.dateTime || event.end?.date,
          location: event.location,
          type: determineEventType(event.title || event.summary || '')
        }));
        
        // 時間順にソート
        timelineEvents.sort((a, b) => 
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
        
        setEvents(timelineEvents);
      }
    } catch (error) {
      console.error('Failed to fetch today schedule:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const determineEventType = (title: string): 'meeting' | 'work' | 'other' => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('会議') || lowerTitle.includes('meeting') || lowerTitle.includes('ミーティング')) {
      return 'meeting';
    }
    if (lowerTitle.includes('作業') || lowerTitle.includes('work') || lowerTitle.includes('開発')) {
      return 'work';
    }
    return 'other';
  };

  const formatTime = (timeString: string): string => {
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '--:--';
    }
  };

  const getEventColor = (type: 'meeting' | 'work' | 'other') => {
    switch (type) {
      case 'meeting':
        return {
          bg: 'bg-blue-100',
          border: 'border-blue-400',
          text: 'text-blue-900',
          dot: 'bg-blue-500'
        };
      case 'work':
        return {
          bg: 'bg-green-100',
          border: 'border-green-400',
          text: 'text-green-900',
          dot: 'bg-green-500'
        };
      case 'other':
        return {
          bg: 'bg-pink-100',
          border: 'border-pink-400',
          text: 'text-pink-900',
          dot: 'bg-pink-500'
        };
    }
  };

  const isEventActive = (startTime: string, endTime?: string): boolean => {
    const now = new Date();
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date(start.getTime() + 60 * 60 * 1000); // デフォルト1時間
    
    return now >= start && now <= end;
  };

  const findFreeTimeSlots = (): Array<{ start: string; end: string; duration: number }> => {
    if (events.length === 0) return [];
    
    const freeSlots: Array<{ start: string; end: string; duration: number }> = [];
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59);

    // 現在時刻から最初のイベントまで
    if (events.length > 0) {
      const firstEventStart = new Date(events[0].startTime);
      if (now < firstEventStart) {
        const duration = Math.floor((firstEventStart.getTime() - now.getTime()) / (1000 * 60));
        if (duration >= 15) { // 15分以上の空き時間のみ
          freeSlots.push({
            start: now.toISOString(),
            end: events[0].startTime,
            duration
          });
        }
      }
    }

    // イベント間の空き時間
    for (let i = 0; i < events.length - 1; i++) {
      const currentEnd = new Date(events[i].endTime || events[i].startTime);
      const nextStart = new Date(events[i + 1].startTime);
      
      if (currentEnd < nextStart) {
        const duration = Math.floor((nextStart.getTime() - currentEnd.getTime()) / (1000 * 60));
        if (duration >= 15) {
          freeSlots.push({
            start: currentEnd.toISOString(),
            end: events[i + 1].startTime,
            duration
          });
        }
      }
    }

    return freeSlots.slice(0, 3); // 最大3つまで表示
  };

  const freeTimeSlots = findFreeTimeSlots();

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow border border-gray-200 ${className}`}>
        <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-lg">
          <h3 className="text-lg font-semibold text-gray-900">今日のスケジュール</h3>
        </div>
        <div className="h-80 overflow-y-auto p-4">
          <div className="space-y-6">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="flex items-start space-x-4 animate-pulse">
                {/* 時間部分 */}
                <div className="flex-shrink-0 w-20 text-right space-y-1">
                  <div className="h-4 bg-gray-200 rounded w-12 ml-auto"></div>
                  <div className="h-3 bg-gray-200 rounded w-10 ml-auto"></div>
                </div>
                
                {/* タイムライン点 */}
                <div className="flex-shrink-0 mt-2">
                  <div className="w-4 h-4 bg-gray-200 rounded-full"></div>
                </div>
                
                {/* イベント内容 */}
                <div className="flex-1 p-4 bg-gray-50 rounded-lg border-l-4 border-gray-200">
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow border border-gray-200 ${className}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50 rounded-t-lg">
        <h3 className="text-lg font-semibold text-gray-900">今日のスケジュール</h3>
        <div className="flex items-center space-x-2">
          <div className="text-xs text-gray-500">
            {new Date().toLocaleDateString('ja-JP', { 
              month: 'short', 
              day: 'numeric',
              weekday: 'short'
            })}
          </div>
          <button
            onClick={fetchTodaySchedule}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            title="スケジュールを更新"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* スクロール可能な固定高さタイムラインコンテナ */}
      <div className="h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 p-4">
        {events.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500">今日の予定はありません</p>
          </div>
        ) : (
          <div className="relative">
            {/* 縦型タイムライン - 連続線 */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
            
            <div className="space-y-6">
              {events.map((event, index) => {
                const colors = getEventColor(event.type);
                const isActive = isEventActive(event.startTime, event.endTime);
                const duration = event.endTime 
                  ? Math.ceil((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60))
                  : null;
                
                return (
                  <div key={event.id} className="relative flex items-start space-x-4">
                    {/* 時間表示 - 左側固定幅 */}
                    <div className="flex-shrink-0 w-20 text-right">
                      <div className={`text-sm font-semibold ${isActive ? 'text-blue-600' : 'text-gray-900'}`}>
                        {formatTime(event.startTime)}
                      </div>
                      {event.endTime && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatTime(event.endTime)}
                        </div>
                      )}
                      {duration && (
                        <div className="text-xs text-gray-400 font-medium mt-0.5">
                          {duration}分
                        </div>
                      )}
                    </div>

                    {/* タイムライン点 - より大きく、色分け強化 */}
                    <div className="flex-shrink-0 mt-2 relative z-10">
                      <div className={`w-4 h-4 rounded-full border-2 border-white shadow-sm ${colors.dot} ${
                        isActive ? 'ring-2 ring-blue-300 ring-opacity-50 scale-110' : ''
                      } transition-all duration-200`}></div>
                    </div>

                    {/* イベント内容 - 時間ブロック風デザイン */}
                    <div className={`flex-1 p-4 rounded-lg border-l-4 shadow-sm ${colors.bg} ${colors.border} ${
                      isActive ? 'ring-1 ring-blue-300 shadow-md transform scale-[1.02]' : 'hover:shadow-md'
                    } transition-all duration-200`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className={`font-semibold text-base ${colors.text} ${isActive ? 'text-blue-900' : ''}`}>
                            {event.title}
                            {isActive && (
                              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-500 text-white animate-pulse">
                                進行中
                              </span>
                            )}
                          </div>
                          
                          {/* イベント詳細情報 */}
                          <div className="mt-2 space-y-1">
                            {event.location && (
                              <div className="text-sm text-gray-600 flex items-center">
                                <svg className="w-4 h-4 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="truncate">{event.location}</span>
                              </div>
                            )}
                            
                            {duration && (
                              <div className="text-sm text-gray-500 flex items-center">
                                <svg className="w-4 h-4 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {duration}分間
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* イベントタイプバッジ */}
                        <div className="ml-3 flex-shrink-0">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                            {event.type === 'meeting' ? '会議' : event.type === 'work' ? '作業' : 'その他'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 空き時間の表示 - 改善版 */}
        {freeTimeSlots.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                <svg className="w-4 h-4 mr-1.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                空き時間
              </h4>
              <span className="text-xs text-gray-500">{freeTimeSlots.length}件</span>
            </div>
            <div className="space-y-3">
              {freeTimeSlots.map((slot, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg hover:shadow-sm transition-all duration-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <span className="text-sm font-medium text-gray-700">
                      {formatTime(slot.start)} - {formatTime(slot.end)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                      {slot.duration}分
                    </span>
                    {slot.duration >= 60 && (
                      <span className="text-xs text-green-600">
                        ⚡ 長時間
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* 空き時間の活用提案 */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs text-blue-700">
                  <span className="font-medium">空き時間の活用:</span> 
                  {freeTimeSlots.some(slot => slot.duration >= 60) ? ' 長時間の空きでは重要なタスクに集中' : ' 短時間の空きでは簡単なタスクを'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}