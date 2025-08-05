'use client';

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
    { key: 'all' as const, label: 'すべて', count: taskCounts.all },
    { key: 'pending' as const, label: '未完了', count: taskCounts.pending },
    { key: 'completed' as const, label: '完了済み', count: taskCounts.completed },
    { key: 'high' as const, label: '高優先度', count: taskCounts.high },
    { key: 'today' as const, label: '今日の期限', count: taskCounts.today },
  ];

  const getFilterButtonClass = (filterKey: string) => {
    const baseClass = "inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors";
    const activeClass = "bg-blue-600 text-white";
    const inactiveClass = "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50";
    
    return `${baseClass} ${activeFilter === filterKey ? activeClass : inactiveClass}`;
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {filters.map((filter) => (
        <button
          key={filter.key}
          onClick={() => onFilterChange(filter.key)}
          className={getFilterButtonClass(filter.key)}
        >
          {filter.label}
          <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
            activeFilter === filter.key 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 text-gray-600'
          }`}>
            {filter.count}
          </span>
        </button>
      ))}
    </div>
  );
}