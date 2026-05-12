import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.js";

/**
 * Database client — singleton Drizzle instance.
 *
 * Supports any PostgreSQL provider via DATABASE_URL:
 *   Supabase, Neon, Railway, AWS RDS, GCP Cloud SQL.
 *
 * The mobile app never has access to this client or DATABASE_URL.
 * All data access goes through the backend service layer.
 *
 * If DATABASE_URL is not set, the client is not initialized and
 * any attempt to use it at runtime will throw a clear error.
 */

function createClient() {
  const databaseUrl = process.env["DATABASE_URL"];

  if (!databaseUrl) {
    // Return a proxy that throws clearly at the first DB call, not at import time.
    // This allows the server to boot (and /health to respond) without a DB connection.
    return new Proxy({} as ReturnType<typeof drizzle>, {
      get(_target, prop) {
        if (prop === "then") return undefined; // not a Promise
        throw new Error(
          `Database client accessed before DATABASE_URL is configured. ` +
          `Set DATABASE_URL in apps/api/.env to connect to PostgreSQL.`,
        );
      },
    });
  }

  const sql = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(sql, { schema });
}

export const db = createClient();
export type Db = typeof db;
