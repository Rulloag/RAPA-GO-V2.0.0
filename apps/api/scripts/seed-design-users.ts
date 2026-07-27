/**
 * seed-design-users.ts
 *
 * Crea un chofer y un guía turístico nuevos en Supabase
 * para iterar sobre el diseño con datos reales.
 *
 * Ejecutar: npx tsx apps/api/scripts/seed-design-users.ts
 *
 * SOLO funciona si NODE_ENV !== "production".
 */

import "dotenv/config";
import argon2 from "argon2";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema/index.js";

if (process.env["NODE_ENV"] === "production") {
  console.error("ERROR: seed-design-users no puede ejecutarse en producción.");
  process.exit(1);
}

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL no está configurado en apps/api/.env");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(sql, { schema });

const PASSWORD = "Diseno1234!";

const ARGON_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

async function upsertUser(email: string, name: string, role: string) {
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing.length > 0 && existing[0]) {
    console.log(`  ↳ ${email} — ya existe, omitiendo creación de usuario.`);
    return existing[0].id;
  }

  const hash = await argon2.hash(PASSWORD, ARGON_OPTIONS);

  const [user] = await db
    .insert(schema.users)
    .values({ email, name, role, status: "active", isVerified: true })
    .returning({ id: schema.users.id });

  if (!user) throw new Error(`No se pudo crear ${email}`);

  await db
    .insert(schema.authCredentials)
    .values({ userId: user.id, passwordHash: hash });

  console.log(`  ✓ ${email} (${role}) creado`);
  return user.id;
}

async function seed() {
  console.log("Creando cuenta de chofer para diseño...\n");

  const driverId = await upsertUser(
    "chofer.design@rapago.local",
    "Mateo Tepano",
    "driver"
  );

  await db
    .insert(schema.driverProfiles)
    .values({
      userId: driverId,
      phone: "+56 9 8765 4321",
      vehicleBrand: "Toyota",
      vehicleModel: "Hilux",
      vehicleYear: 2022,
      vehiclePlate: "RGDS-01",
      vehicleColor: "Blanco",
      licenseNumber: "L-DESIGN-001",
      licenseExpiry: "2027-06-30",
      bio: "Chofer local con años de experiencia recorriendo la isla.",
      languages: ["es", "en"],
      gender: "male",
    })
    .onConflictDoUpdate({
      target: schema.driverProfiles.userId,
      set: {
        phone: "+56 9 8765 4321",
        vehicleBrand: "Toyota",
        vehicleModel: "Hilux",
        vehicleYear: 2022,
        vehiclePlate: "RGDS-01",
        vehicleColor: "Blanco",
        licenseNumber: "L-DESIGN-001",
        licenseExpiry: "2027-06-30",
        bio: "Chofer local con años de experiencia recorriendo la isla.",
        languages: ["es", "en"],
        gender: "male",
        updatedAt: new Date(),
      },
    });

  const now = new Date();
  await db
    .insert(schema.driverStatuses)
    .values({
      driverUserId: driverId,
      availability: "available",
      currentRideId: null,
      currentZone: "hanga_roa",
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: schema.driverStatuses.driverUserId,
      set: {
        availability: "available",
        currentRideId: null,
        currentZone: "hanga_roa",
        lastSeenAt: now,
        updatedAt: now,
      },
    });

  console.log("  ✓ driver_profiles y driver_statuses configurados\n");

  console.log("Creando cuenta de guía turístico para diseño...\n");

  const guideId = await upsertUser(
    "guia.design@rapago.local",
    "Ana Hotu",
    "guide"
  );

  const existingService = await db
    .select({ id: schema.touristServices.id })
    .from(schema.touristServices)
    .where(eq(schema.touristServices.guideId, guideId))
    .limit(1);

  if (existingService.length === 0) {
    await db.insert(schema.touristServices).values({
      guideId,
      title: "Tour Rano Kau y Orongo",
      description:
        "Recorrido guiado por el volcán Rano Kau y la aldea ceremonial de Orongo, con explicación de la cultura Rapa Nui.",
      type: "tour",
      durationMinutes: 240,
      maxPeople: 6,
      price: 45000,
      includes: ["Guía bilingüe", "Entrada al parque", "Agua"],
      languages: ["es", "en"],
      meetingPoint: "Plaza de Hanga Roa",
      includesVehicle: true,
      conditions: "Uso de calzado cómodo y protección solar.",
      cancellationPolicy: "Cancelación gratuita hasta 24h antes.",
      status: "active",
    });
    console.log("  ✓ tourist_services de ejemplo creado para la guía");
  } else {
    console.log("  ↳ ya existe un tourist_service para esta guía, omitiendo.");
  }

  console.log("\n✓ Seed completo.\n");
  console.log("Credenciales de diseño:");
  console.log("  Chofer → chofer.design@rapago.local");
  console.log("  Guía   → guia.design@rapago.local");
  console.log(`  Password (ambos): ${PASSWORD}`);
}

seed()
  .catch((err) => {
    console.error("Error en seed:", err);
    process.exit(1);
  })
  .finally(() => sql.end());
