'use client';

interface PriorityBadgeProps {
  priority: 'high' | 'medium' | 'low';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const priorityConfig = {
  high: {
    label: '高',
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
    icon: '🔴'
  },
  medium: {
    label: '中',
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
    icon: '🟡'
  },
  low: {
    label: '低',
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    icon: '🟢'
  }
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base'
};

export function PriorityBadge({ priority, size = 'sm', className = '' }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  const sizeClass = sizeClasses[size];

  return (
    <span className={`
      inline-flex items-center rounded-full font-medium border
      ${config.bg} ${config.text} ${config.border} ${sizeClass} ${className}
    `}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
}

interface PrioritySelectProps {
  value: 'high' | 'medium' | 'low';
  onChange: (priority: 'high' | 'medium' | 'low') => void;
  className?: string;
}

export function PrioritySelect({ value, onChange, className = '' }: PrioritySelectProps) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {(Object.keys(priorityConfig) as Array<keyof typeof priorityConfig>).map((priority) => (
        <button
          key={priority}
          type="button"
          onClick={() => onChange(priority)}
          className={`
            inline-flex items-center px-3 py-2 rounded-md text-sm font-medium border transition-all duration-200
            ${value === priority 
              ? `${priorityConfig[priority].bg} ${priorityConfig[priority].text} ${priorityConfig[priority].border} ring-2 ring-opacity-50`
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }
          `}
        >
          <span className="mr-1.5">{priorityConfig[priority].icon}</span>
          {priorityConfig[priority].label}
        </button>
      ))}
    </div>
  );
}