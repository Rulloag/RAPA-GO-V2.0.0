import crypto from "node:crypto";
import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { PaymentsRepository } from "./payments.repository.js";
import { getActiveProvider, getProvider } from "./provider.registry.js";
import { AuditService } from "../audit/audit.service.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { CreatePaymentInput } from "./payments.schema.js";
import type { NormalizedWebhook } from "./payment.provider.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepo = new UsersRepository();
const paymentsRepo = new PaymentsRepository();
const auditService = new AuditService();

type Ok<T> = { ok: true } & T;
type Fail = { ok: false; code: string; message: string; statusCode: number };
type Result<T> = Ok<T> | Fail;

type PaymentAuthUser = {
  id: string;
  role: string;
  status?: string | null;
  isVerified?: boolean | null;
  verified?: boolean | null;
  driverStatus?: string | null;
  driverApplicationStatus?: string | null;
  applicationStatus?: string | null;
  isDriverApproved?: boolean | null;
  driverApproved?: boolean | null;
  approvedAt?: string | null;
  email?: string | null;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
};

const PAYMENT_ALLOWED_RIDE_STATUSES = new Set([
  "requested",
  "scheduled",
  "driver_scheduled",
  "accepted",
  "driver_en_route",
  "driver_arrived",
  "in_progress",
  "completed",
]);

function normalizePaymentText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getRecordString(
  source: Record<string, unknown> | null | undefined,
  keys: string[],
): string {
  if (!source) return "";

  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
  }

  return "";
}

function getRecordBoolean(
  source: Record<string, unknown> | null | undefined,
  keys: string[],
): boolean | null {
  if (!source) return null;

  for (const key of keys) {
    const value = source[key];

    if (typeof value === "boolean") return value;

    if (typeof value === "string") {
      const normalized = normalizePaymentText(value);

      if (["true", "si", "sí", "yes", "1", "approved", "aprobado"].includes(normalized)) {
        return true;
      }

      if (["false", "no", "0", "rejected", "rechazado"].includes(normalized)) {
        return false;
      }
    }
  }

  return null;
}

function getUserText(user: PaymentAuthUser, keys: string[]): string {
  const base = user as unknown as Record<string, unknown>;

  return (
    getRecordString(base, keys) ||
    getRecordString(user.profile, keys) ||
    getRecordString(user.metadata, keys)
  );
}

function getUserBoolean(user: PaymentAuthUser, keys: string[]): boolean | null {
  const base = user as unknown as Record<string, unknown>;

  return (
    getRecordBoolean(base, keys) ??
    getRecordBoolean(user.profile, keys) ??
    getRecordBoolean(user.metadata, keys)
  );
}

function isDriverApprovedForPassengerPayments(user: PaymentAuthUser): boolean {
  const role = normalizePaymentText(user.role);

  if (role !== "driver" && role !== "conductor") {
    return false;
  }

  const status = normalizePaymentText(
    getUserText(user, [
      "status",
      "driverStatus",
      "driverApplicationStatus",
      "applicationStatus",
      "approvalStatus",
    ]),
  );

  const approvedBoolean =
    getUserBoolean(user, [
      "isVerified",
      "verified",
      "isDriverApproved",
      "driverApproved",
      "approved",
      "canDrive",
      "canReceiveRides",
    ]) === true;

  const hasApprovedDate = Boolean(
    getUserText(user, [
      "approvedAt",
      "driverApprovedAt",
      "verifiedAt",
      "activatedAt",
    ]),
  );

  return (
    approvedBoolean ||
    hasApprovedDate ||
    status === "active" ||
    status === "approved" ||
    status === "aprobado" ||
    status === "verified" ||
    status === "verificado"
  );
}

function canCreatePassengerPayment(user: PaymentAuthUser): boolean {
  const role = normalizePaymentText(user.role);

  if (role === "passenger" || role === "pasajero") return true;
  if (role === "admin" || role === "administrator") return true;
  if (isDriverApprovedForPassengerPayments(user)) return true;

  return false;
}

