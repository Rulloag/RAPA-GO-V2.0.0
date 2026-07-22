import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { PassengerProfileRepository } from "./passengerProfile.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { UpsertPassengerProfileInput } from "./passengerProfile.schemas.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const profileRepo    = new PassengerProfileRepository();

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

function serializeProfile(profile: import("../../db/schema/index.js").PassengerProfile) {
  return {
    id:                    profile.id,
    userId:                profile.userId,
    phone:                 profile.phone                 ?? null,
    requestedFareType:     profile.requestedFareType,
    effectiveFareType:     profile.effectiveFareType,
    residenceVerificationStatus:
      profile.residenceVerificationStatus,
    residenceRequestedAt:
      profile.residenceRequestedAt?.toISOString() ?? null,
    residenceReviewedAt:
      profile.residenceReviewedAt?.toISOString() ?? null,
    residenceRejectionReason:
      profile.residenceRejectionReason ?? null,
    preferredLanguage:     profile.preferredLanguage,
    notificationEnabled:   profile.notificationEnabled,
    emailNotifications:    profile.emailNotifications,
    smsNotifications:      profile.smsNotifications,
    emergencyContactName:  profile.emergencyContactName  ?? null,
    emergencyContactPhone: profile.emergencyContactPhone ?? null,
    createdAt:             profile.createdAt.toISOString(),
    updatedAt:             profile.updatedAt.toISOString(),
  };
}

export class PassengerProfileService {
  async getProfile(accessToken: string) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "passenger") {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Only passengers can access passenger profile.", statusCode: 403 };
    }
    let profile = await profileRepo.findByUserId(auth.userId);
    if (!profile) {
      profile = await profileRepo.upsert(auth.userId, {});
    }
    return { ok: true as const, profile: serializeProfile(profile) };
  }

  async upsertProfile(accessToken: string, input: UpsertPassengerProfileInput) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "passenger") {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Only passengers can update passenger profile.", statusCode: 403 };
    }
    const profile = await profileRepo.upsert(auth.userId, input);
    return { ok: true as const, profile: serializeProfile(profile) };
  }

  async getPreferences(accessToken: string) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "passenger") {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Only passengers can access passenger preferences.", statusCode: 403 };
    }
    let profile = await profileRepo.findByUserId(auth.userId);
    if (!profile) {
      profile = await profileRepo.upsert(auth.userId, {});
    }
    return {
      ok: true as const,
      preferences: {
        preferredLanguage:   profile.preferredLanguage,
        notificationEnabled: profile.notificationEnabled,
        emailNotifications:  profile.emailNotifications,
        smsNotifications:    profile.smsNotifications,
      },
    };
  }
}
