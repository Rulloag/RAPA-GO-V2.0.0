import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  paymentWebhookEvents,
  payments,
  type NewPayment,
  type NewPaymentWebhookEvent,
  type Payment,
  type PaymentWebhookEvent,
} from "../../db/schema/index.js";

export type PaymentPurpose = "ride" | "fast_search";

export class PaymentsRepository {
  async create(data: NewPayment): Promise<Payment> {
    const [row] = await db.insert(payments).values(data).returning();
    return row!;
  }

  async findById(id: string): Promise<Payment | null> {
    const [row] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);

    return row ?? null;
  }

  async findByRideId(
    rideRequestId: string,
    paymentPurpose: PaymentPurpose = "ride",
  ): Promise<Payment | null> {
    const [row] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.rideRequestId, rideRequestId),
          eq(payments.paymentPurpose, paymentPurpose),
        ),
      )
      .orderBy(desc(payments.createdAt))
      .limit(1);

    return row ?? null;
  }

  // Importante: este método representa exclusivamente el pago principal.
  // Un pago de $800 de fast_search jamás puede habilitar por sí solo un viaje con tarjeta.
  async findSuccessfulByRideId(rideRequestId: string): Promise<Payment | null> {
    return this.findSuccessfulByRideIdAndPurpose(rideRequestId, "ride");
  }

  /** Pago principal que puede devolverse o ya fue devuelto. */
  async findRefundableByRideId(
    rideRequestId: string,
  ): Promise<Payment | null> {
    const [row] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.rideRequestId, rideRequestId),
          eq(payments.paymentPurpose, "ride"),
          inArray(payments.status, ["success", "refunded"]),
        ),
      )
      .orderBy(desc(payments.paidAt), desc(payments.createdAt))
      .limit(1);

    return row ?? null;
  }

  async findSuccessfulByRideIdAndPurpose(
    rideRequestId: string,
    paymentPurpose: PaymentPurpose,
  ): Promise<Payment | null> {
    const [row] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.rideRequestId, rideRequestId),
          eq(payments.paymentPurpose, paymentPurpose),
          eq(payments.status, "success"),
        ),
      )
      .orderBy(desc(payments.paidAt), desc(payments.createdAt))
      .limit(1);

    return row ?? null;
  }

  async findActiveByRideId(rideRequestId: string): Promise<Payment | null> {
    return this.findActiveByRideIdAndPurpose(rideRequestId, "ride");
  }

  async findActiveByRideIdAndPurpose(
    rideRequestId: string,
    paymentPurpose: PaymentPurpose,
  ): Promise<Payment | null> {
    const [row] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.rideRequestId, rideRequestId),
          eq(payments.paymentPurpose, paymentPurpose),
          inArray(payments.status, ["pending", "processing"]),
        ),
      )
      .orderBy(desc(payments.createdAt))
      .limit(1);

    return row ?? null;
  }

  async findByProviderOrderId(providerOrderId: string): Promise<Payment | null> {
    const [row] = await db
      .select()
      .from(payments)
      .where(eq(payments.providerOrderId, providerOrderId))
      .limit(1);

    return row ?? null;
  }

  async markProcessing(
    id: string,
    urlPay: string,
    providerOrderId: string,
  ): Promise<Payment> {
    const [row] = await db
      .update(payments)
      .set({
        status: "processing",
        urlPay,
        providerOrderId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();

    return row!;
  }

  async markFailed(id: string): Promise<Payment> {
    const [row] = await db
      .update(payments)
      .set({
        status: "failed",
        failedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();

    return row!;
  }

  async markSuccess(
    id: string,
    externalId: string,
    webhookPayload: unknown,
  ): Promise<Payment> {
    const [row] = await db
      .update(payments)
      .set({
        status: "success",
        providerPaymentId: externalId,
        rawProviderPayload: webhookPayload as Record<string, unknown>,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();

    return row!;
  }

  async markRejected(id: string, webhookPayload: unknown): Promise<Payment> {
    const [row] = await db
      .update(payments)
      .set({
        status: "rejected",
        rawProviderPayload: webhookPayload as Record<string, unknown>,
        rejectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();

    return row!;
  }

  /**
   * Reserva la devolución de forma atómica. Solo una petición puede pasar a
   * processing. Los reintentos después de failed usan la misma clave estable.
   */
  async claimRefund(
    id: string,
    idempotencyKey: string,
  ): Promise<Payment | null> {
    const now = new Date();
    const [row] = await db
      .update(payments)
      .set({
        refundStatus: "processing",
        refundIdempotencyKey: idempotencyKey,
        refundRequestedAt: now,
        refundFailedAt: null,
        refundFailureReason: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(payments.id, id),
          eq(payments.status, "success"),
          or(
            isNull(payments.refundStatus),
            eq(payments.refundStatus, "failed"),
          ),
        ),
      )
      .returning();

    return row ?? null;
  }

  async markRefunded(input: {
    id: string;
    providerRefundId?: string | null;
    refundPayload: unknown;
  }): Promise<Payment> {
    const existing = await this.findById(input.id);
    const previousPayload =
      existing?.rawProviderPayload &&
      typeof existing.rawProviderPayload === "object"
        ? existing.rawProviderPayload
        : {};
    const now = new Date();

    const [row] = await db
      .update(payments)
      .set({
        status: "refunded",
        refundStatus: "approved",
        refundProviderId: input.providerRefundId ?? null,
        refundedAt: now,
        refundFailedAt: null,
        refundFailureReason: null,
        rawProviderPayload: {
          ...previousPayload,
          rapagoRefund: {
            status: "approved",
            providerRefundId: input.providerRefundId ?? null,
            refundedAt: now.toISOString(),
            payload: input.refundPayload,
          },
        } as Record<string, unknown>,
        updatedAt: now,
      })
      .where(
        and(
          eq(payments.id, input.id),
          eq(payments.refundStatus, "processing"),
        ),
      )
      .returning();

    if (!row) {
      const current = await this.findById(input.id);
      if (current?.refundStatus === "approved") return current;
      throw new Error("Payment refund could not be marked approved.");
    }

    return row;
  }

  async markRefundFailed(input: {
    id: string;
    reason: string;
    refundPayload: unknown;
  }): Promise<Payment> {
    const existing = await this.findById(input.id);
    const previousPayload =
      existing?.rawProviderPayload &&
      typeof existing.rawProviderPayload === "object"
        ? existing.rawProviderPayload
        : {};
    const now = new Date();

    const [row] = await db
      .update(payments)
      .set({
        refundStatus: "failed",
        refundFailedAt: now,
        refundFailureReason: input.reason.slice(0, 1000),
        rawProviderPayload: {
          ...previousPayload,
          rapagoRefund: {
            status: "failed",
            failedAt: now.toISOString(),
            reason: input.reason,
            payload: input.refundPayload,
          },
        } as Record<string, unknown>,
        updatedAt: now,
      })
      .where(
        and(
          eq(payments.id, input.id),
          eq(payments.refundStatus, "processing"),
        ),
      )
      .returning();

    if (!row) {
      const current = await this.findById(input.id);
      if (current) return current;
      throw new Error("Payment refund failure could not be persisted.");
    }

    return row;
  }

  async claimWebhookEvent(
    input: NewPaymentWebhookEvent,
  ): Promise<{ claimed: boolean; event: PaymentWebhookEvent }> {
    const inserted = await db
      .insert(paymentWebhookEvents)
      .values(input)
      .onConflictDoNothing({
        target: [paymentWebhookEvents.provider, paymentWebhookEvents.eventKey],
      })
      .returning();

    if (inserted[0]) return { claimed: true, event: inserted[0] };

    const [existing] = await db
      .select()
      .from(paymentWebhookEvents)
      .where(
        and(
          eq(paymentWebhookEvents.provider, input.provider),
          eq(paymentWebhookEvents.eventKey, input.eventKey),
        ),
      )
      .limit(1);

    if (!existing) throw new Error("Webhook event conflict returned no row.");

    if (existing.status === "failed") {
      const [retried] = await db
        .update(paymentWebhookEvents)
        .set({
          status: "processing",
          errorMessage: null,
          payload: input.payload,
          payloadHash: input.payloadHash,
          requestId: input.requestId ?? existing.requestId,
          action: input.action ?? existing.action,
          processedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(paymentWebhookEvents.id, existing.id),
            eq(paymentWebhookEvents.status, "failed"),
          ),
        )
        .returning();

      if (retried) return { claimed: true, event: retried };
    }

    return { claimed: false, event: existing };
  }

  async completeWebhookEvent(input: {
    id: string;
    paymentId?: string | null;
    providerPaymentId?: string | null;
    action?: string | null;
  }): Promise<void> {
    await db
      .update(paymentWebhookEvents)
      .set({
        status: "processed",
        paymentId: input.paymentId ?? null,
        providerPaymentId: input.providerPaymentId ?? null,
        action: input.action ?? null,
        errorMessage: null,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentWebhookEvents.id, input.id));
  }

  async failWebhookEvent(id: string, errorMessage: string): Promise<void> {
    await db
      .update(paymentWebhookEvents)
      .set({
        status: "failed",
        errorMessage: errorMessage.slice(0, 2000),
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentWebhookEvents.id, id));
  }

}