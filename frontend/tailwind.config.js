/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      colors: {
        // customGray: '#e5e7eb',
        customBlue: "#3b82f6",
        primary: "#3b82f6",
        stroke: "#eeeff1",
        black: "#444",
        green: "#1b743c",
        danger: "#e11d48",
        yellow: "#a16207",
        midgray: "#949494",
        lightgray: "#eee",
        lightBlue: "#eff6ff",
        lightPrimary: "#dbeafe",
      },
    },
  },
  plugins: [],
};
