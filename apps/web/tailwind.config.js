/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cobalto da marca (mantido: já é a identidade oficial do Prospectly).
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Grafite premium. Substitui o zinc padrão para que toda a app herde as
        // novas superfícies sem reescrever classes página a página.
        zinc: {
          50: '#F1F2F4',
          100: '#E7EAEE',
          200: '#D3D8DF',
          300: '#B6BCC6',
          400: '#969DA8',
          500: '#7C8593',
          600: '#4A515C',
          700: '#2A2F38',
          800: '#20242B',
          900: '#15181D',
          950: '#090A0C',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        control: '14px',
        panel: '18px',
        bento: '22px',
      },
      boxShadow: {
        soft: '0 18px 50px -28px rgb(0 0 0 / 0.65)',
        panel: '0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 24px 60px -32px rgb(0 0 0 / 0.85)',
        elevated: '0 1px 0 0 rgb(255 255 255 / 0.06) inset, 0 32px 80px -36px rgb(0 0 0 / 0.9)',
      },
      backgroundImage: {
        'surface-sheen':
          'radial-gradient(120% 100% at 0% 0%, rgb(255 255 255 / 0.05) 0%, transparent 60%)',
        'accent-sheen':
          'radial-gradient(120% 100% at 0% 0%, rgb(59 130 246 / 0.16) 0%, transparent 62%)',
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
