import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'glass' | 'ghost' | 'danger' | 'outline' | 'brand';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'cta-primary',
  brand: 'cta-primary',
  glass: 'cta-glass',
  secondary:
    'border border-[color:var(--cta-secondary-border)] bg-[color:var(--cta-secondary-bg)] text-[color:var(--cta-secondary-ink)] hover:bg-[color:var(--cta-secondary-hover)]',
  ghost: 'text-[color:var(--ink-secondary)] hover:bg-[color:var(--cta-ghost-hover)] hover:text-[color:var(--ink)]',
  outline:
    'border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] text-[color:var(--ink)] hover:bg-[color:var(--bg-subtle)]',
  danger: 'bg-red-600 text-white hover:bg-red-500',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 min-h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-11 px-6 text-base font-semibold',
  icon: 'h-11 w-11 shrink-0 px-0',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-control font-semibold tracking-tight transition-[color,background,box-shadow,transform] duration-200 active:scale-[0.98]',
        'focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
