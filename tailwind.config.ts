import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        uec: {
          bg: "#0B1020",
          surface: "#111827",
          elevated: "#172033",
          border: "#1F2937",
          borderLight: "#27354F",
          red: "#D62839",
          redHover: "#B91C1C",
          blue: "#2563EB",
          blueHover: "#1D4ED8",
          cyan: "#22D3EE",
          text: "#F8FAFC",
          muted: "#94A3B8",
          gold: "#F59E0B",
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        arabic: ["var(--font-cairo)", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-subtle": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
