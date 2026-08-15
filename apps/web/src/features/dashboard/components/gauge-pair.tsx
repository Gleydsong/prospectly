import { useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface GaugePairProps {
  loading?: boolean;
  approachRate: number;
  meetingRate: number;
}

function Gauge({ value, label, animate }: { value: number; label: string; animate: boolean }) {
  const clamped = Math.max(0, Math.min(100, value));
  const data = [
    { name: 'value', value: clamped },
    { name: 'rest', value: 100 - clamped },
  ];

  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <div className="relative h-28 w-28">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              startAngle={210}
              endAngle={-30}
              innerRadius={34}
              outerRadius={46}
              stroke="none"
              isAnimationActive={animate}
              animationBegin={animate ? 180 : 0}
              animationDuration={animate ? 900 : 0}
            >
              <Cell
                fill="#60a5fa"
                style={{ filter: 'drop-shadow(0 0 8px rgb(96 165 250 / 0.55))' }}
              />
              <Cell fill="rgb(255 255 255 / 0.08)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pt-2">
          <span className="text-lg font-semibold tabular-nums text-zinc-50">
            {clamped.toFixed(0)}
            <span className="text-xs text-zinc-500">%</span>
          </span>
        </div>
      </div>
      <p className="text-center text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
    </div>
  );
}

export function GaugePair({ loading, approachRate, meetingRate }: GaugePairProps) {
  const { t } = useTranslation();
  const animate = !useReducedMotion();

  return (
    <Card
      surface="bento"
      className="h-full transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-white/20"
    >
      <CardHeader title={t('dashboard.energyRates')} className="border-b-0 pb-0" />
      <CardContent className="pt-2">
        {loading ? (
          <div className="flex gap-4">
            <Skeleton className="mx-auto h-28 w-28 rounded-full" />
            <Skeleton className="mx-auto h-28 w-28 rounded-full" />
          </div>
        ) : (
          <div className="flex items-center justify-around gap-2">
            <Gauge value={approachRate} label={t('dashboard.approachRate')} animate={animate} />
            <Gauge value={meetingRate} label={t('dashboard.meetingRate')} animate={animate} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
