import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { RidesRepository } from "../rides/rides.repository.js";
import { CashPaymentsRepository } from "./cashPayments.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { CloseCashPaymentInput } from "./cashPayments.schemas.js";
import type { CashPaymentClosure } from "../../db/schema/index.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepo = new UsersRepository();
const ridesRepo = new RidesRepository();
const cashRepo = new CashPaymentsRepository();

type Fail = { ok: false; code: string; message: string; statusCode: number };
type Auth = { ok: true; userId: string; role: string } | Fail;

async function authenticate(token: string): Promise<Auth> {
  let payload: { sub: string };
  try { payload = tokenService.verifyAccessToken(token); }
  catch (error) {
    if (error instanceof AppError) return { ok: false, code: error.code, message: error.message, statusCode: error.statusCode };
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 };
  }
  if (!await sessionService.isSessionValid(tokenService.hashToken(token))) return { ok: false, code: "AUTH_SESSION_REVOKED", message: "Session has been revoked.", statusCode: 401 };
  const user = await usersRepo.findById(payload.sub);
  if (!user) return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
  return { ok: true, userId: user.id, role: user.role };
}

function serialize(row: CashPaymentClosure) {
  return {
    id: row.id, rideRequestId: row.rideRequestId, passengerUserId: row.passengerUserId,
    driverUserId: row.driverUserId, fareClp: row.fareClp, paidClp: row.paidClp,
    overpaidClp: row.overpaidClp, decision: row.decision, status: row.status,
    resolutionType: row.resolutionType ?? null, resolutionReferenceId: row.resolutionReferenceId ?? null,
    driverNote: row.driverNote ?? null, closedAt: row.closedAt.toISOString(),
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

function paymentMethodOf(ride: { paymentMethod?: string | null; notes?: string | null }): string {
  const direct = String(ride.paymentMethod ?? "").toLowerCase();
  const notes = String(ride.notes ?? "").toLowerCase();
  return direct || (notes.includes("efectivo") || notes.includes("paymentmethod: cash") ? "cash" : "");
}

export class CashPaymentsService {
  async close(token: string, rideId: string, input: CloseCashPaymentInput) {
    const auth = await authenticate(token); if (!auth.ok) return auth;
    if (auth.role !== "driver") return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Only the assigned driver can close a cash payment.", statusCode: 403 };
    const ride = await ridesRepo.findById(rideId);
    if (!ride) return { ok: false as const, code: "NOT_FOUND", message: "Ride not found.", statusCode: 404 };
    if (ride.driverUserId !== auth.userId) return { ok: false as const, code: "AUTH_FORBIDDEN", message: "This ride is not assigned to this driver.", statusCode: 403 };
    if (ride.status !== "completed") return { ok: false as const, code: "CASH_RIDE_NOT_COMPLETED", message: "Complete the ride before closing its cash payment.", statusCode: 409 };
    if (paymentMethodOf(ride) !== "cash") return { ok: false as const, code: "CASH_PAYMENT_ONLY", message: "This endpoint is only for cash rides.", statusCode: 422 };
    const fareClp = Math.max(0, Math.round(Number(ride.estimatedFareClp ?? 0)));
    const paidClp = Math.round(input.paidClp);
    if (fareClp <= 0) return { ok: false as const, code: "CASH_INVALID_FARE", message: "The ride has no valid final fare.", statusCode: 422 };
    if (paidClp < fareClp) return { ok: false as const, code: "CASH_UNDERPAYMENT_NOT_ALLOWED", message: "The received amount cannot be lower than the ride fare.", statusCode: 422 };
    const overpaidClp = paidClp - fareClp;
    if ((input.decision === "exact" && overpaidClp !== 0) || (input.decision === "overpaid" && overpaidClp <= 0)) {
      return { ok: false as const, code: "CASH_DECISION_MISMATCH", message: "The cash decision does not match the received amount.", statusCode: 422 };
    }
    const existing = await cashRepo.findByRideId(rideId);
    if (existing) {
      if (existing.driverUserId !== auth.userId || existing.paidClp !== paidClp) return { ok: false as const, code: "CASH_CLOSURE_CONFLICT", message: "This ride already has a different cash closure.", statusCode: 409 };
      return { ok: true as const, closure: serialize(existing), alreadyExisted: true };
    }
    const created = await cashRepo.create({
      rideRequestId: ride.id, passengerUserId: ride.passengerUserId, driverUserId: auth.userId,
      fareClp, paidClp, overpaidClp, decision: input.decision,
      status: overpaidClp > 0 ? "overpayment_pending_choice" : "paid_exact",
      driverNote: input.note?.trim() || null, updatedAt: new Date(),
    });
    return { ok: true as const, closure: serialize(created), alreadyExisted: false };
  }

  async getByRide(token: string, rideId: string) {
    const auth = await authenticate(token); if (!auth.ok) return auth;
    const row = await cashRepo.findByRideId(rideId);
    if (!row) return { ok: false as const, code: "NOT_FOUND", message: "Cash closure not found.", statusCode: 404 };
    if (auth.role !== "admin" && row.passengerUserId !== auth.userId && row.driverUserId !== auth.userId) return { ok: false as const, code: "AUTH_FORBIDDEN", message: "You cannot view this cash closure.", statusCode: 403 };
    return { ok: true as const, closure: serialize(row) };
  }

  async listMine(token: string) {
    const auth = await authenticate(token); if (!auth.ok) return auth;
    const rows = await cashRepo.listByParticipant(auth.userId);
    return { ok: true as const, closures: rows.map(serialize) };
  }

  async listAdmin(token: string, status?: string) {
    const auth = await authenticate(token); if (!auth.ok) return auth;
    if (auth.role !== "admin") return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Admin only.", statusCode: 403 };
    const rows = await cashRepo.listForAdmin(status);
    return { ok: true as const, closures: rows.map(serialize) };
  }
}
