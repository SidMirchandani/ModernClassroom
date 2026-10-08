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
        // Poppins and nothing else — `display` and `mono` point at it too, so
        // no class anywhere can quietly bring a second typeface back.
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // Nothing heavier than medium. Poppins at 600–700 reads chunky at every
      // size this app uses, so the heavy names are mapped down here, once,
      // rather than hunted out of every component — `font-bold` and
      // `font-semibold` are both 500. Only 400 and 500 are loaded at all.
      fontWeight: {
        semibold: "500",
        bold: "500",
        extrabold: "500",
        black: "500",
      },
      colors: {
        // The house blue, fixed. `primary` moves with the class you are in, so
        // the colour picker needs one swatch that cannot move with it.
        brand: "#2563ea",
        // Channels, not hexes: every `primary` utility resolves through a CSS
        // variable, so a class page can re-point the whole brand ramp at the
        // colour its teacher picked. The blue values live in globals.css.
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          dark: "rgb(var(--primary-dark) / <alpha-value>)",
          glow: "rgb(var(--primary-glow) / <alpha-value>)",
          light: "rgb(var(--primary-light) / <alpha-value>)",
          50: "rgb(var(--primary-50) / <alpha-value>)",
          100: "rgb(var(--primary-100) / <alpha-value>)",
          200: "rgb(var(--primary-200) / <alpha-value>)",
          300: "rgb(var(--primary-300) / <alpha-value>)",
          400: "rgb(var(--primary-400) / <alpha-value>)",
          500: "rgb(var(--primary-500) / <alpha-value>)",
          600: "rgb(var(--primary-600) / <alpha-value>)",
          700: "rgb(var(--primary-700) / <alpha-value>)",
          800: "rgb(var(--primary-800) / <alpha-value>)",
          900: "rgb(var(--primary-900) / <alpha-value>)",
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
