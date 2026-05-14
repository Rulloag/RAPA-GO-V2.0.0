import { db } from "../../db/client.js";
import { rideRatings } from "../../db/schema/index.js";
import { eq, and } from "drizzle-orm";
import type { RideRating, NewRideRating } from "../../db/schema/ratings.schema.js";

export class RatingsRepository {
  async create(input: NewRideRating): Promise<RideRating> {
    const [row] = await db.insert(rideRatings).values(input).returning();
    return row!;
  }

  async findByRideId(rideRequestId: string): Promise<RideRating[]> {
    return db.select().from(rideRatings).where(eq(rideRatings.rideRequestId, rideRequestId));
  }

  async findByRideAndRater(rideRequestId: string, raterUserId: string): Promise<RideRating | null> {
    const rows = await db
      .select()
      .from(rideRatings)
      .where(and(eq(rideRatings.rideRequestId, rideRequestId), eq(rideRatings.raterUserId, raterUserId)));
    return rows[0] ?? null;
  }
}
