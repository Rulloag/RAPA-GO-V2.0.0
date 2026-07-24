import { randomBytes } from "node:crypto";

import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  accountDeletionRequests,
  accountDeletionVerifications,
  applications,
  authIdentities,
  authSessions,
  driverProfiles,
  eventTickets,
  facebookLoginExchanges,
  notifications,
  oauthIdentities,
  passengerProfiles,
  paymentOrders,
  payments,
  refreshTokens,
  rentalBookings,
  rideRequests,
  serviceBookings,
  supportCases,
  userDocuments,
  users,
  wallets,
} from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type {
  AccountDeletionAdminResponse,
  AccountDeletionClientSnapshot,
  AccountDeletionRequestResponse,
  AccountDeletionRequestStatus,
  PublicAccountDeletionStatusResponse,
} from "./accountDeletion.types.js";
import type {
  CreateAccountDeletionRequestInput,
  ListAccountDeletionRequestsQuery,
} from "./accountDeletion.schemas.js";

const ACTIVE_RIDE_STATUSES = [
  "pending_payment",
  "requested",
  "accepted",
  "en_route",
  "arrived",
  "in_progress",
];

const ACTIVE_BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "accepted",
  "active",
  "in_progress",
];

const PENDING_PAYMENT_STATUSES = [
  "pending",
  "created",
  "in_process",
  "authorized",
  "disputed",
  "chargeback",
  "under_review",
];

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toPublicResponse(
  row: typeof accountDeletionRequests.$inferSelect,
): AccountDeletionRequestResponse {
  return {
    id: row.id,
    userId: row.userId,
    trackingCode: row.trackingCode,
    requestChannel: row.requestChannel as "app" | "web",
    requesterRole: row.requesterRole,
    reason: row.reason,
    comment: row.comment,
    status: row.status as AccountDeletionRequestStatus,
    adminNote: row.adminNote,
    requestedAt: row.requestedAt.toISOString(),
    verifiedAt: row.verifiedAt.toISOString(),
    deadlineAt: row.deadlineAt.toISOString(),
    deferredUntil: iso(row.deferredUntil),
    decisionReasonCode: row.decisionReasonCode,
    retentionSummary: row.retentionSummary,
    reviewedAt: iso(row.reviewedAt),
    processingAt: iso(row.processingAt),
    completedAt: iso(row.completedAt),
    failedAt: iso(row.failedAt),
    failureReason: row.failureReason,
    appleRevocationStatus:
      row.appleRevocationStatus as AccountDeletionRequestResponse["appleRevocationStatus"],
    appleRevocationAttemptedAt: iso(row.appleRevocationAttemptedAt),
    appleRevokedAt: iso(row.appleRevokedAt),
    appleRevocationError: row.appleRevocationError,
  };
}

function newTrackingCode(): string {
  return `RAD-${randomBytes(10)
    .toString("hex")
    .slice(0, 16)
    .toUpperCase()}`;
}

type DatabaseErrorDetails = {
  message: string;
  code: string | null;
  detail: string | null;
  hint: string | null;
  constraint: string | null;
  schema: string | null;
  table: string | null;
  column: string | null;
};

function getDatabaseErrorDetails(error: unknown): DatabaseErrorDetails {
  let current: unknown = error;
  const visited = new Set<unknown>();

  for (let depth = 0; depth < 8; depth += 1) {
    if (!current || typeof current !== "object" || visited.has(current)) {
      break;
    }

    visited.add(current);

    const candidate = current as {
      message?: unknown;
      code?: unknown;
      detail?: unknown;
      hint?: unknown;
      constraint?: unknown;
      schema?: unknown;
      table?: unknown;
      column?: unknown;
      cause?: unknown;
    };

    const hasPostgresDetails =
      typeof candidate.code === "string" ||
      typeof candidate.detail === "string" ||
      typeof candidate.constraint === "string" ||
      typeof candidate.table === "string" ||
      typeof candidate.column === "string";

    if (hasPostgresDetails) {
      return {
        message:
          typeof candidate.message === "string"
            ? candidate.message
            : String(error),
        code: typeof candidate.code === "string" ? candidate.code : null,
        detail: typeof candidate.detail === "string" ? candidate.detail : null,
        hint: typeof candidate.hint === "string" ? candidate.hint : null,
        constraint:
          typeof candidate.constraint === "string"
            ? candidate.constraint
            : null,
        schema: typeof candidate.schema === "string" ? candidate.schema : null,
        table: typeof candidate.table === "string" ? candidate.table : null,
        column: typeof candidate.column === "string" ? candidate.column : null,
      };
    }

    current = candidate.cause;
  }

  return {
    message: error instanceof Error ? error.message : String(error),
    code: null,
    detail: null,
    hint: null,
    constraint: null,
    schema: null,
    table: null,
    column: null,
  };
}

