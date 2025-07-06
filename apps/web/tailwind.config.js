/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'vibe-primary': '#1e293b',
        'vibe-secondary': '#0f172a',
        'vibe-accent': '#00ff00',
        'vibe-success': '#22c55e',
        'vibe-warning': '#eab308',
        'vibe-error': '#ef4444',
        'vibe-info': '#3b82f6',
      },
      fontFamily: {
        'mono': ['Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
      backdropBlur: {
        'xs': '2px',
      },
      screens: {
        'xs': '475px',
      },
    },
  },
  plugins: [],
};