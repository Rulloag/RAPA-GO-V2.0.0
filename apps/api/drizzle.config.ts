import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 * Used by: npm run db:generate, db:migrate, db:studio
 *
 * Requires DIRECT_URL to be set in apps/api/.env (conexión directa/sesión,
 * necesaria porque el pooler de transacciones no soporta DDL de migraciones).
 */
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});