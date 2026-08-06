import { useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/features/theme/theme-provider';
import { getLeadStatusShortLabel, getLeadStatusLabel } from '@/lib/lead-status';
import type { LeadStatus } from '@/types';

const AXIS_TICK = { fontSize: 11, fill: '#7C8593' } as const;

const TOOLTIP_STYLE_DARK = {
  background: '#15181D',
  border: '1px solid rgb(255 255 255 / 0.1)',
  borderRadius: 14,
  color: '#F1F2F4',
  fontSize: 12,
} as const;

const TOOLTIP_STYLE_LIGHT = {
  background: 'rgb(255 255 255 / 0.88)',
  border: '1px solid rgb(24 24 27 / 0.1)',
  borderRadius: 14,
  color: '#18181b',
  fontSize: 12,
  backdropFilter: 'blur(16px) saturate(160%)',
} as const;

interface AccentBarChartProps {
  loading?: boolean;
  data: Array<{ status: LeadStatus; count: number }>;
}

export function AccentBarChart({ loading, data }: AccentBarChartProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const tooltipStyle = theme === 'light' ? TOOLTIP_STYLE_LIGHT : TOOLTIP_STYLE_DARK;
  const idleBarFill = theme === 'light' ? 'rgb(24 24 27 / 0.12)' : 'rgb(255 255 255 / 0.14)';
  const cursorFill = theme === 'light' ? 'rgb(24 24 27 / 0.04)' : 'rgb(255 255 255 / 0.04)';

  const chartData = useMemo(
    () =>
      data.map((entry) => ({
        status: entry.status,
        label: getLeadStatusShortLabel(entry.status),
        fullLabel: getLeadStatusLabel(entry.status),
        count: entry.count,
      })),
    [data],
  );

  const maxIndex = useMemo(() => {
    if (chartData.length === 0) return -1;
    let best = 0;
    for (let i = 1; i < chartData.length; i += 1) {
      const current = chartData[i];
      const selected = chartData[best];
      if (current && selected && current.count > selected.count) best = i;
    }
    return best;
  }, [chartData]);

  const highlight = activeIndex ?? maxIndex;

  return (
    <Card
      surface="bento"
      className="h-full transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-white/20"
    >
      <CardHeader title={t('dashboard.byStatus')} className="border-b-0 pb-0" />
      <CardContent className="h-64 pt-2 sm:h-72">
        {loading ? (
          <Skeleton className="h-full" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-zinc-500">{t('dashboard.noLeads')}</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 18, right: 8, left: 0, bottom: 8 }}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={72}
                tickMargin={6}
              />
              <YAxis allowDecimals={false} tick={AXIS_TICK} width={32} />
              <Tooltip
                cursor={{ fill: cursorFill }}
                contentStyle={tooltipStyle}
                formatter={(value: number) => [value, t('dashboard.leadsSeries')]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as
                    | { fullLabel?: string; label?: string }
                    | undefined;
                  return row?.fullLabel ?? row?.label ?? '';
                }}
              />
              <Bar
                dataKey="count"
                radius={[8, 8, 4, 4]}
                name={t('dashboard.leadsSeries')}
                isAnimationActive={!reduceMotion}
                animationBegin={reduceMotion ? 0 : 120}
                animationDuration={reduceMotion ? 0 : 800}
                onMouseEnter={(_, index) => setActiveIndex(index)}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.status}
                    fill={index === highlight ? '#60a5fa' : idleBarFill}
                    style={
                      index === highlight
                        ? { filter: 'drop-shadow(0 0 10px rgb(96 165 250 / 0.45))' }
                        : undefined
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
