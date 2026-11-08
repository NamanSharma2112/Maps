import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/lib/index.ts"),
      name: "MeridianUI",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "meridian-ui.js" : "meridian-ui.cjs"),
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "d3-geo", "topojson-client"],
    },
  },
});
