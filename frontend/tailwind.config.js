/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'tata-bg': '#f4f4f4',
        'worker-bg': '#f6f1e7',
        'worker-blue': '#26457d',
      },
      boxShadow: {
        'neumorph-outer': '-12px -12px 12px 0 rgba(255, 255, 255, 0.6), 12px 12px 12px 0 rgba(0, 0, 0, 0.03)',
        'neumorph-inner': 'inset -8px -8px 12px 0 rgba(255, 255, 255, 0.65), inset 8px 8px 12px 0 rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
}