export class AccountDeletionRepository {
  async findLatestByUserId(
    userId: string,
  ): Promise<AccountDeletionRequestResponse | null> {
    try {
      const rows = await db
        .select()
        .from(accountDeletionRequests)
        .where(eq(accountDeletionRequests.userId, userId))
        .orderBy(desc(accountDeletionRequests.requestedAt))
        .limit(1);

      return rows[0] ? toPublicResponse(rows[0]) : null;
    } catch (error) {
      throw AppError.internal(
        `Failed to load account deletion request: ${String(error)}`,
      );
    }
  }

  async findPendingByUserId(
    userId: string,
  ): Promise<AccountDeletionRequestResponse | null> {
    try {
      const rows = await db
        .select()
        .from(accountDeletionRequests)
        .where(
          and(
            eq(accountDeletionRequests.userId, userId),
            inArray(accountDeletionRequests.status, [
              "pending",
              "deferred",
              "approved",
              "processing",
              "failed",
            ]),
          ),
        )
        .orderBy(desc(accountDeletionRequests.requestedAt))
        .limit(1);

      return rows[0] ? toPublicResponse(rows[0]) : null;
    } catch (error) {
      throw AppError.internal(
        `Failed to check pending account deletion request: ${String(error)}`,
      );
    }
  }

  async create(
    userId: string,
    requesterRole: string,
    input: CreateAccountDeletionRequestInput,
  ): Promise<AccountDeletionRequestResponse> {
    try {
      const verifiedAt = new Date();
      const rows = await db
        .insert(accountDeletionRequests)
        .values({
          userId,
          trackingCode: newTrackingCode(),
          requestChannel: "app",
          requesterRole,
          reason: input.reason?.trim() || null,
          comment: input.comment?.trim() || null,
          requesterSnapshot: input.requesterSnapshot ?? null,
          status: "pending",
          verifiedAt,
          deadlineAt: new Date(
            verifiedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
          ),
        })
        .returning();

      const created = rows[0];
      if (!created) {
        throw AppError.internal(
          "Account deletion request insert returned no rows.",
        );
      }

      return toPublicResponse(created);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(
        `Failed to create account deletion request: ${String(error)}`,
      );
    }
  }

  async hasRecentPublicVerification(
    emailHash: string,
    since: Date,
  ): Promise<boolean> {
    try {
      const rows = await db
        .select({ id: accountDeletionVerifications.id })
        .from(accountDeletionVerifications)
        .where(
          and(
            eq(accountDeletionVerifications.emailHash, emailHash),
            gt(accountDeletionVerifications.createdAt, since),
            isNull(accountDeletionVerifications.consumedAt),
            isNull(accountDeletionVerifications.revokedAt),
          ),
        )
        .limit(1);

      return Boolean(rows[0]);
    } catch (error) {
      throw AppError.internal(
        `Failed to check public account deletion verification: ${String(error)}`,
      );
    }
  }

  async createPublicVerification(input: {
    userId: string;
    emailHash: string;
    codeHash: string;
    expiresAt: Date;
    requestIp: string | null;
    requestUserAgent: string | null;
  }): Promise<string> {
    try {
      const rows = await db
        .insert(accountDeletionVerifications)
        .values(input)
        .returning({ id: accountDeletionVerifications.id });

      const created = rows[0];

      if (!created) {
        throw AppError.internal(
          "Public account deletion verification insert returned no rows.",
        );
      }

      return created.id;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(
        `Failed to create public account deletion verification: ${String(error)}`,
      );
    }
  }

  async revokePublicVerification(verificationId: string): Promise<void> {
    try {
      await db
        .update(accountDeletionVerifications)
        .set({ revokedAt: new Date() })
        .where(eq(accountDeletionVerifications.id, verificationId));
    } catch (error) {
      throw AppError.internal(
        `Failed to revoke public account deletion verification: ${String(error)}`,
      );
    }
  }

