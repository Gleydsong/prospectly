import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export type ButtonVariant =
  | 'primary'
  | 'primary-tinta'
  | 'primary-blue'
  | 'secondary'
  | 'secondary-outline'
  | 'glass'
  | 'ghost'
  | 'danger'
  | 'outline'
  | 'brand';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<ButtonVariant, string> = {
  primary: 'cta-primary rounded-full',
  'primary-blue': 'cta-primary rounded-full',
  'primary-tinta': 'cta-primary-tinta rounded-full',
  secondary:
    'border border-[color:var(--cta-secondary-border)] bg-[color:var(--cta-secondary-bg)] text-[color:var(--cta-secondary-ink)] hover:bg-[color:var(--cta-secondary-hover)]',
  'secondary-outline':
    'border border-[color:var(--border-default)] bg-transparent text-[color:var(--ink)] hover:bg-[color:var(--bg-subtle)] rounded-full',
  glass: 'cta-glass',
  ghost: 'text-[color:var(--ink-secondary)] hover:bg-[color:var(--cta-ghost-hover)] hover:text-[color:var(--ink)]',
  outline:
    'border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] text-[color:var(--ink)] hover:bg-[color:var(--bg-subtle)]',
  danger: 'bg-red-600 text-white hover:bg-red-500',
  brand: 'cta-primary rounded-full',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 min-h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base font-semibold',
  icon: 'h-11 w-11 shrink-0 px-0',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      pill,
      loading,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const isPill =
      pill ??
      (variant === 'primary' ||
        variant === 'primary-tinta' ||
        variant === 'primary-blue' ||
        variant === 'secondary-outline' ||
        variant === 'brand');

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium tracking-tight transition-[color,background-color,border-color,box-shadow,transform] duration-200 active:scale-[0.98]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]',
          'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100',
          isPill ? 'rounded-full' : 'rounded-control',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
