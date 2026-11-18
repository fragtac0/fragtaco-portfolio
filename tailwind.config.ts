import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ground)", // tokens.css
        fog: "#F5EFE6",
        panel: "var(--surface-1)",
        accent: "var(--accent)",
        gilt: "#D9A441",
        verdigris: "#2E6F64",
        muted: "#d8d0c4",
        glass: "rgb(var(--glass-rgb) / 0.2)",
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
        // The dock's lit edges, inside the glass only. It had a soft black drop shadow round it (0 18px 60px at 38%) until R56.4: over a thumbnail that passes
        // under the glass that read as a dark box behind the dock (the owner's note, 16 Nov), so nothing outside the glass is darker than it would be without it.
        "nav-glass": "inset 0 1px 0 rgba(255,236,214,0.24), inset 0 -1px 0 rgba(255,255,255,0.05)",
      },
    },
  },
};

export default config;
