/** @type {import('tailwindcss').Config} */
export default {
  // Purge / content: scan all JS/JSX files in /src for used classes
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],

  theme: {
    extend: {
      // Brand colors matching the README spec (#007bff primary)
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#007bff',   // exact brand blue
          600: '#0069d9',
          700: '#0056b3',
          800: '#004085',
          900: '#002752',
        },
        // Semantic status colors used across all four modules
        status: {
          good:     '#16a34a',  // green  — AQI 71-100 / Authentic
          fair:     '#ca8a04',  // yellow — AQI 41-70
          poor:     '#dc2626',  // red    — AQI 0-40 / Tampered
          info:     '#2563eb',  // blue   — informational cards
        },
      },

      // Custom font sizes for the large AQI / authenticity score displays
      fontSize: {
        '7xl': ['4.5rem',  { lineHeight: '1' }],
        '8xl': ['6rem',    { lineHeight: '1' }],
        '9xl': ['8rem',    { lineHeight: '1' }],
      },

      // Waveform / spectrogram container heights
      height: {
        'waveform':     '128px',
        'spectrogram':  '200px',
        'module-modal': 'calc(100vh - 4rem)',
      },

      // Smooth transitions used on cards and buttons throughout the app
      transitionDuration: {
        '250': '250ms',
        '400': '400ms',
      },

      // Box shadows for card depth (README: "Shadow on cards for depth")
      boxShadow: {
        'card':       '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 8px 24px rgba(0, 123, 255, 0.15)',
        'modal':      '0 20px 60px rgba(0, 0, 0, 0.20)',
      },

      // Animation for progress indicators and spinners
      animation: {
        'spin-slow':   'spin 2s linear infinite',
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':     'fadeIn 0.3s ease-in-out',
        'slide-up':    'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },

      // Border radius tokens for cards / modals
      borderRadius: {
        'card':  '12px',
        'modal': '16px',
      },
    },
  },

  plugins: [
    // Add @tailwindcss/forms if you install it later for styled range/toggle inputs
    // require('@tailwindcss/forms'),
  ],
}