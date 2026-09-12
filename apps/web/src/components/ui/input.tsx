import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leadingIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, leadingIcon, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? props.name ?? autoId;
    return (
      <div className="w-full">
        {label ? (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-semibold text-[color:var(--ink)]"
          >
            {label}
          </label>
        ) : null}
        <div className="relative">
          {leadingIcon ? (
            <span
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[color:var(--ink-muted)]"
              aria-hidden
            >
              {leadingIcon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={cn(
              'field-control h-11 w-full rounded-control px-3 text-sm',
              'placeholder:text-[color:var(--ink-muted)]',
              'focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]',
              leadingIcon && 'pl-10',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              className,
            )}
            {...props}
          />
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';
