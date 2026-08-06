import { MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardMapPin } from '@/types';
import { cn } from '@/lib/utils';

import {
  WORLD_LAND_PATH,
  WORLD_MAP_HEIGHT,
  WORLD_MAP_WIDTH,
} from './world-land-path';

/** Fallback: América do Sul (Prospectly = prospecção local BR). */
const FALLBACK_BOUNDS = {
  minLng: -75,
  maxLng: -30,
  minLat: -35,
  maxLat: 6,
};

function project(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng + 180) / 360) * WORLD_MAP_WIDTH,
    y: ((90 - lat) / 180) * WORLD_MAP_HEIGHT,
  };
}

function arcPath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 - Math.max(28, dist * 0.22);
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

function computeViewBox(pins: Array<{ x: number; y: number; latitude: number; longitude: number }>) {
  let minLng: number;
  let maxLng: number;
  let minLat: number;
  let maxLat: number;

  if (pins.length === 0) {
    ({ minLng, maxLng, minLat, maxLat } = FALLBACK_BOUNDS);
  } else if (pins.length === 1) {
    const p = pins[0]!;
    minLng = p.longitude - 8;
    maxLng = p.longitude + 8;
    minLat = p.latitude - 6;
    maxLat = p.latitude + 6;
  } else {
    minLng = Math.min(...pins.map((p) => p.longitude));
    maxLng = Math.max(...pins.map((p) => p.longitude));
    minLat = Math.min(...pins.map((p) => p.latitude));
    maxLat = Math.max(...pins.map((p) => p.latitude));
    const padLng = Math.max(3, (maxLng - minLng) * 0.35);
    const padLat = Math.max(2.5, (maxLat - minLat) * 0.4);
    minLng -= padLng;
    maxLng += padLng;
    minLat -= padLat;
    maxLat += padLat;
  }

  const topLeft = project(maxLat, minLng);
  const bottomRight = project(minLat, maxLng);
  let x = topLeft.x;
  let y = topLeft.y;
  let w = bottomRight.x - topLeft.x;
  let h = bottomRight.y - topLeft.y;

  // Mantém proporção ~ widescreen do card
  const targetRatio = 1.55;
  const ratio = w / Math.max(h, 1);
  if (ratio < targetRatio) {
    const newW = h * targetRatio;
    x -= (newW - w) / 2;
    w = newW;
  } else if (ratio > targetRatio * 1.35) {
    const newH = w / targetRatio;
    y -= (newH - h) / 2;
    h = newH;
  }

  const pad = Math.max(w, h) * 0.06;
  return `${(x - pad).toFixed(1)} ${(y - pad).toFixed(1)} ${(w + pad * 2).toFixed(1)} ${(h + pad * 2).toFixed(1)}`;
}

interface LeadsMapCardProps {
  loading?: boolean;
  pins: DashboardMapPin[];
  cities: Array<{ city: string | null; count: number }>;
}

