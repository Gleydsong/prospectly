/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Segue `html.dark` do ThemeProvider — não o prefers-color-scheme do SO.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f5fd',
          100: '#ecf0fe',
          200: '#d5dbf8',
          300: '#b0b6ec',
          400: '#8a90e0',
          500: '#676fd6',
          600: '#5b63c9',
          700: '#4a52b0',
          800: '#3a4190',
          900: '#2c326e',
          950: '#1c2048',
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
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        control: '10px',
        card: '12px',
        panel: '16px',
        bento: '16px',
      },
      boxShadow: {
        soft: 'var(--shadow-rest)',
        panel: 'var(--shadow-rest)',
        elevated: 'var(--shadow-rest)',
        fab: 'var(--shadow-fab)',
        'panel-light': 'var(--shadow-rest)',
      },
      spacing: {
        4.5: '1.125rem',
        sidebar: '13.75rem',
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
