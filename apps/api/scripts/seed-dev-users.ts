/**
 * seed-dev-users.ts
 *
 * Crea usuarios de prueba para desarrollo local.
 * Ejecutar: tsx apps/api/scripts/seed-dev-users.ts
 *
 * SOLO funciona si NODE_ENV !== "production".
 * No commitear contraseñas reales. Las credenciales aquí son exclusivamente de
 * entorno local y no deben usarse en staging ni producción.
 */

import "dotenv/config";
import argon2 from "argon2";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema/index.js";

// ── Guard de seguridad ──────────────────────────────────────────────────────

if (process.env["NODE_ENV"] === "production") {
  console.error("ERROR: seed-dev-users no puede ejecutarse en producción.");
  process.exit(1);
}

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL no está configurado en apps/api/.env");
  process.exit(1);
}

// ── Conexión ────────────────────────────────────────────────────────────────

const sql = postgres(DATABASE_URL, { max: 1 });
const db  = drizzle(sql, { schema });

// ── Usuarios demo ───────────────────────────────────────────────────────────

const DEV_USERS = [
  {
    email:    "passenger@rapago.local",
    name:     "Pasajero Demo",
    role:     "passenger" as const,
    status:   "active"  as const,
    password: "Test1234!",
  },
  {
    email:    "driver@rapago.local",
    name:     "Conductor Demo",
    role:     "driver"  as const,
    status:   "active"  as const,
    password: "Test1234!",
  },
  {
    email:    "driver2@rapago.local",
    name:     "Conductor Demo 2",
    role:     "driver"  as const,
    status:   "active"  as const,
    password: "Test1234!",
  },
  {
    email:    "guide@rapago.local",
    name:     "Guía Demo",
    role:     "guide"   as const,
    status:   "active"  as const,
    password: "Test1234!",
  },
  {
    email:    "rental@rapago.local",
    name:     "Rent a Car Demo",
    role:     "rental"  as const,
    status:   "active"  as const,
    password: "Test1234!",
  },
  {
    email:    "admin@rapago.local",
    name:     "Admin Demo",
    role:     "admin"   as const,
    status:   "active"  as const,
    password: "Test1234!",
  },
] as const;

// ── Opciones argon2 — rápidas para dev, no para producción ──────────────────

const ARGON_OPTIONS: argon2.Options = {
  type:        argon2.argon2id,
  memoryCost:  65536,
  timeCost:    3,
  parallelism: 4,
};

// ── Seed ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Creando usuarios de desarrollo...\n");

  const driverUserIds: string[] = [];

  for (const u of DEV_USERS) {
    const existing = await db
      .select({ id: schema.users.id, status: schema.users.status })
      .from(schema.users)
      .where(eq(schema.users.email, u.email))
      .limit(1);

    if (existing.length > 0 && existing[0]) {
      console.log(`  ↳ ${u.email} — ya existe (status: ${existing[0].status}), omitiendo.`);
      if (u.role === "driver") driverUserIds.push(existing[0].id);
      continue;
    }

    const hash = await argon2.hash(u.password, ARGON_OPTIONS);

    const [user] = await db
      .insert(schema.users)
      .values({
        email:  u.email,
        name:   u.name,
        role:   u.role,
        status: u.status,
      })
      .returning({ id: schema.users.id });

    if (!user) {
      console.error(`  ✗ Error al crear ${u.email}`);
      continue;
    }

    await db
      .insert(schema.authCredentials)
      .values({ userId: user.id, passwordHash: hash });

    if (u.role === "driver") driverUserIds.push(user.id);
    console.log(`  ✓ ${u.email} (${u.role} / ${u.status}) creado`);
  }

  // ── Resetear disponibilidad de todos los conductores demo ─────────────────
  for (const driverId of driverUserIds) {
    const now = new Date();
    await db
      .insert(schema.driverStatuses)
      .values({
        driverUserId:  driverId,
        availability:  "available",
        currentRideId: null,
        currentZone:   "hanga_roa",
        lastSeenAt:    now,
      })
      .onConflictDoUpdate({
        target: schema.driverStatuses.driverUserId,
        set: {
          availability:  "available",
          currentRideId: null,
          currentZone:   "hanga_roa",
          lastSeenAt:    now,
          updatedAt:     now,
        },
      });
  }
  if (driverUserIds.length > 0) {
    console.log(`  ✓ ${driverUserIds.length} conductor(es) reseteados a "available" en zona hanga_roa`);
  }

  console.log("\nSeed completo.");
  console.log("\nCredenciales de prueba:");
  console.log("  Email:    passenger@rapago.local");
  console.log("  Email:    driver@rapago.local");
  console.log("  Email:    driver2@rapago.local");
  console.log("  Email:    guide@rapago.local");
  console.log("  Email:    rental@rapago.local");
  console.log("  Email:    admin@rapago.local");
  console.log("  Password: Test1234!  (todos)");
  console.log("\nEstado conductores demo:");
  console.log("  driver@rapago.local  → availability: available | zone: hanga_roa");
  console.log("  driver2@rapago.local → availability: available | zone: hanga_roa");
}

seed()
  .catch((err) => {
    console.error("Error en seed:", err);
    process.exit(1);
  })
  .finally(() => sql.end());
