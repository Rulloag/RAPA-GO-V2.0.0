import { and, avg, count, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { rideRatings, rideRequests, users } from "../../db/schema/index.js";
import type {
  NewRideRating,
  RideRating,
} from "../../db/schema/ratings.schema.js";

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

  async findByRideId(rideRequestId: string): Promise<RideRating[]> {
    return db
      .select()
      .from(rideRatings)
      .where(eq(rideRatings.rideRequestId, rideRequestId));
  }

  async findByRideAndRater(
    rideRequestId: string,
    raterUserId: string,
  ): Promise<RideRating | null> {
    const rows = await db
      .select()
      .from(rideRatings)
      .where(
        and(
          eq(rideRatings.rideRequestId, rideRequestId),
          eq(rideRatings.raterUserId, raterUserId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async getReceivedSummary(ratedUserId: string): Promise<{
    average: number;
    count: number;
    latest: ReceivedRatingRow[];
  }> {
    const aggregateRows = await db
      .select({
        average: avg(rideRatings.rating),
        count: count(rideRatings.id),
      })
      .from(rideRatings)
      .where(eq(rideRatings.ratedUserId, ratedUserId));

    const aggregate = aggregateRows[0];
    const latest = await db
      .select({
        id: rideRatings.id,
        rideRequestId: rideRatings.rideRequestId,
        raterUserId: rideRatings.raterUserId,
        ratedUserId: rideRatings.ratedUserId,
        raterRole: rideRatings.raterRole,
        rating: rideRatings.rating,
        comment: rideRatings.comment,
        createdAt: rideRatings.createdAt,
        updatedAt: rideRatings.updatedAt,
        raterName: users.name,
        originText: rideRequests.originText,
        destinationText: rideRequests.destinationText,
      })
      .from(rideRatings)
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
}
