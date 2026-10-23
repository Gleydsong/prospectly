import { useId } from 'react';
import { cn } from '@/lib/utils';

export type GlossSphereVariant = 'azul' | 'sinal' | 'lima' | 'tinta';
export type GlossSphereSize = 'sm' | 'md' | 'lg' | 'xl';

export interface GlossSphereProps {
  variant?: GlossSphereVariant;
  size?: GlossSphereSize | number;
  className?: string;
}

const SIZE_MAP: Record<GlossSphereSize, number> = {
  sm: 18,
  md: 28,
  lg: 44,
  xl: 72,
};

interface SpherePalette {
  bodyHighlight: string;
  bodyBase: string;
  bodyShadow: string;
  bodyDeep: string;
  specularColor: string;
  bounceColor: string;
  shadowColor: string;
}

const PALETTES: Record<GlossSphereVariant, SpherePalette> = {
  azul: {
    bodyHighlight: '#7AB1FF',
    bodyBase: '#2563EB',
    bodyShadow: '#1D4ED8',
    bodyDeep: '#0B1220',
    specularColor: '#FFFFFF',
    bounceColor: '#B9D8EF',
    shadowColor: '#1E40AF',
  },
  sinal: {
    bodyHighlight: '#FFFFFF',
    bodyBase: '#B9D8EF',
    bodyShadow: '#709AC0',
    bodyDeep: '#3F6182',
    specularColor: '#FFFFFF',
    bounceColor: '#E0F0FE',
    shadowColor: '#263541',
  },
  lima: {
    bodyHighlight: '#F3FFB5',
    bodyBase: '#D4F56A',
    bodyShadow: '#96BA28',
    bodyDeep: '#4D660A',
    specularColor: '#FFFFFF',
    bounceColor: '#EDFDC2',
    shadowColor: '#364B04',
  },
  tinta: {
    bodyHighlight: '#3B4C63',
    bodyBase: '#172233',
    bodyShadow: '#0B1220',
    bodyDeep: '#03060B',
    specularColor: '#93BFFF',
    bounceColor: '#4C8DFF',
    shadowColor: '#000000',
  },
};

/**
 * GlossSphere — Esfera 3D volumétrica com brilho especular e luz refletida em puro SVG/CSS.
 * Suporta as 4 variantes definidas em 00-fundamentos.png: azul, sinal, lima e tinta.
 * Sempre renderizado com aria-hidden="true".
 */
export function GlossSphere({
  variant = 'azul',
  size = 'md',
  className,
}: GlossSphereProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9-_]/g, '');
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] ?? 28;
  const palette = PALETTES[variant] ?? PALETTES.azul;

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-testid="gloss-sphere"
      data-variant={variant}
      className={cn('inline-block shrink-0 select-none overflow-visible', className)}
    >
      <defs>
        {/* Sombra suave de contato */}
        <filter id={`${id}-shadow`} x="-20%" y="-10%" width="140%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor={palette.shadowColor} floodOpacity="0.35" />
        </filter>

        {/* Gradiente esférico principal */}
        <radialGradient
          id={`${id}-body`}
          cx="32%"
          cy="28%"
          r="68%"
          fx="32%"
          fy="28%"
        >
          <stop offset="0%" stopColor={palette.bodyHighlight} />
          <stop offset="35%" stopColor={palette.bodyBase} />
          <stop offset="75%" stopColor={palette.bodyShadow} />
          <stop offset="100%" stopColor={palette.bodyDeep} />
        </radialGradient>

        {/* Reflexo especular direto */}
        <radialGradient
          id={`${id}-specular`}
          cx="30%"
          cy="24%"
          r="30%"
          fx="30%"
          fy="24%"
        >
          <stop offset="0%" stopColor={palette.specularColor} stopOpacity="0.85" />
          <stop offset="45%" stopColor={palette.specularColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={palette.specularColor} stopOpacity="0" />
        </radialGradient>

        {/* Luz ambiente / bounce refletida na borda inferior oposta */}
        <radialGradient
          id={`${id}-bounce`}
          cx="70%"
          cy="80%"
          r="40%"
          fx="70%"
          fy="80%"
        >
          <stop offset="0%" stopColor={palette.bounceColor} stopOpacity="0.45" />
          <stop offset="100%" stopColor={palette.bounceColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      <g filter={`url(#${id}-shadow)`}>
        {/* Esfera base */}
        <circle cx="20" cy="20" r="17" fill={`url(#${id}-body)`} />

        {/* Luz refletida ambiente */}
        <circle cx="20" cy="20" r="17" fill={`url(#${id}-bounce)`} />

        {/* Reflexo especular pontual */}
        <ellipse cx="15" cy="14" rx="6" ry="4" transform="rotate(-25 15 14)" fill={`url(#${id}-specular)`} />
      </g>
    </svg>
  );
}
