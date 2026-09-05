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
        bg: "#F8FAFC",
        fg: "#020617",
        card: {
          DEFAULT: "#FFFFFF",
          fg: "#020617",
        },
        muted: {
          DEFAULT: "#E8ECF1",
          fg: "#475569",
        },
        border: {
          DEFAULT: "#E2E8F0",
        },
        // Flat keys so @apply resolves (text-primary-fg, etc.)
        "primary-fg": "#FFFFFF",
        "primary-dark": "#1E3A8A",
        "accent-fg": "#FFFFFF",
        "accent-dark": "#075985",
        "destructive-fg": "#FFFFFF",
        "muted-fg": "#475569",
        primary: {
          DEFAULT: "#1E40AF",
          dark: "#1E3A8A",
          fg: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#0369A1",
          dark: "#075985",
          fg: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#334155",
          fg: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "#DC2626",
          fg: "#FFFFFF",
        },
        ring: "#1E40AF",
        ec: {
          yellow: "#FFD100",
          blue: "#00247D",
          red: "#EF3340",
        },
        risk: {
          alto: "#DC2626",
          "alto-bg": "#FCE8E7",
          medio: "#CA8A04",
          "medio-bg": "#FEF3C7",
          bajo: "#16A34A",
          "bajo-bg": "#E4F6EA",
        },
        ios: {
          bg: "#F8FAFC",
          card: "#FFFFFF",
          blue: "#1E40AF",
          red: "#DC2626",
          orange: "#CA8A04",
          green: "#16A34A",
          label: "#020617",
          "label-2": "#475569",
          "label-3": "#94A3B8",
          sep: "#E2E8F0",
          fill: "#E8ECF1",
          "fill-2": "#F1F4F8",
        },
      },
      fontFamily: {
        sans: ["var(--font-atkinson)", "system-ui", "sans-serif"],
        heading: ["var(--font-atkinson)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
        xl: "8px",
        "2xl": "8px",
      },
      maxWidth: {
        phone: "480px",
        field: "560px",
      },
      minHeight: {
        tap: "48px",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
    },
  },
  plugins: [],
};
export default config;
