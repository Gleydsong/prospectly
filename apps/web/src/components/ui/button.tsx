import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'glass' | 'ghost' | 'danger' | 'outline' | 'brand';
type Size = 'sm' | 'md' | 'lg' | 'icon';

/**
 * Visual Facilitey-inspired:
 * - primary → cinza glass (light) / cobalto (dark via .cta-primary)
 * - glass → frosted iOS
 * - secondary / outline → borda fina
 * - brand → alias de primary (legado)
 */
const variants: Record<Variant, string> = {
  primary: 'cta-primary',
  brand: 'cta-primary',
  glass: 'cta-glass',
  secondary:
    'border border-[color:var(--cta-secondary-border)] bg-[color:var(--cta-secondary-bg)] text-[color:var(--cta-secondary-ink)] hover:bg-[color:var(--cta-secondary-hover)] backdrop-blur-xl',
  ghost: 'text-zinc-300 hover:bg-[color:var(--cta-ghost-hover)] hover:text-zinc-50',
  outline:
    'border border-[color:var(--border)] bg-transparent text-zinc-200 hover:bg-[color:var(--cta-ghost-hover)] backdrop-blur-sm',
  danger: 'bg-red-600 text-white hover:bg-red-500',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-base font-semibold',
  icon: 'h-10 w-10 shrink-0 px-0',
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
        'inline-flex items-center justify-center gap-2 rounded-control font-semibold tracking-tight transition-[color,background,box-shadow,transform,backdrop-filter] duration-200 active:scale-[0.98]',
        'min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]',
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
