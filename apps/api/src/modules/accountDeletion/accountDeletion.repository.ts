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
  authSessions,
  driverProfiles,
  eventTickets,
  notifications,
  passengerProfiles,
  paymentOrders,
  payments,
  refreshTokens,
  rentalBookings,
  rideRequests,
  serviceBookings,
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
    reviewedAt: iso(row.reviewedAt),
    processingAt: iso(row.processingAt),
    completedAt: iso(row.completedAt),
    failedAt: iso(row.failedAt),
    failureReason: row.failureReason,
  };
}

function newTrackingCode(): string {
  return `RAD-${randomBytes(10)
    .toString("hex")
    .slice(0, 16)
    .toUpperCase()}`;
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
              "approved",
              "processing",
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
      const rows = await db
        .insert(accountDeletionRequests)
        .values({
          userId,
          trackingCode: newTrackingCode(),
          requestChannel: "app",
          requesterRole,
          reason: input.reason,
          comment: input.comment?.trim() || null,
          requesterSnapshot: input.requesterSnapshot ?? null,
          status: "pending",
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
      const rows = await db
        .insert(accountDeletionRequests)
        .values({
          userId,
          trackingCode: newTrackingCode(),
          requestChannel: "web",
          contactEmailHash: emailHash,
          requesterRole,
          reason: input.reason,
          comment: input.comment?.trim() || null,
          requesterSnapshot: null,
          status: "pending",
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
          "No se encontró la solicitud de eliminación.",
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
        reviewedAt: iso(row.reviewedAt),
        completedAt: iso(row.completedAt),
        adminNote: row.adminNote,
        failureReason: row.failureReason,
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
        },
        blockers: [],
        canApprove: row.status === "pending",
      };
    }

    const [
      userRows,
      passengerRows,
      driverRows,
      documentRows,
      rideRows,
      paymentRows,
      paymentOrderRows,
      walletRows,
      serviceRows,
      rentalRows,
      ticketRows,
    ] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)).limit(1),

      db
        .select()
        .from(passengerProfiles)
        .where(eq(passengerProfiles.userId, userId))
        .limit(1),

      db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, userId))
        .limit(1),

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
    ]);

    const user = userRows[0] ?? null;

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
        `La cuenta tiene ${activeServiceBookings} reserva(s) turística(s) activa(s).`,
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
      },

      blockers,

      canApprove:
        row.status === "pending" &&
        user?.status !== "deleted" &&
        blockers.length === 0,
    };
  }

  async reject(
    requestId: string,
    adminUserId: string,
    note: string,
  ): Promise<AccountDeletionRequestResponse> {
    try {
      const rows = await db
        .update(accountDeletionRequests)
        .set({
          status: "rejected",
          reviewedByUserId: adminUserId,
          adminNote: note,
          reviewedAt: new Date(),
          updatedAt: new Date(),
          failureReason: null,
          failedAt: null,
        })
        .where(
          and(
            eq(accountDeletionRequests.id, requestId),
            eq(accountDeletionRequests.status, "pending"),
          ),
        )
        .returning();

      const updated = rows[0];

      if (!updated) {
        throw new AppError({
          code: "ACCOUNT_DELETION_NOT_PENDING",
          message:
            "La solicitud ya fue revisada o no se encuentra pendiente.",
          statusCode: 409,
        });
      }

      return toPublicResponse(updated);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(
        `Failed to reject account deletion request: ${String(error)}`,
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

    try {
      return await db.transaction(async (tx) => {
        const approvedRows = await tx
          .update(accountDeletionRequests)
          .set({
            status: "approved",
            reviewedByUserId: adminUserId,
            adminNote,
            reviewedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(accountDeletionRequests.id, requestId),
              eq(accountDeletionRequests.status, "pending"),
            ),
          )
          .returning();

        if (!approvedRows[0]) {
          throw new AppError({
            code: "ACCOUNT_DELETION_NOT_PENDING",
            message:
              "La solicitud ya fue revisada o no se encuentra pendiente.",
            statusCode: 409,
          });
        }

        await tx
          .update(accountDeletionRequests)
          .set({
            status: "processing",
            processingAt: now,
            updatedAt: now,
          })
          .where(eq(accountDeletionRequests.id, requestId));

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

        // Datos de autenticación y recuperación.
        await tx.execute(
          sql`DELETE FROM auth_credentials WHERE user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM password_reset_tokens WHERE user_id = ${userId}::uuid`,
        );

        // Información privada que no debe conservarse después del cierre.
        await tx.execute(
          sql`DELETE FROM payment_methods WHERE user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM user_bank_accounts WHERE user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM user_documents WHERE user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM passenger_profiles WHERE user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM driver_profiles WHERE user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM driver_statuses WHERE driver_user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM notifications WHERE user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM sync_queue WHERE user_id = ${userId}::uuid`,
        );

        await tx.execute(
          sql`DELETE FROM connectivity_logs WHERE user_id = ${userId}::uuid`,
        );

        // Las postulaciones se conservan como registro operativo, pero sin PII.
        await tx.execute(sql`
          UPDATE applications
          SET
            status = 'withdrawn_account_deleted',
            first_name = 'Cuenta',
            last_name = 'Eliminada',
            email = ${anonymizedEmail},
            phone = 'ELIMINADO',
            rut = NULL,
            birth_date = NULL,
            city = NULL,
            emergency_contact_name = NULL,
            emergency_contact_phone = NULL,
            vehicle_brand = NULL,
            vehicle_model = NULL,
            vehicle_year = NULL,
            vehicle_plate = NULL,
            vehicle_color = NULL,
            license_number = NULL,
            license_expiry = NULL,
            id_front_url = NULL,
            id_back_url = NULL,
            license_front_url = NULL,
            license_back_url = NULL,
            certificate_url = NULL,
            profile_photo_url = NULL,
            notes = NULL,
            updated_at = ${now}
          WHERE user_id = ${userId}::uuid
        `);

        // Beneficios: la aprobación solo se permite con saldo cero.
        await tx.execute(sql`
          UPDATE wallets
          SET status = 'closed', balance = 0, updated_at = ${now}
          WHERE user_id = ${userId}::uuid
        `);

        await tx.execute(sql`
          UPDATE referral_codes
          SET is_active = FALSE
          WHERE user_id = ${userId}::uuid
        `);

        // No se borran viajes, pagos, comprobantes ni aceptaciones legales.
        // Se conserva el usuario anonimizado para mantener integridad referencial.
        await tx
          .update(users)
          .set({
            email: anonymizedEmail,
            name: "Cuenta eliminada",
            status: "deleted",
            avatarUrl: null,
            isVerified: false,
            updatedAt: now,
          })
          .where(eq(users.id, userId));

        const completedRows = await tx
          .update(accountDeletionRequests)
          .set({
            status: "completed",
            completedAt: now,
            updatedAt: now,
            failureReason: null,
            failedAt: null,
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
      if (error instanceof AppError) throw error;

      await db
        .update(accountDeletionRequests)
        .set({
          status: "failed",
          failedAt: new Date(),
          failureReason:
            "No se pudo completar la anonimización. Reintenta desde Admin.",
          updatedAt: new Date(),
        })
        .where(eq(accountDeletionRequests.id, requestId))
        .catch(() => {});

      throw AppError.internal(
        `Failed to approve account deletion request: ${String(error)}`,
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
          message: `${requesterName} (${requesterRole}) solicitó eliminar su cuenta.`,
          entityType: "account_deletion_request",
          entityId: requestId,
          actionUrl: "/admin",
        })),
      );
    } catch {
      // La notificación no debe impedir crear la solicitud.
    }
  }

  async notifyUserOfRejection(
    userId: string,
    requestId: string,
    note: string,
    requesterRole: string,
  ): Promise<void> {
    try {
      await db.insert(notifications).values({
        userId,
        type: "account_deletion_rejected",
        title: "Solicitud de eliminación rechazada",
        message: `Tu cuenta continúa activa. Motivo: ${note}`,
        entityType: "account_deletion_request",
        entityId: requestId,
        actionUrl:
          requesterRole === "driver"
            ? "/driver/profile"
            : "/passenger/profile",
      });
    } catch {
      // La respuesta administrativa sigue siendo válida aunque falle el aviso.
    }
  }
}
