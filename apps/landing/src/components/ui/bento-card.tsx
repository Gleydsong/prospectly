import type { ReactNode } from 'react';

export interface BentoCardProps {
  /** Vitrine no topo do card: mock, chips ou ícones. */
  visual: ReactNode;
  title: string;
  description: string;
  className?: string;
}

/**
 * Card modular escuro: vitrine no topo, texto na base. A superfície combina
 * gradiente vertical, brilho radial e textura pontilhada para dar profundidade
 * sem depender de blur, que pesaria no scroll.
 */
export function BentoCard({ visual, title, description, className }: BentoCardProps) {
  return (
    <article
      className={[
        'group relative flex h-full flex-col overflow-hidden rounded-bento',
        'border border-[color:var(--bento-border)] bg-[color:var(--bento-bg)]',
        'shadow-panel transition-colors duration-200 hover:border-[color:var(--bento-border-hover)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Brilho radial no topo e textura: decorativos, fora da árvore acessível. */}
      <span aria-hidden className="bento-sheen pointer-events-none absolute inset-0" />
      <span aria-hidden className="bento-texture pointer-events-none absolute inset-x-0 top-0 h-1/2" />

      <div className="relative flex min-h-[190px] flex-1 items-center justify-center px-5 pb-2 pt-7">
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
    </article>
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
        'inline-flex items-center gap-1.5 rounded-control border px-3 py-2 text-xs font-medium',
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
