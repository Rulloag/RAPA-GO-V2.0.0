import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { AdminRepository } from "./admin.repository.js";
import { AuditService } from "../audit/audit.service.js";
import { DriverStatusRepository } from "../drivers/driverStatus.repository.js";
import { DriverComplianceService } from "../drivers/driverCompliance.service.js";
import { OfflineRepository } from "../offline/offline.repository.js";
import { RidesRepository } from "../rides/rides.repository.js";
import { RideAssignmentOffersRepository } from "../rides/rideAssignmentOffers.repository.js";
import { rideReceiptsService } from "../rideReceipts/rideReceipts.service.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { ListUsersQuery, UpdateUserStatusInput, ListDocumentsQuery, ReviewDocumentInput, AdminListRidesQuery, AdminAssignDriverInput, AdminCancelRideInput, AdminSyncToRideInput } from "./admin.schemas.js";
import type { AdminUsersListResult, AdminUserResult, AdminUserResponse, AdminDocumentResponse, AdminDocumentsListResult, AdminDocumentResult, AdminRidesListResult, AdminRideResult, AdminRideResponse, ActiveDriversListResult, ActiveDriverResponse } from "./admin.types.js";
import type { AdminDocumentRow, AdminRideRow } from "./admin.repository.js";
import type { User } from "../users/users.types.js";

const tokenService     = new TokenService();
const sessionService   = new SessionService();
const usersRepo        = new UsersRepository();
const adminRepo        = new AdminRepository();
const auditService     = new AuditService();
const driverStatusRepo = new DriverStatusRepository();
const driverComplianceService = new DriverComplianceService();
const offlineRepo      = new OfflineRepository();
const ridesRepo        = new RidesRepository();
const offersRepo       = new RideAssignmentOffersRepository();

const RESIDENCE_DOCUMENT_TYPES = new Set([
  "rapa_nui_residence",
  "residence_document",
  "rapanui_residence",
  "resident_certificate",
  "rapa_nui_resident_certificate",
  "residente_rapa_nui_document",
]);

function isResidenceDocumentType(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    RESIDENCE_DOCUMENT_TYPES.has(normalized) ||
    normalized.includes("residen") ||
    normalized.includes("rapa")
  );
}

function toRideResponse(r: AdminRideRow): AdminRideResponse {
  return {
    id:                 r.id,
    passengerUserId:    r.passengerUserId,
    passengerName:      r.passengerName,
    passengerEmail:     r.passengerEmail,
    driverUserId:       r.driverUserId ?? null,
    driverName:         r.driverName ?? null,
    driverEmail:        r.driverEmail ?? null,
    originText:         r.originText,
    destinationText:    r.destinationText,
    notes:              r.notes ?? null,
    estimatedFareClp:   r.estimatedFareClp ?? null,
    status:             r.status,
    requestedAt:        r.requestedAt.toISOString(),
    acceptedAt:         r.acceptedAt?.toISOString() ?? null,
    enRouteAt:          r.enRouteAt?.toISOString() ?? null,
    arrivedAt:          r.arrivedAt?.toISOString() ?? null,
    startedAt:          r.startedAt?.toISOString() ?? null,
    completedAt:        r.completedAt?.toISOString() ?? null,
    cancelledAt:        r.cancelledAt?.toISOString() ?? null,
    cancellationReason: r.cancellationReason ?? null,
    cancelledByRole:    r.cancelledByRole ?? null,
    createdAt:          r.createdAt.toISOString(),
    rideType:           r.rideType ?? "immediate",
    scheduledPickupAt:  r.scheduledPickupAt?.toISOString() ?? null,
    priorityFeeClp:         r.priorityFeeClp ?? null,
    flightNumber:           r.flightNumber ?? null,
    preferredDriverGender:  (r.preferredDriverGender as "female" | null | undefined) ?? null,
    requestedVehicleCategory: r.requestedVehicleCategory ?? "standard",
    assignedVehicleCategory: r.assignedVehicleCategory ?? null,
  };
}

