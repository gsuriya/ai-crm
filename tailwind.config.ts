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
        background: "hsl(0, 0%, 100%)",
        foreground: "hsl(222, 47%, 11%)",
        primary: {
          DEFAULT: "hsl(230, 85%, 55%)",
          foreground: "hsl(0, 0%, 100%)",
        },
        secondary: {
          DEFAULT: "hsl(222, 47%, 11%)",
          foreground: "hsl(0, 0%, 100%)",
        },
        muted: {
          DEFAULT: "hsl(220, 14%, 96%)",
          foreground: "hsl(222, 12%, 40%)",
        },
        accent: {
          DEFAULT: "hsl(230, 85%, 55%)",
          foreground: "hsl(0, 0%, 100%)",
        },
        border: "hsl(220, 13%, 60%)",
        input: "hsl(220, 13%, 60%)",
        ring: "hsl(230, 85%, 55%)",
        destructive: {
          DEFAULT: "hsl(0, 84%, 60%)",
          foreground: "hsl(0, 0%, 100%)",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
    },
  },
  plugins: [],
};

export default config;

