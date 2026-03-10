import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './stores/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        base: 'rgb(var(--color-base) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        panel: 'rgb(var(--color-panel) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        neon: 'rgb(var(--color-neon) / <alpha-value>)',
        ultraviolet: 'rgb(var(--color-ultraviolet) / <alpha-value>)',
        cyan: 'rgb(var(--color-cyan) / <alpha-value>)',
      },
      boxShadow: {
        neo: '0 22px 60px rgba(0, 0, 0, 0.45), inset 1px 1px 0 rgba(255,255,255,0.14), inset -14px -18px 28px rgba(3, 8, 20, 0.55)',
        glow: '0 0 0 1px rgba(110, 255, 193, 0.15), 0 0 32px rgba(110, 255, 193, 0.16), 0 24px 64px rgba(0, 0, 0, 0.45)',
      },
      backgroundImage: {
        'hero-radial':
          'radial-gradient(circle at top left, rgba(142,255,191,.18), transparent 28%), radial-gradient(circle at top right, rgba(128,89,255,.2), transparent 34%), linear-gradient(180deg, rgba(9,13,24,1), rgba(5,8,16,1))',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
    },
  },
  plugins: [],
}

export default config
