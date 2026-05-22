import { and, desc, eq, inArray, not, or, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { rentalVehicles, rentalBookings, users, driverProfiles } from "../../db/schema/index.js";
import type { RentalVehicle, RentalBooking } from "../../db/schema/index.js";
import type { CreateVehicleInput, UpdateVehicleInput } from "./rental.schemas.js";

export interface BookingWithVehicle extends RentalBooking {
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleType:  string;
}

export interface BookingWithPassenger extends RentalBooking {
  passengerName: string | null;
  vehicleBrand:  string;
  vehicleModel:  string;
  vehiclePlate:  string;
  vehicleType:   string;
}

export interface VehicleWithOperator extends RentalVehicle {
  operatorName:  string | null;
  operatorPhone: string | null;
}

export class RentalRepository {
  async findVehiclesByOperator(operatorId: string): Promise<RentalVehicle[]> {
    return db
      .select()
      .from(rentalVehicles)
      .where(eq(rentalVehicles.operatorId, operatorId))
      .orderBy(desc(rentalVehicles.createdAt));
  }

  async findVehicleById(id: string): Promise<RentalVehicle | null> {
    const rows = await db.select().from(rentalVehicles).where(eq(rentalVehicles.id, id));
    return rows[0] ?? null;
  }

  async findVehicleByIdWithOperator(id: string): Promise<VehicleWithOperator | null> {
    const rows = await db
      .select({
        id:           rentalVehicles.id,
        operatorId:   rentalVehicles.operatorId,
        brand:        rentalVehicles.brand,
        model:        rentalVehicles.model,
        year:         rentalVehicles.year,
        plate:        rentalVehicles.plate,
        color:        rentalVehicles.color,
        type:         rentalVehicles.type,
        seats:        rentalVehicles.seats,
        transmission: rentalVehicles.transmission,
        fuelType:     rentalVehicles.fuelType,
        dailyPrice:   rentalVehicles.dailyPrice,
        description:  rentalVehicles.description,
        features:     rentalVehicles.features,
        photos:       rentalVehicles.photos,
        status:       rentalVehicles.status,
        createdAt:    rentalVehicles.createdAt,
        updatedAt:    rentalVehicles.updatedAt,
        operatorName:  users.name,
        operatorPhone: driverProfiles.phone,
      })
      .from(rentalVehicles)
      .leftJoin(users, eq(users.id, rentalVehicles.operatorId))
      .leftJoin(driverProfiles, eq(driverProfiles.userId, rentalVehicles.operatorId))
      .where(eq(rentalVehicles.id, id));

    const r = rows[0];
    if (!r) return null;
    return {
      ...r,
      operatorName:  r.operatorName ?? null,
      operatorPhone: r.operatorPhone ?? null,
    };
  }

  async findAvailableVehicles(filters: {
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    limit: number;
  }): Promise<{ items: RentalVehicle[]; total: number }> {
    let excludeIds: string[] = [];

    if (filters.dateFrom && filters.dateTo) {
      const overlapping = await db
        .select({ vehicleId: rentalBookings.vehicleId })
        .from(rentalBookings)
        .where(
          and(
            inArray(rentalBookings.status, ["confirmed", "active"]),
            not(
              or(
                sql`${rentalBookings.endDate} < ${filters.dateFrom}`,
                sql`${rentalBookings.startDate} > ${filters.dateTo}`,
              )!,
            )!,
          ),
        );
      excludeIds = overlapping.map((r) => r.vehicleId);
    }

    const conditions = [eq(rentalVehicles.status, "available")];
    if (filters.type) conditions.push(eq(rentalVehicles.type, filters.type));
    if (excludeIds.length > 0) conditions.push(not(inArray(rentalVehicles.id, excludeIds))!);

    const rows = await db
      .select()
      .from(rentalVehicles)
      .where(and(...conditions))
      .orderBy(desc(rentalVehicles.createdAt));

    const total = rows.length;
    const offset = (filters.page - 1) * filters.limit;
    return { items: rows.slice(offset, offset + filters.limit), total };
  }

  async createVehicle(operatorId: string, input: CreateVehicleInput): Promise<RentalVehicle> {
    const now = new Date();
    const base = {
      operatorId,
      brand:      input.brand,
      model:      input.model,
      plate:      input.plate,
      type:       input.type,
      dailyPrice: input.dailyPrice,
      createdAt:  now,
      updatedAt:  now,
    };
    const rows = await db
      .insert(rentalVehicles)
      .values({
        ...base,
        ...(input.year        !== undefined ? { year:        input.year        } : {}),
        ...(input.color       !== undefined ? { color:       input.color       } : {}),
        ...(input.seats       !== undefined ? { seats:       input.seats       } : {}),
        ...(input.transmission !== undefined ? { transmission: input.transmission } : {}),
        ...(input.fuelType    !== undefined ? { fuelType:    input.fuelType    } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.features    !== undefined ? { features:    input.features    } : {}),
        ...(input.photos      !== undefined ? { photos:      input.photos      } : {}),
      })
      .returning();
    return rows[0]!;
  }

  async updateVehicle(id: string, operatorId: string, input: UpdateVehicleInput): Promise<RentalVehicle | null> {
    const patch: Partial<typeof rentalVehicles.$inferInsert> = { updatedAt: new Date() };
    if (input.brand        !== undefined) patch.brand        = input.brand;
    if (input.model        !== undefined) patch.model        = input.model;
    if (input.year         !== undefined) patch.year         = input.year;
    if (input.plate        !== undefined) patch.plate        = input.plate;
    if (input.color        !== undefined) patch.color        = input.color;
    if (input.type         !== undefined) patch.type         = input.type;
    if (input.seats        !== undefined) patch.seats        = input.seats;
    if (input.transmission !== undefined) patch.transmission = input.transmission;
    if (input.fuelType     !== undefined) patch.fuelType     = input.fuelType;
    if (input.dailyPrice   !== undefined) patch.dailyPrice   = input.dailyPrice;
    if (input.description  !== undefined) patch.description  = input.description;
    if (input.features     !== undefined) patch.features     = input.features;
    if (input.photos       !== undefined) patch.photos       = input.photos;

    const rows = await db
      .update(rentalVehicles)
      .set(patch)
      .where(and(eq(rentalVehicles.id, id), eq(rentalVehicles.operatorId, operatorId)))
      .returning();
    return rows[0] ?? null;
  }

  async updateVehicleStatus(id: string, operatorId: string, status: string): Promise<RentalVehicle | null> {
    const rows = await db
      .update(rentalVehicles)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(rentalVehicles.id, id), eq(rentalVehicles.operatorId, operatorId)))
      .returning();
    return rows[0] ?? null;
  }

  async findBookingsByOperator(operatorId: string, page: number, limit: number): Promise<{ items: BookingWithPassenger[]; total: number }> {
    const rows = await db
      .select({
        id:                 rentalBookings.id,
        vehicleId:          rentalBookings.vehicleId,
        passengerId:        rentalBookings.passengerId,
        operatorId:         rentalBookings.operatorId,
        startDate:          rentalBookings.startDate,
        endDate:            rentalBookings.endDate,
        pickupTime:         rentalBookings.pickupTime,
        returnTime:         rentalBookings.returnTime,
        pickupLocation:     rentalBookings.pickupLocation,
        returnLocation:     rentalBookings.returnLocation,
        status:             rentalBookings.status,
        totalPrice:         rentalBookings.totalPrice,
        notes:              rentalBookings.notes,
        cancellationReason: rentalBookings.cancellationReason,
        createdAt:          rentalBookings.createdAt,
        updatedAt:          rentalBookings.updatedAt,
        passengerName:      users.name,
        vehicleBrand:       rentalVehicles.brand,
        vehicleModel:       rentalVehicles.model,
        vehiclePlate:       rentalVehicles.plate,
        vehicleType:        rentalVehicles.type,
      })
      .from(rentalBookings)
      .leftJoin(users, eq(users.id, rentalBookings.passengerId))
      .leftJoin(rentalVehicles, eq(rentalVehicles.id, rentalBookings.vehicleId))
      .where(eq(rentalBookings.operatorId, operatorId))
      .orderBy(desc(rentalBookings.createdAt));

    const total = rows.length;
    const offset = (page - 1) * limit;
    const slice = rows.slice(offset, offset + limit);

    return {
      items: slice.map((r) => ({
        id:                 r.id,
        vehicleId:          r.vehicleId,
        passengerId:        r.passengerId,
        operatorId:         r.operatorId,
        startDate:          r.startDate,
        endDate:            r.endDate,
        pickupTime:         r.pickupTime ?? null,
        returnTime:         r.returnTime ?? null,
        pickupLocation:     r.pickupLocation ?? null,
        returnLocation:     r.returnLocation ?? null,
        status:             r.status,
        totalPrice:         r.totalPrice ?? null,
        notes:              r.notes ?? null,
        cancellationReason: r.cancellationReason ?? null,
        createdAt:          r.createdAt,
        updatedAt:          r.updatedAt,
        passengerName:      r.passengerName ?? null,
        vehicleBrand:       r.vehicleBrand ?? "",
        vehicleModel:       r.vehicleModel ?? "",
        vehiclePlate:       r.vehiclePlate ?? "",
        vehicleType:        r.vehicleType ?? "",
      })),
      total,
    };
  }

  async findBookingsByPassenger(passengerId: string, page: number, limit: number): Promise<{ items: BookingWithVehicle[]; total: number }> {
    const rows = await db
      .select({
        id:                 rentalBookings.id,
        vehicleId:          rentalBookings.vehicleId,
        passengerId:        rentalBookings.passengerId,
        operatorId:         rentalBookings.operatorId,
        startDate:          rentalBookings.startDate,
        endDate:            rentalBookings.endDate,
        pickupTime:         rentalBookings.pickupTime,
        returnTime:         rentalBookings.returnTime,
        pickupLocation:     rentalBookings.pickupLocation,
        returnLocation:     rentalBookings.returnLocation,
        status:             rentalBookings.status,
        totalPrice:         rentalBookings.totalPrice,
        notes:              rentalBookings.notes,
        cancellationReason: rentalBookings.cancellationReason,
        createdAt:          rentalBookings.createdAt,
        updatedAt:          rentalBookings.updatedAt,
        vehicleBrand:       rentalVehicles.brand,
        vehicleModel:       rentalVehicles.model,
        vehiclePlate:       rentalVehicles.plate,
        vehicleType:        rentalVehicles.type,
      })
      .from(rentalBookings)
      .leftJoin(rentalVehicles, eq(rentalVehicles.id, rentalBookings.vehicleId))
      .where(eq(rentalBookings.passengerId, passengerId))
      .orderBy(desc(rentalBookings.createdAt));

    const total = rows.length;
    const offset = (page - 1) * limit;
    const slice = rows.slice(offset, offset + limit);

    return {
      items: slice.map((r) => ({
        id:                 r.id,
        vehicleId:          r.vehicleId,
        passengerId:        r.passengerId,
        operatorId:         r.operatorId,
        startDate:          r.startDate,
        endDate:            r.endDate,
        pickupTime:         r.pickupTime ?? null,
        returnTime:         r.returnTime ?? null,
        pickupLocation:     r.pickupLocation ?? null,
        returnLocation:     r.returnLocation ?? null,
        status:             r.status,
        totalPrice:         r.totalPrice ?? null,
        notes:              r.notes ?? null,
        cancellationReason: r.cancellationReason ?? null,
        createdAt:          r.createdAt,
        updatedAt:          r.updatedAt,
        vehicleBrand:       r.vehicleBrand ?? "",
        vehicleModel:       r.vehicleModel ?? "",
        vehiclePlate:       r.vehiclePlate ?? "",
        vehicleType:        r.vehicleType ?? "",
      })),
      total,
    };
  }

  async findBookingById(id: string): Promise<RentalBooking | null> {
    const rows = await db.select().from(rentalBookings).where(eq(rentalBookings.id, id));
    return rows[0] ?? null;
  }

  async createBooking(data: {
    vehicleId: string; passengerId: string; operatorId: string;
    startDate: string; endDate: string; totalPrice: number | null;
    pickupTime?: string; returnTime?: string;
    pickupLocation?: string; returnLocation?: string; notes?: string;
  }): Promise<RentalBooking> {
    const now = new Date();
    const rows = await db
      .insert(rentalBookings)
      .values({
        vehicleId:   data.vehicleId,
        passengerId: data.passengerId,
        operatorId:  data.operatorId,
        startDate:   data.startDate,
        endDate:     data.endDate,
        createdAt:   now,
        updatedAt:   now,
        ...(data.totalPrice     !== null && data.totalPrice !== undefined ? { totalPrice: data.totalPrice } : {}),
        ...(data.pickupTime     !== undefined ? { pickupTime:     data.pickupTime     } : {}),
        ...(data.returnTime     !== undefined ? { returnTime:     data.returnTime     } : {}),
        ...(data.pickupLocation !== undefined ? { pickupLocation: data.pickupLocation } : {}),
        ...(data.returnLocation !== undefined ? { returnLocation: data.returnLocation } : {}),
        ...(data.notes          !== undefined ? { notes:          data.notes          } : {}),
      })
      .returning();
    return rows[0]!;
  }

  async updateBookingStatus(id: string, status: string, operatorId?: string): Promise<RentalBooking | null> {
    const condition = operatorId
      ? and(eq(rentalBookings.id, id), eq(rentalBookings.operatorId, operatorId))
      : eq(rentalBookings.id, id);

    const rows = await db
      .update(rentalBookings)
      .set({ status, updatedAt: new Date() })
      .where(condition)
      .returning();
    return rows[0] ?? null;
  }

  async cancelBooking(id: string, userId: string, role: string, reason: string | null): Promise<RentalBooking | null> {
    const condition = role === "admin"
      ? eq(rentalBookings.id, id)
      : and(eq(rentalBookings.id, id), eq(rentalBookings.passengerId, userId));

    const patch: Partial<typeof rentalBookings.$inferInsert> = {
      status:    "cancelled",
      updatedAt: new Date(),
    };
    if (reason !== null) patch.cancellationReason = reason;

    const rows = await db
      .update(rentalBookings)
      .set(patch)
      .where(condition)
      .returning();
    return rows[0] ?? null;
  }

  async checkDateOverlap(vehicleId: string, startDate: string, endDate: string, excludeBookingId?: string): Promise<boolean> {
    const conditions = [
      eq(rentalBookings.vehicleId, vehicleId),
      inArray(rentalBookings.status, ["confirmed", "active"]),
      not(
        or(
          sql`${rentalBookings.endDate} < ${startDate}`,
          sql`${rentalBookings.startDate} > ${endDate}`,
        )!,
      )!,
    ];
    if (excludeBookingId) conditions.push(not(eq(rentalBookings.id, excludeBookingId))!);

    const rows = await db
      .select({ id: rentalBookings.id })
      .from(rentalBookings)
      .where(and(...conditions));

    return rows.length > 0;
  }
}
