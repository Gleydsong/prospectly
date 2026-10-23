import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { GlossSphere } from '@/components/ui/gloss-sphere';
import { SignalRing } from '@/components/ui/signal-ring';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-screen flex-col justify-between bg-[color:var(--bg)] p-6 sm:p-10 select-none overflow-hidden">
      {/* Header brand logo */}
      <header className="relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-display text-base font-bold tracking-tight text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] rounded-control"
        >
          <span className="font-display font-black text-xl text-[color:var(--ink)]">P.</span>
          <span className="font-display text-base font-bold text-[color:var(--ink)]">Prospectly</span>
        </Link>
      </header>

      {/* Main 404 center container */}
      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center text-center py-12">
        {/* Visual 404 with SignalRing and GlossSphere */}
        <div className="relative flex items-center justify-center gap-1 sm:gap-2">
          <span className="font-display text-[100px] sm:text-[140px] font-extrabold leading-none tracking-tighter text-[color:var(--ink)]">
            4
          </span>

          <div className="relative inline-flex items-center justify-center">
            <SignalRing
              size={130}
              glow
              className="w-[90px] h-[90px] sm:w-[130px] sm:h-[130px]"
            />
            <GlossSphere
              variant="lima"
              size={34}
              className="absolute -top-1 -right-1 w-[26px] h-[26px] sm:w-[34px] sm:h-[34px] drop-shadow-md"
            />
          </div>

          <span className="font-display text-[100px] sm:text-[140px] font-extrabold leading-none tracking-tighter text-[color:var(--ink)]">
            4
          </span>
        </div>

        {/* Text and Action */}
        <h1 className="mt-6 font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-display text-[color:var(--ink)]">
          {t('notFound.title')}
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-[color:var(--ink-secondary)]">
          {t('notFound.subtitle')}
        </p>

        <div className="mt-8">
          <Link to="/">
            <Button size="lg" className="rounded-full px-8 py-3 shadow-soft">
              {t('notFound.backHome')}
            </Button>
          </Link>
        </div>
      </main>

      {/* Empty footer spacer to maintain vertical balance */}
      <div className="h-6" aria-hidden="true" />
    </div>
  );
}
