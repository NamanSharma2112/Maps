import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Docs / demo site. `SINGLE=1 vite build` inlines everything into one HTML file.
export default defineConfig({
  plugins: [react(), ...(process.env.SINGLE ? [viteSingleFile()] : [])],
  base: "./",
  build: { outDir: process.env.SINGLE ? "dist-single" : "dist-demo" },
});