export function LeadsMapCard({ loading, pins, cities }: LeadsMapCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const projected = useMemo(
    () =>
      pins.map((pin) => ({
        ...pin,
        ...project(pin.latitude, pin.longitude),
      })),
    [pins],
  );

  const viewBox = useMemo(() => computeViewBox(projected), [projected]);

  const arcs = useMemo(() => {
    if (projected.length < 2) return [];
    const top = [...projected].sort((a, b) => b.score - a.score).slice(0, 6);
    const paths: string[] = [];
    for (let i = 0; i < top.length - 1; i += 1) {
      const from = top[i];
      const to = top[i + 1];
      if (from && to) paths.push(arcPath(from, to));
    }
    // Fecha um anel leve entre primeiro e último quando há ≥3
    if (top.length >= 3) {
      const last = top[top.length - 1];
      const first = top[0];
      if (last && first) paths.push(arcPath(last, first));
    }
    return paths;
  }, [projected]);

  const hovered = projected.find((p) => p.id === hoveredId) ?? null;
  const cityCount = cities.filter((c) => c.city).length;
  const coverage = Math.min(100, cityCount * 12 + projected.length);

  return (
    <Card
      surface="bento"
      className="flex h-full min-h-[420px] flex-col transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-brand-400/30 hover:shadow-[0_14px_44px_-18px_rgb(37_99_235_/_0.45)]"
    >
      <CardHeader
        title={t('dashboard.mapTitle')}
        description={t('dashboard.mapDesc')}
        className="border-b-0 pb-0"
        action={
          !loading ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-zinc-300">
              {t('dashboard.mapPinCount', { count: projected.length })}
            </span>
          ) : null
        }
      />
      <CardContent className="flex flex-1 flex-col gap-4 pt-2">
        {loading ? (
          <Skeleton className="min-h-[240px] flex-1" />
        ) : (
          <>
            <div className="relative min-h-[260px] flex-1 overflow-hidden rounded-panel border border-white/[0.06] bg-[#05070b]">
              <svg
                viewBox={viewBox}
                className="h-full w-full"
                role="img"
                aria-label={t('dashboard.mapTitle')}
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <radialGradient id="oceanGlow" cx="42%" cy="38%" r="58%">
                    <stop offset="0%" stopColor="rgb(37 99 235 / 0.28)" />
                    <stop offset="45%" stopColor="rgb(37 99 235 / 0.08)" />
                    <stop offset="100%" stopColor="rgb(5 7 11 / 0)" />
                  </radialGradient>
                  <linearGradient id="landFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(148 163 184 / 0.22)" />
                    <stop offset="100%" stopColor="rgb(71 85 105 / 0.16)" />
                  </linearGradient>
                  <linearGradient id="arcStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgb(96 165 250 / 0)" />
                    <stop offset="50%" stopColor="rgb(147 197 253 / 0.85)" />
                    <stop offset="100%" stopColor="rgb(96 165 250 / 0)" />
                  </linearGradient>
                  <filter id="pinGlow" x="-120%" y="-120%" width="340%" height="340%">
                    <feGaussianBlur stdDeviation="2.6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="landShadow" x="-2%" y="-2%" width="104%" height="104%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#000" floodOpacity="0.45" />
                  </filter>
                </defs>

                <rect
                  x={-WORLD_MAP_WIDTH}
                  y={-WORLD_MAP_HEIGHT}
                  width={WORLD_MAP_WIDTH * 3}
                  height={WORLD_MAP_HEIGHT * 3}
                  fill="#05070b"
                />
                <rect x={0} y={0} width={WORLD_MAP_WIDTH} height={WORLD_MAP_HEIGHT} fill="url(#oceanGlow)" />

                {/* Grade geográfica sutil */}
                {Array.from({ length: 13 }).map((_, i) => (
                  <line
                    key={`lon-${i}`}
                    x1={(WORLD_MAP_WIDTH / 12) * i}
                    x2={(WORLD_MAP_WIDTH / 12) * i}
                    y1={0}
                    y2={WORLD_MAP_HEIGHT}
                    stroke="rgb(255 255 255 / 0.035)"
                    strokeWidth={0.6}
                  />
                ))}
                {Array.from({ length: 7 }).map((_, i) => (
                  <line
                    key={`lat-${i}`}
                    y1={(WORLD_MAP_HEIGHT / 6) * i}
                    y2={(WORLD_MAP_HEIGHT / 6) * i}
                    x1={0}
                    x2={WORLD_MAP_WIDTH}
                    stroke="rgb(255 255 255 / 0.04)"
                    strokeWidth={0.6}
                  />
                ))}

                <path
                  d={WORLD_LAND_PATH}
                  fill="url(#landFill)"
                  stroke="rgb(186 198 214 / 0.38)"
                  strokeWidth={0.7}
                  strokeLinejoin="round"
                  filter="url(#landShadow)"
                />

                {arcs.map((d) => (
                  <path
                    key={d}
                    d={d}
                    fill="none"
                    stroke="url(#arcStroke)"
                    strokeWidth={1.4}
                    strokeLinecap="round"
                    strokeDasharray="5 7"
                    className="dashboard-map-arc"
                    opacity={0.9}
                  />
                ))}

                {projected.map((pin, index) => {
                  const active = hoveredId === pin.id;
                  return (
                    <g
                      key={pin.id}
                      role="link"
                      tabIndex={0}
                      transform={`translate(${pin.x} ${pin.y})`}
                      className="cursor-pointer outline-none"
                      style={{ animationDelay: `${Math.min(index, 12) * 70}ms` }}
                      onMouseEnter={() => setHoveredId(pin.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onFocus={() => setHoveredId(pin.id)}
                      onBlur={() => setHoveredId(null)}
                      onClick={() => navigate(`/leads/${pin.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(`/leads/${pin.id}`);
                        }
                      }}
                    >
                      <circle
                        className="dashboard-map-pin-halo"
                        style={{ animationDelay: `${Math.min(index, 12) * 70}ms` }}
                        r={active ? 16 : 11}
                        fill="rgb(59 130 246 / 0.22)"
                        filter="url(#pinGlow)"
                      />
                      {/* Pin gota (estilo frame) */}
                      <path
                        d="M0 -11 C4.8 -11 8.2 -7.2 8.2 -2.8 C8.2 2.4 0 11 0 11 C0 11 -8.2 2.4 -8.2 -2.8 C-8.2 -7.2 -4.8 -11 0 -11 Z"
                        fill={active ? '#93c5fd' : '#60a5fa'}
                        stroke="#eff6ff"
                        strokeWidth={1.1}
                        filter="url(#pinGlow)"
                      />
                      <circle cy={-3.2} r={2.2} fill="#0b1220" opacity={0.85} />
                      <title>
                        {pin.companyName}
                        {pin.city ? ` · ${pin.city}` : ''} · score {pin.score}
                      </title>
                    </g>
                  );
                })}
              </svg>

              {hovered ? (
                <div className="pointer-events-none absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:max-w-[240px]">
                  <div className="rounded-control border border-white/15 bg-[#0c1018]/92 px-3 py-2 shadow-elevated backdrop-blur-md">
                    <p className="truncate text-sm font-medium text-zinc-50">{hovered.companyName}</p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {[hovered.city, `score ${hovered.score}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              ) : null}

              {projected.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#05070b]/55 px-4 text-center backdrop-blur-[1px]">
                  <MapPin className="h-5 w-5 text-brand-300" aria-hidden />
                  <p className="text-sm text-zinc-400">{t('dashboard.mapEmpty')}</p>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold tabular-nums tracking-tight text-zinc-50">
                    {projected.length}
                    <span className="ml-1 text-sm font-medium text-zinc-500">
                      {t('dashboard.mapMapped')}
                    </span>
                  </p>
                  <p className="text-xs text-zinc-500">
                    {t('dashboard.mapCities', { count: cityCount })}
                  </p>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={cn(
                    'dashboard-map-progress h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-300',
                    'shadow-[0_0_12px_rgb(96_165_250_/_0.45)]',
                  )}
                  style={{ width: `${coverage}%` }}
                />
              </div>
              {cities.slice(0, 4).some((c) => c.city) ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {cities
                    .filter((c) => c.city)
                    .slice(0, 4)
                    .map((c) => (
                      <span
                        key={c.city}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-zinc-400"
                      >
                        {c.city} · {c.count}
                      </span>
                    ))}
                </div>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
