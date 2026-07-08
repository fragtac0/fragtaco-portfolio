import { vitePlugin as remix } from "@remix-run/dev";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    remix(),
  ],
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "motion/react",
      "react-icons/fa6",
      "react-icons/si",
      "clsx",
      "tailwind-merge",
    ],
  },
});
