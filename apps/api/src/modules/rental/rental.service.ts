import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { RentalRepository } from "./rental.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type {
  RentalVehicleResponse, RentalBookingResponse,
  RentalVehicleResult, RentalVehiclesResult,
  RentalBookingResult, RentalBookingsResult,
} from "./rental.types.js";
import type { RentalVehicle, RentalBooking } from "../../db/schema/index.js";
import type { BookingWithVehicle, BookingWithPassenger } from "./rental.repository.js";
import type { CreateVehicleInput, UpdateVehicleInput, UpdateVehicleStatusInput, CreateRentalBookingInput, CancelRentalInput } from "./rental.schemas.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const repo           = new RentalRepository();

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload;
  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, code: err.code, message: err.message, statusCode: err.statusCode };
    }
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 };
  }

  const hash  = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);
  if (!valid) {
    return { ok: false, code: "AUTH_SESSION_REVOKED", message: "Session has been revoked.", statusCode: 401 };
  }

  const user = await usersRepo.findById(payload.sub);
  if (!user) {
    return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
  }

  return { ok: true, userId: user.id, role: user.role };
}

function toVehicleResponse(v: RentalVehicle, extra?: { operatorName?: string | null; operatorPhone?: string | null }): RentalVehicleResponse {
  const r: RentalVehicleResponse = {
    id:           v.id,
    operatorId:   v.operatorId,
    brand:        v.brand,
    model:        v.model,
    year:         v.year ?? null,
    plate:        v.plate,
    color:        v.color ?? null,
    type:         v.type,
    seats:        v.seats ?? null,
    transmission: v.transmission ?? null,
    fuelType:     v.fuelType ?? null,
    dailyPrice:   v.dailyPrice,
    description:  v.description ?? null,
    features:     v.features ?? null,
    photos:       v.photos ?? null,
    status:       v.status,
    createdAt:    v.createdAt.toISOString(),
    updatedAt:    v.updatedAt.toISOString(),
  };
  if (extra?.operatorName  !== undefined) r.operatorName  = extra.operatorName;
  if (extra?.operatorPhone !== undefined) r.operatorPhone = extra.operatorPhone;
  return r;
}

function toBookingResponse(b: RentalBooking, extra?: Partial<BookingWithVehicle & BookingWithPassenger>): RentalBookingResponse {
  const r: RentalBookingResponse = {
    id:                 b.id,
    vehicleId:          b.vehicleId,
    passengerId:        b.passengerId,
    operatorId:         b.operatorId,
    startDate:          b.startDate,
    endDate:            b.endDate,
    pickupTime:         b.pickupTime ?? null,
    returnTime:         b.returnTime ?? null,
    pickupLocation:     b.pickupLocation ?? null,
    returnLocation:     b.returnLocation ?? null,
    status:             b.status,
    totalPrice:         b.totalPrice ?? null,
    notes:              b.notes ?? null,
    cancellationReason: b.cancellationReason ?? null,
    createdAt:          b.createdAt.toISOString(),
    updatedAt:          b.updatedAt.toISOString(),
  };
  if (extra?.vehicleBrand  !== undefined) r.vehicleBrand  = extra.vehicleBrand;
  if (extra?.vehicleModel  !== undefined) r.vehicleModel  = extra.vehicleModel;
  if (extra?.vehiclePlate  !== undefined) r.vehiclePlate  = extra.vehiclePlate;
  if (extra?.vehicleType   !== undefined) r.vehicleType   = extra.vehicleType;
  if (extra?.passengerName !== undefined) r.passengerName = extra.passengerName;
  return r;
}

