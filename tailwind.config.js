/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans', 'sans-serif'],
        heading: ['Lexend Deca', 'sans-serif'],
        logo: ['Funnel Display', 'sans-serif'],
      },
      colors: {
        stone: {
          50: '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
        },
        clay: {
          50: '#FFF8F6',
          100: '#FFEADD',
          200: '#FFD5C0',
          300: '#FDBA9F',
          400: '#F0906F',
          500: '#D97757', // Primary Clay
          600: '#C25D3C',
          700: '#9F462A',
          800: '#833923',
          900: '#4A1D11',
        }
      }
    }
  },
  plugins: [],
}
