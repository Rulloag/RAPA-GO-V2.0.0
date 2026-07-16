import { TokenService }      from "../auth/token.service.js";
import { SessionService }    from "../auth/session.service.js";
import { UsersRepository }   from "../users/users.repository.js";
import { PaymentsRepository } from "./payments.repository.js";
import { getActiveProvider, getProvider } from "./provider.registry.js";
import { AuditService }      from "../audit/audit.service.js";
import { AppError }          from "../../shared/errors/AppError.js";
import type { CreatePaymentInput } from "./payments.schemas.js";
import type { NormalizedWebhook }  from "./payment.provider.js";

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

    const user     = await usersRepo.findById(auth.userId);
    const provider = getActiveProvider();

    const payment = await paymentsRepo.create({
      rideRequestId:   ride.id,
      passengerUserId: auth.userId,
      amountClp,
      status:   "pending",
      provider: provider.name,
    });

    const webhookBaseUrl = process.env["PAYMENT_WEBHOOK_BASE_URL"] ?? "";
    const returnUrl      = process.env["MOBILE_APP_DEEP_LINK"]     ?? "rapago://";

    let providerOrderId: string;
    let urlPay: string;

    try {
      const result = await provider.createPayment({
        orderId:        payment.id,
        amountClp,
        description:    `Viaje Rapa Go — ${ride.originText} → ${ride.destinationText}`,
        passengerEmail: user?.email ?? "",
        passengerName:  user?.name  ?? "Pasajero",
        returnUrl:      `${returnUrl}payment/result`,
        webhookUrl:     `${webhookBaseUrl}/api/payments/webhook/${provider.name}`,
      });
      providerOrderId = result.providerOrderId;
      urlPay          = result.urlPay;
    } catch (err) {
      await paymentsRepo.markFailed(payment.id);

      auditService.recordSafe({
        actorUserId: auth.userId,
        eventType:   "payment.provider_error",
        entityType:  "payment",
        entityId:    payment.id,
        metadata:    { error: String(err), rideId: ride.id, provider: provider.name } as Record<string, string>,
      });

      return {
        ok: false,
        code: "PAYMENT_PROVIDER_ERROR",
        message: "Could not initiate payment with provider. Please try again.",
        statusCode: 502,
      };
    }

    await paymentsRepo.markProcessing(payment.id, urlPay, providerOrderId);

    auditService.recordSafe({
      actorUserId: auth.userId,
      eventType:   "payment.created",
      entityType:  "payment",
      entityId:    payment.id,
      metadata:    { rideId: ride.id, amountClp, provider: provider.name },
    });

    return { ok: true, urlPay, paymentId: payment.id };
  }

  /**
   * Handle an incoming webhook from any payment provider.
   * @param providerName  The provider slug derived from the route (e.g. "mercadopago", "prontopaga")
   * @param payload       Parsed JSON body
   * @param headers       Relevant HTTP headers forwarded from the controller
   */
  async handleWebhook(
    providerName: string,
    payload:      Record<string, unknown>,
    headers:      Record<string, string>,
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
        eventType:  "payment.webhook_invalid_signature",
        entityType: "payment",
        metadata:   { provider: providerName } as Record<string, string>,
      });
      return { ok: false, code: "WEBHOOK_INVALID_SIGNATURE", message: "Invalid webhook signature.", statusCode: 401 };
    }

    let normalized: NormalizedWebhook;
    try {
      normalized = await provider.normalizeWebhook(payload, headers);
    } catch (err) {
      auditService.recordSafe({
        eventType:  "payment.webhook_normalize_error",
        entityType: "payment",
        metadata:   { provider: providerName, error: String(err) } as Record<string, string>,
      });
      return {
        ok: false,
        code: "WEBHOOK_PROVIDER_ERROR",
        message: "Could not fetch payment details from provider.",
        statusCode: 502,
      };
    }

    const { orderId, status, externalId, rawPayload } = normalized;

    // Non-payment events (e.g. MercadoPago subscription notifications) — acknowledge silently.
    if (!orderId) {
      return { ok: true, processed: false };
    }

    if (!orderId) {
      return {
        ok: false,
        code: "WEBHOOK_MISSING_ORDER",
        message: "Webhook payload must include a payment reference.",
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

    // Provider is still processing — no state change yet.
    if (status === "pending" || status === "unknown") {
      return { ok: true, processed: false };
    }

    if (status === "success") {
      await paymentsRepo.markSuccess(payment.id, externalId, rawPayload);

      try {
        const { db }           = await import("../../db/client.js");
        const { rideRequests } = await import("../../db/schema/rides.schema.js");
        const { eq }           = await import("drizzle-orm");
        await db.update(rideRequests).set({ updatedAt: new Date() }).where(eq(rideRequests.id, payment.rideRequestId));
      } catch { }

      auditService.recordSafe({
        actorUserId: payment.passengerUserId,
        eventType:   "payment.success",
        entityType:  "payment",
        entityId:    payment.id,
        metadata:    { rideId: payment.rideRequestId, amountClp: payment.amountClp, externalId, provider: providerName },
      });

      return { ok: true, processed: true };
    }

    if (status === "rejected") {
      await paymentsRepo.markRejected(payment.id, rawPayload);

      auditService.recordSafe({
        actorUserId: payment.passengerUserId,
        eventType:   "payment.rejected",
        entityType:  "payment",
        entityId:    payment.id,
        metadata:    { rideId: payment.rideRequestId, provider: providerName },
      });

      return { ok: true, processed: true };
    }

    return { ok: true, processed: false };
  }

  /**
   * Admin-only, idempotent refund flip. markRefunded's WHERE status='success' is the
   * idempotency gate — calling this twice for the same payment is safe, the second call
   * simply finds no row to update.
   */
  async refundPayment(accessToken: string, paymentId: string): Promise<Result<{ refunded: boolean }>> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin access required.", statusCode: 403 };
    }

    const payment = await paymentsRepo.findById(paymentId);
    if (!payment) {
      return { ok: false, code: "NOT_FOUND", message: "Payment not found.", statusCode: 404 };
    }

    const refunded = await paymentsRepo.markRefunded(paymentId);
    if (!refunded) {
      if (payment.status === "refunded") {
        return { ok: true, refunded: false };
      }
      return {
        ok: false,
        code: "PAYMENT_NOT_REFUNDABLE",
        message: `Payment cannot be refunded — current status is '${payment.status}'.`,
        statusCode: 409,
      };
    }

    auditService.recordSafe({
      actorUserId: auth.userId,
      eventType:   "payment.refunded",
      entityType:  "payment",
      entityId:    refunded.id,
      metadata:    { rideId: refunded.rideRequestId, amountClp: refunded.amountClp },
    });

    return { ok: true, refunded: true };
  }
}
