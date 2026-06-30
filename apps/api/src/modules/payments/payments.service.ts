import { TokenService }    from "../auth/token.service.js";
import { SessionService }  from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { PaymentsRepository } from "./payments.repository.js";
import { createProntoPagaPayment, verifyProntoPagaWebhookSignature } from "./prontopaga.service.js";
import { AuditService }   from "../audit/audit.service.js";
import { AppError }       from "../../shared/errors/AppError.js";
import { extractOrderId } from "./payments.schemas.js";
import type { CreatePaymentInput } from "./payments.schemas.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const paymentsRepo   = new PaymentsRepository();
const auditService   = new AuditService();

type Ok<T>     = { ok: true } & T;
type Fail      = { ok: false; code: string; message: string; statusCode: number };
type Result<T> = Ok<T> | Fail;

async function authenticate(accessToken: string): Promise<Result<{ userId: string; role: string }>> {
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

export class PaymentsService {
  async createPayment(
    accessToken: string,
    input: CreatePaymentInput,
  ): Promise<Result<{ urlPay: string; paymentId: string }>> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only passengers can create payments.", statusCode: 403 };
    }

    const { RidesRepository } = await import("../rides/rides.repository.js");
    const ridesRepo = new RidesRepository();
    const ride = await ridesRepo.findById(input.rideRequestId);

    if (!ride) {
      return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
    }
    if (ride.passengerUserId !== auth.userId) {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "This ride does not belong to you.", statusCode: 403 };
    }
    if (ride.status !== "completed") {
      return {
        ok: false,
        code: "PAYMENT_RIDE_NOT_COMPLETED",
        message: "Payment can only be initiated for completed rides.",
        statusCode: 409,
      };
    }

    // Guard: block only if there is an active (pending|processing) payment.
    // Failed/rejected payments are excluded from the index so retries are allowed.
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
      return { ok: false, code: "PAYMENT_INVALID_AMOUNT", message: "Ride has no valid fare amount.", statusCode: 422 };
    }

    const user = await usersRepo.findById(auth.userId);

    // Insert in pending state first so we have an ID to use as orderId.
    const payment = await paymentsRepo.create({
      rideRequestId:   ride.id,
      passengerUserId: auth.userId,
      amountClp,
      status: "pending",
      provider: "prontopaga",
    });

    const webhookBaseUrl = process.env["PAYMENT_WEBHOOK_BASE_URL"] ?? "";
    const returnUrl      = process.env["MOBILE_APP_DEEP_LINK"]     ?? "rapago://";

    let providerOrderId: string;
    let urlPay: string;

    try {
      const result = await createProntoPagaPayment({
        orderId:        payment.id,
        amountClp,
        description:    `Viaje Rapa Go — ${ride.originText} → ${ride.destinationText}`,
        passengerEmail: user?.email ?? "",
        passengerName:  user?.name  ?? "Pasajero",
        returnUrl:      `${returnUrl}payment/result`,
        webhookUrl:     `${webhookBaseUrl}/api/payments/webhook/prontopaga`,
      });
      providerOrderId = result.providerOrderId;
      urlPay          = result.urlPay;
    } catch (err) {
      // Mark as failed so the passenger can retry without hitting the anti-duplicate guard.
      await paymentsRepo.markFailed(payment.id);

      auditService.recordSafe({
        actorUserId: auth.userId,
        eventType:   "payment.provider_error",
        entityType:  "payment",
        entityId:    payment.id,
        metadata:    { error: String(err), rideId: ride.id } as Record<string, string>,
      });

      return {
        ok: false,
        code: "PAYMENT_PROVIDER_ERROR",
        message: "Could not initiate payment with provider. Please try again.",
        statusCode: 502,
      };
    }

    // Atomic single UPDATE: status=processing + urlPay + providerOrderId.
    await paymentsRepo.markProcessing(payment.id, urlPay, providerOrderId);

    auditService.recordSafe({
      actorUserId: auth.userId,
      eventType:   "payment.created",
      entityType:  "payment",
      entityId:    payment.id,
      metadata:    { rideId: ride.id, amountClp, provider: "prontopaga" },
    });

    return { ok: true, urlPay, paymentId: payment.id };
  }

  async handleWebhook(
    payload: Record<string, unknown>,
    receivedSignature: string,
  ): Promise<Result<{ processed: boolean }>> {
    if (!verifyProntoPagaWebhookSignature(payload, receivedSignature)) {
      auditService.recordSafe({
        eventType:  "payment.webhook_invalid_signature",
        entityType: "payment",
      });
      return { ok: false, code: "WEBHOOK_INVALID_SIGNATURE", message: "Invalid webhook signature.", statusCode: 401 };
    }

    // Normalise: ProntoPaga may send "order" or "order_id"
    const orderId    = extractOrderId(payload);
    const status     = String(payload["status"]  ?? "");
    const externalId = String(payload["external_id"] ?? payload["transaction_id"] ?? "");

    if (!orderId) {
      return {
        ok: false,
        code: "WEBHOOK_MISSING_ORDER",
        message: "Webhook payload must include 'order' or 'order_id'.",
        statusCode: 400,
      };
    }

    const payment = await paymentsRepo.findById(orderId);
    if (!payment) {
      return { ok: false, code: "NOT_FOUND", message: "Payment not found.", statusCode: 404 };
    }

    // Idempotency: skip silently if already in a terminal state.
    if (payment.status === "success" || payment.status === "rejected" || payment.status === "failed") {
      return { ok: true, processed: false };
    }

    if (status === "success" || status === "approved" || status === "paid") {
      await paymentsRepo.markSuccess(payment.id, externalId, payload);

      // Touch ride updated_at so listeners know payment was confirmed.
      try {
        const { db }          = await import("../../db/client.js");
        const { rideRequests } = await import("../../db/schema/rides.schema.js");
        const { eq }          = await import("drizzle-orm");
        await db.update(rideRequests).set({ updatedAt: new Date() }).where(eq(rideRequests.id, payment.rideRequestId));
      } catch { }

      auditService.recordSafe({
        actorUserId: payment.passengerUserId,
        eventType:   "payment.success",
        entityType:  "payment",
        entityId:    payment.id,
        metadata:    { rideId: payment.rideRequestId, amountClp: payment.amountClp, externalId },
      });

      return { ok: true, processed: true };
    }

    if (status === "rejected" || status === "failed" || status === "cancelled") {
      await paymentsRepo.markRejected(payment.id, payload);

      auditService.recordSafe({
        actorUserId: payment.passengerUserId,
        eventType:   "payment.rejected",
        entityType:  "payment",
        entityId:    payment.id,
        metadata:    { rideId: payment.rideRequestId, status },
      });

      return { ok: true, processed: true };
    }

    // Unknown status — log and acknowledge without erroring (avoids provider retry storms).
    auditService.recordSafe({
      eventType:  "payment.webhook_unknown_status",
      entityType: "payment",
      entityId:   payment.id,
      metadata:   { status },
    });

    return { ok: true, processed: false };
  }
}
