const flowbiteReact = require("flowbite-react/plugin/tailwindcss");
const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/flowbite/**/*.js",
    "./node_modules/flowbite-react/lib/**/*.js",
    ".flowbite-react/class-list.json"
  ],
  darkMode: 'class',
  theme: {
    // Override default rem-based spacing with px to isolate from external rem settings
    spacing: Object.fromEntries(
      Object.entries(defaultTheme.spacing).map(([key, value]) => {
        if (typeof value === 'string' && value.endsWith('rem')) {
          const num = parseFloat(value);
          return [key, `${num * 16}px`];
        }
        return [key, value];
      })
    ),
    // Override default rem-based font sizes with px
    fontSize: Object.fromEntries(
      Object.entries(defaultTheme.fontSize).map(([key, value]) => {
        const arr = Array.isArray(value) ? value : [value];
        const size = arr[0];
        if (typeof size === 'string' && size.endsWith('rem')) {
          const num = parseFloat(size);
          const pxSize = `${num * 16}px`;
          return arr.length === 2
            ? [key, [pxSize, arr[1]]]
            : [key, pxSize];
        }
        return [key, value];
      })
    ),
    extend: {
      fontFamily: {
        'sans': ['Nunito Sans', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
      },
      fontWeight: {
        'light': '300',
        'normal': '400',
        'medium': '500',
        'semibold': '600',
        'bold': '700',
        'extrabold': '800',
        'black': '900',
      },
      colors: {
        'brand': {
          'light': '#f4f4f4',
          'dark': '#011326',
          'accent': '#f2da21'
        },
        'primary': {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#011326',
          800: '#011326',
          900: '#011326',
        }
      },
      backgroundColor: {
        'light': '#f4f4f4',
        'dark': '#011326',
      }
    },
  },
  plugins: [require('flowbite/plugin'), flowbiteReact],
} 