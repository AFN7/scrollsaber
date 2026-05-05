import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: 'class',
  content: [
    './entrypoints/**/*.{ts,tsx,html}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        saber: {
          red: '#FF3B3B',
          blue: '#3B82F6',
          bg: '#0A0A0A',
          fg: '#E4E4E7',
        },
        border: 'hsl(240 6% 20%)',
        input: 'hsl(240 6% 18%)',
        ring: 'hsl(0 75% 60%)',
        background: 'hsl(240 10% 4%)',
        foreground: 'hsl(240 6% 95%)',
        primary: {
          DEFAULT: 'hsl(0 75% 60%)',
          foreground: 'hsl(240 10% 4%)',
        },
        secondary: {
          DEFAULT: 'hsl(240 6% 14%)',
          foreground: 'hsl(240 6% 95%)',
        },
        muted: {
          DEFAULT: 'hsl(240 6% 14%)',
          foreground: 'hsl(240 5% 65%)',
        },
        accent: {
          DEFAULT: 'hsl(240 6% 18%)',
          foreground: 'hsl(240 6% 95%)',
        },
        destructive: {
          DEFAULT: 'hsl(0 75% 50%)',
          foreground: 'hsl(240 6% 95%)',
        },
        card: {
          DEFAULT: 'hsl(240 10% 6%)',
          foreground: 'hsl(240 6% 95%)',
        },
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      keyframes: {
        'saber-ignite': {
          '0%': { transform: 'scaleX(0)', opacity: '0' },
          '20%': { opacity: '1' },
          '100%': { transform: 'scaleX(1)', opacity: '1' },
        },
        'saber-glow': {
          '0%, 100%': { boxShadow: '0 0 0 rgba(255,59,59,0)' },
          '50%': { boxShadow: '0 0 14px rgba(255,59,59,0.55)' },
        },
      },
      animation: {
        'saber-ignite': 'saber-ignite 1.4s ease-out forwards',
        'saber-glow': 'saber-glow 1.2s ease-in-out',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
