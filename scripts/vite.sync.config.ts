import { defineConfig } from "vite";

// The sync script needs no plugins. A dedicated config keeps vite-node from
// loading the Remix plugin from vite.config.ts and printing its warnings.
export default defineConfig({});
