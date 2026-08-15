import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  leadingIcon?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, leadingIcon, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? props.name ?? generatedId;
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
          <select
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            className={cn(
              'field-control h-10 w-full rounded-control px-3 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]',
              leadingIcon && 'pl-10',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              className,
            )}
            {...props}
          >
            {children}
          </select>
        </div>
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
