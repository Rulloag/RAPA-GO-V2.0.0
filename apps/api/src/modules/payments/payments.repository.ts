import { db } from "../../db/client.js";
import { payments } from "../../db/schema/payments.schema.js";
import { eq, and, inArray } from "drizzle-orm";
import type { Payment, NewPayment } from "../../db/schema/payments.schema.js";

export class PaymentsRepository {
  async create(data: NewPayment): Promise<Payment> {
    const [row] = await db.insert(payments).values(data).returning();
    return row!;
  }

  async findById(id: string): Promise<Payment | null> {
    const [row] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    return row ?? null;
  }

  async findByRideId(rideRequestId: string): Promise<Payment | null> {
    const [row] = await db
      .select()
      .from(payments)
      .where(eq(payments.rideRequestId, rideRequestId))
      .limit(1);
    return row ?? null;
  }

  async findActiveByRideId(rideRequestId: string): Promise<Payment | null> {
    const [row] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.rideRequestId, rideRequestId),
          inArray(payments.status, ["pending", "processing"]),
        ),
      )
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

  /** Atomic: sets status=processing, urlPay, and providerOrderId in one UPDATE. */
  async markProcessing(id: string, urlPay: string, providerOrderId: string): Promise<Payment> {
    const [row] = await db
      .update(payments)
      .set({ status: "processing", urlPay, providerOrderId, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return row!;
  }

  /** Sets status=failed so the passenger can retry (not blocked by the partial index). */
  async markFailed(id: string): Promise<Payment> {
    const [row] = await db
      .update(payments)
      .set({ status: "failed", failedAt: new Date(), updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return row!;
  }

  async markSuccess(id: string, externalId: string, webhookPayload: unknown): Promise<Payment> {
    const [row] = await db
      .update(payments)
      .set({
        status: "success",
        externalId,
        webhookPayload: webhookPayload as Record<string, unknown>,
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
        webhookPayload: webhookPayload as Record<string, unknown>,
        rejectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();
    return row!;
  }

  /**
   * Atomic: only flips status='success' -> 'refunded'. The WHERE clause is the idempotency
   * gate — a second call for the same payment finds no row still in 'success' and returns null.
   */
  async markRefunded(id: string): Promise<Payment | null> {
    const [row] = await db
      .update(payments)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(and(eq(payments.id, id), eq(payments.status, "success")))
      .returning();
    return row ?? null;
  }
}
