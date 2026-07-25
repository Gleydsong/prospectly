'use client';

import { t, type Locale } from '@/lib/i18n';

const MARKS = [
  {
    label: 'Agência Norte',
    svg: (
      <svg viewBox="0 0 120 28" className="h-7 w-auto fill-current" aria-hidden>
        <path d="M8 22V6h3.2l6.4 11.2L24 6H27v16h-2.8V11.2L18.2 22h-2.4L10.8 11.2V22H8z" />
        <text x="36" y="19" className="fill-current text-[13px] font-semibold tracking-tight">
          Agência Norte
        </text>
      </svg>
    ),
  },
  {
    label: 'Studio Atlas',
    svg: (
      <svg viewBox="0 0 120 28" className="h-7 w-auto fill-current" aria-hidden>
        <circle cx="14" cy="14" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M14 6v16M6 14h16" stroke="currentColor" strokeWidth="1.5" />
        <text x="30" y="19" className="fill-current text-[13px] font-semibold tracking-tight">
          Studio Atlas
        </text>
      </svg>
    ),
  },
  {
    label: 'Pixel Rua',
    svg: (
      <svg viewBox="0 0 110 28" className="h-7 w-auto fill-current" aria-hidden>
        <rect x="6" y="6" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="10" y="10" width="4" height="4" />
        <rect x="16" y="14" width="4" height="4" />
        <text x="30" y="19" className="fill-current text-[13px] font-semibold tracking-tight">
          Pixel Rua
        </text>
      </svg>
    ),
  },
  {
    label: 'Forma Local',
    svg: (
      <svg viewBox="0 0 120 28" className="h-7 w-auto fill-current" aria-hidden>
        <path d="M14 4l10 18H4L14 4z" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="32" y="19" className="fill-current text-[13px] font-semibold tracking-tight">
          Forma Local
        </text>
      </svg>
    ),
  },
  {
    label: 'Base Digital',
    svg: (
      <svg viewBox="0 0 120 28" className="h-7 w-auto fill-current" aria-hidden>
        <path d="M6 20h16V8H6v12zm3-3h4v3H9v-3zm6 0h4v3h-4v-3z" />
        <text x="30" y="19" className="fill-current text-[13px] font-semibold tracking-tight">
          Base Digital
        </text>
      </svg>
    ),
  },
];

export function TrustStrip({ locale }: { locale: Locale }) {
  return (
    <section className="border-y border-[color:var(--border)] bg-[color:var(--bg-sunken)]">
      <div className="mx-auto max-w-shell px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-[color:var(--ink-muted)]">{t(locale, 'trustLabel')}</p>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 opacity-70">
          {MARKS.map((mark) => (
            <li key={mark.label} className="text-[color:var(--ink)]">
              {mark.svg}
              <span className="sr-only">{mark.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
