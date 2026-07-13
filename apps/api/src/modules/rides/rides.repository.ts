import { and, avg, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { rideRequests, users, rideRatings, driverProfiles } from "../../db/schema/index.js";
import { alias } from "drizzle-orm/pg-core";
import { AppError } from "../../shared/errors/AppError.js";
import type { RideRequest } from "../../db/schema/index.js";

export interface RideWithDriverName extends RideRequest {
  driverName:          string | null;
  driverPhone:         string | null;
  driverRatingAverage: number | null;
  driverRatingCount:   number;
  driverVehicleBrand:  string | null;
  driverVehicleModel:  string | null;
  driverVehicleYear:   number | null;
  driverVehiclePlate:  string | null;
  driverVehicleColor:  string | null;
}

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

  async findByPassengerIdWithDriver(passengerUserId: string): Promise<RideWithDriverName[]> {
    try {
      const driver = alias(users, "driver");
      const rows = await db
        .select({
          id:                 rideRequests.id,
          passengerUserId:    rideRequests.passengerUserId,
          driverUserId:       rideRequests.driverUserId,
          originText:         rideRequests.originText,
          destinationText:    rideRequests.destinationText,
          notes:              rideRequests.notes,
          estimatedFareClp:   rideRequests.estimatedFareClp,
          status:             rideRequests.status,
          requestedAt:        rideRequests.requestedAt,
          acceptedAt:         rideRequests.acceptedAt,
          enRouteAt:          rideRequests.enRouteAt,
          arrivedAt:          rideRequests.arrivedAt,
          startedAt:          rideRequests.startedAt,
          completedAt:        rideRequests.completedAt,
          cancelledAt:        rideRequests.cancelledAt,
          cancellationReason: rideRequests.cancellationReason,
          cancelledByUserId:  rideRequests.cancelledByUserId,
          cancelledByRole:    rideRequests.cancelledByRole,
          createdAt:          rideRequests.createdAt,
          updatedAt:          rideRequests.updatedAt,
          isOfflineBooking:   rideRequests.isOfflineBooking,
          driverName:         driver.name,
          driverPhone:        driverProfiles.phone,
          driverVehicleBrand: driverProfiles.vehicleBrand,
          driverVehicleModel: driverProfiles.vehicleModel,
          driverVehicleYear:  driverProfiles.vehicleYear,
          driverVehiclePlate: driverProfiles.vehiclePlate,
          driverVehicleColor: driverProfiles.vehicleColor,
        })
        .from(rideRequests)
        .leftJoin(driver, eq(rideRequests.driverUserId, driver.id))
        .leftJoin(driverProfiles, eq(rideRequests.driverUserId, driverProfiles.userId))
        .where(eq(rideRequests.passengerUserId, passengerUserId))
        .orderBy(desc(rideRequests.requestedAt));

      // Collect unique driverUserIds that are not null
      const driverIds = [...new Set(rows.map((r) => r.driverUserId).filter((id): id is string => id != null))];

      // Fetch AVG/COUNT ratings for each driver in one query
      const ratingMap = new Map<string, { average: number | null; count: number }>();
      if (driverIds.length > 0) {
        const ratingRows = await db
          .select({
            ratedUserId:    rideRatings.ratedUserId,
            avgRating:      avg(rideRatings.rating),
            countRating:    count(rideRatings.rating),
          })
          .from(rideRatings)
          .where(inArray(rideRatings.ratedUserId, driverIds))
          .groupBy(rideRatings.ratedUserId);

        for (const r of ratingRows) {
          ratingMap.set(r.ratedUserId, {
            average: r.avgRating != null ? parseFloat(r.avgRating) : null,
            count:   Number(r.countRating),
          });
        }
      }

      return rows.map((r) => {
        const ratingInfo = r.driverUserId != null ? (ratingMap.get(r.driverUserId) ?? { average: null, count: 0 }) : { average: null, count: 0 };
        return {
          ...r,
          driverRatingAverage: ratingInfo.average,
          driverRatingCount:   ratingInfo.count,
          driverVehicleBrand:  r.driverVehicleBrand ?? null,
          driverVehicleModel:  r.driverVehicleModel ?? null,
          driverVehicleYear:   r.driverVehicleYear ?? null,
          driverVehiclePlate:  r.driverVehiclePlate ?? null,
          driverVehicleColor:  r.driverVehicleColor ?? null,
        } as RideWithDriverName;
      });
    } catch (err) {
      throw AppError.internal(`Failed to query ride requests with driver: ${String(err)}`);
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

  async create(
    passengerUserId: string,
    originText: string,
    destinationText: string,
    notes: string | null,
    estimatedFareClp: number,
  ): Promise<RideRequest> {
    try {
      const rows = await db
        .insert(rideRequests)
        .values({ passengerUserId, originText, destinationText, notes, estimatedFareClp, status: "requested" })
        .returning();
      const row = rows[0];
      if (!row) throw AppError.internal("Insert returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create ride request: ${String(err)}`);
    }
  }

  async findById(id: string): Promise<RideRequest | null> {
    try {
      const rows = await db
        .select()
        .from(rideRequests)
        .where(eq(rideRequests.id, id))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query ride request: ${String(err)}`);
    }
  }

  async findByDriverId(driverUserId: string): Promise<RideRequest[]> {
    try {
      return await db
        .select()
        .from(rideRequests)
        .where(eq(rideRequests.driverUserId, driverUserId))
        .orderBy(desc(rideRequests.acceptedAt));
    } catch (err) {
      throw AppError.internal(`Failed to query driver rides: ${String(err)}`);
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

  /**
   * Atomically accept a ride only when it is still in 'requested' status.
   * Returns null if no row was updated (status already changed — race condition).
   */
  async accept(id: string, driverUserId: string): Promise<RideRequest | null> {
    try {
      const rows = await db
        .update(rideRequests)
        .set({ status: "accepted", driverUserId, acceptedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(rideRequests.id, id), eq(rideRequests.status, "requested")))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to accept ride request: ${String(err)}`);
    }
  }

  /**
   * Atomically complete a ride only when status='in_progress' AND driver matches.
   * Returns null if no row was updated.
   */
  async complete(id: string, driverUserId: string): Promise<RideRequest | null> {
    try {
      const rows = await db
        .update(rideRequests)
        .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(rideRequests.id, id),
          eq(rideRequests.status, "in_progress"),
          eq(rideRequests.driverUserId, driverUserId),
        ))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to complete ride: ${String(err)}`);
    }
  }

  /**
   * Atomically mark a ride en-route: accepted → driver_en_route.
   * Returns null if no row was updated.
   */
  async markEnRoute(id: string, driverUserId: string): Promise<RideRequest | null> {
    try {
      const rows = await db
        .update(rideRequests)
        .set({ status: "driver_en_route", enRouteAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(rideRequests.id, id),
          eq(rideRequests.status, "accepted"),
          eq(rideRequests.driverUserId, driverUserId),
        ))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to mark ride en-route: ${String(err)}`);
    }
  }

  /**
   * Atomically mark a ride arrived: driver_en_route → driver_arrived.
   * Returns null if no row was updated.
   */
  async markArrived(id: string, driverUserId: string): Promise<RideRequest | null> {
    try {
      const rows = await db
        .update(rideRequests)
        .set({ status: "driver_arrived", arrivedAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(rideRequests.id, id),
          eq(rideRequests.status, "driver_en_route"),
          eq(rideRequests.driverUserId, driverUserId),
        ))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to mark ride arrived: ${String(err)}`);
    }
  }

  /**
   * Atomically start a ride only when status='driver_arrived' AND driver matches.
   * Returns null if no row was updated.
   */
  async start(id: string, driverUserId: string): Promise<RideRequest | null> {
    try {
      const rows = await db
        .update(rideRequests)
        .set({ status: "in_progress", startedAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(rideRequests.id, id),
          eq(rideRequests.status, "driver_arrived"),
          eq(rideRequests.driverUserId, driverUserId),
        ))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to start ride: ${String(err)}`);
    }
  }

  /**
   * Atomically cancel a ride as a driver-confirmed no-show, only when status='driver_arrived'
   * AND the driver matches. Returns null if no row was updated (already cancelled/started by
   * a concurrent request, or driver mismatch) — this is what makes "no-show no registrado
   * anteriormente" and "prevención de doble cargo" enforceable at the DB level, not just in
   * application code.
   */
  async cancelNoShow(id: string, driverUserId: string): Promise<RideRequest | null> {
    try {
      const rows = await db
        .update(rideRequests)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledByUserId: driverUserId,
          cancelledByRole: "driver_no_show",
          cancellationReason: "Confirmado por conductor: pasajero no se presentó.",
          updatedAt: new Date(),
        })
        .where(and(
          eq(rideRequests.id, id),
          eq(rideRequests.status, "driver_arrived"),
          eq(rideRequests.driverUserId, driverUserId),
        ))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to cancel ride as no-show: ${String(err)}`);
    }
  }

  /**
   * Atomically cancel a ride only when it is still in 'accepted' status.
   * Returns null if no row was updated (status changed concurrently).
   */
  async cancelAccepted(
    id: string,
    cancelledByUserId: string,
    cancelledByRole: string,
    cancellationReason: string | null,
  ): Promise<RideRequest | null> {
    try {
      const rows = await db
        .update(rideRequests)
        .set({
          status:             "cancelled",
          cancelledAt:        new Date(),
          cancelledByUserId,
          cancelledByRole,
          cancellationReason,
          updatedAt:          new Date(),
        })
        .where(and(eq(rideRequests.id, id), eq(rideRequests.status, "accepted")))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to cancel accepted ride: ${String(err)}`);
    }
  }

  async createOfflineRide(data: {
    passengerUserId:      string;
    originText:           string;
    destinationText:      string;
    notes:                string | null;
    estimatedFareClp:     number;
    offlinePassengerName: string;
    offlinePassengerPhone: string;
    offlinePassengerEmail?: string | null;
  }): Promise<RideRequest> {
    try {
      const rows = await db
        .insert(rideRequests)
        .values({
          passengerUserId:      data.passengerUserId,
          originText:           data.originText,
          destinationText:      data.destinationText,
          notes:                data.notes,
          estimatedFareClp:     data.estimatedFareClp,
          status:               "requested",
          isOfflineBooking:     true,
          offlinePassengerName:  data.offlinePassengerName,
          offlinePassengerPhone: data.offlinePassengerPhone,
          offlinePassengerEmail: data.offlinePassengerEmail ?? null,
        })
        .returning();
      const row = rows[0];
      if (!row) throw AppError.internal("Insert returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create offline ride request: ${String(err)}`);
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