  async verifyAndConsumePublicCode(
    emailHash: string,
    codeHash: string,
  ): Promise<string | null> {
    try {
      return await db.transaction(async (tx) => {
        const now = new Date();

        const rows = await tx
          .select()
          .from(accountDeletionVerifications)
          .where(
            and(
              eq(accountDeletionVerifications.emailHash, emailHash),
              gt(accountDeletionVerifications.expiresAt, now),
              isNull(accountDeletionVerifications.consumedAt),
              isNull(accountDeletionVerifications.revokedAt),
              lt(accountDeletionVerifications.attempts, 5),
            ),
          )
          .orderBy(desc(accountDeletionVerifications.createdAt))
          .limit(1);

        const verification = rows[0];

        if (!verification) return null;

        if (verification.codeHash !== codeHash) {
          const attempts = verification.attempts + 1;

          await tx
            .update(accountDeletionVerifications)
            .set({
              attempts,
              revokedAt: attempts >= 5 ? now : null,
            })
            .where(eq(accountDeletionVerifications.id, verification.id));

          return null;
        }

        const consumedRows = await tx
          .update(accountDeletionVerifications)
          .set({ consumedAt: now })
          .where(
            and(
              eq(accountDeletionVerifications.id, verification.id),
              isNull(accountDeletionVerifications.consumedAt),
            ),
          )
          .returning({ userId: accountDeletionVerifications.userId });

        return consumedRows[0]?.userId ?? null;
      });
    } catch (error) {
      throw AppError.internal(
        `Failed to consume public account deletion verification: ${String(error)}`,
      );
    }
  }

  async createPublicRequest(
    userId: string,
    requesterRole: string,
    emailHash: string,
    input: CreateAccountDeletionRequestInput,
  ): Promise<AccountDeletionRequestResponse> {
    try {
      const verifiedAt = new Date();
      const rows = await db
        .insert(accountDeletionRequests)
        .values({
          userId,
          trackingCode: newTrackingCode(),
          requestChannel: "web",
          contactEmailHash: emailHash,
          requesterRole,
          reason: input.reason?.trim() || null,
          comment: input.comment?.trim() || null,
          requesterSnapshot: null,
          status: "pending",
          verifiedAt,
          deadlineAt: new Date(
            verifiedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
          ),
        })
        .returning();

      const created = rows[0];

      if (!created) {
        throw AppError.internal(
          "Public account deletion request insert returned no rows.",
        );
      }

      return toPublicResponse(created);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(
        `Failed to create public account deletion request: ${String(error)}`,
      );
    }
  }

  async attachPublicContact(
    requestId: string,
    emailHash: string,
  ): Promise<AccountDeletionRequestResponse> {
    try {
      const rows = await db
        .update(accountDeletionRequests)
        .set({
          contactEmailHash: emailHash,
          updatedAt: new Date(),
        })
        .where(eq(accountDeletionRequests.id, requestId))
        .returning();

      const updated = rows[0];

      if (!updated) {
        throw AppError.notFound(
          "No se encontrÃ³ la solicitud de eliminaciÃ³n.",
        );
      }

      return toPublicResponse(updated);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(
        `Failed to attach public contact to account deletion request: ${String(error)}`,
      );
    }
  }

  async findPublicStatus(
    trackingCode: string,
    emailHash: string,
  ): Promise<PublicAccountDeletionStatusResponse | null> {
    try {
      const rows = await db
        .select()
        .from(accountDeletionRequests)
        .where(
          and(
            eq(accountDeletionRequests.trackingCode, trackingCode),
            eq(accountDeletionRequests.contactEmailHash, emailHash),
          ),
        )
        .limit(1);

      const row = rows[0];

      if (!row) return null;

      return {
        trackingCode: row.trackingCode,
        status: row.status as AccountDeletionRequestStatus,
        requestedAt: row.requestedAt.toISOString(),
        verifiedAt: row.verifiedAt.toISOString(),
        deadlineAt: row.deadlineAt.toISOString(),
        deferredUntil: iso(row.deferredUntil),
        decisionReasonCode: row.decisionReasonCode,
        reviewedAt: iso(row.reviewedAt),
        completedAt: iso(row.completedAt),
        adminNote: row.adminNote,
        failureReason: row.failureReason,
        retentionSummary: row.retentionSummary,
      };
    } catch (error) {
      throw AppError.internal(
        `Failed to load public account deletion status: ${String(error)}`,
      );
    }
  }

