import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      id,
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
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'field-control min-h-[96px] w-full rounded-control px-3 py-2 text-sm',
            'placeholder:text-[color:var(--ink-muted)]',
            'focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            className,
          )}
          {...props}
          aria-invalid={ariaInvalidProp ?? internalAriaInvalid}
          aria-describedby={
            [ariaDescribedbyProp, internalAriaDescribedby].filter(Boolean).join(' ') || undefined
          }
        />
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
Textarea.displayName = 'Textarea';
