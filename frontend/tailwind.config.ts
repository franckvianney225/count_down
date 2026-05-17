import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      keyframes: {
        pulseSlow: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
        zoomOnce: {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '30%': { transform: 'scale(1.2)', opacity: '1' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        finalZoom: {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '100%': { transform: 'scale(1.5)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(60px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(60px)', opacity: '0' },
        },
      },
      animation: {
        'pulse-slow': 'pulseSlow 3s ease-in-out infinite',
        'zoom-once': 'zoomOnce 1s ease-out forwards',
        'final-zoom': 'finalZoom 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-in forwards',
      },
    },
  },
  plugins: [],
};

export default config;
