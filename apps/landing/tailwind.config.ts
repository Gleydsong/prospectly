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
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        shell: '1400px',
      },
      borderRadius: {
        control: '12px',
      },
      boxShadow: {
        soft: '0 18px 50px -28px rgb(24 24 27 / 0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
