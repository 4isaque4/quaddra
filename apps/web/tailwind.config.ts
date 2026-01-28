import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { 
    extend: {
      colors: {
        'quaddra-orange': '#FF9933',
        'quaddra-dark': '#2C3E50',
        orange: {
          50: '#FFF5E6',
          100: '#FFE6CC',
          200: '#FFCC99',
          300: '#FFB366',
          400: '#FF9933', // Cor principal do logo
          500: '#FF9933', // Mantém compatibilidade
          600: '#E68A2E',
          700: '#CC7A29',
          800: '#B36A24',
          900: '#995B1F',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#2C3E50', // Cor do logo
          900: '#1f2937',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
