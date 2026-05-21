import { desc, eq, and, isNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import { offlineBookings, syncQueue, connectivityLogs } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { OfflineBooking, SyncQueueItem, NewOfflineBooking } from "../../db/schema/index.js";

export class OfflineRepository {
  async createOfflineBooking(data: NewOfflineBooking): Promise<OfflineBooking> {
    try {
      const rows = await db.insert(offlineBookings).values(data).returning();
      const row = rows[0];
      if (!row) throw AppError.internal("Insert returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create offline booking: ${String(err)}`);
    }
  }

  async listOfflineBookings(status?: string): Promise<OfflineBooking[]> {
    try {
      const query = db.select().from(offlineBookings);
      if (status) {
        return await query.where(eq(offlineBookings.status, status)).orderBy(desc(offlineBookings.createdAt));
      }
      return await query.orderBy(desc(offlineBookings.createdAt));
    } catch (err) {
      throw AppError.internal(`Failed to list offline bookings: ${String(err)}`);
    }
  }

  async findOfflineBookingById(id: string): Promise<OfflineBooking | null> {
    try {
      const rows = await db.select().from(offlineBookings).where(eq(offlineBookings.id, id)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to find offline booking: ${String(err)}`);
    }
  }

  async syncOfflineBooking(id: string, rideRequestId: string): Promise<OfflineBooking | null> {
    try {
      const rows = await db
        .update(offlineBookings)
        .set({ status: "synced", syncedToRideId: rideRequestId })
        .where(and(eq(offlineBookings.id, id), eq(offlineBookings.status, "pending_sync")))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to sync offline booking: ${String(err)}`);
    }
  }

  async cancelOfflineBooking(id: string): Promise<OfflineBooking | null> {
    try {
      const rows = await db
        .update(offlineBookings)
        .set({ status: "cancelled" })
        .where(and(eq(offlineBookings.id, id), eq(offlineBookings.status, "pending_sync")))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to cancel offline booking: ${String(err)}`);
    }
  }

  async logConnectivity(userId: string, role: string, hadConnectivity: boolean, locationZone?: string | null) {
    try {
      const rows = await db.insert(connectivityLogs).values({ userId, role, hadConnectivity, locationZone: locationZone ?? null }).returning();
      return rows[0]!;
    } catch (err) {
      throw AppError.internal(`Failed to log connectivity: ${String(err)}`);
    }
  }

  async getSyncQueue(userId: string): Promise<SyncQueueItem[]> {
    try {
      return await db
        .select()
        .from(syncQueue)
        .where(and(eq(syncQueue.userId, userId), isNull(syncQueue.syncedAt)))
        .orderBy(desc(syncQueue.createdAt));
    } catch (err) {
      throw AppError.internal(`Failed to get sync queue: ${String(err)}`);
    }
  }

  async confirmSyncItem(id: string, userId: string): Promise<SyncQueueItem | null> {
    try {
      const rows = await db
        .update(syncQueue)
        .set({ syncedAt: new Date() })
        .where(and(eq(syncQueue.id, id), eq(syncQueue.userId, userId)))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to confirm sync item: ${String(err)}`);
    }
  }
}