async function authenticate(
  accessToken: string,
): Promise<Result<{ userId: string; role: string; user: PaymentAuthUser }>> {
  let payload;

  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (err) {
    if (err instanceof AppError) {
      return {
        ok: false,
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
      };
    }

    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Invalid access token.",
      statusCode: 401,
    };
  }

  const hash = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);

  if (!valid) {
    return {
      ok: false,
      code: "AUTH_SESSION_REVOKED",
      message: "Session has been revoked.",
      statusCode: 401,
    };
  }

  const user = (await usersRepo.findById(payload.sub)) as PaymentAuthUser | null;

  if (!user) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "User not found.",
      statusCode: 404,
    };
  }

  return {
    ok: true,
    userId: user.id,
    role: user.role,
    user,
  };
}

function buildPaymentReturnUrl(): string {
  const successUrl = process.env["PAYMENT_SUCCESS_URL"];

  if (successUrl?.trim()) {
    return successUrl.trim();
  }

  const frontendUrl = process.env["FRONTEND_URL"];

  if (frontendUrl?.trim()) {
    return `${frontendUrl.replace(/\/+$/, "")}/passenger/trips?payment=success`;
  }

  const mobileDeepLink = process.env["MOBILE_APP_DEEP_LINK"] ?? "rapago://";

  return `${mobileDeepLink}payment/result`;
}

function isPaymentRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function getPaymentRecordValue(source: unknown, keys: string[]): unknown {
  let current = source;

  for (const key of keys) {
    if (!isPaymentRecord(current)) return null;
    current = current[key];
  }

  return current;
}

function getPaymentStringValue(source: unknown, keys: string[]): string {
  const value = getPaymentRecordValue(source, keys);

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function getStoredRefundStatus(payment: Record<string, unknown>): string {
  const rawPayload = payment["rawProviderPayload"];

  return normalizePaymentText(
    getPaymentStringValue(rawPayload, ["rapagoRefund", "status"]) ||
      getPaymentStringValue(rawPayload, ["refundStatus"]) ||
      getPaymentStringValue(rawPayload, ["refund", "status"]),
  );
}

function extractMercadoPagoPaymentId(payment: Record<string, unknown>): string {
  return (
    getPaymentStringValue(payment, ["providerPaymentId"]) ||
    getPaymentStringValue(payment, ["externalId"]) ||
    getPaymentStringValue(payment["rawProviderPayload"], ["id"]) ||
    getPaymentStringValue(payment["rawProviderPayload"], ["data", "id"]) ||
    getPaymentStringValue(payment["rawProviderPayload"], ["payment_id"]) ||
    getPaymentStringValue(payment["rawProviderPayload"], ["paymentId"]) ||
    getPaymentStringValue(payment["rawProviderPayload"], ["externalId"])
  );
}

async function findSuccessfulPaymentByRideRequestId(
  rideRequestId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const { db } = await import("../../db/client.js");
    const { payments } = await import("../../db/schema/payments.schema.js");
    const { and, eq } = await import("drizzle-orm");

    const [row] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.rideRequestId, rideRequestId),
          eq(payments.status, "success"),
        ),
      )
      .limit(1);

    return (row ?? null) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

async function saveRefundStateOnPayment(input: {
  paymentId: string;
  status: "approved" | "failed";
  mercadoPagoPaymentId: string;
  refundPayload: unknown;
}): Promise<void> {
  try {
    const { db } = await import("../../db/client.js");
    const { payments } = await import("../../db/schema/payments.schema.js");
    const { eq } = await import("drizzle-orm");

    const existing = await paymentsRepo.findById(input.paymentId);
    const previousPayload = isPaymentRecord(existing?.rawProviderPayload)
      ? existing?.rawProviderPayload
      : {};

    await db
      .update(payments)
      .set({
        rawProviderPayload: {
          ...previousPayload,
          rapagoRefund: {
            status: input.status,
            mercadoPagoPaymentId: input.mercadoPagoPaymentId,
            at: new Date().toISOString(),
            payload: input.refundPayload,
          },
        } as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, input.paymentId));
  } catch {
    // No rompe la cancelación si no se pudo guardar el detalle local.
  }
}

