/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'game-bg': '#0f0f1a',
        'game-card': '#1a1a2e',
        'game-accent': '#6366f1',
        'game-success': '#10b981',
        'game-danger': '#ef4444',
        'game-warning': '#f59e0b',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounce 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
