import type { Config } from 'tailwindcss';
import { colors, typography } from './lib/design-tokens';

const config: Config = {
  darkMode: 'class', // Core is dark-mode only; the class is set once in the root layout and never toggled
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: colors.bg,
        ink: colors.ink,
        amber: colors.amber,
        indigo: colors.indigo,
        signal: colors.signal,
      },
      fontFamily: {
        display: typography.display.split(',').map((f) => f.trim()),
        body: typography.body.split(',').map((f) => f.trim()),
        mono: typography.mono.split(',').map((f) => f.trim()),
      },
      borderRadius: {
        squircle: '28%', // the logo/frame silhouette — used sparingly, not as a generic card radius
      },
      keyframes: {
        'core-pulse': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
      },
      animation: {
        'core-pulse': 'core-pulse 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('tailwindcss-rtl'), // enables ps-/pe-/ms-/me- logical properties for Arabic RTL
  ],
};

export default config;
