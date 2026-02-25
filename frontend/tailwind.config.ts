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
        // Raw design tokens — use when you need exact control
        ink: {
          DEFAULT: "#0E0B08",
          80: "rgba(14,11,8,0.8)",
          40: "rgba(14,11,8,0.4)",
          15: "rgba(14,11,8,0.15)",
          6:  "rgba(14,11,8,0.06)",
        },
        gold: {
          DEFAULT: "#C9922A",
          light: "#E8B84B",
          pale: "rgba(201,146,42,0.12)",
        },
        ember: {
          DEFAULT: "#B03A1E",
          pale: "rgba(176,58,30,0.1)",
        },
        forest: {
          DEFAULT: "#1E3D2F",
          mid: "#2A5240",
          pale: "rgba(30,61,47,0.1)",
        },
        sand: {
          DEFAULT: "#F6F0E6",
          dark: "#EDE5D4",
        },
        parchment: "#FAF7F2",
        sidebar: "#0E0B08",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans:    ["var(--font-outfit)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-cormorant)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        gold: "0 8px 32px rgba(201,146,42,0.2)",
        card: "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
}

export default config
