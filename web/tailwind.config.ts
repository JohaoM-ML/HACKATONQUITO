import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ios: {
          bg: "#F8FAFC",
          card: "#FFFFFF",
          blue: "#1E3A8A",
          red: "#E5352B",
          orange: "#EAB308",
          green: "#16A34A",
          label: "#0F172A",
          "label-2": "#475569",
          "label-3": "#94A3B8",
          sep: "#E2E8F0",
          fill: "#E8ECF1",
          "fill-2": "#F1F4F8",
        },
        ec: {
          yellow: "#FFD100",
          blue: "#00247D",
          red: "#EF3340",
        },
        primary: {
          DEFAULT: "#1E3A8A",
          dark: "#16296B",
        },
        accent: {
          DEFAULT: "#A16207",
          dark: "#7C4A05",
        },
        risk: {
          alto: "#DC2626",
          "alto-bg": "#FCE8E7",
          medio: "#C2410C",
          "medio-bg": "#FCE9DD",
          bajo: "#16A34A",
          "bajo-bg": "#E4F6EA",
        },
      },
      fontFamily: {
        sans: ['"Source Sans 3"', "system-ui", "sans-serif"],
        heading: ["Lexend", "system-ui", "sans-serif"],
      },
      maxWidth: {
        phone: "390px",
      },
      minHeight: {
        tap: "48px",
      },
    },
  },
  plugins: [],
};
export default config;
