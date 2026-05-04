/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#ece5d8',
        'paper-2': '#ddd4c2',
        'paper-3': '#c8bea8',
        ink: '#0e0d0a',
        'ink-2': '#1f1d18',
        'ink-soft': '#3a362e',
        pencil: '#6b665c',
        accent: 'var(--accent)',
        tape: '#f5e58a',
        'tape-2': '#c4d8c0',
        stamp: '#2a4ba0',
        // keep old names as aliases for other pages (landing, fuse)
        void: '#080808',
        obsidian: '#111111',
        iron: '#1a1a1a',
        steel: '#242424',
        ash: '#3a3a3a',
        smoke: '#666666',
        silver: '#999999',
        bone: '#cccccc',
        blood: '#cc2200',
        crimson: '#ff3311',
        ember: '#ff6633',
        gold: '#c8952a',
        amber: '#f0b840',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
        body: ['var(--font-body)', 'Courier New', 'monospace'],
        mono: ['var(--font-mono)', 'Courier New', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
        'flicker': 'flicker 2s step-start infinite',
        'slide-up': 'slideUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.6s ease-out',
        'waveform': 'waveform 1.2s ease-in-out infinite',
        'shake': 'shake .25s linear infinite',
      },
      keyframes: {
        flicker: {
          '0%, 95%, 100%': { opacity: '1' },
          '96%, 99%': { opacity: '0.4' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        waveform: {
          '0%, 100%': { transform: 'scaleY(0.2)' },
          '50%': { transform: 'scaleY(1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translate(0,0) rotate(0)' },
          '20%': { transform: 'translate(-2px, 1px) rotate(-.4deg)' },
          '40%': { transform: 'translate(2px, -1px) rotate(.3deg)' },
          '60%': { transform: 'translate(-1px, 2px) rotate(-.2deg)' },
          '80%': { transform: 'translate(1px, -2px) rotate(.2deg)' },
        },
      },
    },
  },
  plugins: [],
}
