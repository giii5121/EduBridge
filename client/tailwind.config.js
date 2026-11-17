/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5faff',
          100: '#e5f2fe',
          200: '#d8e8f7',
          300: '#97ddf1',
          400: '#5cc3e8',
          500: '#3a81da',
          600: '#3e75f6',
          700: '#2a42a1',
          800: '#173b73',
          900: '#0f58b3',
        },
        accent: {
          success: '#42c6b0',
          warning: '#ffd45a',
          orange: '#ffb43a',
          danger: '#f56f9b',
          red: '#ec1f22',
          purple: '#8d7dcb',
        }
      },
      fontFamily: {
        fredoka: ['Fredoka', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'card': '0px 4px 4px 0px rgba(17, 110, 216, 0.25)',
        'card-soft': '0px 4px 4px 0px rgba(0, 0, 0, 0.25)',
      }
    },
  },
  plugins: [],
}
