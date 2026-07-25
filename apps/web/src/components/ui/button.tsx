import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-500 disabled:bg-brand-900',
  secondary: 'bg-zinc-800 text-zinc-50 hover:bg-zinc-700',
  ghost: 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50',
  outline: 'border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800',
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
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
        'disabled:cursor-not-allowed disabled:opacity-60',
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
