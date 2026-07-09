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
      },
      maxWidth: {
        site: "1400px",
      },
      minHeight: {
        "screen-nav": "calc(100dvh - var(--site-nav-height, 61px))",
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
      keyframes: {
        "cut-reveal": {
          "0%": {
            opacity: "0",
            transform: "translate3d(0,34px,0)",
            clipPath: "inset(0 0 100% 0)",
          },
          "60%": {
            opacity: "1",
            clipPath: "inset(0 0 0% 0)",
          },
          "100%": {
            opacity: "1",
            transform: "translate3d(0,0,0)",
            clipPath: "inset(0 0 0% 0)",
          },
        },
        "reach-pulse": {
          "0%, 100%": { opacity: "0.22", transform: "scale(0.98)" },
          "50%": { opacity: "0.55", transform: "scale(1.03)" },
        },
        "reach-sweep": {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" },
        },
        "glass-breathe": {
          "0%, 100%": {
            boxShadow:
              "0 24px 90px rgba(0,0,0,0.24), 0 0 34px rgba(252,76,0,0.08), inset 0 1px 0 rgba(255,236,214,0.10)",
          },
          "42%": {
            boxShadow:
              "0 30px 108px rgba(0,0,0,0.30), 0 0 46px rgba(252,76,0,0.13), inset 0 1px 0 rgba(255,236,214,0.14)",
          },
          "70%": {
            boxShadow:
              "0 34px 124px rgba(0,0,0,0.33), 0 0 60px rgba(217,164,65,0.14), inset 0 1px 0 rgba(255,236,214,0.16)",
          },
        },
        "glass-sheen": {
          "0%": { opacity: "0", transform: "translateX(-150%) skewX(-14deg)" },
          "18%": { opacity: "0" },
          "45%": { opacity: "1" },
          "74%": { opacity: "0.2" },
          "100%": { opacity: "0", transform: "translateX(170%) skewX(-14deg)" },
        },
        "ken-burns": {
          "0%": { transform: "scale(1.06) translate3d(0,0,0)" },
          "50%": { transform: "scale(1.13) translate3d(-1.4%,0.8%,0)" },
          "100%": { transform: "scale(1.06) translate3d(0,0,0)" },
        },
        "rec-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.18" },
        },
        "gate-weave": {
          "0%, 100%": { opacity: "0.5", transform: "translateY(0)" },
          "50%": { opacity: "0.9", transform: "translateY(-6px)" },
        },
        "stack-marquee": {
          "0%": { transform: "translate3d(0,0,0)" },
          "100%": { transform: "translate3d(-50%,0,0)" },
        },
        "ember-drift-a": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(6%,4%,0) scale(1.08)" },
        },
        "ember-drift-b": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(-5%,-6%,0) scale(1.05)" },
        },
        "ember-pulse-c": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.5" },
          "50%": { transform: "scale(1.12)", opacity: "0.7" },
        },
      },
      animation: {
        "cut-reveal": "cut-reveal 850ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "reach-pulse": "reach-pulse 7.2s ease-in-out infinite",
        "reach-sweep": "reach-sweep 4.4s cubic-bezier(0.16, 1, 0.3, 1) infinite",
        "glass-breathe": "glass-breathe 12s cubic-bezier(0.45, 0, 0.2, 1) infinite",
        "glass-sheen": "glass-sheen 8.6s cubic-bezier(0.45, 0, 0.2, 1) infinite",
        "ken-burns": "ken-burns 34s ease-in-out infinite",
        "rec-blink": "rec-blink 1.6s steps(1, end) infinite",
        "gate-weave": "gate-weave 9s ease-in-out infinite",
        "stack-marquee": "stack-marquee 26s linear infinite",
        "ember-drift-a": "ember-drift-a 26s ease-in-out infinite",
        "ember-drift-b": "ember-drift-b 34s ease-in-out infinite",
        "ember-pulse-c": "ember-pulse-c 40s ease-in-out infinite",
      },
    },
  },
};

export default config;