async function refundMercadoPagoPayment(input: {
  mercadoPagoPaymentId: string;
}): Promise<{
  ok: boolean;
  statusCode: number;
  data: unknown;
}> {
  const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"];

  if (!accessToken) {
    return {
      ok: false,
      statusCode: 500,
      data: {
        message: "Falta MERCADOPAGO_ACCESS_TOKEN en el backend.",
      },
    };
  }

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${input.mercadoPagoPaymentId}/refunds`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({}),
    },
  );

  const data = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    statusCode: response.status,
    data,
  };
}

export class PaymentsService {
  async createPayment(
    accessToken: string,
    input: CreatePaymentInput,
  ): Promise<Result<{ urlPay: string; paymentId: string }>> {
    const auth = await authenticate(accessToken);

    if (!auth.ok) return auth;

    if (!canCreatePassengerPayment(auth.user)) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message:
          "Solo pasajeros, conductores aprobados usando vista pasajero o administradores pueden crear pagos.",
        statusCode: 403,
      };
    }

    const { RidesRepository } = await import("../rides/rides.repository.js");
    const ridesRepo = new RidesRepository();
    const ride = await ridesRepo.findById(input.rideRequestId);

    if (!ride) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Ride request not found.",
        statusCode: 404,
      };
    }

    const isAdmin =
      normalizePaymentText(auth.role) === "admin" ||
      normalizePaymentText(auth.role) === "administrator";

    if (!isAdmin && ride.passengerUserId !== auth.userId) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "This ride does not belong to you.",
        statusCode: 403,
      };
    }

    if (!PAYMENT_ALLOWED_RIDE_STATUSES.has(String(ride.status ?? ""))) {
      return {
        ok: false,
        code: "PAYMENT_RIDE_STATUS_NOT_ALLOWED",
        message:
          "Payment can only be initiated for an active, scheduled, in-progress or completed ride.",
        statusCode: 409,
      };
    }

    const active = await paymentsRepo.findActiveByRideId(input.rideRequestId);

    if (active) {
      return {
        ok: false,
        code: "PAYMENT_ALREADY_EXISTS",
        message: "A payment for this ride is already pending or processing.",
        statusCode: 409,
      };
    }

    const amountClp = ride.estimatedFareClp ?? 0;

    if (amountClp <= 0) {
      return {
        ok: false,
        code: "PAYMENT_INVALID_AMOUNT",
        message: "Ride has no valid fare amount.",
        statusCode: 422,
      };
    }

    const user = await usersRepo.findById(auth.userId);
    const provider = getActiveProvider();

    const payment = await paymentsRepo.create({
      rideRequestId: ride.id,
      passengerUserId: auth.userId,
      amountClp,
      status: "pending",
      provider: provider.name,
    });

    const webhookBaseUrl = process.env["PAYMENT_WEBHOOK_BASE_URL"] ?? "";

    let providerOrderId: string;
    let urlPay: string;

    try {
      const result = await provider.createPayment({
        orderId: payment["id"],
        amountClp,
        description: `Viaje Rapa Go — ${ride.originText} → ${ride.destinationText}`,
        passengerEmail: user?.email ?? "",
        passengerName: user?.name ?? "Pasajero",
        returnUrl: buildPaymentReturnUrl(),
        webhookUrl: `${webhookBaseUrl.replace(/\/+$/, "")}/api/payments/webhook/${provider.name}`,
      });

      providerOrderId = result.providerOrderId;
      urlPay = result.urlPay;
    } catch (err) {
      await paymentsRepo.markFailed(payment["id"]);

      auditService.recordSafe({
        actorUserId: auth.userId,
        eventType: "payment.provider_error",
        entityType: "payment",
        entityId: payment["id"],
        metadata: {
          error: String(err),
          rideId: ride.id,
          provider: provider.name,
        } as Record<string, string>,
      });

      return {
        ok: false,
        code: "PAYMENT_PROVIDER_ERROR",
        message: "Could not initiate payment with provider. Please try again.",
        statusCode: 502,
      };
    }

    await paymentsRepo.markProcessing(payment["id"], urlPay, providerOrderId);

    auditService.recordSafe({
      actorUserId: auth.userId,
      eventType: "payment.created",
      entityType: "payment",
      entityId: payment["id"],
      metadata: {
        rideId: ride.id,
        amountClp,
        provider: provider.name,
        actorRole: auth.role,
      },
    });

    return {
      ok: true,
      urlPay,
      paymentId: payment["id"],
    };
  }

  async refundCardPaymentForCancelledRide(input: {
    rideRequestId: string;
    cancelledByUserId: string;
    cancelledByRole: string;
    reason?: string | null;
  }): Promise<Result<{
    processed: boolean;
    refunded: boolean;
    skippedReason?: string;
    paymentId?: string;
    mercadoPagoPaymentId?: string;
    refund?: unknown;
  }>> {
    const payment = await findSuccessfulPaymentByRideRequestId(input.rideRequestId);

    if (!payment) {
      return {
        ok: true,
        processed: false,
        refunded: false,
        skippedReason: "No existe un pago aprobado para devolver en este viaje.",
      };
    }

    const providerName = normalizePaymentText(payment["provider"]);

    if (providerName !== "mercadopago") {
      return {
        ok: true,
        processed: false,
        refunded: false,
        skippedReason: "El pago aprobado no fue realizado con MercadoPago.",
        paymentId: String(payment["id"] ?? ""),
      };
    }

    const storedRefundStatus = getStoredRefundStatus(payment);

    if (storedRefundStatus === "approved" || storedRefundStatus === "aprobado") {
      return {
        ok: true,
        processed: true,
        refunded: true,
        skippedReason: "Este pago ya fue devuelto anteriormente.",
        paymentId: String(payment["id"] ?? ""),
        mercadoPagoPaymentId: extractMercadoPagoPaymentId(payment),
      };
    }

    const mercadoPagoPaymentId = extractMercadoPagoPaymentId(payment);

    if (!mercadoPagoPaymentId) {
      return {
        ok: false,
        code: "REFUND_MISSING_MERCADOPAGO_ID",
        message: "El pago no tiene providerPaymentId de MercadoPago para devolver.",
        statusCode: 409,
      };
    }

    const refundResult = await refundMercadoPagoPayment({
      mercadoPagoPaymentId,
    });

    if (!refundResult.ok) {
      await saveRefundStateOnPayment({
        paymentId: String(payment["id"]),
        status: "failed",
        mercadoPagoPaymentId,
        refundPayload: refundResult.data,
      });

      auditService.recordSafe({
        actorUserId: input.cancelledByUserId,
        eventType: "payment.refund_failed_on_cancel",
        entityType: "payment",
        entityId: String(payment["id"] ?? ""),
        metadata: {
          rideId: input.rideRequestId,
          provider: "mercadopago",
          mercadoPagoPaymentId,
          statusCode: String(refundResult.statusCode),
          cancelledByRole: input.cancelledByRole,
          reason: input.reason ?? "",
        } as Record<string, string>,
      });

      return {
        ok: false,
        code: "MERCADOPAGO_REFUND_ERROR",
        message: "El viaje fue cancelado, pero MercadoPago no pudo procesar la devolución.",
        statusCode: refundResult.statusCode,
      };
    }

    await saveRefundStateOnPayment({
      paymentId: String(payment["id"]),
      status: "approved",
      mercadoPagoPaymentId,
      refundPayload: refundResult.data,
    });

    auditService.recordSafe({
      actorUserId: input.cancelledByUserId,
      eventType: "payment.refunded_on_cancel",
      entityType: "payment",
      entityId: String(payment["id"] ?? ""),
      metadata: {
        rideId: input.rideRequestId,
        provider: "mercadopago",
        mercadoPagoPaymentId,
        cancelledByRole: input.cancelledByRole,
        reason: input.reason ?? "",
      } as Record<string, string>,
    });

    return {
      ok: true,
      processed: true,
      refunded: true,
      paymentId: String(payment["id"] ?? ""),
      mercadoPagoPaymentId,
      refund: refundResult.data,
    };
  }

  async handleWebhook(
    providerName: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<Result<{ processed: boolean }>> {
    let provider;

    try {
      provider = getProvider(providerName);
    } catch {
      return {
        ok: false,
        code: "WEBHOOK_UNKNOWN_PROVIDER",
        message: `Unknown payment provider: "${providerName}".`,
        statusCode: 400,
      };
    }

    if (!provider.verifyWebhookSignature(payload, headers)) {
      auditService.recordSafe({
        eventType: "payment.webhook_invalid_signature",
        entityType: "payment",
        metadata: {
          provider: providerName,
        } as Record<string, string>,
      });

      return {
        ok: false,
        code: "WEBHOOK_INVALID_SIGNATURE",
        message: "Invalid webhook signature.",
        statusCode: 401,
      };
    }

    let normalized: NormalizedWebhook;

    try {
      normalized = await provider.normalizeWebhook(payload, headers);
    } catch (err) {
      auditService.recordSafe({
        eventType: "payment.webhook_normalize_error",
        entityType: "payment",
        metadata: {
          provider: providerName,
          error: String(err),
        } as Record<string, string>,
      });

      return {
        ok: false,
        code: "WEBHOOK_PROVIDER_ERROR",
        message: "Could not fetch payment details from provider.",
        statusCode: 502,
      };
    }

    const { orderId, status, externalId, rawPayload } = normalized;

    if (!orderId) {
      return {
        ok: true,
        processed: false,
      };
    }

    const payment = await paymentsRepo.findById(orderId);

    if (!payment) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Payment not found.",
        statusCode: 404,
      };
    }

    if (
      payment.status === "success" ||
      payment.status === "rejected" ||
      payment.status === "failed" ||
      payment.status === "refunded"
    ) {
      return {
        ok: true,
        processed: false,
      };
    }

    if (status === "pending" || status === "unknown") {
      return {
        ok: true,
        processed: false,
      };
    }

    if (status === "success") {
      await paymentsRepo.markSuccess(payment["id"], externalId, rawPayload);

      try {
        const { db } = await import("../../db/client.js");
        const { rideRequests } = await import("../../db/schema/rides.schema.js");
        const { eq } = await import("drizzle-orm");

        await db
          .update(rideRequests)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(rideRequests.id, payment.rideRequestId));
      } catch {
        // No bloquea el webhook si la actualización auxiliar del viaje falla.
      }

      auditService.recordSafe({
        actorUserId: payment.passengerUserId,
        eventType: "payment.success",
        entityType: "payment",
        entityId: payment["id"],
        metadata: {
          rideId: payment.rideRequestId,
          amountClp: payment.amountClp,
          externalId,
          provider: providerName,
        },
      });

      return {
        ok: true,
        processed: true,
      };
    }

    if (status === "rejected") {
      await paymentsRepo.markRejected(payment["id"], rawPayload);

      auditService.recordSafe({
        actorUserId: payment.passengerUserId,
        eventType: "payment.rejected",
        entityType: "payment",
        entityId: payment["id"],
        metadata: {
          rideId: payment.rideRequestId,
          provider: providerName,
        },
      });

      return {
        ok: true,
        processed: true,
      };
    }

    return {
      ok: true,
      processed: false,
    };
  }
}