/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        primary: '#8b5cf6',
        secondary: '#6366f1',
        background: '#0a0a0f',
      },
      animation: {
        'pop-in': 'popIn 0.2s ease-out',
        'bounce-dot': 'bounceDot 1.2s ease-in-out infinite',
      },
      keyframes: {
        popIn: {
          '0%':   { opacity: '0', transform: 'scale(0.95) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        bounceDot: {
          '0%, 80%, 100%': { transform: 'translateY(0)' },
          '40%':           { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
}
