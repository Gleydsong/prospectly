import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'glass' | 'ghost' | 'danger' | 'outline' | 'brand';
type Size = 'sm' | 'md' | 'lg' | 'icon';

/**
 * Sistema alinhado à landing:
 * - primary / glass → vidro transparente legível
 * - secondary → vidro mais leve
 * - brand → cobalto (só quando o azul for necessário)
 */
const variants: Record<Variant, string> = {
  primary: 'cta-glass',
  glass: 'cta-glass',
  secondary:
    'border border-[color:var(--cta-secondary-border)] bg-[color:var(--cta-secondary-bg)] text-[color:var(--cta-secondary-ink)] hover:bg-[color:var(--cta-secondary-hover)]',
  ghost: 'text-zinc-300 hover:bg-[color:var(--cta-ghost-hover)] hover:text-zinc-50',
  outline:
    'border border-[color:var(--border)] bg-transparent text-zinc-200 hover:bg-[color:var(--cta-ghost-hover)]',
  brand: 'cta-primary',
  danger: 'bg-red-600 text-white hover:bg-red-500',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
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
        'inline-flex items-center justify-center gap-2 rounded-control font-medium transition-[color,background,box-shadow,transform,backdrop-filter] duration-200 active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
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
