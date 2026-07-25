/** Prospectly brand tokens — aligned with landing zinc + cobalt identity. */
export const COLORS = {
  ink: '#09090b',
  zinc950: '#09090b',
  zinc900: '#18181b',
  zinc800: '#27272a',
  zinc700: '#3f3f46',
  zinc400: '#a1a1aa',
  zinc300: '#d4d4d8',
  zinc100: '#f4f4f5',
  zinc50: '#fafafa',
  white: '#ffffff',
  /** @deprecated Prefer blue* / accent*; kept for existing scene call sites. */
  emerald400: '#60a5fa',
  emerald500: '#3b82f6',
  emerald600: '#2563eb',
  blue400: '#60a5fa',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  glowEmerald: 'rgba(37, 99, 235, 0.35)',
  glowBlue: 'rgba(37, 99, 235, 0.35)',
  glowSoft: 'rgba(255, 255, 255, 0.08)',
  browserChrome: '#1c1c1e',
  browserBar: '#2c2c2e',
  calloutBg: 'rgba(9, 9, 11, 0.88)',
  calloutBorder: 'rgba(96, 165, 250, 0.55)',
} as const;

export const FONTS = {
  sans: '"Inter", "SF Pro Display", system-ui, -apple-system, sans-serif',
  display: '"Inter", "SF Pro Display", system-ui, -apple-system, sans-serif',
} as const;

export const TYPOGRAPHY = {
  hero: 92,
  headline: 64,
  supporting: 36,
  callout: 28,
  label: 22,
  cta: 40,
  url: 32,
} as const;

export const PRODUCT = {
  name: 'Prospectly',
  tagline: 'Prospecção local para agências',
  url: 'prospectly.dev',
  cta: 'Comece com 3 buscas grátis',
} as const;
