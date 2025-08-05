'use client';

import { FilterButton, FilterButtonGroup } from '@/components/ui';

interface TaskFiltersProps {
  activeFilter: 'all' | 'pending' | 'completed' | 'high' | 'today';
  onFilterChange: (filter: 'all' | 'pending' | 'completed' | 'high' | 'today') => void;
  taskCounts: {
    all: number;
    pending: number;
    completed: number;
    high: number;
    today: number;
  };
  className?: string;
}

export function TaskFilters({ 
  activeFilter, 
  onFilterChange, 
  taskCounts, 
  className = '' 
}: TaskFiltersProps) {
  const filters = [
    { 
      key: 'all' as const, 
      label: 'すべて', 
      count: taskCounts.all,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    },
    { 
      key: 'pending' as const, 
      label: '未完了', 
      count: taskCounts.pending,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    { 
      key: 'completed' as const, 
      label: '完了済み', 
      count: taskCounts.completed,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    { 
      key: 'high' as const, 
      label: '高優先度', 
      count: taskCounts.high,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      )
    },
    { 
      key: 'today' as const, 
      label: '今日の期限', 
      count: taskCounts.today,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
  ];

  return (
    <FilterButtonGroup className={className} spacing="md">
      {filters.map((filter) => (
        <FilterButton
          key={filter.key}
          label={filter.label}
          count={filter.count}
          active={activeFilter === filter.key}
          onClick={() => onFilterChange(filter.key)}
          icon={filter.icon}
          variant="outline"
        />
      ))}
    </FilterButtonGroup>
  );
}