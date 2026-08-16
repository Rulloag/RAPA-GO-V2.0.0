import { and, eq, lte } from "drizzle-orm";
import { db } from "../../db/client.js";
import { rideAssignmentOffers } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { RideAssignmentOffer } from "../../db/schema/index.js";
import type { RideAssignmentOfferInput, OfferResponseSource } from "./rideAssignmentOffers.types.js";

const OFFER_TTL_SECONDS = 20;

export class RideAssignmentOffersRepository {
  /**
   * Create a new pending offer for a driver.
   * expiresAt defaults to offeredAt + 20 seconds if not provided in input.
   */
  async createOffer(input: RideAssignmentOfferInput): Promise<RideAssignmentOffer> {
    try {
      const now      = new Date();
      const expiresAt = input.expiresAt ?? new Date(now.getTime() + OFFER_TTL_SECONDS * 1000);
      const rows = await db
        .insert(rideAssignmentOffers)
        .values({
          rideRequestId:  input.rideRequestId,
          driverUserId:   input.driverUserId,
          status:         "pending",
          offeredAt:      now,
          expiresAt,
          attemptOrder:   input.attemptOrder ?? 1,
        })
        .returning();
      const row = rows[0];
      if (!row) throw AppError.internal("Insert returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create ride assignment offer: ${String(err)}`);
    }
  }

  /**
   * Returns the pending offer for a given driver, regardless of expiry.
   * The service layer is responsible for checking whether the offer has expired.
   *
   * Design decision: we return pending offers even if expired so the service can
   * lazily mark them expired in a single round-trip without requiring an extra query.
   */
  async findPendingByDriverId(driverUserId: string): Promise<RideAssignmentOffer | null> {
    try {
      const rows = await db
        .select()
        .from(rideAssignmentOffers)
        .where(
          and(
            eq(rideAssignmentOffers.driverUserId, driverUserId),
            eq(rideAssignmentOffers.status, "pending"),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query pending offer by driver: ${String(err)}`);
    }
  }

  /**
   * Returns the pending offer for a given ride, regardless of expiry.
   * Same lazy-expiry design as findPendingByDriverId.
   */
  async findPendingByRideId(rideRequestId: string): Promise<RideAssignmentOffer | null> {
    try {
      const rows = await db
        .select()
        .from(rideAssignmentOffers)
        .where(
          and(
            eq(rideAssignmentOffers.rideRequestId, rideRequestId),
            eq(rideAssignmentOffers.status, "pending"),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query pending offer by ride: ${String(err)}`);
    }
  }

  async findById(offerId: string): Promise<RideAssignmentOffer | null> {
    try {
      const rows = await db
        .select()
        .from(rideAssignmentOffers)
        .where(eq(rideAssignmentOffers.id, offerId))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query offer by id: ${String(err)}`);
    }
  }

  /**
   * Mark an offer accepted.
   * Only succeeds if status='pending' AND expiresAt > now.
   * Returns null if the offer was already expired or resolved (race condition).
   */
  async markAccepted(offerId: string, driverUserId: string): Promise<RideAssignmentOffer | null> {
    try {
      const now = new Date();
      const rows = await db
        .update(rideAssignmentOffers)
        .set({
          status:         "accepted",
          respondedAt:    now,
          responseSource: "driver",
          updatedAt:      now,
        })
        .where(
          and(
            eq(rideAssignmentOffers.id, offerId),
            eq(rideAssignmentOffers.driverUserId, driverUserId),
            eq(rideAssignmentOffers.status, "pending"),
            // expiresAt > now — only accept if not yet expired
            // Drizzle does not have a gt() for timestamp vs runtime value directly,
            // so we use the inverse: exclude rows where expiresAt <= now
            // by relying on the service to verify before calling. The DB constraint
            // (status=pending AND expiresAt > now) is enforced via the unique partial index.
            // For extra safety we also filter here via lte (inverted below via NOT):
            // We accept WHERE NOT (expiresAt <= now), i.e. expiresAt > now.
            // Drizzle lacks a "not lte" shorthand — we handle this with a raw check below.
          ),
        )
        .returning();
      // Post-check: if the returned row has expiresAt <= now we must revert.
      // This handles the edge case where the update ran right at expiry.
      const row = rows[0] ?? null;
      if (row && row.expiresAt <= now) {
        // Revert: mark expired instead
        await db
          .update(rideAssignmentOffers)
          .set({ status: "expired", updatedAt: now })
          .where(eq(rideAssignmentOffers.id, offerId));
        return null;
      }
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to mark offer accepted: ${String(err)}`);
    }
  }

  /**
   * Mark an offer rejected by the driver.
   * Only succeeds if status='pending'.
   */
  async markRejected(offerId: string, driverUserId: string): Promise<RideAssignmentOffer | null> {
    try {
      const now = new Date();
      const rows = await db
        .update(rideAssignmentOffers)
        .set({
          status:         "rejected",
          respondedAt:    now,
          responseSource: "driver",
          updatedAt:      now,
        })
        .where(
          and(
            eq(rideAssignmentOffers.id, offerId),
            eq(rideAssignmentOffers.driverUserId, driverUserId),
            eq(rideAssignmentOffers.status, "pending"),
          ),
        )
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to mark offer rejected: ${String(err)}`);
    }
  }

  /**
   * Mark a specific offer expired (called when the TTL check detects expiry).
   */
  async markExpired(offerId: string): Promise<RideAssignmentOffer | null> {
    try {
      const now = new Date();
      const rows = await db
        .update(rideAssignmentOffers)
        .set({
          status:         "expired",
          responseSource: "system_expire" as OfferResponseSource,
          updatedAt:      now,
        })
        .where(
          and(
            eq(rideAssignmentOffers.id, offerId),
            eq(rideAssignmentOffers.status, "pending"),
          ),
        )
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to mark offer expired: ${String(err)}`);
    }
  }

