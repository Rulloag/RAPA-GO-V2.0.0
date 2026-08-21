import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { driverProfiles } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { DriverProfile, NewDriverProfile } from "../../db/schema/index.js";
import type { UpsertDriverProfileInput } from "./driverProfile.schemas.js";

export class DriverProfileRepository {
  async findByUserId(userId: string): Promise<DriverProfile | null> {
    try {
      const rows = await db.select().from(driverProfiles)
        .where(eq(driverProfiles.userId, userId)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query driver profile: ${String(err)}`);
    }
  }

  async upsert(userId: string, input: UpsertDriverProfileInput): Promise<DriverProfile> {
    try {
      const existing = await this.findByUserId(userId);
      const setValues: Partial<NewDriverProfile> = {
        updatedAt: new Date(),
      };

      if (input.vehicleBrand !== undefined)    setValues.vehicleBrand    = input.vehicleBrand;
      if (input.vehicleModel !== undefined)    setValues.vehicleModel    = input.vehicleModel;
      if (input.vehicleYear !== undefined)     setValues.vehicleYear     = input.vehicleYear;
      if (input.vehiclePlate !== undefined)    setValues.vehiclePlate    = input.vehiclePlate;
      if (input.vehicleColor !== undefined)    setValues.vehicleColor    = input.vehicleColor;
      if (input.profilePhotoUrl !== undefined) setValues.profilePhotoUrl = input.profilePhotoUrl;
      if (input.vehiclePhotoUrl !== undefined) setValues.vehiclePhotoUrl = input.vehiclePhotoUrl;
      if (input.bio !== undefined)             setValues.bio             = input.bio;
      if (input.languages !== undefined)       setValues.languages       = input.languages;

      // Cambio de identidad del vehículo: revocar capacidades aprobadas.
      // Las aprobaciones no pueden transferirse a otro auto (p. ej. Accent 2017
      // heredando Confort/XL del RAV4 2024).
      if (existing) {
        const norm = (v: string | null | undefined) =>
          String(v ?? "").trim().toLowerCase();
        const plateChanged =
          input.vehiclePlate !== undefined &&
          norm(input.vehiclePlate) !== norm(existing.vehiclePlate);
        const yearChanged =
          input.vehicleYear !== undefined &&
          Number(input.vehicleYear) !== Number(existing.vehicleYear ?? NaN);
        const brandChanged =
          input.vehicleBrand !== undefined &&
          norm(input.vehicleBrand) !== norm(existing.vehicleBrand);
        const modelChanged =
          input.vehicleModel !== undefined &&
          norm(input.vehicleModel) !== norm(existing.vehicleModel);

        if (plateChanged || yearChanged || brandChanged || modelChanged) {
          setValues.capabilityXl = false;
          setValues.capabilityExtraLuggage = false;
          setValues.capabilityComfort = false;
          setValues.vehicleCategory = "standard";
        }
      }

      const insertValues: NewDriverProfile = {
        userId,
        ...setValues,
      };

      const rows = await db
        .insert(driverProfiles)
        .values(insertValues)
        .onConflictDoUpdate({
          target: driverProfiles.userId,
          set: setValues,
        })
        .returning();

      const row = rows[0];
      if (!row) throw AppError.internal("Upsert returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to upsert driver profile: ${String(err)}`);
    }
  }

  async setApprovedVehicleCategory(
    userId: string,
    vehicleCategory: "standard" | "xl" | "extra_luggage" | "comfort",
  ): Promise<DriverProfile> {
    try {
      const existing = await this.findByUserId(userId);
      if (!existing) {
        throw AppError.notFound("Driver profile not found.");
      }

      const { capabilitiesFromLegacyCategory, primaryCategoryFromCapabilities } =
        await import("@rapa-go/shared");
      const caps = capabilitiesFromLegacyCategory(
        vehicleCategory,
        existing.vehicleYear,
      );

      const rows = await db
        .update(driverProfiles)
        .set({
          vehicleCategory: primaryCategoryFromCapabilities(caps),
          capabilityXl: caps.xl,
          capabilityExtraLuggage: caps.extraLuggage,
          capabilityComfort: caps.comfort,
          updatedAt: new Date(),
        })
        .where(eq(driverProfiles.userId, userId))
        .returning();

      const row = rows[0];
      if (!row) throw AppError.internal("Category update returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(
        `Failed to set approved vehicle category: ${String(err)}`,
      );
    }
  }

  async setVehicleCapabilities(
    userId: string,
    capabilities: {
      xl: boolean;
      extraLuggage: boolean;
      comfort: boolean;
    },
  ): Promise<DriverProfile> {
    try {
      const existing = await this.findByUserId(userId);
      if (!existing) {
        throw AppError.notFound("Driver profile not found.");
      }

      const { primaryCategoryFromCapabilities } = await import("@rapa-go/shared");
      const next = {
        xl: capabilities.xl === true,
        extraLuggage: capabilities.extraLuggage === true,
        comfort: capabilities.comfort === true,
        vehicleYear: existing.vehicleYear ?? null,
      };

      const rows = await db
        .update(driverProfiles)
        .set({
          capabilityXl: next.xl,
          capabilityExtraLuggage: next.extraLuggage,
          capabilityComfort: next.comfort,
          vehicleCategory: primaryCategoryFromCapabilities(next),
          updatedAt: new Date(),
        })
        .where(eq(driverProfiles.userId, userId))
        .returning();

      const row = rows[0];
      if (!row) throw AppError.internal("Capabilities update returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(
        `Failed to set vehicle capabilities: ${String(err)}`,
      );
    }
  }
}
