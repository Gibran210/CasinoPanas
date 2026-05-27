/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          300: '#f9e189',
          400: '#f0c040',
          500: '#d4af37',
          600: '#b8960c',
        },
        felt: {
          DEFAULT: '#1a472a',
          dark:    '#0a2010',
          light:   '#2d6a4f',
        },
      },
      fontFamily: {
        serif:   ['"Georgia"', '"Times New Roman"', 'serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        gold:  '0 0 30px rgba(212,175,55,0.15)',
        felt:  '0 0 60px rgba(6,78,59,0.4)',
        card:  '0 4px 12px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}
