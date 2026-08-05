import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

export type CtaVariant = 'primary' | 'secondary' | 'glass' | 'ghost' | 'outline';
export type CtaSize = 'sm' | 'md' | 'lg' | 'icon';

/**
 * Único sistema de botão da landing — alinhado ao redesign grafite/bento.
 * Primary: cobalto. Secondary: vidro leve. Glass: vidro mais visível (CTAs principais).
 */
const variants: Record<CtaVariant, string> = {
  primary: 'cta-primary',
  secondary:
    'border border-[color:var(--cta-secondary-border)] bg-[color:var(--cta-secondary-bg)] text-[color:var(--cta-secondary-ink)] hover:bg-[color:var(--cta-secondary-hover)]',
  glass:
    'border border-[color:var(--cta-glass-border)] bg-[color:var(--cta-glass-bg)] text-[color:var(--cta-glass-ink)] shadow-[inset_0_1px_0_0_var(--cta-glass-inset)] backdrop-blur-md hover:bg-[color:var(--cta-glass-hover)]',
  outline:
    'border border-[color:var(--border)] bg-transparent text-[color:var(--ink)] hover:bg-[color:var(--cta-ghost-hover)]',
  ghost:
    'text-[color:var(--ink-muted)] hover:bg-[color:var(--cta-ghost-hover)] hover:text-[color:var(--ink)]',
};

const sizes: Record<CtaSize, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-sm',
  icon: 'h-11 w-11 shrink-0 px-0',
};

const base =
  'focus-ring inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-[color,background,box-shadow,transform] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100';

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
