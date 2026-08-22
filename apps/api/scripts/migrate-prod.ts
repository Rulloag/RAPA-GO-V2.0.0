import "dotenv/config";
import { execSync } from "node:child_process";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/db/schema/index.js";

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL");
}

console.log("🚀 START");

const client = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(client, { schema });

console.log("⏳ migrate (drizzle journal)…");

execSync("npx drizzle-kit migrate", {
  stdio: "inherit",
  env: process.env,
});

console.log("⏳ migrate (manual chain 0056→0057→0058)…");
const { applyManualMigrations } = await import(
  "./manual-migrations/applyManualMigrations.js"
);
await applyManualMigrations(client);

await client`SELECT 1`;
console.log("✅ DB OK");

console.log("⏳ seed...");

const now = sql`NOW()`;

// FARE
const fares = [
  { type: "mobility_per_km", name: "Tarifa km", value: 230000, currency: "CLP", description: "km" },
];

for (const f of fares) {
  const exists = await db
    .select()
    .from(schema.fareSettings)
    .where(eq(schema.fareSettings.type, f.type))
    .limit(1);

  if (!exists.length) {
    await db.insert(schema.fareSettings).values({
      ...f,
      isActive: true,
      effectiveFrom: now,
      effectiveUntil: null,
      createdAt: now,
      updatedAt: now,
    });
  }
}

// LEGAL
const legal = [
  { type: "terms_and_conditions", title: "Términos" },
];

for (const l of legal) {
  const exists = await db
    .select()
    .from(schema.legalDocuments)
    .where(eq(schema.legalDocuments.type, l.type))
    .limit(1);

  if (!exists.length) {
    await db.insert(schema.legalDocuments).values({
      ...l,
      version: "1.0.0",
      content: "Pendiente",
      isActive: false,
      effectiveDate: now,
      createdAt: now,
      updatedAt: now,
    });
  }
}

console.log("🎉 DONE");

await client.end();