import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'media',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#18181b',
          muted: '#52525b',
          soft: '#71717a',
        },
        surface: {
          DEFAULT: '#fafafa',
          raised: '#ffffff',
          sunken: '#f4f4f5',
        },
        accent: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          soft: '#dbeafe',
          ink: '#1e3a8a',
        },
        // Mesma escala cobalto do app, para que CTAs sejam idênticos nos dois produtos.
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
        // Grafite premium usado no esquema escuro, espelhando o app.
        graphite: {
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
        sans: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        shell: '1400px',
      },
      borderRadius: {
        control: '14px',
        panel: '18px',
        bento: '22px',
      },
      boxShadow: {
        soft: '0 18px 50px -28px rgb(24 24 27 / 0.35)',
        panel: '0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 24px 60px -32px rgb(9 10 12 / 0.55)',
        elevated: '0 1px 0 0 rgb(255 255 255 / 0.06) inset, 0 32px 80px -36px rgb(9 10 12 / 0.7)',
      },
    },
  },
  plugins: [],
};

export default config;
