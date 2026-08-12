import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  paymentWebhookEvents,
  payments,
  rideRequests,
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
          // Una autorización o una captura incierta/rechazada nunca deben
          // permitir crear automáticamente una segunda orden Klap — todas
          // estas variantes cuentan como "activa" hasta que se resuelvan de
          // forma explícita (success/rejected/refunded/failed son terminales).
          inArray(payments.status, [
            "pending",
            "processing",
            "authorized",
            "capture_pending",
            "capture_unknown",
            "capture_failed",
          ]),
        ),
      )
      .orderBy(desc(payments.createdAt))
      .limit(1);

    return row ?? null;
  }

  /**
   * Pago suficientemente aprobado para permitir que el viaje avance
   * (aceptar/en-route/arrived/start/complete), sin exigir todavía una
   * captura confirmada. Para Klap, "authorized"/"capture_pending"/
   * "capture_unknown" ya reservaron el dinero en la tarjeta — el viaje
   * puede continuar mientras la captura se resuelve al completar el viaje.
   * Mercado Pago y ProntoPaga no tienen concepto de autorización diferida:
   * para ellos solo "success" cuenta.
   */
  async findApprovedByRideId(rideRequestId: string): Promise<Payment | null> {
    const [row] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.rideRequestId, rideRequestId),
          eq(payments.paymentPurpose, "ride"),
          or(
            eq(payments.status, "success"),
            and(
              eq(payments.provider, "klap"),
              inArray(payments.status, [
                "authorized",
                "capture_pending",
                "capture_unknown",
              ]),
            ),
          ),
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

  /**
   * Same "processing" transition as `markProcessing()` above, for providers with
   * no checkout URL at all (Klap Checkout Transparente). `urlPay` has no
   * parameter here — not `string | null`, not optional — so an embedded provider
   * has no way, even by mistake, to pass a fake or empty-string URL through this
   * method. The column is genuinely NULL for these rows, not `""`.
   */
  async markEmbeddedProcessing(id: string, providerOrderId: string): Promise<Payment> {
    const [row] = await db
      .update(payments)
      .set({
        status: "processing",
        urlPay: null,
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

  async markSuccessAndActivateRide(input: {
    id: string;
    rideRequestId: string;
    externalId: string;
    providerPayload: unknown;
  }): Promise<{ payment: Payment; rideActivated: boolean }> {
    return db.transaction(async (tx) => {
      const [existingPayment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, input.id))
        .limit(1);

      if (!existingPayment) {
        throw new Error(`Payment not found: ${input.id}`);
      }

      let confirmedPayment = existingPayment;
      const confirmedAt = new Date();

      if (existingPayment.status !== "success") {
        const [updatedPayment] = await tx
          .update(payments)
          .set({
            status: "success",
            providerPaymentId: input.externalId,
            rawProviderPayload:
              input.providerPayload as Record<string, unknown>,
            paidAt: confirmedAt,
            updatedAt: confirmedAt,
          })
          .where(
            and(
              eq(payments.id, input.id),
              inArray(payments.status, ["pending", "processing"]),
            ),
          )
          .returning();

        if (!updatedPayment) {
          throw new Error(
            `Payment ${input.id} could not transition to success.`,
          );
        }

        confirmedPayment = updatedPayment;
      }

      const activatedAt = new Date();
      const [activatedRide] = await tx
        .update(rideRequests)
        .set({
          status: "requested",
          requestedAt: activatedAt,
          updatedAt: activatedAt,
        })
        .where(
          and(
            eq(rideRequests.id, input.rideRequestId),
            eq(rideRequests.status, "pending_payment"),
          ),
        )
        .returning({ id: rideRequests.id });

      if (activatedRide) {
        return {
          payment: confirmedPayment,
          rideActivated: true,
        };
      }

      const [currentRide] = await tx
        .select({ status: rideRequests.status })
        .from(rideRequests)
        .where(eq(rideRequests.id, input.rideRequestId))
        .limit(1);

      const currentStatus = String(
        currentRide?.status ?? "",
      )
        .trim()
        .toLowerCase();
      const alreadyActivated = Boolean(
        currentRide &&
          currentStatus &&
          currentStatus !== "pending_payment" &&
          currentStatus !== "cancelled",
      );

      if (!alreadyActivated) {
        throw new Error(
          `Ride ${input.rideRequestId} could not be activated after payment.`,
        );
      }

      return {
        payment: confirmedPayment,
        rideActivated: true,
      };
    });
  }

  /**
   * Equivalente de `markSuccessAndActivateRide` para captura diferida: deja
   * el pago en `authorized` (tarjeta autorizada, NO cobrada — paidAt/capturedAt
   * permanecen null) y activa el viaje pendiente. Atómica, idempotente frente
   * a webhooks duplicados: solo transiciona pending/processing → authorized;
   * un pago ya en authorized/capture_pending/capture_unknown/success no
   * repite la activación ni ningún efecto.
   */
  async markAuthorizedAndActivateRide(input: {
    id: string;
    rideRequestId: string;
    authorizedAmountClp: number;
    transactionType: string;
    providerPayload: unknown;
  }): Promise<{ payment: Payment; rideActivated: boolean }> {
    return db.transaction(async (tx) => {
      const [existingPayment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, input.id))
        .limit(1);

      if (!existingPayment) {
        throw new Error(`Payment not found: ${input.id}`);
      }

      let currentPayment = existingPayment;

      if (existingPayment.status === "pending" || existingPayment.status === "processing") {
        const authorizedAt = new Date();
        const [updatedPayment] = await tx
          .update(payments)
          .set({
            status: "authorized",
            transactionType: input.transactionType,
            authorizedAmountClp: input.authorizedAmountClp,
            authorizedAt,
            rawProviderPayload: input.providerPayload as Record<string, unknown>,
            updatedAt: authorizedAt,
          })
          .where(
            and(
              eq(payments.id, input.id),
              inArray(payments.status, ["pending", "processing"]),
            ),
          )
          .returning();

        if (!updatedPayment) {
          // Perdió la carrera contra otro webhook concurrente — releer abajo.
          const [reread] = await tx
            .select()
            .from(payments)
            .where(eq(payments.id, input.id))
            .limit(1);
          if (reread) currentPayment = reread;
        } else {
          currentPayment = updatedPayment;
        }
      }
      // Si ya está authorized/capture_pending/capture_unknown/capture_failed/
      // success, no se repite la transición — solo se activa el viaje abajo
      // (idempotente también, vía el mismo guard de estado del viaje).

      const activatedAt = new Date();
      const [activatedRide] = await tx
        .update(rideRequests)
        .set({
          status: "requested",
          requestedAt: activatedAt,
          updatedAt: activatedAt,
        })
        .where(
          and(
            eq(rideRequests.id, input.rideRequestId),
            eq(rideRequests.status, "pending_payment"),
          ),
        )
        .returning({ id: rideRequests.id });

      if (activatedRide) {
        return { payment: currentPayment, rideActivated: true };
      }

      const [currentRide] = await tx
        .select({ status: rideRequests.status })
        .from(rideRequests)
        .where(eq(rideRequests.id, input.rideRequestId))
        .limit(1);

      const currentStatus = String(currentRide?.status ?? "").trim().toLowerCase();
      const alreadyActivated = Boolean(
        currentRide &&
          currentStatus &&
          currentStatus !== "pending_payment" &&
          currentStatus !== "cancelled",
      );

      if (!alreadyActivated) {
        throw new Error(
          `Ride ${input.rideRequestId} could not be activated after authorization.`,
        );
      }

      return { payment: currentPayment, rideActivated: true };
    });
  }

  /**
   * Reclama atómicamente el derecho a capturar: solo transiciona
   * authorized → capture_pending, y solo una llamada concurrente puede
   * ganar la carrera (WHERE status = 'authorized'). Devuelve null si el pago
   * ya no está en authorized (otra captura en curso, ya capturado, fallido, etc).
   */
  async claimCapture(input: {
    id: string;
    captureAttemptKey: string;
  }): Promise<Payment | null> {
    const now = new Date();
    const [row] = await db
      .update(payments)
      .set({
        status: "capture_pending",
        captureRequestedAt: now,
        captureAttemptKey: input.captureAttemptKey,
        updatedAt: now,
      })
      .where(and(eq(payments.id, input.id), eq(payments.status, "authorized")))
      .returning();

    return row ?? null;
  }

  async markCapturedSuccess(input: {
    id: string;
    capturedAmountClp: number;
    providerPayload: unknown;
  }): Promise<Payment> {
    const now = new Date();
    const [row] = await db
      .update(payments)
      .set({
        status: "success",
        capturedAmountClp: input.capturedAmountClp,
        capturedAt: now,
        paidAt: now,
        captureProviderPayload: input.providerPayload as Record<string, unknown>,
        captureFailureReason: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(payments.id, input.id),
          inArray(payments.status, ["capture_pending", "capture_unknown"]),
        ),
      )
      .returning();

    if (!row) {
      const current = await this.findById(input.id);
      if (current?.status === "success") return current;
      throw new Error(`Payment ${input.id} could not transition to success after capture.`);
    }

    return row;
  }

  /**
   * Timeout / error de red / HTTP 5xx: Klap podría haber procesado la
   * captura aunque Rapa Go no recibiera la respuesta. Nunca se convierte
   * automáticamente en capture_failed.
   */
  async markCaptureUnknown(input: {
    id: string;
    reason: string;
  }): Promise<Payment> {
    const now = new Date();
    const [row] = await db
      .update(payments)
      .set({
        status: "capture_unknown",
        captureFailureReason: input.reason.slice(0, 1000),
        updatedAt: now,
      })
      .where(
        and(
          eq(payments.id, input.id),
          inArray(payments.status, ["capture_pending", "capture_unknown"]),
        ),
      )
      .returning();

    if (!row) {
      const current = await this.findById(input.id);
      if (current) return current;
      throw new Error(`Payment ${input.id} not found while marking capture_unknown.`);
    }

    return row;
  }

  /** HTTP 4xx: Klap rechazó definitivamente la captura. */
  async markCaptureFailed(input: {
    id: string;
    reason: string;
  }): Promise<Payment> {
    const now = new Date();
    const [row] = await db
      .update(payments)
      .set({
        status: "capture_failed",
        captureFailedAt: now,
        captureFailureReason: input.reason.slice(0, 1000),
        updatedAt: now,
      })
      .where(
        and(
          eq(payments.id, input.id),
          inArray(payments.status, ["capture_pending", "capture_unknown"]),
        ),
      )
      .returning();

    if (!row) {
      const current = await this.findById(input.id);
      if (current) return current;
      throw new Error(`Payment ${input.id} not found while marking capture_failed.`);
    }

    return row;
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
          inArray(payments.status, ["success", "authorized"]),
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