function calcDays(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end   = new Date(endDate).getTime();
  const days  = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

export class RentalService {
  async getMyVehicles(accessToken: string): Promise<RentalVehiclesResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "rental_operator") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only rental operators can access their vehicles.", statusCode: 403 };
    }

    const rows = await repo.findVehiclesByOperator(auth.userId);
    return { ok: true, items: rows.map((v) => toVehicleResponse(v)), total: rows.length, page: 1 };
  }

  async createVehicle(accessToken: string, input: CreateVehicleInput): Promise<RentalVehicleResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "rental_operator") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only rental operators can create vehicles.", statusCode: 403 };
    }

    const vehicle = await repo.createVehicle(auth.userId, input);
    return { ok: true, vehicle: toVehicleResponse(vehicle) };
  }

  async updateVehicle(accessToken: string, vehicleId: string, input: UpdateVehicleInput): Promise<RentalVehicleResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "rental_operator") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only rental operators can update vehicles.", statusCode: 403 };
    }

    const updated = await repo.updateVehicle(vehicleId, auth.userId, input);
    if (!updated) return { ok: false, code: "NOT_FOUND", message: "Vehicle not found or not yours.", statusCode: 404 };
    return { ok: true, vehicle: toVehicleResponse(updated) };
  }

  async updateVehicleStatus(accessToken: string, vehicleId: string, input: UpdateVehicleStatusInput): Promise<RentalVehicleResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "rental_operator") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only rental operators can change vehicle status.", statusCode: 403 };
    }

    const updated = await repo.updateVehicleStatus(vehicleId, auth.userId, input.status);
    if (!updated) return { ok: false, code: "NOT_FOUND", message: "Vehicle not found or not yours.", statusCode: 404 };
    return { ok: true, vehicle: toVehicleResponse(updated) };
  }

  async getMyOperatorBookings(accessToken: string, page: number, limit: number): Promise<RentalBookingsResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "rental_operator") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only rental operators can access their bookings.", statusCode: 403 };
    }

    const { items, total } = await repo.findBookingsByOperator(auth.userId, page, limit);
    return {
      ok: true,
      items: items.map((b) => toBookingResponse(b, b)),
      total,
      page,
    };
  }

  async confirmBooking(accessToken: string, bookingId: string): Promise<RentalBookingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "rental_operator") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only rental operators can confirm bookings.", statusCode: 403 };
    }

    const existing = await repo.findBookingById(bookingId);
    if (!existing) return { ok: false, code: "NOT_FOUND", message: "Booking not found.", statusCode: 404 };
    if (existing.operatorId !== auth.userId) {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only confirm your own bookings.", statusCode: 403 };
    }

    const updated = await repo.updateBookingStatus(bookingId, "confirmed", auth.userId);
    if (!updated) return { ok: false, code: "NOT_FOUND", message: "Booking not found.", statusCode: 404 };
    return { ok: true, booking: toBookingResponse(updated) };
  }

  async completeBooking(accessToken: string, bookingId: string): Promise<RentalBookingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "rental_operator") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only rental operators can complete bookings.", statusCode: 403 };
    }

    const existing = await repo.findBookingById(bookingId);
    if (!existing) return { ok: false, code: "NOT_FOUND", message: "Booking not found.", statusCode: 404 };
    if (existing.operatorId !== auth.userId) {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only complete your own bookings.", statusCode: 403 };
    }

    const updated = await repo.updateBookingStatus(bookingId, "completed", auth.userId);
    if (!updated) return { ok: false, code: "NOT_FOUND", message: "Booking not found.", statusCode: 404 };
    return { ok: true, booking: toBookingResponse(updated) };
  }

  async cancelOperatorBooking(accessToken: string, bookingId: string, input: CancelRentalInput): Promise<RentalBookingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "rental_operator") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only rental operators can cancel bookings.", statusCode: 403 };
    }

    const existing = await repo.findBookingById(bookingId);
    if (!existing) return { ok: false, code: "NOT_FOUND", message: "Booking not found.", statusCode: 404 };
    if (existing.operatorId !== auth.userId) {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only cancel your own bookings.", statusCode: 403 };
    }

    const updated = await repo.cancelBooking(bookingId, auth.userId, "rental_operator", input.reason ?? null);
    if (!updated) return { ok: false, code: "NOT_FOUND", message: "Booking not found.", statusCode: 404 };
    return { ok: true, booking: toBookingResponse(updated) };
  }

  async listAvailableVehicles(accessToken: string, filters: { type?: string; dateFrom?: string; dateTo?: string; page: number; limit: number }): Promise<RentalVehiclesResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const { items, total } = await repo.findAvailableVehicles(filters);
    return { ok: true, items: items.map((v) => toVehicleResponse(v)), total, page: filters.page };
  }

  async getVehicle(accessToken: string, vehicleId: string): Promise<RentalVehicleResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const v = await repo.findVehicleByIdWithOperator(vehicleId);
    if (!v) return { ok: false, code: "NOT_FOUND", message: "Vehicle not found.", statusCode: 404 };
    return { ok: true, vehicle: toVehicleResponse(v, { operatorName: v.operatorName, operatorPhone: v.operatorPhone }) };
  }

  async createRentalBooking(accessToken: string, input: CreateRentalBookingInput): Promise<RentalBookingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only passengers can create rental bookings.", statusCode: 403 };
    }

    if (input.startDate >= input.endDate) {
      return { ok: false, code: "INVALID_DATES", message: "End date must be after start date.", statusCode: 400 };
    }

    const today = new Date().toISOString().slice(0, 10);
    if (input.startDate < today) {
      return { ok: false, code: "PAST_DATE", message: "Start date must be today or in the future.", statusCode: 400 };
    }

    const vehicle = await repo.findVehicleById(input.vehicleId);
    if (!vehicle) return { ok: false, code: "NOT_FOUND", message: "Vehicle not found.", statusCode: 404 };
    if (vehicle.status !== "available") {
      return { ok: false, code: "VEHICLE_NOT_AVAILABLE", message: "This vehicle is not available.", statusCode: 409 };
    }

    const overlaps = await repo.checkDateOverlap(input.vehicleId, input.startDate, input.endDate);
    if (overlaps) {
      return { ok: false, code: "DATE_OVERLAP", message: "Vehicle is already booked for those dates.", statusCode: 409 };
    }

    const days       = calcDays(input.startDate, input.endDate);
    const totalPrice = vehicle.dailyPrice * days;

    const booking = await repo.createBooking({
      vehicleId:   input.vehicleId,
      passengerId: auth.userId,
      operatorId:  vehicle.operatorId,
      startDate:   input.startDate,
      endDate:     input.endDate,
      totalPrice,
      ...(input.pickupTime     !== undefined ? { pickupTime:     input.pickupTime     } : {}),
      ...(input.returnTime     !== undefined ? { returnTime:     input.returnTime     } : {}),
      ...(input.pickupLocation !== undefined ? { pickupLocation: input.pickupLocation } : {}),
      ...(input.returnLocation !== undefined ? { returnLocation: input.returnLocation } : {}),
      ...(input.notes          !== undefined ? { notes:          input.notes          } : {}),
    });
    return { ok: true, booking: toBookingResponse(booking) };
  }

  async getMyRentalBookings(accessToken: string, page: number, limit: number): Promise<RentalBookingsResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only passengers can access their rental bookings.", statusCode: 403 };
    }

    const { items, total } = await repo.findBookingsByPassenger(auth.userId, page, limit);
    return {
      ok: true,
      items: items.map((b) => toBookingResponse(b, b)),
      total,
      page,
    };
  }

  async cancelRentalBooking(accessToken: string, bookingId: string, input: CancelRentalInput): Promise<RentalBookingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const existing = await repo.findBookingById(bookingId);
    if (!existing) return { ok: false, code: "NOT_FOUND", message: "Booking not found.", statusCode: 404 };

    const isOwner = existing.passengerId === auth.userId;
    const isAdmin = auth.role === "admin";
    if (!isOwner && !isAdmin) {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only cancel your own bookings.", statusCode: 403 };
    }

    if (existing.status === "cancelled" || existing.status === "completed") {
      return { ok: false, code: "CANNOT_CANCEL", message: `Booking cannot be cancelled — status is '${existing.status}'.`, statusCode: 409 };
    }

    const cancelled = await repo.cancelBooking(bookingId, auth.userId, auth.role, input.reason ?? null);
    if (!cancelled) return { ok: false, code: "NOT_FOUND", message: "Booking not found.", statusCode: 404 };
    return { ok: true, booking: toBookingResponse(cancelled) };
  }
}
