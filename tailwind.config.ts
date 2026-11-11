import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#050403",
        fog: "#F5EFE6",
        panel: "#0d0a07",
        accent: "#FC4C00",
        gilt: "#D9A441",
        verdigris: "#2E6F64",
        muted: "#d8d0c4",
        glass: "rgba(28,20,12,0.2)",
        label: {
          verdigris: "#3E8A7C",
          gilt: "#D9A441",
          brick: "#C94F35",
          lavender: "#9C8AC9",
        },
      },
      fontFamily: {
        doto: ['"Doto"', "monospace"],
        space: ['"Space Mono"', "monospace"],
      },
      boxShadow: {
        "nav-glass":
          "0 18px 60px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,236,214,0.24), inset 0 -1px 0 rgba(255,255,255,0.05)",
      },
    },
  },
};

export default config;
