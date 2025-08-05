'use client';

import { useEffect, useState } from 'react';

interface TaskMetrics {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  remainingWorkTime: number; // 分単位
}

interface MetricsCardsProps {
  className?: string;
}

export function MetricsCards({ className = '' }: MetricsCardsProps) {
  const [metrics, setMetrics] = useState<TaskMetrics>({
    totalTasks: 0,
    completedTasks: 0,
    completionRate: 0,
    remainingWorkTime: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTodayMetrics();
  }, []);

  const fetchTodayMetrics = async () => {
    try {
      setIsLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      // 今日のタスクを取得
      const response = await fetch(`/api/tasks?date=${today}`);
      if (response.ok) {
        const { tasks } = await response.json();
        
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((task: any) => task.status === 'completed').length;
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        
        // 残り作業時間を計算（未完了タスクの見積時間合計）
        const remainingWorkTime = tasks
          .filter((task: any) => task.status !== 'completed')
          .reduce((total: number, task: any) => total + (task.estimated_minutes || 30), 0);

        setMetrics({
          totalTasks,
          completedTasks,
          completionRate: Math.round(completionRate),
          remainingWorkTime
        });
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatWorkTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}分`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}時間${remainingMinutes}分` : `${hours}時間`;
  };

  const metricsData = [
    {
      title: '本日のタスク',
      value: metrics.totalTasks,
      unit: '件',
      icon: (
        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-900'
    },
    {
      title: '完了済み',
      value: metrics.completedTasks,
      unit: '件',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bgColor: 'bg-green-50',
      textColor: 'text-green-900'
    },
    {
      title: '完了率',
      value: metrics.completionRate,
      unit: '%',
      icon: (
        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-900'
    },
    {
      title: '残り作業時間',
      value: formatWorkTime(metrics.remainingWorkTime),
      unit: '',
      icon: (
        <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-900'
    }
  ];

  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
      {metricsData.map((metric, index) => (
        <div key={index} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                {metric.title}
              </p>
              <p className={`text-2xl font-bold ${metric.textColor}`}>
                {typeof metric.value === 'string' ? metric.value : metric.value.toLocaleString()}
                {metric.unit && <span className="text-lg ml-1">{metric.unit}</span>}
              </p>
            </div>
            <div className={`${metric.bgColor} rounded-full p-3`}>
              {metric.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}