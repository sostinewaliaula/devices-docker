// Theme-aware colours are CSS variables (see src/index.css) so a single class
// like `text-heading` or `bg-surface` flips between light and dark on its own.
const themed = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Company palette (fixed) ──────────────────────────────────────
        primary: '#D90429',        // Red        — actions, alerts, emphasis
        secondary: '#152F52',      // Blue Tint  — brand base, headings (light)
        white: '#FFFFFF',
        accent: '#F7E7C6',         // Golden brown — headings/actions (dark), soft fills (light)
        'brand-orange': '#E59730', // Orange     — warnings, highlights
        'brand-green': '#D9E021',  // Green      — success accents, positive chips
        dark: '#0B1626',

        // ── Theme-aware tokens (flip with .dark) ─────────────────────────
        page: themed('page'),              // app background
        surface: themed('surface'),        // cards, panels, dropdowns
        'surface-2': themed('surface-2'),  // inputs, hover fills, table headers
        line: themed('line'),              // borders, dividers
        heading: themed('heading'),        // headings: navy / golden brown
        content: themed('content'),        // body text
        muted: themed('muted'),            // secondary text
        action: themed('action'),          // primary neutral button: navy / golden brown
        'on-action': themed('on-action'),  // text on `action`
        lightred: themed('lightred'),      // soft red tint fill
        lightblue: themed('lightblue'),    // soft navy tint fill

        // Neutral scale tinted toward the brand navy, so every existing
        // `gray-*` / `dark:*-gray-*` class picks up the palette automatically.
        gray: {
          50: '#F6F8FB',
          100: '#EDF1F6',
          200: '#DCE3ED',
          300: '#C0CBDA',
          400: '#8C9BB2',
          500: '#63758F',
          600: '#46566F',
          700: '#2E3F5A',
          800: '#1B2E4A',
          900: '#122238',
          950: '#0B1626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1.25rem',
        '2xl': '1.5rem',
        '4xl': '2.5rem',
      },
      boxShadow: {
        card: '0 4px 24px 0 rgba(21, 47, 82, 0.08)',
        button: '0 2px 8px 0 rgba(217, 4, 41, 0.15)',
      },
    },
  },
}
