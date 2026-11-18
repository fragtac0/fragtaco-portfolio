import { vitePlugin as remix } from "@remix-run/dev";
import tailwindcss from "@tailwindcss/vite";
import { vercelPreset } from "@vercel/remix/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    // a test beside a route (app/routes/api.csp-report.test.ts) is a test, not a route
    remix({ presets: [vercelPreset()], ignoredRouteFiles: ["**/*.test.ts"] }),
  ],
  build: {
    // Font files are never inlined as data: addresses (the small subsets would be): every face is a file on this site, so the content
    // policy of the security pass can say font-src 'self'. Everything else keeps Vite's own decision (undefined means "use the default":
    // its 4 KiB limit and its other guards).
    assetsInlineLimit: (file) => (file.endsWith(".woff2") ? false : undefined),
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "motion/react",
      "react-icons/fa6",
      "react-icons/si",
    ],
  },
});
