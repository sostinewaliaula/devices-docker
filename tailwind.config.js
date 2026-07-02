export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#D90429', // Red
        secondary: '#152F52', // Blue Tint
        white: '#FFFFFF',
        accent: '#F7E7C6', // Golden brown
        'brand-orange': '#E59730',
        'brand-green': '#D9E021',
        lightred: '#fbe6ea',
        lightblue: '#d0dceb',
        dark: '#222B2E',
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
        card: '0 4px 24px 0 rgba(34, 43, 46, 0.08)',
        button: '0 2px 8px 0 rgba(155, 81, 224, 0.15)',
      },
    },
  },
}