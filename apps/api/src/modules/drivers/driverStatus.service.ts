import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { DriverStatusRepository } from "./driverStatus.repository.js";
import { AppError } from "../../shared/errors/AppError.js";

const tokenService     = new TokenService();
const sessionService   = new SessionService();
const usersRepo        = new UsersRepository();
const driverStatusRepo = new DriverStatusRepository();

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload;
  try { payload = tokenService.verifyAccessToken(accessToken); }
  catch (err) {
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

export class DriverStatusService {
  async getMyStatus(accessToken: string) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "driver") return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can access driver status.", statusCode: 403 };

    let status = await driverStatusRepo.findByDriverId(auth.userId);
    if (!status) {
      status = await driverStatusRepo.upsert(auth.userId, "unavailable");
    }
    return {
      ok: true,
      status: {
        availability:  status.availability,
        currentZone:   status.currentZone ?? null,
        lastSeenAt:    status.lastSeenAt?.toISOString() ?? null,
        currentRideId: status.currentRideId ?? null,
      },
    };
  }

  async updateMyStatus(accessToken: string, availability: string, currentZone?: string | null) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "driver") return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can update driver status.", statusCode: 403 };

    if (!["available", "unavailable"].includes(availability)) {
      return { ok: false, code: "VALIDATION_ERROR", message: "availability must be 'available' or 'unavailable'.", statusCode: 400 };
    }

    const VALID_ZONES = ["hanga_roa", "mataveri", "anakena", "rano_raraku", "tongariki", "rano_kau_orongo", "vaihu_sur", "interior", "desconocida"];
    if (currentZone !== undefined && currentZone !== null && !VALID_ZONES.includes(currentZone)) {
      return { ok: false, code: "VALIDATION_ERROR", message: "currentZone inválida.", statusCode: 400 };
    }

    if (availability === "available") {
      const current = await driverStatusRepo.findByDriverId(auth.userId);
      if (current?.currentRideId) {
        return { ok: false, code: "DRIVER_HAS_ACTIVE_RIDE", message: "Cannot set available while on an active ride.", statusCode: 409 };
      }
    }

    const updated = await driverStatusRepo.upsert(auth.userId, availability, currentZone);
    return {
      ok: true,
      status: {
        availability:  updated.availability,
        currentZone:   updated.currentZone ?? null,
        lastSeenAt:    updated.lastSeenAt?.toISOString() ?? null,
        currentRideId: updated.currentRideId ?? null,
      },
    };
  }
}
