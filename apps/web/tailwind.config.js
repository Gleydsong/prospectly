/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Segue `html.dark` do ThemeProvider — não o prefers-color-scheme do SO.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tinta: '#0B1220',
        grafite: '#263541',
        eletrico: '#4C8DFF',
        sinal: {
          DEFAULT: '#B9D8EF',
          profundo: '#709AC0',
        },
        lima: '#D4F56A',
        papel: '#F3F5F7',
        linha: '#DCE3EA',
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#b9d8ef',
          400: '#4c8dff',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#172554',
          950: '#0b1220',
        },
        zinc: {
          50: 'rgb(var(--zinc-50) / <alpha-value>)',
          100: 'rgb(var(--zinc-100) / <alpha-value>)',
          200: 'rgb(var(--zinc-200) / <alpha-value>)',
          300: 'rgb(var(--zinc-300) / <alpha-value>)',
          400: 'rgb(var(--zinc-400) / <alpha-value>)',
          500: 'rgb(var(--zinc-500) / <alpha-value>)',
          600: 'rgb(var(--zinc-600) / <alpha-value>)',
          700: 'rgb(var(--zinc-700) / <alpha-value>)',
          800: 'rgb(var(--zinc-800) / <alpha-value>)',
          900: 'rgb(var(--zinc-900) / <alpha-value>)',
          950: 'rgb(var(--zinc-950) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        display: '-0.04em',
        title: '-0.02em',
        'mono-label': '0.12em',
      },
      borderRadius: {
        control: '12px',
        card: '20px',
        panel: '28px',
        bento: '20px',
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgb(11 18 32 / 0.05), 0 8px 24px -4px rgb(11 18 32 / 0.08)',
        panel: '0 2px 8px -2px rgb(11 18 32 / 0.05), 0 8px 24px -4px rgb(11 18 32 / 0.08)',
        elevated: '0 4px 16px -4px rgb(11 18 32 / 0.08), 0 16px 32px -8px rgb(11 18 32 / 0.12)',
        fab: '0 8px 20px -8px rgb(37 99 235 / 0.4)',
        'panel-light': '0 2px 8px -2px rgb(11 18 32 / 0.05), 0 8px 24px -4px rgb(11 18 32 / 0.08)',
        'glow-eletrico': '0 0 24px -4px rgba(76, 141, 255, 0.45)',
      },
      spacing: {
        4.5: '1.125rem',
        sidebar: '15rem',
      },
      keyframes: {
        'fade-rise': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-rise': 'fade-rise 220ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
    },
  },
  plugins: [],
};
