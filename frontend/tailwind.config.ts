import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // shadcn/ui HSL vars — mapped to the UjamaaDAO design system in globals.css
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },

        // ── Chai palette — warm earth design system ──────────────────
        "tea-green":    "#1D4731",
        "tea-dark":     "#142F22",
        "cream":        "#F7F2E8",
        "cream-dim":    "#EDE7DA",
        "amber":        "#D4911E",
        "amber-bright": "#E9A52E",
        "leaf":         "#38A063",
        "chai":         "#1A120B",
        "warm-gray":    "#7A6E60",

        // ── Legacy tokens kept for backward compat ────────────────────
        ink: {
          DEFAULT: "#1A120B",
          80: "rgba(26,18,11,0.8)",
          40: "rgba(26,18,11,0.4)",
          15: "rgba(26,18,11,0.15)",
          6:  "rgba(26,18,11,0.06)",
        },
        gold: {
          DEFAULT: "#D4911E",
          light:  "#E9A52E",
          pale:   "rgba(212,145,30,0.12)",
        },
        ember: {
          DEFAULT: "#C43D28",
          pale:    "rgba(196,61,40,0.1)",
        },
        forest: {
          DEFAULT: "#1D4731",
          mid:     "#38A063",
          pale:    "rgba(29,71,49,0.1)",
        },
        sand: {
          DEFAULT: "#F7F2E8",
          dark:    "#EDE7DA",
        },
        parchment: "#F7F2E8",
        sidebar:   "#1D4731",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans:    ["var(--font-outfit)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif:   ["var(--font-cormorant)", "ui-serif", "Georgia", "serif"],
        display: ["var(--font-cormorant)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        gold: "0 8px 32px rgba(212,145,30,0.2)",
        card: "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
}

export default config
