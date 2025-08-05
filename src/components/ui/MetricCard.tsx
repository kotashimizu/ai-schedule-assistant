'use client';

import { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'purple';
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    icon: 'text-blue-500'
  },
  green: {
    bg: 'bg-green-50',
    text: 'text-green-600',
    icon: 'text-green-500'
  },
  yellow: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-600',
    icon: 'text-yellow-500'
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    icon: 'text-red-500'
  },
  gray: {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    icon: 'text-gray-500'
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    icon: 'text-purple-500'
  }
};

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color = 'blue',
  trend,
  className = '' 
}: MetricCardProps) {
  const colors = colorClasses[color];

  return (
    <div className={`${colors.bg} rounded-lg p-4 text-center border border-opacity-20 hover:shadow-md transition-all duration-200 ${className}`}>
      {/* アイコン */}
      {icon && (
        <div className={`${colors.icon} mb-3 flex justify-center`}>
          {icon}
        </div>
      )}

      {/* メイン数値 */}
      <div className={`text-2xl sm:text-3xl font-bold ${colors.text} mb-1`}>
        {value}
      </div>

      {/* タイトル */}
      <div className="text-sm font-medium text-gray-700 mb-1">
        {title}
      </div>

      {/* サブタイトル */}
      {subtitle && (
        <div className="text-xs text-gray-500">
          {subtitle}
        </div>
      )}

      {/* トレンド表示 */}
      {trend && (
        <div className={`flex items-center justify-center mt-2 text-xs ${
          trend.isPositive ? 'text-green-600' : 'text-red-600'
        }`}>
          <svg 
            className={`w-3 h-3 mr-1 ${trend.isPositive ? 'rotate-0' : 'rotate-180'}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l5-5 5 5" />
          </svg>
          {Math.abs(trend.value)}%
        </div>
      )}
    </div>
  );
}