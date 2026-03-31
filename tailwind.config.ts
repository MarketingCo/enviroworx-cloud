import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#059669', dark: '#047857', light: '#d1fae5' },
        warn: '#f59e0b',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
}
export default config
