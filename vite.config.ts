import { defineConfig } from "vite";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte({ preprocess: vitePreprocess() })],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: "src/frontend/main.ts",
      output: {
        entryFileNames: "frontend.js",
        assetFileNames: "frontend[extname]",
        format: "iife",
      },
    },
  },
});
