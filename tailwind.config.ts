import type { Config } from "tailwindcss";

/**
 * Open* house theme: one brand blue, a fixed radius scale, and the z-shadow
 * depth system. Elevation is chosen by an element's role, never ad-hoc.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    // Status chips and per-resource palettes live in plain .ts modules — without
    // this they are silently dropped from the build and render unstyled.
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-eb-garamond)", "Georgia", "serif"],
        serif: ["var(--font-eb-garamond)", "Georgia", "serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#2563ea",
          dark: "#1d4fc4",
          glow: "#7aa8f5",
          light: "#eaf1fe",
          50: "#f2f6fe",
          100: "#dbe8fd",
          200: "#bfd4fb",
          300: "#93b7f8",
          400: "#5b8ef1",
          500: "#3a75ee",
          600: "#2563ea",
          700: "#1d4fc4",
          800: "#1a409c",
          900: "#16306f",
        },
      },
      borderRadius: {
        lg: "0.625rem",
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        z1: "0 1px 3px rgba(11,31,65,.07), 0 3px 8px rgba(11,31,65,.06)",
        z2: "0 2px 6px rgba(11,31,65,.11), 0 4px 14px rgba(11,31,65,.08)",
        z3: "0 4px 14px rgba(11,31,65,.14), 0 8px 26px rgba(11,31,65,.09)",
        z4: "0 4px 12px rgba(0,48,135,.30), 0 2px 5px rgba(0,48,135,.16)",
        "z4-hover": "0 8px 26px rgba(0,48,135,.36), 0 3px 8px rgba(0,48,135,.20)",
        z5: "0 8px 32px rgba(11,31,65,.17), 0 4px 12px rgba(11,31,65,.09)",
      },
      keyframes: {
        "content-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "content-in": "content-in .2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
