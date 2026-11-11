import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        theme: {
          orange: "#FC4C00",
          gilt: "#D9A441",
          verdigris: "#2E6F64",
          black: "#000000",
          white: "#FFFFFF",
        },
        ink: "#050403",
        fog: "#F5EFE6",
        panel: "#0d0a07",
        steel: "#191411",
        accent: "#FC4C00",
        gilt: "#D9A441",
        verdigris: "#2E6F64",
        muted: "#d8d0c4",
        glass: "rgba(28,20,12,0.2)",
        ember: {
          950: "#1A0800",
          900: "#31100A",
          700: "#7A2504",
          500: "#C43A00",
          400: "#FC4C00",
          300: "#FF7A38",
          glow: "rgba(252,76,0,0.16)",
        },
        label: {
          verdigris: "#3E8A7C",
          gilt: "#D9A441",
          brick: "#C94F35",
          lavender: "#9C8AC9",
        },
      },
      fontFamily: {
        doto: ['"Doto"', "monospace"],
        metric: ['"Tektur"', "monospace"],
        mono: ['"IBM Plex Mono"', "monospace"],
        serif: ['"Lora"', "Georgia", "serif"],
        space: ['"Space Mono"', "monospace"],
      },
      maxWidth: {
        site: "1400px",
      },
      minHeight: {
        "nav-row": "10.5rem",
      },
      height: {
        "nav-row": "10.5rem",
      },
      boxShadow: {
        "nav-glass":
          "0 18px 60px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,236,214,0.24), inset 0 -1px 0 rgba(255,255,255,0.05)",
      },
      tracking: {
        section: "0em",
      },
    },
  },
};

export default config;
