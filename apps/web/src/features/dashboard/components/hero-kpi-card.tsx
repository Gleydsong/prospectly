import { ArrowUpRight } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCountUp } from '@/hooks/use-count-up';
import { cn } from '@/lib/utils';

interface HeroKpiCardProps {
  loading?: boolean;
  conversionRate: number;
  won: number;
  newLeads: number;
  /** Âncora do first-load circular reveal. */
  originRef?: (node: HTMLElement | null) => void;
  className?: string;
}

export function HeroKpiCard({
  loading,
  conversionRate,
  won,
  newLeads,
  originRef,
  className,
}: HeroKpiCardProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const animatedRate = useCountUp(conversionRate);
  const spark = [
    { v: Math.max(0, conversionRate * 0.45) },
    { v: Math.max(0, conversionRate * 0.62) },
    { v: Math.max(0, conversionRate * 0.5) },
    { v: Math.max(0, conversionRate * 0.78) },
    { v: Math.max(0, conversionRate * 0.66) },
    { v: conversionRate },
  ];

  return (
    <div ref={originRef} className="h-full min-w-0">
      <Card
        surface="accent"
        className={cn(
          'group h-full transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-brand-400/40 hover:shadow-[0_14px_44px_-14px_rgb(37_99_235_/_0.55)]',
          className,
        )}
      >
      <CardHeader
        title={t('dashboard.conversion')}
        description={t('dashboard.heroKpiDesc')}
        className="border-b-0 pb-0"
        action={
          !loading && won > 0 ? (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-300">
              {t('dashboard.wonBadge', { count: won })}
            </span>
          ) : null
        }
      />
      <CardContent className="flex flex-1 flex-col gap-4 pt-2">
        {loading ? (
          <Skeleton className="h-16 w-36" />
        ) : (
          <div className="relative">
            <p className="text-4xl font-semibold tabular-nums tracking-tight text-zinc-50 sm:text-5xl">
              {animatedRate.toFixed(1)}
              <span className="ml-1 text-2xl text-zinc-400">%</span>
            </p>
            <div className="pointer-events-none absolute -right-1 top-0 h-14 w-28 opacity-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spark}>
                  <defs>
                    <linearGradient id="heroSpark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#93c5fd"
                    strokeWidth={2}
                    fill="url(#heroSpark)"
                    isAnimationActive={!reduceMotion}
                    animationDuration={reduceMotion ? 0 : 900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <p className="text-xs text-zinc-500">
          {loading ? '—' : t('dashboard.heroKpiHint', { newLeads, won })}
        </p>
        <Link
          to="/pipeline"
          className="cta-primary inline-flex h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98]"
        >
          {t('dashboard.openPipeline')}
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </CardContent>
      </Card>
    </div>
  );
}
