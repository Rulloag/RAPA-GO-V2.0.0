import { db } from "../../db/client.js";
import {
  users,
  userDocuments,
  passengerProfiles,
  notifications,
  rideRequests,
  driverStatuses,
  driverProfiles,
} from "../../db/schema/index.js";
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
  rideType:           string;
  scheduledPickupAt:  Date | null;
  priorityFeeClp:     number | null;
  flightNumber:          string | null;
  preferredDriverGender: string | null;
  requestedVehicleCategory: string;
  assignedVehicleCategory: string | null;
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


  async reviewResidenceDocument(input: {
    documentId: string;
    adminUserId: string;
    status: "approved" | "rejected";
    rejectionReason: string | null;
    reclassifiedFareType?: "chilean" | "foreigner" | undefined;
  }): Promise<AdminDocumentRow | null> {
    try {
      const now = new Date();

      await db.transaction(async (tx) => {
        const documentRows = await tx
          .update(userDocuments)
          .set({
            status: input.status,
            rejectionReason: input.rejectionReason,
            reviewedAt: now,
            updatedAt: now,
          })
          .where(eq(userDocuments.id, input.documentId))
          .returning({ userId: userDocuments.userId });

        const document = documentRows[0];
        if (!document) {
          throw AppError.notFound("Document not found.");
        }

        const effectiveFareType =
          input.status === "approved"
            ? "resident"
            : input.reclassifiedFareType;

        if (!effectiveFareType) {
          throw AppError.internal(
            "Missing residence reclassification fare type.",
          );
        }

        const requestedFareType =
          input.status === "approved" ? "resident" : effectiveFareType;

        await tx
          .insert(passengerProfiles)
          .values({
            userId: document.userId,
            requestedFareType,
            effectiveFareType,
            residenceVerificationStatus:
              input.status === "approved" ? "approved" : "rejected",
            residenceRequestedAt: now,
            residenceReviewedAt: now,
            residenceReviewedBy: input.adminUserId,
            residenceRejectionReason:
              input.status === "approved" ? null : input.rejectionReason,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: passengerProfiles.userId,
            set: {
              requestedFareType,
              effectiveFareType,
              residenceVerificationStatus:
                input.status === "approved" ? "approved" : "rejected",
              residenceReviewedAt: now,
              residenceReviewedBy: input.adminUserId,
              residenceRejectionReason:
                input.status === "approved" ? null : input.rejectionReason,
              updatedAt: now,
            },
          });

        const reclassifiedLabel =
          effectiveFareType === "foreigner"
            ? "Turista extranjero"
            : effectiveFareType === "chilean"
              ? "Turista chileno"
              : "RAPA NUI / RESIDENTE RAPA NUI";

        await tx.insert(notifications).values({
          userId: document.userId,
          type:
            input.status === "approved"
              ? "residence_accreditation_approved"
              : "residence_accreditation_reclassified",
          title:
            input.status === "approved"
              ? "Acreditación de residencia aprobada"
              : "Categoría tarifaria actualizada",
          message:
            input.status === "approved"
              ? "Tu acreditación fue aprobada. Mantienes la categoría RAPA NUI / RESIDENTE RAPA NUI."
              : `Tu acreditación no fue aprobada. Tu categoría cambió a ${reclassifiedLabel}. Motivo: ${input.rejectionReason ?? "No informado"}`,
          entityType: "user_document",
          entityId: input.documentId,
          actionUrl: "/profile/documents",
          createdAt: now,
        });
      });

      return this.findDocumentById(input.documentId);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(
        `Failed to review residence document: ${String(err)}`,
      );
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
          rideType:           rideRequests.rideType,
          scheduledPickupAt:  rideRequests.scheduledPickupAt,
          priorityFeeClp:        rideRequests.priorityFeeClp,
          flightNumber:          rideRequests.flightNumber,
          preferredDriverGender: rideRequests.preferredDriverGender,
          requestedVehicleCategory: rideRequests.requestedVehicleCategory,
          assignedVehicleCategory: rideRequests.assignedVehicleCategory,
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
          rideType:           rideRequests.rideType,
          scheduledPickupAt:  rideRequests.scheduledPickupAt,
          priorityFeeClp:        rideRequests.priorityFeeClp,
          flightNumber:          rideRequests.flightNumber,
          preferredDriverGender: rideRequests.preferredDriverGender,
          requestedVehicleCategory: rideRequests.requestedVehicleCategory,
          assignedVehicleCategory: rideRequests.assignedVehicleCategory,
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
   * Atomically assign a driver to a ride WITH eligibility enforcement.
   * Prefer RidesRepository.accept from services; this path must not bypass
   * vehicle category validation if invoked.
   */
  async assignDriver(rideId: string, driverUserId: string): Promise<RideRequest | null> {
    try {
      return await db.transaction(async (tx) => {
        const ride = (
          await tx
            .select()
            .from(rideRequests)
            .where(eq(rideRequests.id, rideId))
            .limit(1)
        )[0];
        if (!ride || ride.status !== "requested") return null;

        const profile = (
          await tx
            .select()
            .from(driverProfiles)
            .where(eq(driverProfiles.userId, driverUserId))
            .limit(1)
        )[0];

        const { assertVehicleEligibleForRide } = await import(
          "../rides/vehicleEligibility.js"
        );
        const eligibility = await assertVehicleEligibleForRide({
          profile,
          requestedVehicleCategory: ride.requestedVehicleCategory,
        });

        const now = new Date();
        const rows = await tx
          .update(rideRequests)
          .set({
            status: "accepted",
            driverUserId,
            acceptedAt: now,
            assignedVehicleCategory: eligibility.assignedVehicleCategory,
            assignedVehiclePlate: profile?.vehiclePlate ?? null,
            updatedAt: now,
          })
          .where(
            and(
              eq(rideRequests.id, rideId),
              eq(rideRequests.status, "requested"),
            ),
          )
          .returning();
        return rows[0] ?? null;
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
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

  async listActiveDrivers(): Promise<(User & {
    availability: string | null;
    currentRideId: string | null;
    lastSeenAt: Date | null;
    currentZone: string | null;
    vehicleBrand: string | null;
    vehicleModel: string | null;
    vehicleYear: number | null;
    vehiclePlate: string | null;
    vehicleCategory: string | null;
    capabilityXl: boolean | null;
    capabilityExtraLuggage: boolean | null;
    capabilityComfort: boolean | null;
  })[]> {
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
          vehicleBrand:  driverProfiles.vehicleBrand,
          vehicleModel:  driverProfiles.vehicleModel,
          vehicleYear:   driverProfiles.vehicleYear,
          vehiclePlate:  driverProfiles.vehiclePlate,
          vehicleCategory: driverProfiles.vehicleCategory,
          capabilityXl: driverProfiles.capabilityXl,
          capabilityExtraLuggage: driverProfiles.capabilityExtraLuggage,
          capabilityComfort: driverProfiles.capabilityComfort,
        })
        .from(users)
        .leftJoin(driverStatuses, eq(users.id, driverStatuses.driverUserId))
        .leftJoin(driverProfiles, eq(users.id, driverProfiles.userId))
        .where(and(eq(users.role, "driver"), eq(users.status, "active")));
      return rows as (User & {
        availability: string | null;
        currentRideId: string | null;
        lastSeenAt: Date | null;
        currentZone: string | null;
        vehicleBrand: string | null;
        vehicleModel: string | null;
        vehicleYear: number | null;
        vehiclePlate: string | null;
        vehicleCategory: string | null;
        capabilityXl: boolean | null;
        capabilityExtraLuggage: boolean | null;
        capabilityComfort: boolean | null;
      })[];
    } catch (err) {
      throw AppError.internal(`Failed to list active drivers: ${String(err)}`);
    }
  }
}
