import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        border: 'var(--border)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        accentFg: 'var(--accent-fg)',
        accentSoft: 'var(--accent-soft)',
        overdueFg: 'var(--overdue-fg)',
        overdueBg: 'var(--overdue-bg)',
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(16 24 40 / 0.04), 0 8px 24px -6px rgb(16 24 40 / 0.08)',
        card: '0 1px 3px 0 rgb(16 24 40 / 0.06), 0 12px 32px -8px rgb(16 24 40 / 0.10)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Pretendard',
          'Apple SD Gothic Neo',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