function toDriverResponse(u: User & { availability?: string | null; currentRideId?: string | null; lastSeenAt?: Date | null; currentZone?: string | null }): ActiveDriverResponse {
  return {
    id:            u.id,
    name:          u.name,
    email:         u.email,
    status:        u.status,
    isVerified:    u.isVerified,
    createdAt:     u.createdAt.toISOString(),
    availability:  u.availability ?? "unavailable",
    currentRideId: u.currentRideId ?? null,
    lastSeenAt:    u.lastSeenAt?.toISOString() ?? null,
    currentZone:   u.currentZone ?? null,
  };
}

function toDocResponse(d: AdminDocumentRow): AdminDocumentResponse {
  return {
    id:              d.id,
    userId:          d.userId,
    userName:        d.userName,
    userEmail:       d.userEmail,
    userRole:        d.userRole,
    documentType:    d.documentType,
    status:          d.status,
    fileUrl:         d.fileUrl,
    rejectionReason: d.rejectionReason,
    uploadedAt:      d.uploadedAt?.toISOString() ?? null,
    reviewedAt:      d.reviewedAt?.toISOString() ?? null,
    createdAt:       d.createdAt.toISOString(),
  };
}

function toResponse(u: User): AdminUserResponse {
  return {
    id:         u.id,
    email:      u.email,
    name:       u.name,
    role:       u.role,
    status:     u.status,
    isVerified: u.isVerified,
    createdAt:  u.createdAt.toISOString(),
  };
}

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload;
  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, code: err.code, message: err.message, statusCode: err.statusCode };
    }
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 };
  }

  const hash  = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);
  if (!valid) {
    return { ok: false, code: "AUTH_SESSION_REVOKED", message: "Session has been revoked.", statusCode: 401 };
  }

  const user = await usersRepo.findById(payload.sub);
  if (!user) {
    return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
  }

  return { ok: true, userId: user.id, role: user.role };
}

