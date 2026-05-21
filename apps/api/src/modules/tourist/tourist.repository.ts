import { and, avg, count, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users, driverProfiles, rideRatings, touristServices, serviceBookings } from "../../db/schema/index.js";
import type { TouristService, ServiceBooking } from "../../db/schema/index.js";
import type { CreateServiceInput, UpdateServiceInput } from "./tourist.schemas.js";

export interface GuideRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  languages: string[] | null;
  profilePhotoUrl: string | null;
  ratingAverage: number | null;
  ratingCount: number;
}

export class TouristRepository {
  async findGuides(filters: { name?: string; language?: string } = {}): Promise<{ items: GuideRow[]; total: number }> {
    const rows = await db
      .select({
        id:              users.id,
        name:            users.name,
        email:           users.email,
        phone:           driverProfiles.phone,
        bio:             driverProfiles.bio,
        languages:       driverProfiles.languages,
        profilePhotoUrl: driverProfiles.profilePhotoUrl,
        ratingAverage:   avg(rideRatings.rating),
        ratingCount:     count(rideRatings.id),
      })
      .from(users)
      .leftJoin(driverProfiles, eq(driverProfiles.userId, users.id))
      .leftJoin(rideRatings, eq(rideRatings.ratedUserId, users.id))
      .where(and(
        eq(users.role, "guide"),
        eq(users.status, "active"),
      ))
      .groupBy(users.id, driverProfiles.id)
      .orderBy(desc(users.createdAt));

    const filtered = rows.filter((r) => {
      if (filters.name && !r.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
      if (filters.language && r.languages && !r.languages.includes(filters.language)) return false;
      return true;
    });

    return {
      items: filtered.map((r) => ({
        id:              r.id,
        name:            r.name,
        email:           r.email,
        phone:           r.phone ?? null,
        bio:             r.bio ?? null,
        languages:       r.languages ?? null,
        profilePhotoUrl: r.profilePhotoUrl ?? null,
        ratingAverage:   r.ratingAverage ? Number(r.ratingAverage) : null,
        ratingCount:     Number(r.ratingCount),
      })),
      total: filtered.length,
    };
  }

  async findGuideById(id: string): Promise<GuideRow | null> {
    const rows = await db
      .select({
        id:              users.id,
        name:            users.name,
        email:           users.email,
        phone:           driverProfiles.phone,
        bio:             driverProfiles.bio,
        languages:       driverProfiles.languages,
        profilePhotoUrl: driverProfiles.profilePhotoUrl,
        ratingAverage:   avg(rideRatings.rating),
        ratingCount:     count(rideRatings.id),
      })
      .from(users)
      .leftJoin(driverProfiles, eq(driverProfiles.userId, users.id))
      .leftJoin(rideRatings, eq(rideRatings.ratedUserId, users.id))
      .where(and(eq(users.id, id), eq(users.role, "guide")))
      .groupBy(users.id, driverProfiles.id)
      .limit(1);

    const r = rows[0];
    if (!r) return null;
    return {
      id:              r.id,
      name:            r.name,
      email:           r.email,
      phone:           r.phone ?? null,
      bio:             r.bio ?? null,
      languages:       r.languages ?? null,
      profilePhotoUrl: r.profilePhotoUrl ?? null,
      ratingAverage:   r.ratingAverage ? Number(r.ratingAverage) : null,
      ratingCount:     Number(r.ratingCount),
    };
  }

  async findServicesByGuide(guideId: string, onlyActive = false): Promise<TouristService[]> {
    const conditions = onlyActive
      ? and(eq(touristServices.guideId, guideId), eq(touristServices.status, "active"))
      : eq(touristServices.guideId, guideId);

    return db
      .select()
      .from(touristServices)
      .where(conditions)
      .orderBy(desc(touristServices.createdAt));
  }

  async findServiceById(id: string): Promise<TouristService | null> {
    const rows = await db
      .select()
      .from(touristServices)
      .where(eq(touristServices.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async createService(guideId: string, input: CreateServiceInput): Promise<TouristService> {
    const rows = await db
      .insert(touristServices)
      .values({
        guideId,
        title:       input.title,
        type:        input.type,
        ...(input.description  !== undefined ? { description:     input.description  } : {}),
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.maxPeople    !== undefined ? { maxPeople:       input.maxPeople    } : {}),
        ...(input.price        !== undefined ? { price:           input.price        } : {}),
        ...(input.includes     !== undefined ? { includes:        input.includes     } : {}),
        ...(input.languages    !== undefined ? { languages:       input.languages    } : {}),
        ...(input.meetingPoint !== undefined ? { meetingPoint:    input.meetingPoint } : {}),
      })
      .returning();
    return rows[0]!;
  }

  async updateService(id: string, guideId: string, input: UpdateServiceInput): Promise<TouristService | null> {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title           !== undefined) values["title"]           = input.title;
    if (input.description     !== undefined) values["description"]     = input.description;
    if (input.type            !== undefined) values["type"]            = input.type;
    if (input.durationMinutes !== undefined) values["durationMinutes"] = input.durationMinutes;
    if (input.maxPeople       !== undefined) values["maxPeople"]       = input.maxPeople;
    if (input.price           !== undefined) values["price"]           = input.price;
    if (input.includes        !== undefined) values["includes"]        = input.includes;
    if (input.languages       !== undefined) values["languages"]       = input.languages;
    if (input.meetingPoint    !== undefined) values["meetingPoint"]    = input.meetingPoint;

    const rows = await db
      .update(touristServices)
      .set(values as Partial<TouristService>)
      .where(and(eq(touristServices.id, id), eq(touristServices.guideId, guideId)))
      .returning();
    return rows[0] ?? null;
  }

  async setServiceStatus(id: string, guideId: string, status: string): Promise<TouristService | null> {
    const rows = await db
      .update(touristServices)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(touristServices.id, id), eq(touristServices.guideId, guideId)))
      .returning();
    return rows[0] ?? null;
  }

