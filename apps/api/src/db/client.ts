import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.js";

const DATABASE_URL = process.env["DATABASE_URL"];

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL no está cargada. Revisa apps/api/.env"
  );
}

const sql = postgres(DATABASE_URL, {
  max: 10,
  // El pooler de Supabase en modo transacción (pgbouncer) no soporta
  // prepared statements — deben desactivarse en el driver.
  prepare: false,
});

export const db = drizzle(sql, { schema });
export { sql };