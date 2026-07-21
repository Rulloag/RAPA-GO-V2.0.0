import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
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
