import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-[0_10px_30px_-12px_rgb(37_99_235_/_0.9)] hover:bg-brand-500 disabled:bg-brand-900 disabled:shadow-none',
  secondary: 'border border-white/10 bg-white/[0.06] text-zinc-50 hover:bg-white/[0.1]',
  ghost: 'text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-50',
  outline: 'border border-white/[0.12] bg-transparent text-zinc-200 hover:bg-white/[0.06]',
  danger: 'bg-red-600 text-white hover:bg-red-500',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
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
        'inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors active:scale-[0.98]',
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
