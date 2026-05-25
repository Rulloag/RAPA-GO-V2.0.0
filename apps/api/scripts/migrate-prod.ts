/**
 * migrate-prod.ts
 * Run with: npm run migrate:prod
 *
 * 1. Verifies DATABASE_URL is set
 * 2. Runs drizzle-kit migrate (applies pending SQL migrations)
 * 3. Seeds minimum required data on first boot
 * 4. Closes connection cleanly
 */

import { execSync } from "node:child_process";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema/index.js";

const DATABASE_URL = process.env["DATABASE_URL"];

if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set. Aborting.");
  process.exit(1);
}

console.log("✅  DATABASE_URL found.");

// ── 1. Run drizzle-kit migrate ─────────────────────────────────────────────
console.log("⏳  Running drizzle-kit migrate…");
try {
  execSync("npx drizzle-kit migrate", {
    stdio: "inherit",
    env:   { ...process.env },
  });
  console.log("✅  Migrations applied.");
} catch (err) {
  console.error("❌  Migration failed:", err);
  process.exit(1);
}

// ── 2. Connect and verify ──────────────────────────────────────────────────
const sql = postgres(DATABASE_URL, { max: 2, connect_timeout: 15 });
const db  = drizzle(sql, { schema });

try {
  await sql`SELECT 1`;
  console.log("✅  Database connection verified.");
} catch (err) {
  console.error("❌  Cannot connect to database:", err);
  await sql.end();
  process.exit(1);
}

// ── 3. Seed minimum data ───────────────────────────────────────────────────
console.log("⏳  Checking seed data…");

// fare_settings defaults
const fareTypes = [
  { type: "mobility_per_km",  name: "Tarifa por km (movilidad)",   value: 230000, description: "Centavos CLP por km recorrido" },
  { type: "minimum_fare",     name: "Tarifa mínima (movilidad)",   value: 300000, description: "Tarifa mínima en centavos CLP" },
  { type: "tour_per_person",  name: "Tour por persona (base)",     value: 1500000, description: "Tarifa base tour por persona en centavos CLP" },
] as const;

for (const fare of fareTypes) {
  const existing = await db
    .select()
    .from(schema.fareSettings)
    .where(eq(schema.fareSettings.type, fare.type))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.fareSettings).values({
      type:        fare.type,
      name:        fare.name,
      value:       fare.value,
      description: fare.description,
      isActive:    true,
    });
    console.log(`  ✅  Inserted fare_settings: ${fare.type}`);
  } else {
    console.log(`  ⏭  fare_settings already exists: ${fare.type}`);
  }
}

// legal_documents placeholders (admin must fill real content)
const legalTypes = [
  { type: "terms_and_conditions", title: "Términos y Condiciones" },
  { type: "privacy_policy",       title: "Política de Privacidad" },
  { type: "user_conditions",      title: "Condiciones para Usuarios" },
  { type: "driver_conditions",    title: "Condiciones para Conductores" },
  { type: "guide_conditions",     title: "Condiciones para Guías" },
] as const;

for (const doc of legalTypes) {
  const existing = await db
    .select()
    .from(schema.legalDocuments)
    .where(eq(schema.legalDocuments.type, doc.type))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.legalDocuments).values({
      type:      doc.type,
      title:     doc.title,
      content:   `[Contenido de ${doc.title} pendiente de redacción por el equipo legal.]`,
      version:   "1.0.0",
      isActive:  false,
    });
    console.log(`  ✅  Inserted legal_document placeholder: ${doc.type}`);
  } else {
    console.log(`  ⏭  legal_document already exists: ${doc.type}`);
  }
}

console.log("✅  Seed data check complete.");

// ── 4. Close connection ────────────────────────────────────────────────────
await sql.end();
console.log("✅  Database connection closed. Deploy ready.");