  async list(
    query: ListAccountDeletionRequestsQuery,
  ): Promise<AccountDeletionAdminResponse[]> {
    try {
      const baseRows = query.status
        ? await db
            .select()
            .from(accountDeletionRequests)
            .where(eq(accountDeletionRequests.status, query.status))
            .orderBy(desc(accountDeletionRequests.requestedAt))
        : await db
            .select()
            .from(accountDeletionRequests)
            .orderBy(desc(accountDeletionRequests.requestedAt));

      const results: AccountDeletionAdminResponse[] = [];

      for (const row of baseRows) {
        results.push(await this.buildAdminResponse(row));
      }

      return results;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(
        `Failed to list account deletion requests: ${String(error)}`,
      );
    }
  }

  async findAdminById(
    requestId: string,
  ): Promise<AccountDeletionAdminResponse | null> {
    try {
      const rows = await db
        .select()
        .from(accountDeletionRequests)
        .where(eq(accountDeletionRequests.id, requestId))
        .limit(1);

      return rows[0] ? await this.buildAdminResponse(rows[0]) : null;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(
        `Failed to load account deletion request: ${String(error)}`,
      );
    }
  }

  private async buildAdminResponse(
    row: typeof accountDeletionRequests.$inferSelect,
  ): Promise<AccountDeletionAdminResponse> {
    const userId = row.userId;

    if (!userId) {
      return {
        ...toPublicResponse(row),
        requester: null,
        clientSnapshot:
          (row.requesterSnapshot as AccountDeletionClientSnapshot | null) ??
          null,
        passengerProfile: null,
        driverProfile: null,
        application: null,
        documents: [],
        accountSummary: {
          totalRides: 0,
          activeRides: 0,
          pendingPayments: 0,
          walletBalanceClp: 0,
          activeServiceBookings: 0,
          activeRentalBookings: 0,
          activeEventTickets: 0,
          openSupportCases: 0,
        },
        blockers: [],
        canApprove:
          row.status === "pending" ||
          row.status === "deferred" ||
          row.status === "failed",
      };
    }

    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = userRows[0] ?? null;

    /*
     * The deletion list must not query every column from both profile tables.
     * Production may legitimately have only the profile that matches the
     * account role, and selecting the complete Drizzle model can reference
     * optional columns that have not been deployed yet.
     *
     * Load only the fields required by AccountDeletionAdminResponse and only
     * from the table that corresponds to the actual account role.
     */
    const passengerRows =
      user?.role === "passenger"
        ? await db
            .select({
              phone: passengerProfiles.phone,
              preferredLanguage: passengerProfiles.preferredLanguage,
              emergencyContactName:
                passengerProfiles.emergencyContactName,
              emergencyContactPhone:
                passengerProfiles.emergencyContactPhone,
            })
            .from(passengerProfiles)
            .where(eq(passengerProfiles.userId, userId))
            .limit(1)
        : [];

    const driverRows =
      user?.role === "driver"
        ? await db
            .select({
              phone: driverProfiles.phone,
              vehicleBrand: driverProfiles.vehicleBrand,
              vehicleModel: driverProfiles.vehicleModel,
              vehicleYear: driverProfiles.vehicleYear,
              vehiclePlate: driverProfiles.vehiclePlate,
              vehicleColor: driverProfiles.vehicleColor,
              licenseNumber: driverProfiles.licenseNumber,
              licenseExpiry: driverProfiles.licenseExpiry,
            })
            .from(driverProfiles)
            .where(eq(driverProfiles.userId, userId))
            .limit(1)
        : [];

    const [
      documentRows,
      rideRows,
      paymentRows,
      paymentOrderRows,
      walletRows,
      serviceRows,
      rentalRows,
      ticketRows,
      supportRows,
    ] = await Promise.all([
      db
        .select()
        .from(userDocuments)
        .where(eq(userDocuments.userId, userId))
        .orderBy(desc(userDocuments.createdAt)),

      db
        .select({ status: rideRequests.status })
        .from(rideRequests)
        .where(
          or(
            eq(rideRequests.passengerUserId, userId),
            eq(rideRequests.driverUserId, userId),
          ),
        ),

      db
        .select({ status: payments.status })
        .from(payments)
        .where(eq(payments.passengerUserId, userId)),

      db
        .select({ status: paymentOrders.status })
        .from(paymentOrders)
        .where(eq(paymentOrders.userId, userId)),

      db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .limit(1),

      db
        .select({ status: serviceBookings.status })
        .from(serviceBookings)
        .where(
          or(
            eq(serviceBookings.passengerId, userId),
            eq(serviceBookings.guideId, userId),
          ),
        ),

      db
        .select({ status: rentalBookings.status })
        .from(rentalBookings)
        .where(
          or(
            eq(rentalBookings.passengerId, userId),
            eq(rentalBookings.operatorId, userId),
          ),
        ),

      db
        .select({ status: eventTickets.status })
        .from(eventTickets)
        .where(eq(eventTickets.userId, userId)),

      db
        .select({ status: supportCases.status })
        .from(supportCases)
        .where(eq(supportCases.requesterUserId, userId)),
    ]);

    const applicationRows = user
      ? await db
          .select()
          .from(applications)
          .where(
            or(
              eq(applications.userId, userId),
              eq(applications.email, user.email),
            ),
          )
          .orderBy(desc(applications.createdAt))
          .limit(1)
      : [];

    const passenger = passengerRows[0] ?? null;
    const driver = driverRows[0] ?? null;
    const application = applicationRows[0] ?? null;
    const wallet = walletRows[0] ?? null;

    const activeRides = rideRows.filter((item) =>
      ACTIVE_RIDE_STATUSES.includes(item.status),
    ).length;

    const pendingPayments =
      paymentRows.filter((item) =>
        PENDING_PAYMENT_STATUSES.includes(item.status),
      ).length +
      paymentOrderRows.filter((item) =>
        PENDING_PAYMENT_STATUSES.includes(item.status),
      ).length;

    const activeServiceBookings = serviceRows.filter((item) =>
      ACTIVE_BOOKING_STATUSES.includes(item.status),
    ).length;

    const activeRentalBookings = rentalRows.filter((item) =>
      ACTIVE_BOOKING_STATUSES.includes(item.status),
    ).length;

    const activeEventTickets = ticketRows.filter(
      (item) => item.status === "active",
    ).length;

    const openSupportCases = supportRows.filter(
      (item) => !["resolved", "closed", "rejected"].includes(item.status),
    ).length;

    const walletBalanceClp = Math.max(0, Number(wallet?.balance ?? 0));

    const blockers: string[] = [];

    if (activeRides > 0) {
      blockers.push(
        `La cuenta tiene ${activeRides} viaje(s) activo(s) o pendiente(s).`,
      );
    }

    if (pendingPayments > 0) {
      blockers.push(
        `La cuenta tiene ${pendingPayments} pago(s) pendiente(s).`,
      );
    }

    if (walletBalanceClp > 0) {
      blockers.push(
        `La cuenta tiene un saldo/beneficio pendiente de $${walletBalanceClp.toLocaleString("es-CL")}.`,
      );
    }

    if (activeServiceBookings > 0) {
      blockers.push(
        `La cuenta tiene ${activeServiceBookings} reserva(s) turÃ­stica(s) activa(s).`,
      );
    }

    if (activeRentalBookings > 0) {
      blockers.push(
        `La cuenta tiene ${activeRentalBookings} reserva(s) de arriendo activa(s).`,
      );
    }

    if (activeEventTickets > 0) {
      blockers.push(
        `La cuenta tiene ${activeEventTickets} ticket(s) de evento activo(s).`,
      );
    }

    if (openSupportCases > 0) {
      blockers.push(
        `La cuenta tiene ${openSupportCases} reclamo(s) o caso(s) de soporte abierto(s).`,
      );
    }

    return {
      ...toPublicResponse(row),

      requester: user
        ? {
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            isVerified: user.isVerified,
            createdAt: user.createdAt.toISOString(),
            avatarUrl: user.avatarUrl,
          }
        : null,

      clientSnapshot:
        (row.requesterSnapshot as AccountDeletionClientSnapshot | null) ??
        null,

      passengerProfile: passenger
        ? {
            phone: passenger.phone,
            preferredLanguage: passenger.preferredLanguage,
            emergencyContactName: passenger.emergencyContactName,
            emergencyContactPhone: passenger.emergencyContactPhone,
          }
        : null,

      driverProfile: driver
        ? {
            phone: driver.phone,
            vehicleBrand: driver.vehicleBrand,
            vehicleModel: driver.vehicleModel,
            vehicleYear: driver.vehicleYear,
            vehiclePlate: driver.vehiclePlate,
            vehicleColor: driver.vehicleColor,
            licenseNumber: driver.licenseNumber,
            licenseExpiry: driver.licenseExpiry,
          }
        : null,

      application: application
        ? {
            type: application.type,
            status: application.status,
            firstName: application.firstName,
            lastName: application.lastName,
            email: application.email,
            phone: application.phone,
            rut: application.rut,
            birthDate: application.birthDate,
            vehicleBrand: application.vehicleBrand,
            vehicleModel: application.vehicleModel,
            vehicleYear: application.vehicleYear,
            vehiclePlate: application.vehiclePlate,
            vehicleColor: application.vehicleColor,
            licenseNumber: application.licenseNumber,
            licenseExpiry: application.licenseExpiry,
          }
        : null,

      documents: documentRows.map((document) => ({
        id: document.id,
        documentType: document.documentType,
        status: document.status,
        fileUrl: document.fileUrl,
        uploadedAt: iso(document.uploadedAt),
        reviewedAt: iso(document.reviewedAt),
      })),

      accountSummary: {
        totalRides: rideRows.length,
        activeRides,
        pendingPayments,
        walletBalanceClp,
        activeServiceBookings,
        activeRentalBookings,
        activeEventTickets,
        openSupportCases,
      },

      blockers,

      canApprove:
        (
          row.status === "pending" ||
          row.status === "deferred" ||
          row.status === "failed"
        ) &&
        user?.status !== "deleted" &&
        blockers.length === 0,
    };
  }

