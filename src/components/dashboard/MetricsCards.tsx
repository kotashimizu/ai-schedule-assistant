'use client';

import { useEffect, useState } from 'react';
import { MetricCard } from '@/components/ui';

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
      value: `${metrics.totalTasks}件`,
      color: 'blue' as const,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    },
    {
      title: '完了済み',
      value: `${metrics.completedTasks}件`,
      color: 'green' as const,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      title: '完了率',
      value: `${metrics.completionRate}%`,
      color: 'purple' as const,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      title: '残り作業時間',
      value: formatWorkTime(metrics.remainingWorkTime),
      color: 'yellow' as const,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ];

  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {[...Array(4)].map((_, index) => (
          <MetricCard
            key={index}
            title="読み込み中..."
            value="---"
            color="gray"
            className="animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {metricsData.map((metric, index) => (
        <MetricCard
          key={index}
          title={metric.title}
          value={metric.value}
          color={metric.color}
          icon={metric.icon}
          className="hover:scale-105 transition-transform duration-200"
        />
      ))}
    </div>
  );
}