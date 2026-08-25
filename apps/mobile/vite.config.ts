import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { resolve } from "path";

/** Collect resolved VITE_* values for build-time guard checks. */
function viteEnvBlob(env: Record<string, string>): string {
  return Object.entries(env)
    .filter(([key]) => key.startsWith("VITE_"))
    .map(([, value]) => value)
    .join("\n");
}

/**
 * Fail fast when staging/production env files point at the wrong hosts.
 * Minimal guards — no secret scanning here (handled in CI grep step).
 */
function assertBuildEnv(mode: string, env: Record<string, string>): void {
  if (mode !== "staging" && mode !== "production") return;

  const blob = viteEnvBlob(env);
  const appEnv =
    env.VITE_ENV ?? env.VITE_APP_ENV ?? (mode === "production" ? "production" : mode);

  if (mode === "staging") {
    if (appEnv !== "staging") {
      throw new Error(
        `[vite] mode=staging requires VITE_ENV=staging (got "${appEnv}"). ` +
          `Use apps/mobile/.env.staging from .env.staging.template.`,
      );
    }
    if (/\bapp\.rapago\.cl\b/i.test(blob)) {
      throw new Error(
        "[vite] staging build must not reference app.rapago.cl (production frontend).",
      );
    }
    if (!/\bbackend\.rapago\.cl\b/i.test(blob)) {
      throw new Error(
        "[vite] staging build must point API to backend.rapago.cl (VITE_API_*).",
      );
    }
  }

  if (mode === "production") {
    if (/\bstaging\.rapago\.cl\b/i.test(blob)) {
      throw new Error(
        "[vite] production build must not reference staging.rapago.cl.",
      );
    }
  }
}

// Sourcemaps:
// - dev (`vite`): served by dev server, not emitted to dist — always allowed.
// - staging (`vite build --mode staging`): ON for QA/debug (override via
//   VITE_STAGING_SOURCEMAPS=false in .env.staging.local if CI must hide them).
// - production: public sourcemaps OFF (never publish .map alongside SPA).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  assertBuildEnv(mode, env);

  const stagingSourcemaps =
    env.VITE_STAGING_SOURCEMAPS !== "false" && env.VITE_STAGING_SOURCEMAPS !== "0";

  return {
    base: "/",
    appType: "spa",
    plugins: [basicSsl(), react()],
    resolve: {
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
          target: "http://192.168.1.3:3000",
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap:
        mode === "production" ? false : mode === "staging" ? stagingSourcemaps : true,
    },
  };
});