  async recordAppleRevocationResult(
    requestId: string,
    result: {
      applicable: boolean;
      revokedTokens: number;
      alreadyInvalidTokens: number;
    },
  ): Promise<void> {
    const now = new Date();
    const allAlreadyInvalid =
      result.applicable &&
      result.revokedTokens > 0 &&
      result.revokedTokens === result.alreadyInvalidTokens;

    try {
      await db
        .update(accountDeletionRequests)
        .set({
          appleRevocationStatus: result.applicable
            ? allAlreadyInvalid
              ? "already_invalid"
              : "revoked"
            : "not_applicable",
          appleRevocationAttemptedAt: result.applicable ? now : null,
          appleRevokedAt: result.applicable ? now : null,
          appleRevocationError: null,
          failureReason: null,
          failedAt: null,
          updatedAt: now,
        })
        .where(eq(accountDeletionRequests.id, requestId));
    } catch (error) {
      throw AppError.internal(
        `Failed to persist Apple revocation result: ${String(error)}`,
      );
    }
  }

  async markAppleRevocationFailure(
    requestId: string,
    error: unknown,
  ): Promise<void> {
    const now = new Date();
    const safeMessage =
      error instanceof AppError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);

    try {
      await db
        .update(accountDeletionRequests)
        .set({
          status: "failed",
          appleRevocationStatus: "failed",
          appleRevocationAttemptedAt: now,
          appleRevocationError: safeMessage.slice(0, 1000),
          failedAt: now,
          failureReason:
            "No se pudo revocar la vinculación de Sign in with Apple. La solicitud puede reintentarse desde Administración después de corregir la configuración o volver a autenticar la cuenta.",
          updatedAt: now,
        })
        .where(eq(accountDeletionRequests.id, requestId));
    } catch (persistError) {
      console.error(
        "[AccountDeletion] failed to persist Apple revocation failure",
        persistError,
      );
    }
  }

  async defer(
    requestId: string,
    adminUserId: string,
    input: {
      reasonCode: string;
      note: string;
      deferUntil: Date | null;
    },
  ): Promise<AccountDeletionRequestResponse> {
    try {
      const rows = await db
        .update(accountDeletionRequests)
        .set({
          status:
            input.reasonCode === "identity_unverified"
              ? "identity_not_verified"
              : "deferred",
          reviewedByUserId: adminUserId,
          adminNote: input.note,
          reviewedAt: new Date(),
          deferredUntil:
            input.reasonCode === "identity_unverified"
              ? null
              : input.deferUntil,
          decisionReasonCode: input.reasonCode,
          updatedAt: new Date(),
          failureReason: null,
          failedAt: null,
        })
        .where(
          and(
            eq(accountDeletionRequests.id, requestId),
            inArray(accountDeletionRequests.status, ["pending", "deferred"]),
          ),
        )
        .returning();

      const updated = rows[0];

      if (!updated) {
        throw new AppError({
          code: "ACCOUNT_DELETION_NOT_REVIEWABLE",
          message: "La solicitud ya fue completada o no puede aplazarse.",
          statusCode: 409,
        });
      }

      return toPublicResponse(updated);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(
        `Failed to defer account deletion request: ${String(error)}`,
      );
    }
  }

  async approveAndAnonymize(
    requestId: string,
    adminUserId: string,
    adminNote: string,
    userId: string,
  ): Promise<AccountDeletionRequestResponse> {
    const now = new Date();
    const anonymizedEmail = `deleted+${userId}@deleted.rapago.local`;
    let currentStep = "inicializaciÃ³n";

    try {
      return await db.transaction(async (tx) => {
        currentStep = "cargar cuenta";

        const userRows = await tx
          .select({
            id: users.id,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        const account = userRows[0];

        if (!account) {
          throw AppError.notFound(
            "No se encontrÃ³ la cuenta asociada a la solicitud.",
          );
        }

        currentStep = "aprobar solicitud";

        const approvedRows = await tx
          .update(accountDeletionRequests)
          .set({
            status: "approved",
            reviewedByUserId: adminUserId,
            adminNote,
            reviewedAt: now,
            processingAt: null,
            completedAt: null,
            failedAt: null,
            failureReason: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(accountDeletionRequests.id, requestId),
              inArray(accountDeletionRequests.status, [
                "pending",
                "deferred",
                "failed",
              ]),
            ),
          )
          .returning();

        if (!approvedRows[0]) {
          throw new AppError({
            code: "ACCOUNT_DELETION_NOT_PENDING",
            message:
              "La solicitud ya fue completada o no se encuentra disponible para revisiÃ³n.",
            statusCode: 409,
          });
        }

        currentStep = "marcar procesamiento";

        await tx
          .update(accountDeletionRequests)
          .set({
            status: "processing",
            processingAt: now,
            updatedAt: now,
          })
          .where(eq(accountDeletionRequests.id, requestId));

        currentStep = "revocar sesiones";

        await tx
          .update(authSessions)
          .set({ revokedAt: now })
          .where(
            and(
              eq(authSessions.userId, userId),
              isNull(authSessions.revokedAt),
            ),
          );

        await tx
          .update(refreshTokens)
          .set({ revokedAt: now })
          .where(
            and(
              eq(refreshTokens.userId, userId),
              isNull(refreshTokens.revokedAt),
            ),
          );

        currentStep = "eliminar credenciales";

        await tx.execute(
          sql`DELETE FROM public.auth_credentials WHERE user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM public.password_reset_tokens WHERE user_id = ${userId}::uuid`,
        );

        await tx
          .delete(authIdentities)
          .where(eq(authIdentities.userId, userId));

        await tx
          .delete(oauthIdentities)
          .where(eq(oauthIdentities.userId, userId));

        await tx
          .delete(facebookLoginExchanges)
          .where(eq(facebookLoginExchanges.userId, userId));

        currentStep = "eliminar datos privados";

        await tx.execute(
          sql`DELETE FROM public.payment_methods WHERE user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM public.user_bank_accounts WHERE user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM public.user_documents WHERE user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM public.passenger_profiles WHERE user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM public.driver_profiles WHERE user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM public.driver_statuses WHERE driver_user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM public.notifications WHERE user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM public.sync_queue WHERE user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM public.connectivity_logs WHERE user_id = ${userId}::uuid`,
        );

        currentStep = "buscar postulaciÃ³n vinculada";

        const applicationWhere = or(
          eq(applications.userId, userId),
          eq(applications.email, account.email),
        );

        const linkedApplications = await tx
          .select({ id: applications.id })
          .from(applications)
          .where(applicationWhere)
          .limit(1);

        /*
         * No todas las cuentas tienen una postulaciÃ³n. Evitamos ejecutar un
         * UPDATE innecesario cuando no existe ninguna fila vinculada.
         */
        if (linkedApplications.length > 0) {
          currentStep = "anonimizar postulaciÃ³n";

          await tx
            .update(applications)
            .set({
              status: "withdrawn_account_deleted",
              firstName: "Cuenta",
              lastName: "Eliminada",
              email: anonymizedEmail,
              phone: "ELIMINADO",
              rut: null,
              birthDate: null,
              city: null,
              emergencyContactName: null,
              emergencyContactPhone: null,
              vehicleBrand: null,
              vehicleModel: null,
              vehicleYear: null,
              vehiclePlate: null,
              vehicleColor: null,
              licenseNumber: null,
              licenseExpiry: null,
              idFrontUrl: null,
              idBackUrl: null,
              licenseFrontUrl: null,
              licenseBackUrl: null,
              certificateUrl: null,
              profilePhotoUrl: null,
              notes: null,
              updatedAt: now,
            })
            .where(applicationWhere);
        }

        currentStep = "cerrar beneficios";

        await tx.execute(sql`
          UPDATE public.wallets
          SET status = 'closed', balance = 0, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ${userId}::uuid
        `);

        await tx.execute(sql`
          UPDATE public.referral_codes
          SET is_active = FALSE
          WHERE user_id = ${userId}::uuid
        `);

        currentStep = "anonimizar usuario";

        const anonymizedUsers = await tx
          .update(users)
          .set({
            email: anonymizedEmail,
            name: "Cuenta eliminada",
            status: "deleted",
            avatarUrl: null,
            isVerified: false,
            updatedAt: now,
          })
          .where(eq(users.id, userId))
          .returning({ id: users.id });

        if (!anonymizedUsers[0]) {
          throw AppError.internal(
            "La anonimizaciÃ³n del usuario no modificÃ³ ninguna fila.",
          );
        }

        currentStep = "completar solicitud";

        const completedRows = await tx
          .update(accountDeletionRequests)
          .set({
            status: "completed",
            completedAt: now,
            updatedAt: now,
            failureReason: null,
            failedAt: null,
            retentionSummary:
              "Se eliminaron credenciales, perfiles, documentos, medios de pago y datos bancarios. Viajes, pagos, comprobantes y aceptaciones legales se conservan de forma restringida para integridad, obligaciones legales, tributarias y defensa de derechos.",
            requesterSnapshot: {
              redacted: true,
              requesterRole: approvedRows[0].requesterRole,
              sourceView:
                (
                  approvedRows[0]
                    .requesterSnapshot as AccountDeletionClientSnapshot | null
                )?.sourceView ?? null,
            },
          })
          .where(eq(accountDeletionRequests.id, requestId))
          .returning();

        const completed = completedRows[0];

        if (!completed) {
          throw AppError.internal(
            "Account deletion completion returned no rows.",
          );
        }

        return toPublicResponse(completed);
      });
    } catch (error) {
      const databaseError = getDatabaseErrorDetails(error);

      console.error("[AccountDeletion] approveAndAnonymize failed", {
        requestId,
        userId,
        step: currentStep,
        databaseError,
        error,
      });

      if (error instanceof AppError) throw error;

      await db
        .update(accountDeletionRequests)
        .set({
          status: "failed",
          failedAt: new Date(),
          failureReason:
            `No se pudo completar la anonimizaciÃ³n en el paso "${currentStep}". ` +
            "Reintenta desde Admin.",
          updatedAt: new Date(),
        })
        .where(eq(accountDeletionRequests.id, requestId))
        .catch((failureUpdateError) => {
          console.error(
            "[AccountDeletion] failed to persist failure status",
            failureUpdateError,
          );
        });

      throw AppError.internal(
        `Failed to approve account deletion request at step "${currentStep}". ` +
          `Database code: ${databaseError.code ?? "unknown"}. ` +
          `Cause: ${databaseError.message}`,
      );
    }
  }

  async notifyAdminsOfNewRequest(
    requestId: string,
    requesterName: string,
    requesterRole: string,
  ): Promise<void> {
    try {
      const adminRows = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.role, "admin"),
            eq(users.status, "active"),
          ),
        );

      if (adminRows.length === 0) return;

      await db.insert(notifications).values(
        adminRows.map((admin) => ({
          userId: admin.id,
          type: "account_deletion_request",
          title: "Nueva solicitud para eliminar cuenta",
          message: `${requesterName} (${requesterRole}) solicitÃ³ eliminar su cuenta.`,
          entityType: "account_deletion_request",
          entityId: requestId,
          actionUrl: "/admin",
        })),
      );
    } catch {
      // La notificaciÃ³n no debe impedir crear la solicitud.
    }
  }

  async notifyUserOfDeferral(
    userId: string,
    requestId: string,
    note: string,
    requesterRole: string,
  ): Promise<void> {
    try {
      await db.insert(notifications).values({
        userId,
        type: "account_deletion_deferred",
        title: "Solicitud de eliminaciÃ³n aplazada",
        message: `Tu solicitud sigue vigente. Causa temporal: ${note}`,
        entityType: "account_deletion_request",
        entityId: requestId,
        actionUrl:
          requesterRole === "driver"
            ? "/driver/profile"
            : "/passenger/profile",
      });
    } catch {
      // La respuesta administrativa sigue siendo vÃ¡lida aunque falle el aviso.
    }
  }
}