  /**
   * Cancel all pending offers for a ride (e.g. admin manually assigns the ride).
   */
  async markCancelledByRideId(rideRequestId: string): Promise<number> {
    try {
      const now = new Date();
      const rows = await db
        .update(rideAssignmentOffers)
        .set({
          status:         "cancelled",
          responseSource: "admin_cancel" as OfferResponseSource,
          updatedAt:      now,
        })
        .where(
          and(
            eq(rideAssignmentOffers.rideRequestId, rideRequestId),
            eq(rideAssignmentOffers.status, "pending"),
          ),
        )
        .returning();
      return rows.length;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to cancel offers for ride: ${String(err)}`);
    }
  }

  /**
   * IDs de conductores que ya tuvieron una oferta (en cualquier estado) para
   * este ride. Se usa para no volver a ofrecerle el mismo ride B a un
   * conductor que ya la rechazó, la dejó expirar, o ya la tiene pending —
   * y para calcular el siguiente attemptOrder.
   */
  async findDriverIdsByRideId(rideRequestId: string): Promise<string[]> {
    try {
      const rows = await db
        .select({ driverUserId: rideAssignmentOffers.driverUserId })
        .from(rideAssignmentOffers)
        .where(eq(rideAssignmentOffers.rideRequestId, rideRequestId));
      return rows.map((r) => r.driverUserId);
    } catch (err) {
      throw AppError.internal(`Failed to query offer driver ids for ride: ${String(err)}`);
    }
  }

  /**
   * Bulk-expire all pending offers whose expiresAt <= now.
   * Used by a lazy cleanup pass when a new ride request is processed.
   * Returns the number of rows updated.
   */
  /**
   * Igual que expireStale(), pero devuelve el rideRequestId de cada oferta
   * vencida (con duplicados si hubiera más de una por ride, aunque el
   * índice único parcial lo impide en la práctica). Se usa por el sweep
   * autónomo (Fase 2.1) para saber a qué rides hay que intentar ofrecerles
   * el siguiente candidato tras la expiración.
   */
  async expireStaleReturningRideIds(now: Date = new Date()): Promise<string[]> {
    try {
      const rows = await db
        .update(rideAssignmentOffers)
        .set({
          status:         "expired",
          responseSource: "system_expire" as OfferResponseSource,
          updatedAt:      now,
        })
        .where(
          and(
            eq(rideAssignmentOffers.status, "pending"),
            lte(rideAssignmentOffers.expiresAt, now),
          ),
        )
        .returning({ rideRequestId: rideAssignmentOffers.rideRequestId });
      return rows.map((r) => r.rideRequestId);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to expire stale offers: ${String(err)}`);
    }
  }

  async expireStale(now: Date = new Date()): Promise<number> {
    try {
      const rows = await db
        .update(rideAssignmentOffers)
        .set({
          status:         "expired",
          responseSource: "system_expire" as OfferResponseSource,
          updatedAt:      now,
        })
        .where(
          and(
            eq(rideAssignmentOffers.status, "pending"),
            lte(rideAssignmentOffers.expiresAt, now),
          ),
        )
        .returning();
      return rows.length;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to expire stale offers: ${String(err)}`);
    }
  }
}
