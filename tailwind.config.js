/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'primary-fg': 'rgb(var(--color-primary-fg) / <alpha-value>)',
        'text-main': 'rgb(var(--color-text-main) / <alpha-value>)',
        'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
      }
    },
  },
  plugins: [],
};
