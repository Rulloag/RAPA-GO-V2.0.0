import { desc, eq, or } from "drizzle-orm";
import { db } from "../../db/client.js";
import { cashPaymentClosures } from "../../db/schema/index.js";
import type { CashPaymentClosure, NewCashPaymentClosure } from "../../db/schema/index.js";

export class CashPaymentsRepository {
  async findByRideId(rideRequestId: string): Promise<CashPaymentClosure | null> {
    const [row] = await db.select().from(cashPaymentClosures).where(eq(cashPaymentClosures.rideRequestId, rideRequestId)).limit(1);
    return row ?? null;
  }

  async create(data: NewCashPaymentClosure): Promise<CashPaymentClosure> {
    const inserted = await db.insert(cashPaymentClosures).values(data).onConflictDoNothing({ target: cashPaymentClosures.rideRequestId }).returning();
    const row = inserted[0] ?? await this.findByRideId(data.rideRequestId);
    if (!row) throw new Error("Cash closure insert returned no rows.");
    return row;
  }

  async listByParticipant(userId: string): Promise<CashPaymentClosure[]> {
    return db.select().from(cashPaymentClosures)
      .where(or(eq(cashPaymentClosures.passengerUserId, userId), eq(cashPaymentClosures.driverUserId, userId)))
      .orderBy(desc(cashPaymentClosures.closedAt));
  }

  async listForAdmin(status?: string): Promise<CashPaymentClosure[]> {
    const query = db.select().from(cashPaymentClosures);
    return status && status !== "all"
      ? query.where(eq(cashPaymentClosures.status, status)).orderBy(desc(cashPaymentClosures.closedAt))
      : query.orderBy(desc(cashPaymentClosures.closedAt));
  }

  async markResolution(input: { rideRequestId: string; type: "benefit" | "bank_refund"; referenceId: string }): Promise<CashPaymentClosure | null> {
    const [row] = await db.update(cashPaymentClosures).set({
      resolutionType: input.type,
      resolutionReferenceId: input.referenceId,
      status: input.type === "benefit" ? "benefit_requested" : "refund_requested",
      updatedAt: new Date(),
    }).where(eq(cashPaymentClosures.rideRequestId, input.rideRequestId)).returning();
    return row ?? null;
  }
  async markResolved(input: {
    rideRequestId: string;
    type: "benefit" | "bank_refund";
    referenceId: string;
  }): Promise<CashPaymentClosure | null> {
    const [row] = await db.update(cashPaymentClosures).set({
      resolutionType: input.type,
      resolutionReferenceId: input.referenceId,
      status: "resolved",
      updatedAt: new Date(),
    }).where(eq(cashPaymentClosures.rideRequestId, input.rideRequestId)).returning();
    return row ?? null;
  }

}
