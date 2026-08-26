/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#f3f5f8',
        foreground: '#2b3244',
        card: {
          DEFAULT: '#ffffff',
          foreground: '#2b3244',
        },
        popover: {
          DEFAULT: '#ffffff',
          foreground: '#2b3244',
        },
        primary: {
          DEFAULT: '#2f4a86',
          foreground: '#fcfcfd',
        },
        secondary: {
          DEFAULT: '#e8eaef',
          foreground: '#3a4256',
        },
        muted: {
          DEFAULT: '#edeef2',
          foreground: '#6c7288',
        },
        accent: {
          DEFAULT: '#e07d33',
          foreground: '#fdfdfd',
        },
        destructive: {
          DEFAULT: '#d92d20',
          foreground: '#fdfdfd',
        },
        border: '#dde0e7',
        input: '#dde0e7',
        ring: '#2f4a86',
        'chart-2': '#1f7a8c',
        'chart-4': '#3f9a5d',
      },
      fontFamily: {
        mono: ['monospace'],
      },
      borderRadius: {
        sm: '8px',
        md: '11px',
        lg: '14px',
        xl: '20px',
        '2xl': '25px',
        '3xl': '31px',
      },
    },
  },
  plugins: [],
}
