import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-zinc-300">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            'h-10 w-full rounded-control border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-50',
            'placeholder:text-zinc-500',
            'focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            className,
          )}
          {...props}
        />
        {error ? (
          <p id={`${inputId}-error`} className="mt-1 text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';
