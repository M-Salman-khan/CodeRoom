import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        "surface-hover": "var(--surface-hover)",
        panel: "var(--panel)",
        "panel-header": "var(--panel-header)",
        border: "var(--border)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        success: "var(--success)",
      },
    },
  },
  plugins: [],
};
export default config;
