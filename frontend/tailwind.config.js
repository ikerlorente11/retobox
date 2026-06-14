/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      colors: {
        neon: {
          purple: '#a855f7',
          pink: '#ec4899',
          cyan: '#22d3ee',
        },
        ink: {
          900: '#0b0614',
          800: '#130a23',
          700: '#1c1033',
        },
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(168, 85, 247, 0.6)',
        'glow-pink': '0 0 40px -8px rgba(236, 72, 153, 0.55)',
        'glow-cyan': '0 0 40px -8px rgba(34, 211, 238, 0.5)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      backgroundImage: {
        'neon-gradient':
          'linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #22d3ee 100%)',
      },
      keyframes: {
        'float-slow': {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
      animation: {
        'float-slow': 'float-slow 6s ease-in-out infinite',
        shimmer: 'shimmer 3s linear infinite',
      },
    },
  },
  plugins: [],
}
