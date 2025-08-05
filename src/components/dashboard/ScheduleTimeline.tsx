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
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">今日のスケジュール</h3>
        <div className="space-y-4">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="flex items-start space-x-4 animate-pulse">
              <div className="w-16 h-4 bg-gray-200 rounded flex-shrink-0"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">今日のスケジュール</h3>
        <button
          onClick={fetchTodaySchedule}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          更新
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {events.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500">今日の予定はありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event, index) => {
              const colors = getEventColor(event.type);
              const isActive = isEventActive(event.startTime, event.endTime);
              
              return (
                <div key={event.id} className="relative">
                  {/* タイムライン線 */}
                  {index < events.length - 1 && (
                    <div className="absolute left-8 top-12 w-0.5 h-8 bg-gray-200"></div>
                  )}
                  
                  <div className="flex items-start space-x-4">
                    {/* 時間表示 */}
                    <div className="flex-shrink-0 w-20 text-right">
                      <div className={`text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-900'}`}>
                        {formatTime(event.startTime)}
                      </div>
                      {event.endTime && (
                        <div className="text-xs text-gray-500">
                          - {formatTime(event.endTime)}
                        </div>
                      )}
                    </div>

                    {/* タイムライン点 */}
                    <div className="flex-shrink-0 mt-1.5">
                      <div className={`w-3 h-3 rounded-full ${colors.dot} ${isActive ? 'ring-2 ring-blue-200' : ''}`}></div>
                    </div>

                    {/* イベント内容 */}
                    <div className={`flex-1 p-3 rounded-lg border-l-4 ${colors.bg} ${colors.border} ${isActive ? 'ring-1 ring-blue-200' : ''}`}>
                      <div className={`font-medium ${colors.text} ${isActive ? 'text-blue-900' : ''}`}>
                        {event.title}
                        {isActive && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            進行中
                          </span>
                        )}
                      </div>
                      {event.location && (
                        <div className="mt-1 text-sm text-gray-600 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {event.location}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 空き時間の表示 */}
        {freeTimeSlots.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">空き時間</h4>
            <div className="space-y-2">
              {freeTimeSlots.map((slot, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">
                    {formatTime(slot.start)} - {formatTime(slot.end)}
                  </span>
                  <span className="text-xs font-medium text-green-600">
                    {slot.duration}分
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}