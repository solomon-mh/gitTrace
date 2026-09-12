import type { Config } from "tailwindcss";

/**
 * gitTrace uses a semantic colour system (not raw slate/gray classes) so the
 * whole app is themed from one place. Tokens are defined as space-separated RGB
 * channels in globals.css, which lets Tailwind's `/opacity` modifier work
 * (e.g. `bg-danger/10`). gitTrace ships dark by default; `:root.light` in
 * globals.css swaps every token.
 */
const withAlpha = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: "var(--font-sans-stack)",
        display: "var(--font-display-stack)",
        mono: "var(--font-mono-stack)",
      },
      colors: {
        canvas: withAlpha("--canvas"), // page background
        surface: withAlpha("--surface"), // card background
        "surface-2": withAlpha("--surface-2"), // raised: tiles, headers, chips
        border: withAlpha("--border-color"),
        ink: withAlpha("--ink"), // primary text
        "ink-muted": withAlpha("--ink-muted"), // secondary text
        "ink-subtle": withAlpha("--ink-subtle"), // labels, timestamps
        accent: withAlpha("--accent"), // links, primary buttons
        "accent-hover": withAlpha("--accent-hover"),
        ok: withAlpha("--ok"),
        warn: withAlpha("--warn"),
        danger: withAlpha("--danger"),
      },
    },
  },
  plugins: [],
};

export default config;
