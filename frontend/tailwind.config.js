/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    { pattern: /bg-(blue|emerald|violet|amber|pink|rose|slate|primary|dark|surface|background)-(50|100|200|300|400|500|600|700|800|900)/ },
    { pattern: /text-(blue|emerald|violet|amber|pink|rose|slate|primary|dark|surface|background)-(50|100|200|300|400|500|600|700|800|900)/ },
    { pattern: /border-(blue|emerald|violet|amber|pink|rose|slate|primary|dark|surface|background)-(50|100|200|300|400|500|600|700|800|900)/ },
  ],
  theme: {
    extend: {
      colors: {
        background: "#F7F9FC",
        surface: "#FFFFFF",
        borderSoft: "#E2E8F0",
        primary: {
          DEFAULT: "#0E2D7B",
          50: '#F0F4FA',
          100: '#DCE5F3',
          200: '#B8CBDF',
          300: '#94B2CC',
          400: '#7098B8',
          500: '#4C7EA5',
          600: '#2A5D8A',
          700: '#1A4373',
          800: '#0E2D7B', // Brand Blue
          900: '#07184A',
        },
        dark: {
          DEFAULT: '#0f172a',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        success: "#10B981", // More modern green
        action: "#0E2D7B",
        textMain: "#1E293B", // Darker slate for readability
        textMuted: "#64748B",
      },
      boxShadow: {
        glass: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        card: '0 2px 10px rgba(0,0,0,0.05)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
