import { db } from "../../db/client.js";
import { users, userDocuments, rideRequests, driverStatuses } from "../../db/schema/index.js";
import { eq, and, or, ilike, inArray, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { AppError } from "../../shared/errors/AppError.js";
import type { User } from "../users/users.types.js";
import type { UserDocument, RideRequest } from "../../db/schema/index.js";

export interface AdminRideRow {
  id:                 string;
  passengerUserId:    string;
  passengerName:      string;
  passengerEmail:     string;
  driverUserId:       string | null;
  driverName:         string | null;
  driverEmail:        string | null;
  originText:         string;
  destinationText:    string;
  notes:              string | null;
  estimatedFareClp:   number | null;
  status:             string;
  requestedAt:        Date;
  acceptedAt:         Date | null;
  enRouteAt:          Date | null;
  arrivedAt:          Date | null;
  startedAt:          Date | null;
  completedAt:        Date | null;
  cancelledAt:        Date | null;
  cancellationReason: string | null;
  cancelledByRole:    string | null;
  createdAt:          Date;
}

export interface ListRidesFilter {
  status?:          string | undefined;
  driverUserId?:    string | undefined;
  passengerUserId?: string | undefined;
}

export interface AdminDocumentRow extends UserDocument {
  userName:  string;
  userEmail: string;
  userRole:  string;
}

export interface ListDocumentsFilter {
  status?:       string | undefined;
  documentType?: string | undefined;
  userId?:       string | undefined;
}

export interface ListUsersFilter {
  role?:   string | undefined;
  status?: string | undefined;
  search?: string | undefined;
}

export class AdminRepository {
  async listUsers(filter: ListUsersFilter): Promise<User[]> {
    try {
      const conditions: SQL[] = [];

      if (filter.role)   conditions.push(eq(users.role,   filter.role));
      if (filter.status) conditions.push(eq(users.status, filter.status));
      if (filter.search) {
        const term = `%${filter.search}%`;
        conditions.push(or(ilike(users.name, term), ilike(users.email, term))!);
      }

      const query = db.select().from(users);
      const rows = conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;

      return rows;
    } catch (err) {
      throw AppError.internal(`Failed to list users: ${String(err)}`);
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to find user: ${String(err)}`);
    }
  }

  async updateStatus(id: string, status: string): Promise<User | null> {
    try {
      const rows = await db
        .update(users)
        .set({ status, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to update user status: ${String(err)}`);
    }
  }

  async listDocuments(filter: ListDocumentsFilter): Promise<AdminDocumentRow[]> {
    try {
      const conditions: SQL[] = [];
      if (filter.status)       conditions.push(eq(userDocuments.status,       filter.status));
      if (filter.documentType) conditions.push(eq(userDocuments.documentType, filter.documentType));
      if (filter.userId)       conditions.push(eq(userDocuments.userId,       filter.userId));

      const query = db
        .select({
          id:              userDocuments.id,
          userId:          userDocuments.userId,
          documentType:    userDocuments.documentType,
          status:          userDocuments.status,
          fileUrl:         userDocuments.fileUrl,
          rejectionReason: userDocuments.rejectionReason,
          uploadedAt:      userDocuments.uploadedAt,
          reviewedAt:      userDocuments.reviewedAt,
          createdAt:       userDocuments.createdAt,
          updatedAt:       userDocuments.updatedAt,
          userName:        users.name,
          userEmail:       users.email,
          userRole:        users.role,
        })
        .from(userDocuments)
        .innerJoin(users, eq(userDocuments.userId, users.id));

      const rows = conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;

      return rows;
    } catch (err) {
      throw AppError.internal(`Failed to list documents: ${String(err)}`);
    }
  }

  async findDocumentById(id: string): Promise<AdminDocumentRow | null> {
    try {
      const rows = await db
        .select({
          id:              userDocuments.id,
          userId:          userDocuments.userId,
          documentType:    userDocuments.documentType,
          status:          userDocuments.status,
          fileUrl:         userDocuments.fileUrl,
          rejectionReason: userDocuments.rejectionReason,
          uploadedAt:      userDocuments.uploadedAt,
          reviewedAt:      userDocuments.reviewedAt,
          createdAt:       userDocuments.createdAt,
          updatedAt:       userDocuments.updatedAt,
          userName:        users.name,
          userEmail:       users.email,
          userRole:        users.role,
        })
        .from(userDocuments)
        .innerJoin(users, eq(userDocuments.userId, users.id))
        .where(eq(userDocuments.id, id))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to find document: ${String(err)}`);
    }
  }

  async reviewDocument(
    id: string,
    status: string,
    rejectionReason: string | null,
  ): Promise<AdminDocumentRow | null> {
    try {
      await db
        .update(userDocuments)
        .set({ status, rejectionReason, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(userDocuments.id, id));
      return this.findDocumentById(id);
    } catch (err) {
      throw AppError.internal(`Failed to review document: ${String(err)}`);
    }
  }

  // ─── Rides ────────────────────────────────────────────────────────────────

  private buildRideSelect() {
    const passenger = alias(users, "passenger");
    const driver    = alias(users, "driver");
    return { passenger, driver };
  }

  async listRides(filter: ListRidesFilter): Promise<AdminRideRow[]> {
    try {
      const passenger = alias(users, "passenger");
      const driver    = alias(users, "driver");
      const conditions: SQL[] = [];
      if (filter.status)          conditions.push(eq(rideRequests.status,          filter.status));
      if (filter.driverUserId)    conditions.push(eq(rideRequests.driverUserId,    filter.driverUserId));
      if (filter.passengerUserId) conditions.push(eq(rideRequests.passengerUserId, filter.passengerUserId));

      const query = db
        .select({
          id:                 rideRequests.id,
          passengerUserId:    rideRequests.passengerUserId,
          passengerName:      passenger.name,
          passengerEmail:     passenger.email,
          driverUserId:       rideRequests.driverUserId,
          driverName:         driver.name,
          driverEmail:        driver.email,
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
          cancelledByRole:    rideRequests.cancelledByRole,
          createdAt:          rideRequests.createdAt,
        })
        .from(rideRequests)
        .innerJoin(passenger, eq(rideRequests.passengerUserId, passenger.id))
        .leftJoin(driver, eq(rideRequests.driverUserId, driver.id))
        .orderBy(rideRequests.requestedAt);

      const rows = conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;

      return rows as AdminRideRow[];
    } catch (err) {
      throw AppError.internal(`Failed to list rides: ${String(err)}`);
    }
  }

  async findRideById(id: string): Promise<AdminRideRow | null> {
    try {
      const passenger = alias(users, "passenger");
      const driver    = alias(users, "driver");
      const rows = await db
        .select({
          id:                 rideRequests.id,
          passengerUserId:    rideRequests.passengerUserId,
          passengerName:      passenger.name,
          passengerEmail:     passenger.email,
          driverUserId:       rideRequests.driverUserId,
          driverName:         driver.name,
          driverEmail:        driver.email,
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
          cancelledByRole:    rideRequests.cancelledByRole,
          createdAt:          rideRequests.createdAt,
        })
        .from(rideRequests)
        .innerJoin(passenger, eq(rideRequests.passengerUserId, passenger.id))
        .leftJoin(driver, eq(rideRequests.driverUserId, driver.id))
        .where(eq(rideRequests.id, id))
        .limit(1);
      return (rows[0] as AdminRideRow) ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to find ride: ${String(err)}`);
    }
  }

  /**
   * Atomically assign a driver to a ride.
   * WHERE id=? AND status='requested' — returns null if no row updated.
   */
  async assignDriver(rideId: string, driverUserId: string): Promise<RideRequest | null> {
    try {
      const rows = await db
        .update(rideRequests)
        .set({ status: "accepted", driverUserId, acceptedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(rideRequests.id, rideId), eq(rideRequests.status, "requested")))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to assign driver: ${String(err)}`);
    }
  }

  /**
   * Cancel a ride if its current status is among cancelableStatuses.
   * Returns null if no row was updated.
   */
  async cancelRide(
    rideId: string,
    adminUserId: string,
    reason: string,
    cancelableStatuses: string[],
  ): Promise<RideRequest | null> {
    try {
      const rows = await db
        .update(rideRequests)
        .set({
          status:             "cancelled",
          cancellationReason: reason,
          cancelledByUserId:  adminUserId,
          cancelledByRole:    "admin",
          cancelledAt:        new Date(),
          updatedAt:          new Date(),
        })
        .where(and(eq(rideRequests.id, rideId), inArray(rideRequests.status, cancelableStatuses)))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to cancel ride: ${String(err)}`);
    }
  }

  async listActiveDrivers(): Promise<(User & { availability: string | null; currentRideId: string | null; lastSeenAt: Date | null; currentZone: string | null })[]> {
    try {
      const rows = await db
        .select({
          id:           users.id,
          name:         users.name,
          email:        users.email,
          role:         users.role,
          status:       users.status,
          avatarUrl:    users.avatarUrl,
          isVerified:   users.isVerified,
          createdAt:    users.createdAt,
          updatedAt:    users.updatedAt,
          availability:  driverStatuses.availability,
          currentRideId: driverStatuses.currentRideId,
          lastSeenAt:    driverStatuses.lastSeenAt,
          currentZone:   driverStatuses.currentZone,
        })
        .from(users)
        .leftJoin(driverStatuses, eq(users.id, driverStatuses.driverUserId))
        .where(and(eq(users.role, "driver"), eq(users.status, "active")));
      return rows as (User & { availability: string | null; currentRideId: string | null; lastSeenAt: Date | null; currentZone: string | null })[];
    } catch (err) {
      throw AppError.internal(`Failed to list active drivers: ${String(err)}`);
    }
  }
}
