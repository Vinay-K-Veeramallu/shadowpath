import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      boxShadow: {
        card: "0 4px 6px -1px rgb(15 23 42 / 0.06), 0 10px 24px -6px rgb(15 23 42 / 0.08)",
        "card-hover": "0 8px 16px -4px rgb(15 23 42 / 0.08), 0 20px 40px -12px rgb(15 23 42 / 0.12)",
      },
    },
  },
  plugins: [
    plugin(function ({ addVariant }) {
      addVariant("hc", '[data-high-contrast="true"] &');
    }),
  ],
};
export default config;
