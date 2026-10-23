import { useId } from 'react';
import { cn } from '@/lib/utils';

export type SignalRingSize = 'sm' | 'md' | 'lg' | 'xl';

export interface SignalRingProps {
  size?: SignalRingSize | number;
  glow?: boolean;
  className?: string;
}

const SIZE_MAP: Record<SignalRingSize, number> = {
  sm: 48,
  md: 80,
  lg: 120,
  xl: 180,
};

/**
 * SignalRing — Primitivo 3D volumétrico em puro SVG/CSS do sinal de oportunidade.
 * Inspirado nas referências 00-fundamentos.png e 02-app-inicio.png.
 * Sempre renderizado com aria-hidden="true".
 */
export function SignalRing({ size = 'md', glow = false, className }: SignalRingProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9-_]/g, '');
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] ?? 80;

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-testid="signal-ring"
      className={cn('inline-block shrink-0 select-none overflow-visible', className)}
    >
      <defs>
        {/* Gradiente principal do anel volumétrico */}
        <linearGradient id={`${id}-body`} x1="25" y1="15" x2="105" y2="105" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4C8DFF" />
          <stop offset="35%" stopColor="#2563EB" />
          <stop offset="70%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#0B1220" />
        </linearGradient>

        {/* Gradiente da borda externa chanfrada com reflexo */}
        <linearGradient id={`${id}-outer-bevel`} x1="10" y1="10" x2="110" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B9D8EF" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#4C8DFF" stopOpacity="0.6" />
          <stop offset="80%" stopColor="#2563EB" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#709AC0" stopOpacity="0.5" />
        </linearGradient>

        {/* Gradiente interno do chanfro da abertura */}
        <linearGradient id={`${id}-inner-bevel`} x1="30" y1="30" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0B1220" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#1E40AF" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#B9D8EF" stopOpacity="0.8" />
        </linearGradient>

        {/* Reflexo especular superior */}
        <radialGradient id={`${id}-specular`} cx="60" cy="22" r="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
          <stop offset="50%" stopColor="#B9D8EF" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#4C8DFF" stopOpacity="0" />
        </radialGradient>

        {/* Filtro de brilho 3D / sombra suave */}
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="150%" filterUnits="userSpaceOnUse">
          <feDropShadow
            dx="0"
            dy="8"
            stdDeviation={glow ? '10' : '6'}
            floodColor={glow ? '#4C8DFF' : '#0B1220'}
            floodOpacity={glow ? '0.45' : '0.25'}
          />
        </filter>
      </defs>

      <g filter={`url(#${id}-shadow)`}>
        {/* Corpo principal do anel (outer 50, inner 28) */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M 60 10 A 50 50 0 1 0 60 110 A 50 50 0 1 0 60 10 Z M 60 32 A 28 28 0 1 1 60 88 A 28 28 0 1 1 60 32 Z"
          fill={`url(#${id}-body)`}
        />

        {/* Borda externa com reflexo e luz */}
        <circle cx="60" cy="60" r="49.5" stroke={`url(#${id}-outer-bevel)`} strokeWidth="1" />

        {/* Chanfro interno com contraste */}
        <circle cx="60" cy="60" r="28.5" stroke={`url(#${id}-inner-bevel)`} strokeWidth="1.5" />

        {/* Realce especular em arco superior */}
        <path
          d="M 28 40 C 35 24 46 16 60 16 C 74 16 85 24 92 40"
          stroke={`url(#${id}-specular)`}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.85"
        />

        {/* Segundo anel concêntrico sutil para profundidade de ranhura */}
        <circle
          cx="60"
          cy="60"
          r="41"
          stroke="#709AC0"
          strokeWidth="0.75"
          strokeDasharray="2 3"
          opacity="0.4"
        />
      </g>
    </svg>
  );
}
