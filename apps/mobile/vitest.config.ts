import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
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
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/vitest.setup.ts"],
  },
});
