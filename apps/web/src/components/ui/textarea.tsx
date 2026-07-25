import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-zinc-300">
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cn(
            'min-h-[96px] w-full rounded-control border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50',
            'placeholder:text-zinc-500',
            'focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            className,
          )}
          {...props}
        />
        {error ? (
          <p className="mt-1 text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
