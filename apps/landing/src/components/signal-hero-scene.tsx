'use client';

import dynamic from 'next/dynamic';
import React, { useEffect, useRef, useState } from 'react';
import { SignalHeroFallback } from './signal-hero-fallback';
import {
  shouldLoadHero3D,
  getHero3DBrowserConditions,
  type ShouldLoadHero3DOptions,
} from '@/lib/should-load-hero-3d';
import { t, type Locale } from '@/lib/i18n';

export { shouldLoadHero3D, getHero3DBrowserConditions, type ShouldLoadHero3DOptions };

// Carregamento preguiçoso do objeto 3D sem SSR (não bloqueia LCP nem SSR)
const SignalHero3D = dynamic(() => import('./signal-hero-3d'), {
  ssr: false,
  loading: () => <SignalHeroFallback />,
});

export function SignalHeroScene({ locale = 'pt' }: { locale?: Locale }) {
  const [mount3D, setMount3D] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Avalia decisão de performance/capacidade com a função pura
    const conditions = getHero3DBrowserConditions();
    if (!shouldLoadHero3D(conditions)) {
      setUseFallback(true);
      return;
    }

    let isIntersecting = false;
    let isIdle = false;
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let observer: IntersectionObserver | undefined;

    const tryMount = () => {
      if (!cancelled && isIntersecting && isIdle) {
        setMount3D(true);
        if (observer) {
          observer.disconnect();
          observer = undefined;
        }
      }
    };

    // 2. IntersectionObserver: só dispara se o hero estiver no viewport
    const container = containerRef.current;
    if (typeof IntersectionObserver !== 'undefined' && container) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              isIntersecting = true;
              tryMount();
              break;
            }
          }
        },
        { rootMargin: '50px' },
      );
      observer.observe(container);
    } else {
      isIntersecting = true;
    }

    // 3. requestIdleCallback (com fallback setTimeout) após o evento load
    const onIdle = () => {
      isIdle = true;
      tryMount();
    };

    const scheduleIdle = () => {
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(onIdle, { timeout: 2500 });
      } else {
        timeoutId = setTimeout(onIdle, 300);
      }
    };

    if (document.readyState === 'complete') {
      scheduleIdle();
    } else {
      window.addEventListener('load', scheduleIdle, { once: true });
    }

    // 4. Observa dinamicamente preferência de redução de movimento
    const motionMediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setUseFallback(true);
        setMount3D(false);
      }
    };
    motionMediaQuery?.addEventListener?.('change', handleMotionChange);

    return () => {
      cancelled = true;
      window.removeEventListener('load', scheduleIdle);
      motionMediaQuery?.removeEventListener?.('change', handleMotionChange);
      if (idleId !== undefined && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[560px] mx-auto min-h-[360px] sm:min-h-[460px] lg:min-h-[520px] flex items-center justify-center select-none"
    >
      {/* Objeto 3D em Three.js ou Fallback CSS/SVG */}
      <div className="absolute inset-0 flex items-center justify-center">
        {useFallback || !mount3D ? (
          <SignalHeroFallback />
        ) : (
          <SignalHero3D onWebGLUnavailable={() => setUseFallback(true)} />
        )}
      </div>

      {/* Cartões e Pílulas de Vidro Fosco Flutuantes (01-landing-desktop.png) */}

      {/* 1. Pílula Superior: 27 sem site em Olinda */}
      <div className="absolute top-4 sm:top-6 left-6 sm:left-12 z-10 flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-2xl bg-white/70 dark:bg-tinta/80 border border-white/80 dark:border-white/15 shadow-[0_8px_24px_rgba(11,18,32,0.08)] text-xs font-medium text-grafite dark:text-zinc-200 animate-fade-rise">
        <span className="w-2 h-2 rounded-full bg-azul-prospectly animate-pulse" aria-hidden="true" />
        <span>{t(locale, 'heroCardOlindaPill')}</span>
      </div>

      {/* 2. Cartão Central de Oportunidade: Padaria Pão Dourado */}
      <div className="absolute z-20 w-[90%] max-w-[320px] sm:max-w-[340px] p-4 sm:p-5 rounded-[20px] backdrop-blur-2xl bg-white/85 dark:bg-tinta/90 border border-white/90 dark:border-white/15 shadow-[0_20px_48px_rgba(11,18,32,0.14)] text-tinta dark:text-zinc-100 top-1/2 -translate-y-1/3 right-2 sm:right-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-azul-prospectly font-semibold block">
              {t(locale, 'heroCardEyebrow')}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-7 h-7 rounded-full bg-azul-prospectly/10 dark:bg-azul-prospectly/25 text-azul-prospectly flex items-center justify-center font-bold text-xs">
                PD
              </div>
              <div>
                <h3 className="font-display font-bold text-sm sm:text-base leading-tight text-tinta dark:text-white">
                  {t(locale, 'heroCardCompany')}
                </h3>
                <p className="text-xs text-grafite/70 dark:text-zinc-400">
                  {t(locale, 'heroCardCategoryCity')}
                </p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="font-display font-extrabold text-2xl tracking-tight text-tinta dark:text-white leading-none block">
              84
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-grafite/60 dark:text-zinc-400">
              PTS
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-linha/60 dark:border-white/10 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-400/20 text-amber-700 dark:text-amber-300 font-medium text-[11px]">
            {t(locale, 'heroCardNoWebsite')}
          </span>
          <span className="text-grafite/80 dark:text-zinc-300 text-[11px] font-medium">
            {t(locale, 'heroCardReviews')}
          </span>
        </div>
      </div>

      {/* 3. Pílula Inferior: No Funil Hoje +18 clientes */}
      <div className="absolute bottom-4 sm:bottom-6 right-4 sm:right-10 z-10 flex items-center gap-3 px-4 py-2.5 rounded-[16px] backdrop-blur-2xl bg-white/80 dark:bg-tinta/85 border border-white/80 dark:border-white/15 shadow-[0_12px_32px_rgba(11,18,32,0.12)]">
        <div>
          <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-grafite/70 dark:text-zinc-400 font-semibold block">
            {t(locale, 'heroCardFunnelToday')}
          </span>
          <strong className="font-display font-bold text-sm sm:text-base text-tinta dark:text-white">
            {t(locale, 'heroCardFunnelCount')}
          </strong>
        </div>
        {/* Mini gráfico de barras decorativo */}
        <div className="flex items-end gap-1 h-5 pb-0.5" aria-hidden="true">
          <span className="w-1 bg-azul-prospectly/40 rounded-full h-2" />
          <span className="w-1 bg-azul-prospectly/60 rounded-full h-3" />
          <span className="w-1 bg-azul-prospectly/80 rounded-full h-4" />
          <span className="w-1 bg-azul-prospectly rounded-full h-5" />
        </div>
      </div>
    </div>
  );
}
