import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  leadingIcon?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      id,
      children,
      leadingIcon,
      'aria-invalid': ariaInvalidProp,
      'aria-describedby': ariaDescribedbyProp,
      ...props
    },
    ref,
  ) => {
    const autoId = useId();
    const inputId = (id ?? props.name ?? autoId).replace(/:/g, '');

    const internalAriaInvalid = error ? true : undefined;
    const internalAriaDescribedby = error ? `${inputId}-error` : undefined;

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
            className={cn(
              'field-control h-11 w-full rounded-control px-3 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]',
              leadingIcon && 'pl-10',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              className,
            )}
            {...props}
            aria-invalid={ariaInvalidProp ?? internalAriaInvalid}
            aria-describedby={
              [ariaDescribedbyProp, internalAriaDescribedby].filter(Boolean).join(' ') || undefined
            }
          >
            {children}
          </select>
        </div>
        {error ? (
          <p
            id={`${inputId}-error`}
            className="mt-1 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
Select.displayName = 'Select';
