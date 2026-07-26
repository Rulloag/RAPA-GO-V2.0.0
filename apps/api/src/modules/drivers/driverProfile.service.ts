import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { DriverProfileRepository } from "./driverProfile.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { UpsertDriverProfileInput } from "./driverProfile.schemas.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const profileRepo    = new DriverProfileRepository();

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

function serializeProfile(profile: import("../../db/schema/index.js").DriverProfile | null) {
  if (!profile) return null;
  return {
    id:              profile.id,
    userId:          profile.userId,
    phone:           profile.phone           ?? null,
    vehicleBrand:    profile.vehicleBrand    ?? null,
    vehicleModel:    profile.vehicleModel    ?? null,
    vehicleYear:     profile.vehicleYear     ?? null,
    vehiclePlate:    profile.vehiclePlate    ?? null,
    vehicleColor:    profile.vehicleColor    ?? null,
    licenseNumber:   profile.licenseNumber   ?? null,
    licenseExpiry:   profile.licenseExpiry   ?? null,
    profilePhotoUrl: profile.profilePhotoUrl ?? null,
    vehiclePhotoUrl: profile.vehiclePhotoUrl ?? null,
    bio:             profile.bio             ?? null,
    languages:       profile.languages       ?? [],
    createdAt:       profile.createdAt.toISOString(),
    updatedAt:       profile.updatedAt.toISOString(),
  };
}

export class DriverProfileService {
  async getProfile(accessToken: string) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "driver") {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Only drivers can access driver profile.", statusCode: 403 };
    }
    const profile = await profileRepo.findByUserId(auth.userId);
    return { ok: true as const, profile: serializeProfile(profile) };
  }

  async upsertProfile(accessToken: string, input: UpsertDriverProfileInput) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "driver") {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Only drivers can update driver profile.", statusCode: 403 };
    }
    const profile = await profileRepo.upsert(auth.userId, input);
    return { ok: true as const, profile: serializeProfile(profile) };
  }

  async getPublicProfile(driverUserId: string) {
    const user = await usersRepo.findById(driverUserId);
    if (!user) return { ok: false as const, code: "NOT_FOUND", message: "Driver not found.", statusCode: 404 };
    const profile = await profileRepo.findByUserId(driverUserId);
    const serialized = serializeProfile(profile);
    // Omit licenseNumber for public/admin view
    if (serialized) {
      const { licenseNumber: _ln, ...publicProfile } = serialized;
      return { ok: true as const, profile: publicProfile };
    }
    return { ok: true as const, profile: null };
  }
}
