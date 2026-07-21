import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => ({
  // El frontend está publicado en la raíz del dominio (actualmente api.rapago.cl).
  // Mantener una base absoluta evita que /auth/login intente buscar assets en /auth/assets.
  base: "/",
  appType: "spa",
  plugins: [react()],
  resolve: {
    // Evita runtimes duplicados de React dentro del monorepo.
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
    // Ionic/Capacitor crea imports dinámicos web-*.js. En hosting compartido,
    // una publicación incompleta o una caché antigua puede devolver index.html
    // para esos archivos y producir el error MIME text/html. Se integra todo
    // el JavaScript en un único app.js estable para eliminar esa causa.
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith(".css")
            ? "assets/app.css"
            : "assets/[name]-[hash][extname]",
      },
    },
    chunkSizeWarningLimit: 3500,
  },
}));
