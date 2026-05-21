import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { passengerProfiles } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { PassengerProfile, NewPassengerProfile } from "../../db/schema/index.js";
import type { UpsertPassengerProfileInput } from "./passengerProfile.schemas.js";

export class PassengerProfileRepository {
  async findByUserId(userId: string): Promise<PassengerProfile | null> {
    try {
      const rows = await db.select().from(passengerProfiles)
        .where(eq(passengerProfiles.userId, userId)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query passenger profile: ${String(err)}`);
    }
  }

  async upsert(userId: string, input: UpsertPassengerProfileInput): Promise<PassengerProfile> {
    try {
      const setValues: Partial<NewPassengerProfile> = {
        updatedAt: new Date(),
      };

      if (input.phone                 !== undefined) setValues.phone                 = input.phone;
      if (input.preferredLanguage     !== undefined) setValues.preferredLanguage     = input.preferredLanguage;
      if (input.notificationEnabled   !== undefined) setValues.notificationEnabled   = input.notificationEnabled;
      if (input.emailNotifications    !== undefined) setValues.emailNotifications    = input.emailNotifications;
      if (input.smsNotifications      !== undefined) setValues.smsNotifications      = input.smsNotifications;
      if (input.emergencyContactName  !== undefined) setValues.emergencyContactName  = input.emergencyContactName;
      if (input.emergencyContactPhone !== undefined) setValues.emergencyContactPhone = input.emergencyContactPhone;

      const insertValues: NewPassengerProfile = {
        userId,
        ...setValues,
      };

      const rows = await db
        .insert(passengerProfiles)
        .values(insertValues)
        .onConflictDoUpdate({
          target: passengerProfiles.userId,
          set:    setValues,
        })
        .returning();

      const row = rows[0];
      if (!row) throw AppError.internal("Upsert returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to upsert passenger profile: ${String(err)}`);
    }
  }
}