  async createBooking(data: {
    serviceId: string;
    passengerId: string;
    guideId: string;
    bookingDate: string;
    bookingTime?: string;
    numberOfPeople: number;
    notes?: string;
    totalPrice: number | null;
  }): Promise<ServiceBooking> {
    const rows = await db
      .insert(serviceBookings)
      .values({
        serviceId:      data.serviceId,
        passengerId:    data.passengerId,
        guideId:        data.guideId,
        bookingDate:    data.bookingDate,
        numberOfPeople: data.numberOfPeople,
        totalPrice:     data.totalPrice,
        ...(data.bookingTime !== undefined ? { bookingTime: data.bookingTime } : {}),
        ...(data.notes       !== undefined ? { notes:       data.notes       } : {}),
      })
      .returning();
    return rows[0]!;
  }

  async findBookingsByPassenger(
    passengerId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ServiceBooking[]; total: number }> {
    const [totalRow, items] = await Promise.all([
      db.select({ total: count() }).from(serviceBookings).where(eq(serviceBookings.passengerId, passengerId)),
      db.select().from(serviceBookings).where(eq(serviceBookings.passengerId, passengerId))
        .orderBy(desc(serviceBookings.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
    ]);
    return { items, total: Number(totalRow[0]?.total ?? 0) };
  }

  async findBookingsByGuide(
    guideId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ServiceBooking[]; total: number }> {
    const [totalRow, items] = await Promise.all([
      db.select({ total: count() }).from(serviceBookings).where(eq(serviceBookings.guideId, guideId)),
      db.select().from(serviceBookings).where(eq(serviceBookings.guideId, guideId))
        .orderBy(desc(serviceBookings.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
    ]);
    return { items, total: Number(totalRow[0]?.total ?? 0) };
  }

  async findBookingById(id: string): Promise<ServiceBooking | null> {
    const rows = await db
      .select()
      .from(serviceBookings)
      .where(eq(serviceBookings.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async cancelBooking(id: string, reason: string | null): Promise<ServiceBooking | null> {
    const rows = await db
      .update(serviceBookings)
      .set({ status: "cancelled", ...(reason !== null ? { cancellationReason: reason } : {}), updatedAt: new Date() })
      .where(eq(serviceBookings.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async confirmBooking(id: string, guideId: string): Promise<ServiceBooking | null> {
    const rows = await db
      .update(serviceBookings)
      .set({ status: "confirmed", updatedAt: new Date() })
      .where(and(eq(serviceBookings.id, id), eq(serviceBookings.guideId, guideId)))
      .returning();
    return rows[0] ?? null;
  }

  async completeBooking(id: string, guideId: string): Promise<ServiceBooking | null> {
    const rows = await db
      .update(serviceBookings)
      .set({ status: "completed", updatedAt: new Date() })
      .where(and(eq(serviceBookings.id, id), eq(serviceBookings.guideId, guideId)))
      .returning();
    return rows[0] ?? null;
  }
}
