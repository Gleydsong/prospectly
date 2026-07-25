import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-zinc-300">
            {label}
          </label>
        ) : null}
        <select
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cn(
            'h-10 w-full rounded-control border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-50',
            'focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error ? (
          <p className="mt-1 text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
Select.displayName = 'Select';
