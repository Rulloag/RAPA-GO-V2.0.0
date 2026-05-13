import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { rideRequests } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { RideRequest } from "../../db/schema/index.js";

export class RidesRepository {
  async findByPassengerId(passengerUserId: string): Promise<RideRequest[]> {
    try {
      return await db
        .select()
        .from(rideRequests)
        .where(eq(rideRequests.passengerUserId, passengerUserId))
        .orderBy(desc(rideRequests.requestedAt));
    } catch (err) {
      throw AppError.internal(`Failed to query ride requests: ${String(err)}`);
    }
  }

  async findByIdAndPassenger(id: string, passengerUserId: string): Promise<RideRequest | null> {
    try {
      const rows = await db
        .select()
        .from(rideRequests)
        .where(and(eq(rideRequests.id, id), eq(rideRequests.passengerUserId, passengerUserId)))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query ride request: ${String(err)}`);
    }
  }

  async create(passengerUserId: string, originText: string, destinationText: string, notes: string | null): Promise<RideRequest> {
    try {
      const rows = await db
        .insert(rideRequests)
        .values({ passengerUserId, originText, destinationText, notes, status: "requested" })
        .returning();
      const row = rows[0];
      if (!row) throw AppError.internal("Insert returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create ride request: ${String(err)}`);
    }
  }

  async findAvailable(): Promise<RideRequest[]> {
    try {
      return await db
        .select()
        .from(rideRequests)
        .where(eq(rideRequests.status, "requested"))
        .orderBy(desc(rideRequests.requestedAt));
    } catch (err) {
      throw AppError.internal(`Failed to query available rides: ${String(err)}`);
    }
  }

  async cancel(id: string): Promise<RideRequest> {
    try {
      const rows = await db
        .update(rideRequests)
        .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(rideRequests.id, id))
        .returning();
      const row = rows[0];
      if (!row) throw AppError.internal("Update returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to cancel ride request: ${String(err)}`);
    }
  }
}