export class AdminService {
  async listUsers(accessToken: string, query: ListUsersQuery): Promise<AdminUsersListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin access required.", statusCode: 403 };
    }

    const rows = await adminRepo.listUsers({
      role:   query.role,
      status: query.status,
      search: query.search,
    });

    return { ok: true, users: rows.map(toResponse) };
  }

  async updateUserStatus(
    accessToken: string,
    targetUserId: string,
    input: UpdateUserStatusInput,
  ): Promise<AdminUserResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin access required.", statusCode: 403 };
    }

    if (auth.userId === targetUserId) {
      return { ok: false, code: "ADMIN_CANNOT_CHANGE_OWN_STATUS", message: "Admins cannot change their own status.", statusCode: 403 };
    }

    const existing = await adminRepo.findById(targetUserId);
    if (!existing) {
      return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
    }

    const updated = await adminRepo.updateStatus(targetUserId, input.status);
    if (!updated) {
      return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
    }

    if (input.status !== "active") {
      await sessionService.revokeAllForUser(targetUserId);
    }

    auditService.recordSafe({
      eventType: "admin.user_status_changed",
      metadata:  { adminUserId: auth.userId, targetUserId, previousStatus: existing.status, newStatus: input.status },
    });

    return { ok: true, user: toResponse(updated) };
  }

  async listDocuments(accessToken: string, query: ListDocumentsQuery): Promise<AdminDocumentsListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin access required.", statusCode: 403 };
    }

    const rows = await adminRepo.listDocuments({
      status:       query.status,
      documentType: query.documentType,
      userId:       query.userId,
    });

    return { ok: true, documents: rows.map(toDocResponse) };
  }

  async reviewDocument(
    accessToken: string,
    documentId: string,
    input: ReviewDocumentInput,
  ): Promise<AdminDocumentResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin access required.", statusCode: 403 };
    }

    const existing = await adminRepo.findDocumentById(documentId);
    if (!existing) {
      return { ok: false, code: "NOT_FOUND", message: "Document not found.", statusCode: 404 };
    }

    const rejectionReason =
      input.status === "approved" ? null : (input.rejectionReason ?? null);
    const isResidenceDocument = isResidenceDocumentType(existing.documentType);

    if (
      isResidenceDocument &&
      input.status === "rejected" &&
      !input.reclassifiedFareType
    ) {
      return {
        ok: false,
        code: "ADMIN_RESIDENCE_RECLASSIFICATION_REQUIRED",
        message:
          "Debes elegir Turista chileno o Turista extranjero al rechazar la acreditación.",
        statusCode: 400,
      };
    }

    const updated = isResidenceDocument
      ? await adminRepo.reviewResidenceDocument({
          documentId,
          adminUserId: auth.userId,
          status: input.status,
          rejectionReason,
          ...(input.reclassifiedFareType
            ? { reclassifiedFareType: input.reclassifiedFareType }
            : {}),
        })
      : await adminRepo.reviewDocument(
          documentId,
          input.status,
          rejectionReason,
        );

    if (!updated) {
      return { ok: false, code: "NOT_FOUND", message: "Document not found.", statusCode: 404 };
    }

    auditService.recordSafe({
      eventType: "admin.document_reviewed",
      metadata: {
        adminUserId: auth.userId,
        documentId,
        previousStatus: existing.status,
        newStatus: input.status,
        fareType: isResidenceDocument
          ? input.status === "approved"
            ? "resident"
            : (input.reclassifiedFareType ?? null)
          : null,
      },
    });

    return { ok: true, document: toDocResponse(updated) };
  }

  async listRides(accessToken: string, query: AdminListRidesQuery): Promise<AdminRidesListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin access required.", statusCode: 403 };
    }

    const rows = await adminRepo.listRides({
      status:          query.status,
      driverUserId:    query.driverUserId,
      passengerUserId: query.passengerUserId,
    });
    return { ok: true, rides: rows.map(toRideResponse) };
  }

  async listActiveDrivers(accessToken: string): Promise<ActiveDriversListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin access required.", statusCode: 403 };
    }

    const rows = await adminRepo.listActiveDrivers();
    return { ok: true, drivers: rows.map(toDriverResponse) };
  }

  async assignDriver(
    accessToken: string,
    rideId: string,
    input: AdminAssignDriverInput,
  ): Promise<AdminRideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin access required.", statusCode: 403 };
    }

    const existing = await adminRepo.findRideById(rideId);
    if (!existing) {
      return { ok: false, code: "NOT_FOUND", message: "Ride not found.", statusCode: 404 };
    }
    if (existing.status !== "requested") {
      return { ok: false, code: "RIDE_CANNOT_ASSIGN", message: `Ride cannot be assigned — current status is '${existing.status}'.`, statusCode: 409 };
    }

    const driver = await adminRepo.findById(input.driverUserId);
    if (!driver) {
      return { ok: false, code: "NOT_FOUND", message: "Driver not found.", statusCode: 404 };
    }
    if (driver.role !== "driver") {
      return { ok: false, code: "VALIDATION_ERROR", message: "User is not a driver.", statusCode: 400 };
    }
    if (driver.status !== "active") {
      return { ok: false, code: "DRIVER_NOT_AVAILABLE", message: "Driver is not active.", statusCode: 400 };
    }

    const restAccess = await driverComplianceService.canReceiveNewOffers(
      input.driverUserId,
    );
    if (!restAccess.allowed) {
      return {
        ok: false,
        code: "DRIVER_REST_PERIOD",
        message: restAccess.state.message,
        statusCode: 409,
      };
    }

    const driverStatus = await driverStatusRepo.findByDriverId(input.driverUserId);
    if (!driverStatus || driverStatus.availability !== "available") {
      return {
        ok: false,
        code: "DRIVER_NOT_AVAILABLE",
        message: "El conductor no está disponible en este momento.",
        statusCode: 409,
      };
    }

    const updated = await ridesRepo.accept(rideId, input.driverUserId);
    if (!updated) {
      const refetch = await adminRepo.findRideById(rideId);
      return {
        ok: false,
        code: "RIDE_CANNOT_ASSIGN",
        message: `Ride cannot be assigned — current status is '${refetch?.status ?? "unknown"}'.`,
        statusCode: 409,
      };
    }

    // Scheduled rides keep driver available until they press "Voy en camino"
    if (existing.rideType !== "scheduled") {
      await driverStatusRepo.setBusy(input.driverUserId, rideId);
    }

    auditService.recordSafe({
      eventType: "admin.ride_driver_assigned",
      metadata:  {
        adminUserId:    auth.userId,
        rideId,
        driverUserId:   input.driverUserId,
        previousStatus: "requested",
        newStatus:      "accepted",
        requestedVehicleCategory:
          existing.requestedVehicleCategory ?? "standard",
        assignedVehicleCategory:
          updated.assignedVehicleCategory ?? null,
        vehicleCategoryMismatch:
          Boolean(
            existing.requestedVehicleCategory &&
              updated.assignedVehicleCategory &&
              existing.requestedVehicleCategory !==
                updated.assignedVehicleCategory,
          ),
      },
    });

    const ride = await adminRepo.findRideById(rideId);
    if (!ride) return { ok: false, code: "NOT_FOUND", message: "Ride not found after update.", statusCode: 404 };

    const response = toRideResponse(ride) as ReturnType<typeof toRideResponse> &
      Record<string, unknown>;
    if (
      ride.requestedVehicleCategory &&
      ride.assignedVehicleCategory &&
      ride.requestedVehicleCategory !== ride.assignedVehicleCategory
    ) {
      response["vehicleCategoryMismatchWarning"] =
        "El vehículo seleccionado está registrado en una categoría diferente a la solicitada.";
    }

    return { ok: true, ride: response };
  }

  async adminCancelRide(
    accessToken: string,
    rideId: string,
    input: AdminCancelRideInput,
  ): Promise<AdminRideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin access required.", statusCode: 403 };
    }

    const existing = await adminRepo.findRideById(rideId);
    if (!existing) {
      return { ok: false, code: "NOT_FOUND", message: "Ride not found.", statusCode: 404 };
    }

    const cancelableStatuses = ["requested", "accepted", "driver_en_route", "driver_arrived"];
    if (!cancelableStatuses.includes(existing.status)) {
      return {
        ok: false,
        code: "RIDE_CANNOT_CANCEL",
        message: `Ride cannot be cancelled — current status is '${existing.status}'.`,
        statusCode: 409,
      };
    }

    const previousStatus = existing.status;
    const updated = existing.status === "requested"
      ? await adminRepo.cancelRide(
          rideId,
          auth.userId,
          input.reason,
          cancelableStatuses,
        )
      : await ridesRepo.cancelAccepted(
          rideId,
          auth.userId,
          "admin",
          input.reason,
          { cancellationEvent: "admin_ride_cancelled", location: null },
        );
    if (!updated) {
      const refetch = await adminRepo.findRideById(rideId);
      return {
        ok: false,
        code: "RIDE_CANNOT_CANCEL",
        message: `Ride cannot be cancelled — current status is '${refetch?.status ?? "unknown"}'.`,
        statusCode: 409,
      };
    }

    if (existing.driverUserId) {
      await driverComplianceService.releaseDriverAfterRide(
        existing.driverUserId,
      );
    }

    auditService.recordSafe({
      eventType: "admin.ride_cancelled",
      metadata:  { adminUserId: auth.userId, rideId, reason: input.reason, previousStatus },
    });

    const ride = await adminRepo.findRideById(rideId);
    if (!ride) return { ok: false, code: "NOT_FOUND", message: "Ride not found after update.", statusCode: 404 };

    // Punto 9: una cancelación definitiva realizada por administración también
    // debe generar el mismo comprobante del pasajero. La cola es idempotente por
    // (rideId, type), por lo que reintentar la acción no duplica el correo.
    void rideReceiptsService.queueCancelledRide(rideId).catch(() => {});

    return { ok: true, ride: toRideResponse(ride) };
  }

  async syncToRide(
    accessToken: string,
    offlineBookingId: string,
    input: AdminSyncToRideInput,
  ): Promise<AdminRideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin access required.", statusCode: 403 };
    }

    const booking = await offlineRepo.findOfflineBookingById(offlineBookingId);
    if (!booking) {
      return { ok: false, code: "NOT_FOUND", message: "Offline booking not found.", statusCode: 404 };
    }
    if (booking.status !== "pending_sync") {
      return { ok: false, code: "BOOKING_NOT_PENDING", message: `Booking is already ${booking.status}.`, statusCode: 409 };
    }

    const placeholderPassengerId = auth.userId;
    const newRide = await ridesRepo.createOfflineRide({
      passengerUserId:       placeholderPassengerId,
      originText:            booking.originText,
      destinationText:       booking.destinationText,
      notes:                 input.notes ?? booking.notes ?? null,
      estimatedFareClp:      0,
      offlinePassengerName:  booking.passengerName,
      offlinePassengerPhone: booking.passengerPhone,
      offlinePassengerEmail: (booking as any).passengerEmail ?? null,
    });

    await offlineRepo.syncOfflineBooking(offlineBookingId, newRide.id);

    if (input.driverUserId) {
      const driver = await adminRepo.findById(input.driverUserId);
      if (!driver || driver.role !== "driver" || driver.status !== "active") {
        const ride = await adminRepo.findRideById(newRide.id);
        if (!ride) return { ok: false, code: "NOT_FOUND", message: "Ride not found.", statusCode: 404 };
        return { ok: true, ride: toRideResponse(ride) };
      }

      const restAccess = await driverComplianceService.canReceiveNewOffers(
        input.driverUserId,
      );
      const driverStatus = await driverStatusRepo.findByDriverId(input.driverUserId);
      if (
        restAccess.allowed &&
        driverStatus?.availability === "available"
      ) {
        await ridesRepo.accept(newRide.id, input.driverUserId);
        await driverStatusRepo.setBusy(input.driverUserId, newRide.id);
        auditService.recordSafe({
          eventType: "admin.ride_driver_assigned",
          metadata:  { adminUserId: auth.userId, rideId: newRide.id, driverUserId: input.driverUserId, previousStatus: "requested", newStatus: "accepted" },
        });
      }
    }

    auditService.recordSafe({
      eventType: "admin.offline_booking_synced",
      metadata:  { adminUserId: auth.userId, offlineBookingId, rideId: newRide.id },
    });

    const ride = await adminRepo.findRideById(newRide.id);
    if (!ride) return { ok: false, code: "NOT_FOUND", message: "Ride not found after sync.", statusCode: 404 };
    return { ok: true, ride: toRideResponse(ride) };
  }

  /**
   * Administración aprueba la categoría del vehículo del conductor.
   * Confort exige año >= mínimo configurable; el conductor no puede autoasignarse.
   */
  async setDriverVehicleCategory(
    accessToken: string,
    driverUserId: string,
    vehicleCategory: import("@rapa-go/shared").VehicleCategory,
  ) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Admin access required.",
        statusCode: 403,
      };
    }

    const user = await usersRepo.findById(driverUserId);
    if (!user || user.role !== "driver") {
      return {
        ok: false as const,
        code: "NOT_FOUND",
        message: "Driver not found.",
        statusCode: 404,
      };
    }

    const { DriverProfileRepository } = await import(
      "../drivers/driverProfile.repository.js"
    );
    const { evaluateComfortCategoryApproval } = await import(
      "../drivers/comfortEligibility.service.js"
    );
    const { serializeDriverProfile } = await import(
      "../drivers/driverProfile.serializer.js"
    );

    const profileRepo = new DriverProfileRepository();
    const profile = await profileRepo.findByUserId(driverUserId);
    if (!profile) {
      return {
        ok: false as const,
        code: "NOT_FOUND",
        message: "Driver profile not found.",
        statusCode: 404,
      };
    }

    const eligibility = await evaluateComfortCategoryApproval({
      targetCategory: vehicleCategory,
      vehicleYear: profile.vehicleYear,
    });
    if (!eligibility.ok) {
      return {
        ok: false as const,
        code: eligibility.code,
        message: eligibility.message,
        statusCode: 400,
      };
    }

    const updated = await profileRepo.setApprovedVehicleCategory(
      driverUserId,
      vehicleCategory,
    );

    auditService.recordSafe({
      eventType: "admin.driver_vehicle_category_set",
      metadata: {
        adminUserId: auth.userId,
        driverUserId,
        vehicleCategory,
        vehicleYear: profile.vehicleYear ?? null,
      },
    });

    return {
      ok: true as const,
      profile: serializeDriverProfile(updated),
    };
  }
}
