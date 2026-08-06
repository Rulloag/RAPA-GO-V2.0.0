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
}
