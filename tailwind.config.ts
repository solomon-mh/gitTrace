import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Semantic health colors used across dashboard cards.
        ok: "#16a34a",
        warn: "#d97706",
        danger: "#dc2626",
      },
    },
  },
  plugins: [],
};

export default config;
