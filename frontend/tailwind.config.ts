import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0d12",
        ember: "#ff6b3d",
        mint: "#10b981",
        sky: "#4f9cf9"
      },
      boxShadow: {
        glow: "0 0 40px rgba(255, 107, 61, 0.15)"
      }
    }
  },
  plugins: []
} satisfies Config;
