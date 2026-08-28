import { useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface PerformanceGaugesProps {
  loading?: boolean;
  conversionRate: number;
  avgScore: number;
}

function Ring({
  value,
  max,
  label,
  format,
  animate,
}: {
  value: number;
  max: number;
  label: string;
  format: (n: number) => string;
  animate: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const data = [
    { name: 'v', value: pct },
    { name: 'r', value: 100 - pct },
  ];

  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <div className="relative h-24 w-24">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={30}
              outerRadius={40}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={animate}
              animationBegin={animate ? 220 : 0}
              animationDuration={animate ? 900 : 0}
            >
              <Cell fill="#3b82f6" style={{ filter: 'drop-shadow(0 0 6px rgb(59 130 246 / 0.5))' }} />
              <Cell fill="rgb(255 255 255 / 0.07)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold tabular-nums text-[color:var(--ink)]">{format(value)}</span>
        </div>
      </div>
      <p className="text-center text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink-muted)]">
        {label}
      </p>
    </div>
  );
}

export function PerformanceGauges({ loading, conversionRate, avgScore }: PerformanceGaugesProps) {
  const { t } = useTranslation();
  const animate = !useReducedMotion();

  return (
    <Card
      surface="bento"
      className="h-full transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-white/20"
    >
      <CardHeader title={t('dashboard.performance')} className="border-b-0 pb-0" />
      <CardContent className="pt-2">
        {loading ? (
          <div className="flex gap-4">
            <Skeleton className="mx-auto h-24 w-24 rounded-full" />
            <Skeleton className="mx-auto h-24 w-24 rounded-full" />
          </div>
        ) : (
          <div className="flex items-center justify-around gap-2">
            <Ring
              value={conversionRate}
              max={100}
              label={t('dashboard.conversion')}
              format={(n) => `${n.toFixed(0)}%`}
              animate={animate}
            />
            <Ring
              value={avgScore}
              max={100}
              label={t('dashboard.avgScore')}
              format={(n) => n.toFixed(0)}
              animate={animate}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
