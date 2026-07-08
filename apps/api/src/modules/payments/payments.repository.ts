import { and, eq, inArray } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  payments,
  type NewPayment,
  type Payment,
} from "../../db/schema/payments.schema.js";

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

  async findByRideId(rideRequestId: string): Promise<Payment | null> {
    const [row] = await db
      .select()
      .from(payments)
      .where(eq(payments.rideRequestId, rideRequestId))
      .limit(1);

    return row ?? null;
  }

  async findSuccessfulByRideId(rideRequestId: string): Promise<Payment | null> {
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

  async markRefunded(id: string, refundPayload: unknown): Promise<Payment> {
    const [row] = await db
      .update(payments)
      .set({
        status: "refunded",
        rawProviderPayload: {
          refundStatus: "approved",
          refundedAt: new Date().toISOString(),
          refundPayload,
        } as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();

    return row!;
  }

  async markRefundFailed(id: string, refundPayload: unknown): Promise<Payment> {
    const [row] = await db
      .update(payments)
      .set({
        rawProviderPayload: {
          refundStatus: "failed",
          refundFailedAt: new Date().toISOString(),
          refundPayload,
        } as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();

    return row!;
  }
}