'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    switch: 'h-5 w-9',
    circle: 'h-4 w-4',
    translate: 'translate-x-4'
  },
  md: {
    switch: 'h-6 w-11',
    circle: 'h-5 w-5',
    translate: 'translate-x-5'
  },
  lg: {
    switch: 'h-7 w-14',
    circle: 'h-6 w-6',
    translate: 'translate-x-7'
  }
};

export function Toggle({ 
  checked, 
  onChange, 
  label, 
  description, 
  size = 'md',
  disabled = false,
  className = '' 
}: ToggleProps) {
  const config = sizeConfig[size];

  return (
    <div className={`flex items-start ${className}`}>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => !disabled && onChange(!checked)}
          disabled={disabled}
          className={`
            relative inline-flex flex-shrink-0 border-2 border-transparent rounded-full cursor-pointer 
            transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
            ${config.switch}
            ${checked ? 'bg-blue-600' : 'bg-gray-200'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-75'}
          `}
          aria-checked={checked}
          aria-describedby={description ? `${label}-description` : undefined}
        >
          <span
            className={`
              ${config.circle} inline-block rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200
              ${checked ? config.translate : 'translate-x-0'}
            `}
          />
        </button>
      </div>
      
      {(label || description) && (
        <div className="ml-3">
          {label && (
            <div className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>
              {label}
            </div>
          )}
          {description && (
            <div id={`${label}-description`} className="text-sm text-gray-500">
              {description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ToggleGroupProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function ToggleGroup({ title, children, className = '' }: ToggleGroupProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {title && (
        <h4 className="text-base font-medium text-gray-900">{title}</h4>
      )}
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}