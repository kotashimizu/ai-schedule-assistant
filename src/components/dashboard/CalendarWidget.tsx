'use client';

import { useState, useEffect } from 'react';

interface CalendarWidgetProps {
  className?: string;
}

export function CalendarWidget({ className = '' }: CalendarWidgetProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [eventsData, setEventsData] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    fetchMonthEvents();
  }, [currentDate]);

  const fetchMonthEvents = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const response = await fetch(`/api/calendar/events?year=${year}&month=${month}`);
      
      if (response.ok) {
        const { events } = await response.json();
        
        // 日付別のイベント数をカウント
        const eventCounts: { [key: string]: number } = {};
        events.forEach((event: any) => {
          const eventDate = new Date(event.start_time).toISOString().split('T')[0];
          eventCounts[eventDate] = (eventCounts[eventDate] || 0) + 1;
        });
        
        setEventsData(eventCounts);
      }
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // 前月の日付で埋める
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({
        date: prevDate,
        isCurrentMonth: false,
        hasEvents: false
      });
    }

    // 現在月の日付
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        date,
        isCurrentMonth: true,
        hasEvents: eventsData[dateStr] > 0,
        eventCount: eventsData[dateStr] || 0
      });
    }

    // 次月の日付で42日（6週）になるまで埋める
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const nextDate = new Date(year, month + 1, day);
      days.push({
        date: nextDate,
        isCurrentMonth: false,
        hasEvents: false
      });
    }

    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="前月"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="次月"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day, index) => (
          <div key={day} className="text-center py-2">
            <span className={`text-sm font-medium ${
              index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-700'
            }`}>
              {day}
            </span>
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const dayIsToday = isToday(day.date);
          const dayIsSelected = isSelected(day.date);
          
          return (
            <button
              key={index}
              onClick={() => setSelectedDate(day.date)}
              className={`
                relative h-10 text-sm font-medium rounded-md transition-colors
                ${!day.isCurrentMonth 
                  ? 'text-gray-300 hover:text-gray-400' 
                  : dayIsToday
                    ? 'bg-blue-600 text-white font-bold'
                    : dayIsSelected
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-gray-900 hover:bg-gray-100'
                }
              `}
            >
              {day.date.getDate()}
              
              {/* イベントインジケーター */}
              {day.hasEvents && day.isCurrentMonth && !dayIsToday && (
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                </div>
              )}
              
              {/* 複数イベントのインジケーター */}
              {day.eventCount > 1 && day.isCurrentMonth && !dayIsToday && (
                <div className="absolute top-1 right-1">
                  <span className="text-xs bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                    {day.eventCount > 9 ? '9+' : day.eventCount}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 今日の日付表示 */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">今日</span>
          <span className="font-medium text-gray-900">
            {new Date().toLocaleDateString('ja-JP', {
              month: 'long',
              day: 'numeric',
              weekday: 'short'
            })}
          </span>
        </div>
      </div>

      {/* 選択された日付の情報 */}
      {!isToday(selectedDate) && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">選択日</span>
            <span className="font-medium text-gray-900">
              {selectedDate.toLocaleDateString('ja-JP', {
                month: 'long',
                day: 'numeric',
                weekday: 'short'
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}