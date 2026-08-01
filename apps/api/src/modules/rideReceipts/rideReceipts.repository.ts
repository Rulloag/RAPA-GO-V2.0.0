import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  driverProfiles,
  legalDocuments,
  payments,
  rideLocationUpdates,
  ridePolicyCharges,
  rideReceipts,
  rideRequests,
  userAcceptances,
  users,
  type DriverProfile,
  type NewRideReceipt,
  type Payment,
  type RideLocationUpdate,
  type RidePolicyCharge,
  type RideReceipt,
  type RideRequest,
  type User,
  type UserAcceptance,
} from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";

export interface ReceiptLegalAcceptance extends UserAcceptance {
  documentTypeResolved: string;
  documentTitleResolved: string;
}

export class RideReceiptsRepository {
  async findById(id: string): Promise<RideReceipt | null> {
    try {
      const [row] = await db
        .select()
        .from(rideReceipts)
        .where(eq(rideReceipts.id, id))
        .limit(1);

      return row ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to query ride receipt: ${String(error)}`,
      );
    }
  }

  async findByRideAndType(
    rideId: string,
    type: string,
  ): Promise<RideReceipt | null> {
    try {
      const [row] = await db
        .select()
        .from(rideReceipts)
        .where(
          and(
            eq(rideReceipts.rideId, rideId),
            eq(rideReceipts.type, type),
          ),
        )
        .limit(1);

      return row ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to query ride receipt by ride: ${String(error)}`,
      );
    }
  }

  async createPending(data: NewRideReceipt): Promise<RideReceipt> {
    try {
      const [created] = await db
        .insert(rideReceipts)
        .values(data)
        .onConflictDoNothing({
          target: [rideReceipts.rideId, rideReceipts.type],
        })
        .returning();

      if (created) return created;

      const existing = await this.findByRideAndType(
        data.rideId,
        data.type,
      );

      if (!existing) {
        throw AppError.internal(
          "Receipt insert returned no row and no existing receipt was found.",
        );
      }

      return existing;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(
        `Failed to create ride receipt: ${String(error)}`,
      );
    }
  }

  async markGenerating(id: string): Promise<RideReceipt | null> {
    try {
      const now = new Date();
      const [row] = await db
        .update(rideReceipts)
        .set({
          status: "generating",
          deliveryAttempts: sql`${rideReceipts.deliveryAttempts} + 1`,
          lastAttemptAt: now,
          failureReason: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(rideReceipts.id, id),
            inArray(rideReceipts.status, ["pending", "failed", "generated"]),
          ),
        )
        .returning();

      return row ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to lock ride receipt for generation: ${String(error)}`,
      );
    }
  }

  async markGenerated(input: {
    id: string;
    storageBucket: string;
    storagePath: string;
    pdfSha256: string;
    mapProvider: string;
    routePointCount: number;
    legalDocumentType: string | null;
    legalDocumentVersion: string | null;
    legalAcceptedAt: Date | null;
    snapshot: Record<string, unknown>;
  }): Promise<RideReceipt | null> {
    try {
      const now = new Date();
      const [row] = await db
        .update(rideReceipts)
        .set({
          status: "generated",
          storageBucket: input.storageBucket,
          storagePath: input.storagePath,
          pdfSha256: input.pdfSha256,
          mapProvider: input.mapProvider,
          routePointCount: input.routePointCount,
          legalDocumentType: input.legalDocumentType,
          legalDocumentVersion: input.legalDocumentVersion,
          legalAcceptedAt: input.legalAcceptedAt,
          snapshot: input.snapshot,
          generatedAt: now,
          failureReason: null,
          updatedAt: now,
        })
        .where(eq(rideReceipts.id, input.id))
        .returning();

      return row ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to mark ride receipt generated: ${String(error)}`,
      );
    }
  }

  async markSent(id: string): Promise<RideReceipt | null> {
    try {
      const now = new Date();
      const [row] = await db
        .update(rideReceipts)
        .set({
          status: "sent",
          sentAt: now,
          failureReason: null,
          updatedAt: now,
        })
        .where(eq(rideReceipts.id, id))
        .returning();

      return row ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to mark ride receipt sent: ${String(error)}`,
      );
    }
  }

  async markFailed(id: string, reason: string): Promise<RideReceipt | null> {
    try {
      const [row] = await db
        .update(rideReceipts)
        .set({
          status: "failed",
          failureReason: reason.slice(0, 1500),
          updatedAt: new Date(),
        })
        .where(eq(rideReceipts.id, id))
        .returning();

      return row ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to mark ride receipt failed: ${String(error)}`,
      );
    }
  }

  async listForOwner(ownerUserId: string): Promise<RideReceipt[]> {
    try {
      return await db
        .select()
        .from(rideReceipts)
        .where(eq(rideReceipts.ownerUserId, ownerUserId))
        .orderBy(desc(rideReceipts.createdAt));
    } catch (error) {
      throw AppError.internal(
        `Failed to list ride receipts: ${String(error)}`,
      );
    }
  }

  async listAll(): Promise<RideReceipt[]> {
    try {
      return await db
        .select()
        .from(rideReceipts)
        .orderBy(desc(rideReceipts.createdAt));
    } catch (error) {
      throw AppError.internal(
        `Failed to list all ride receipts: ${String(error)}`,
      );
    }
  }

  async listRetryable(limit: number): Promise<RideReceipt[]> {
    try {
      const retryBefore = new Date(Date.now() - 2 * 60 * 1000);

      return await db
        .select()
        .from(rideReceipts)
        .where(
          and(
            inArray(rideReceipts.status, ["pending", "failed", "generated"]),
            lt(rideReceipts.deliveryAttempts, 5),
            or(
              eq(rideReceipts.status, "pending"),
              lt(rideReceipts.updatedAt, retryBefore),
            ),
          ),
        )
        .orderBy(asc(rideReceipts.createdAt))
        .limit(limit);
    } catch (error) {
      throw AppError.internal(
        `Failed to list retryable ride receipts: ${String(error)}`,
      );
    }
  }

  async findRide(rideId: string): Promise<RideRequest | null> {
    try {
      const [row] = await db
        .select()
        .from(rideRequests)
        .where(eq(rideRequests.id, rideId))
        .limit(1);

      return row ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to query receipt ride: ${String(error)}`,
      );
    }
  }

  async findUser(userId: string): Promise<User | null> {
    try {
      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return row ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to query receipt user: ${String(error)}`,
      );
    }
  }

  async findDriverProfile(userId: string): Promise<DriverProfile | null> {
    try {
      const [row] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, userId))
        .limit(1);

      return row ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to query receipt driver profile: ${String(error)}`,
      );
    }
  }

  async findLatestPayment(rideId: string): Promise<Payment | null> {
    try {
      const [row] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.rideRequestId, rideId),
            eq(payments.paymentPurpose, "ride"),
          ),
        )
        .orderBy(desc(payments.paidAt), desc(payments.createdAt))
        .limit(1);

      return row ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to query receipt payment: ${String(error)}`,
      );
    }
  }

  async findPolicyCharge(id: string): Promise<RidePolicyCharge | null> {
    try {
      const [row] = await db
        .select()
        .from(ridePolicyCharges)
        .where(eq(ridePolicyCharges.id, id))
        .limit(1);

      return row ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to query receipt policy charge: ${String(error)}`,
      );
    }
  }

  async listRoutePoints(
    rideId: string,
    from: Date | null,
    to: Date | null,
  ): Promise<RideLocationUpdate[]> {
    try {
      let predicate = and(
        eq(rideLocationUpdates.rideId, rideId),
        eq(rideLocationUpdates.isMocked, false),
      );

      if (from) {
        predicate = and(
          predicate,
          gte(rideLocationUpdates.capturedAt, from),
        );
      }

      if (to) {
        predicate = and(
          predicate,
          lte(rideLocationUpdates.capturedAt, to),
        );
      }

      return await db
        .select()
        .from(rideLocationUpdates)
        .where(predicate)
        .orderBy(asc(rideLocationUpdates.capturedAt));
    } catch (error) {
      throw AppError.internal(
        `Failed to query receipt route points: ${String(error)}`,
      );
    }
  }

  async findLatestTermsAcceptance(
    userId: string,
    acceptedAtOrBefore: Date,
  ): Promise<ReceiptLegalAcceptance | null> {
    try {
      const rows = await db
        .select({
          acceptance: userAcceptances,
          documentType: legalDocuments.type,
          documentTitle: legalDocuments.title,
        })
        .from(userAcceptances)
        .innerJoin(
          legalDocuments,
          eq(userAcceptances.legalDocumentId, legalDocuments.id),
        )
        .where(
          and(
            eq(userAcceptances.userId, userId),
            inArray(legalDocuments.type, [
              "terms_and_conditions",
              "user_conditions",
            ]),
            lte(userAcceptances.acceptedAt, acceptedAtOrBefore),
          ),
        )
        .orderBy(desc(userAcceptances.acceptedAt))
        .limit(1);

      const row = rows[0];
      if (!row) return null;

      return {
        ...row.acceptance,
        documentTypeResolved: row.documentType,
        documentTitleResolved: row.documentTitle,
      };
    } catch (error) {
      throw AppError.internal(
        `Failed to query legal acceptance for receipt: ${String(error)}`,
      );
    }
  }
}
