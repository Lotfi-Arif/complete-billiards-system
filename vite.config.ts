import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "./", // Use relative paths
  root: path.join(__dirname, "src/renderer"),
  build: {
    outDir: path.join(__dirname, "dist/renderer"),
    sourcemap: true,
    // Ensure assets are built with the correct relative paths
    assetsDir: "assets",
    rollupOptions: {
      input: path.join(__dirname, "src/renderer/index.html"),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
