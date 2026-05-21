import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { OfflineRepository } from "./offline.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { CreateOfflineBookingInput, SyncOfflineBookingInput, ListOfflineBookingsQuery, ConnectivityCheckInput } from "./offline.schemas.js";
import type { OfflineBooking, SyncQueueItem, ConnectivityLog } from "../../db/schema/index.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const offlineRepo    = new OfflineRepository();

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload;
  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (err) {
    if (err instanceof AppError) return { ok: false, code: err.code, message: err.message, statusCode: err.statusCode };
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 };
  }

  const hash  = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);
  if (!valid) return { ok: false, code: "AUTH_SESSION_REVOKED", message: "Session has been revoked.", statusCode: 401 };

  const user = await usersRepo.findById(payload.sub);
  if (!user) return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };

  return { ok: true, userId: user.id, role: user.role };
}

type BookingResult =
  | { ok: true; booking: OfflineBooking }
  | { ok: false; code: string; message: string; statusCode: number };

type BookingsResult =
  | { ok: true; items: OfflineBooking[] }
  | { ok: false; code: string; message: string; statusCode: number };

type ConnectivityResult =
  | { ok: true; log: ConnectivityLog }
  | { ok: false; code: string; message: string; statusCode: number };

type SyncQueueResult =
  | { ok: true; items: SyncQueueItem[] }
  | { ok: false; code: string; message: string; statusCode: number };

export class OfflineService {
  async createOfflineBooking(accessToken: string, input: CreateOfflineBookingInput): Promise<BookingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only admins can create offline bookings.", statusCode: 403 };
    }

    const booking = await offlineRepo.createOfflineBooking({
      adminId:          auth.userId,
      passengerName:    input.passengerName,
      passengerPhone:   input.passengerPhone,
      originText:       input.originText,
      destinationText:  input.destinationText,
      assignedDriverId: input.assignedDriverId ?? null,
      notes:            input.notes ?? null,
      status:           "pending_sync",
    });

    return { ok: true, booking };
  }

  async listOfflineBookings(accessToken: string, query: ListOfflineBookingsQuery): Promise<BookingsResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only admins can view offline bookings.", statusCode: 403 };
    }

    const items = await offlineRepo.listOfflineBookings(query.status);
    return { ok: true, items };
  }

  async syncOfflineBooking(accessToken: string, id: string, input: SyncOfflineBookingInput): Promise<BookingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only admins can sync offline bookings.", statusCode: 403 };
    }

    const existing = await offlineRepo.findOfflineBookingById(id);
    if (!existing) {
      return { ok: false, code: "NOT_FOUND", message: "Offline booking not found.", statusCode: 404 };
    }
    if (existing.status !== "pending_sync") {
      return { ok: false, code: "BOOKING_NOT_PENDING", message: `Booking is already ${existing.status}.`, statusCode: 409 };
    }

    const updated = await offlineRepo.syncOfflineBooking(id, input.rideRequestId);
    if (!updated) {
      return { ok: false, code: "NOT_FOUND", message: "Offline booking not found or already processed.", statusCode: 404 };
    }

    return { ok: true, booking: updated };
  }

  async cancelOfflineBooking(accessToken: string, id: string): Promise<BookingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only admins can cancel offline bookings.", statusCode: 403 };
    }

    const existing = await offlineRepo.findOfflineBookingById(id);
    if (!existing) {
      return { ok: false, code: "NOT_FOUND", message: "Offline booking not found.", statusCode: 404 };
    }

    const updated = await offlineRepo.cancelOfflineBooking(id);
    if (!updated) {
      return { ok: false, code: "BOOKING_NOT_PENDING", message: `Booking cannot be cancelled — status is '${existing.status}'.`, statusCode: 409 };
    }

    return { ok: true, booking: updated };
  }

  async logConnectivity(accessToken: string, input: ConnectivityCheckInput): Promise<ConnectivityResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const log = await offlineRepo.logConnectivity(auth.userId, auth.role, input.hadConnectivity, input.locationZone);
    return { ok: true, log };
  }

  async getSyncQueue(accessToken: string): Promise<SyncQueueResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const items = await offlineRepo.getSyncQueue(auth.userId);
    return { ok: true, items };
  }

  async confirmSyncItem(accessToken: string, id: string): Promise<{ ok: true; item: SyncQueueItem } | { ok: false; code: string; message: string; statusCode: number }> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const item = await offlineRepo.confirmSyncItem(id, auth.userId);
    if (!item) {
      return { ok: false, code: "NOT_FOUND", message: "Sync item not found.", statusCode: 404 };
    }

    return { ok: true, item };
  }
}
