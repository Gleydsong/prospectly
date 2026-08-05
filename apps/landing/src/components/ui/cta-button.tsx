import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

export type CtaVariant = 'primary' | 'secondary' | 'ghost';
export type CtaSize = 'sm' | 'md' | 'lg';

/**
 * Mesmas variantes e medidas do botão do app autenticado, para que os CTAs
 * públicos e o produto compartilhem a mesma linguagem visual.
 */
const variants: Record<CtaVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-[0_10px_30px_-12px_rgb(37_99_235_/_0.9)] hover:bg-brand-500',
  secondary:
    'border border-[color:var(--border)] bg-[color:var(--bg-raised)] text-[color:var(--ink)] hover:bg-[color:var(--bg-sunken)]',
  ghost: 'text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]',
};

const sizes: Record<CtaSize, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-sm',
};

const base =
  'focus-ring inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors active:scale-[0.98]';

function classes(variant: CtaVariant, size: CtaSize, className?: string): string {
  return [base, variants[variant], sizes[size], className].filter(Boolean).join(' ');
}

interface SharedProps {
  variant?: CtaVariant;
  size?: CtaSize;
  className?: string;
  children: ReactNode;
}

type LinkProps = SharedProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> & { href: string };

type ButtonProps = SharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { href?: never };

export type CtaButtonProps = LinkProps | ButtonProps;

function isExternal(href: string): boolean {
  return /^(https?:|mailto:|tel:|#)/.test(href);
}

export function CtaButton(props: CtaButtonProps) {
  const { variant = 'primary', size = 'lg', className, children } = props;
  const merged = classes(variant, size, className);

  if ('href' in props && props.href) {
    const { href, variant: _variant, size: _size, className: _className, ...rest } = props;
    if (isExternal(href)) {
      return (
        <a href={href} className={merged} {...rest}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={merged} {...rest}>
        {children}
      </Link>
    );
  }

  const { variant: _variant, size: _size, className: _className, ...rest } = props as ButtonProps;
  return (
    <button className={merged} {...rest}>
      {children}
    </button>
  );
}
