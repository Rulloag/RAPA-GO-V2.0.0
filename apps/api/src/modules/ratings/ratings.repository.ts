import { and, avg, count, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { rideRatings, rideRequests, users } from "../../db/schema/index.js";
import type { NewRideRating, RideRating } from "../../db/schema/ratings.schema.js";

export interface ReceivedRatingRow extends RideRating {
  raterName: string | null;
  originText: string | null;
  destinationText: string | null;
}

export class RatingsRepository {
  async create(input: NewRideRating): Promise<RideRating> {
    const rows = await db.insert(rideRatings).values(input).returning();
    const created = rows[0];
    if (!created) throw new Error("Rating insert returned no rows.");
    return created;
  }

  async findById(id: string): Promise<RideRating | null> {
    const [row] = await db.select().from(rideRatings).where(eq(rideRatings.id, id)).limit(1);
    return row ?? null;
  }

  async findByRideId(rideRequestId: string): Promise<RideRating[]> {
    return db.select().from(rideRatings).where(eq(rideRatings.rideRequestId, rideRequestId));
  }

  async findByRideAndRater(rideRequestId: string, raterUserId: string): Promise<RideRating | null> {
    const rows = await db.select().from(rideRatings).where(and(
      eq(rideRatings.rideRequestId, rideRequestId),
      eq(rideRatings.raterUserId, raterUserId),
    )).limit(1);
    return rows[0] ?? null;
  }

  async getReceivedSummary(ratedUserId: string): Promise<{
    average: number;
    count: number;
    latest: ReceivedRatingRow[];
  }> {
    const [aggregate] = await db.select({
      average: avg(rideRatings.rating),
      count: count(rideRatings.id),
    }).from(rideRatings).where(eq(rideRatings.ratedUserId, ratedUserId));

    const latest = await db.select({
      id: rideRatings.id,
      rideRequestId: rideRatings.rideRequestId,
      raterUserId: rideRatings.raterUserId,
      ratedUserId: rideRatings.ratedUserId,
      raterRole: rideRatings.raterRole,
      rating: rideRatings.rating,
      comment: rideRatings.comment,
      commentVisibility: rideRatings.commentVisibility,
      moderationStatus: rideRatings.moderationStatus,
      moderationReason: rideRatings.moderationReason,
      moderatedByUserId: rideRatings.moderatedByUserId,
      moderatedAt: rideRatings.moderatedAt,
      createdAt: rideRatings.createdAt,
      updatedAt: rideRatings.updatedAt,
      raterName: users.name,
      originText: rideRequests.originText,
      destinationText: rideRequests.destinationText,
    }).from(rideRatings)
      .innerJoin(users, eq(rideRatings.raterUserId, users.id))
      .innerJoin(rideRequests, eq(rideRatings.rideRequestId, rideRequests.id))
      .where(eq(rideRatings.ratedUserId, ratedUserId))
      .orderBy(desc(rideRatings.createdAt))
      .limit(20);

    return {
      average: Number(aggregate?.average ?? 0),
      count: Number(aggregate?.count ?? 0),
      latest,
    };
  }

  async listForAdmin(limit = 100): Promise<ReceivedRatingRow[]> {
    return db.select({
      id: rideRatings.id,
      rideRequestId: rideRatings.rideRequestId,
      raterUserId: rideRatings.raterUserId,
      ratedUserId: rideRatings.ratedUserId,
      raterRole: rideRatings.raterRole,
      rating: rideRatings.rating,
      comment: rideRatings.comment,
      commentVisibility: rideRatings.commentVisibility,
      moderationStatus: rideRatings.moderationStatus,
      moderationReason: rideRatings.moderationReason,
      moderatedByUserId: rideRatings.moderatedByUserId,
      moderatedAt: rideRatings.moderatedAt,
      createdAt: rideRatings.createdAt,
      updatedAt: rideRatings.updatedAt,
      raterName: users.name,
      originText: rideRequests.originText,
      destinationText: rideRequests.destinationText,
    }).from(rideRatings)
      .innerJoin(users, eq(rideRatings.raterUserId, users.id))
      .innerJoin(rideRequests, eq(rideRatings.rideRequestId, rideRequests.id))
      .orderBy(desc(rideRatings.createdAt))
      .limit(Math.min(500, Math.max(1, limit)));
  }

  async moderate(input: {
    id: string;
    moderationStatus: "visible" | "hidden";
    moderationReason?: string;
    moderatedByUserId: string;
  }): Promise<RideRating | null> {
    const [row] = await db.update(rideRatings).set({
      moderationStatus: input.moderationStatus,
      moderationReason: input.moderationReason?.trim() || null,
      moderatedByUserId: input.moderatedByUserId,
      moderatedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(rideRatings.id, input.id)).returning();
    return row ?? null;
  }
}
