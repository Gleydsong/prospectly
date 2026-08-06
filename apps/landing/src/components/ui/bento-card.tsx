import type { ReactNode } from 'react';

export interface BentoCardProps {
  /** Vitrine no topo do card: mock, chips ou ícones. */
  visual: ReactNode;
  title: string;
  description: string;
  /** `default` = mock largo; `compact` = vitrine menor; `icon` = só ícone. */
  visualSize?: 'default' | 'compact' | 'icon';
  className?: string;
}

const VISUAL_MIN: Record<NonNullable<BentoCardProps['visualSize']>, string> = {
  default: 'min-h-[190px]',
  compact: 'min-h-[120px]',
  icon: 'min-h-[88px]',
};

/**
 * Shell escuro compartilhado: gradiente, sheen e textura.
 * Usado por cards e painéis maiores (waitlist, FAQ, pricing, CTA).
 */
export function BentoSurface({
  children,
  className,
  as: Tag = 'div',
  /** Desliga sheen/textura (ex.: embed de vídeo). */
  decor = true,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'article' | 'section' | 'li';
  decor?: boolean;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={[
        'bento-surface group relative overflow-hidden rounded-bento',
        'border border-[color:var(--bento-border)] shadow-panel',
        'transition-colors duration-200 hover:border-[color:var(--bento-border-hover)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {decor ? (
        <>
          <span aria-hidden className="bento-sheen pointer-events-none absolute inset-0" />
          <span aria-hidden className="bento-texture pointer-events-none absolute inset-x-0 top-0 h-1/2" />
        </>
      ) : null}
      {children}
    </Tag>
  );
}

/**
 * Card modular escuro: vitrine no topo, texto na base.
 */
export function BentoCard({
  visual,
  title,
  description,
  visualSize = 'default',
  className,
}: BentoCardProps) {
  return (
    <BentoSurface as="article" className={['flex h-full flex-col', className].filter(Boolean).join(' ')}>
      <div
        className={[
          'relative flex flex-1 items-center justify-center px-5 pb-2 pt-7',
          VISUAL_MIN[visualSize],
        ].join(' ')}
      >
        {visual}
      </div>

      <div className="relative px-6 pb-6 pt-2">
        <h3 className="text-base font-semibold tracking-tight text-[color:var(--bento-ink)]">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--bento-ink-muted)]">
          {description}
        </p>
      </div>
    </BentoSurface>
  );
}

/** Ícone em disco para vitrines compactas. */
export function BentoIconDisk({ children }: { children: ReactNode }) {
  return (
      <span className="bento-icon-disk flex h-14 w-14 items-center justify-center rounded-panel border border-white/12 bg-white/[0.07] text-white/85">
      {children}
    </span>
  );
}

/** Chip usado nas vitrines. `dim` recua o chip para criar profundidade. */
export function BentoChip({
  children,
  dim,
  className,
}: {
  children: ReactNode;
  dim?: boolean;
  className?: string;
}) {
  return (
    <span
      className={[
        'bento-chip inline-flex items-center gap-1.5 rounded-control border px-3 py-2 text-xs font-medium',
        dim
          ? 'border-white/5 bg-white/[0.02] text-white/35'
          : 'border-white/10 bg-white/[0.06] text-white/80',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
