import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => ({
  base: "/",
  appType: "spa",
  plugins: [react()],
  resolve: {
    // Force every workspace dependency to use the same React runtime.
    // Without this, npm can install one React at the monorepo root and
    // another inside apps/mobile, causing invalid-hook-call and black screens.
    dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
    alias: {
      "@": resolve(__dirname, "src"),
      "@components": resolve(__dirname, "src/components"),
      "@features": resolve(__dirname, "src/features"),
      "@services": resolve(__dirname, "src/services"),
      "@store": resolve(__dirname, "src/store"),
      "@config": resolve(__dirname, "src/config"),
      "@navigation": resolve(__dirname, "src/navigation"),
      "@theme": resolve(__dirname, "src/theme"),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: mode !== "production",
  },
}));
