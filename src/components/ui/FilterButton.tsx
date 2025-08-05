'use client';

import { ReactNode } from 'react';

interface FilterButtonProps {
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
  icon?: ReactNode;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const variantClasses = {
  default: {
    active: 'bg-blue-600 text-white border-blue-600 shadow-sm',
    inactive: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
  },
  outline: {
    active: 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-300',
    inactive: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
  },
  ghost: {
    active: 'bg-blue-100 text-blue-800',
    inactive: 'text-gray-700 hover:bg-gray-100'
  }
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base'
};

export function FilterButton({ 
  label, 
  count, 
  active = false, 
  onClick, 
  icon,
  variant = 'default',
  size = 'md',
  className = '' 
}: FilterButtonProps) {
  const variantClass = variantClasses[variant];
  const sizeClass = sizeClasses[size];
  const activeClass = active ? variantClass.active : variantClass.inactive;
  const borderClass = variant !== 'ghost' ? 'border' : '';

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center justify-center font-medium rounded-md transition-all duration-200
        ${borderClass} ${activeClass} ${sizeClass} ${className}
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
      `}
    >
      {icon && (
        <span className="mr-2 flex-shrink-0">
          {icon}
        </span>
      )}
      <span>{label}</span>
      {count !== undefined && (
        <span className={`
          ml-2 px-2 py-0.5 text-xs rounded-full font-medium
          ${active 
            ? variant === 'default' 
              ? 'bg-blue-500 text-white' 
              : 'bg-blue-200 text-blue-800'
            : 'bg-gray-200 text-gray-600'
          }
        `}>
          {count}
        </span>
      )}
    </button>
  );
}

interface FilterButtonGroupProps {
  children: ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  spacing?: 'sm' | 'md' | 'lg';
}

const spacingClasses = {
  horizontal: {
    sm: 'space-x-1',
    md: 'space-x-2',
    lg: 'space-x-3'
  },
  vertical: {
    sm: 'space-y-1',
    md: 'space-y-2',
    lg: 'space-y-3'
  }
};

export function FilterButtonGroup({ 
  children, 
  className = '',
  orientation = 'horizontal',
  spacing = 'md'
}: FilterButtonGroupProps) {
  const spacingClass = spacingClasses[orientation][spacing];
  const flexClass = orientation === 'horizontal' ? 'flex flex-wrap items-center' : 'flex flex-col';

  return (
    <div className={`${flexClass} ${spacingClass} ${className}`}>
      {children}
    </div>
  );
}

interface FilterChipProps {
  label: string;
  onRemove: () => void;
  className?: string;
}

export function FilterChip({ label, onRemove, className = '' }: FilterChipProps) {
  return (
    <span className={`
      inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
      bg-blue-100 text-blue-800 ${className}
    `}>
      {label}
      <button
        onClick={onRemove}
        className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200 focus:outline-none focus:bg-blue-200 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}