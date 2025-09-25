/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}',
    './index.html',
  ],
  theme: {
    extend: {
      colors: {
        // Madden-inspired dark theme colors
        madden: {
          dark: '#0a0a0a',
          darker: '#000000',
          gray: '#1a1a1a',
          'gray-light': '#2a2a2a',
          blue: '#0066cc',
          'blue-light': '#3399ff',
          orange: '#ff6600',
          'orange-light': '#ff9933',
          green: '#00cc66',
          red: '#cc0000',
          gold: '#ffcc00',
        },
        // NFL team color palette
        nfl: {
          'bears-navy': '#0b162a',
          'bears-orange': '#c83803',
          'patriots-navy': '#002244',
          'patriots-red': '#c60c30',
          'steelers-black': '#000000',
          'steelers-gold': '#ffb612',
          'cowboys-navy': '#041e42',
          'cowboys-silver': '#869397',
        }
      },
      fontFamily: {
        'sport': ['Arial Black', 'Arial', 'sans-serif'],
        'mono': ['Consolas', 'Monaco', 'monospace'],
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
      },
      spacing: {
        '72': '18rem',
        '84': '21rem',
        '96': '24rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      boxShadow: {
        'glow': '0 0 20px rgba(51, 153, 255, 0.5)',
        'glow-orange': '0 0 20px rgba(255, 102, 0, 0.5)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};