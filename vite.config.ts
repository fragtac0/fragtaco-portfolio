import { vitePlugin as remix } from "@remix-run/dev";
import tailwindcss from "@tailwindcss/vite";
import { vercelPreset } from "@vercel/remix/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    remix({ presets: [vercelPreset()] }),
  ],
  build: {
    // Font files are never inlined as data: addresses (the small subsets would be): every face is a file on this site, so the content
    // policy of the security pass can say font-src 'self'. Everything else keeps Vite's default limit (4 KiB).
    assetsInlineLimit: (file, content) => (file.endsWith(".woff2") ? false : content.length < 4096),
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
