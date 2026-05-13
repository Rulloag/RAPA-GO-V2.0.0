import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { ProfileServiceResult } from "./profile.types.js";
import type { UpdateProfileInput } from "../users/users.types.js";

const tokenService    = new TokenService();
const sessionService  = new SessionService();
const usersRepository = new UsersRepository();

function toIso(d: Date): string {
  return d.toISOString();
}

export class ProfileService {
  /** Authenticate via Bearer token and return the user's profile. */
  async getProfile(accessToken: string): Promise<ProfileServiceResult> {
    let payload;
    try {
      payload = tokenService.verifyAccessToken(accessToken);
    } catch (err) {
      if (err instanceof AppError) {
        return { ok: false, code: err.code, message: err.message, statusCode: err.statusCode };
      }
      return { ok: false, code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 };
    }

    const hash = tokenService.hashToken(accessToken);
    const valid = await sessionService.isSessionValid(hash);
    if (!valid) {
      return { ok: false, code: "AUTH_SESSION_REVOKED", message: "Session has been revoked.", statusCode: 401 };
    }

    const user = await usersRepository.findById(payload.sub);
    if (!user) {
      return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
    }

    return {
      ok: true,
      profile: {
        id:         user.id,
        email:      user.email,
        name:       user.name,
        role:       user.role,
        status:     user.status,
        avatarUrl:  user.avatarUrl,
        isVerified: user.isVerified,
        createdAt:  toIso(user.createdAt),
      },
    };
  }

  /** Authenticate and update allowed profile fields. */
  async updateProfile(
    accessToken: string,
    input: UpdateProfileInput,
  ): Promise<ProfileServiceResult> {
    let payload;
    try {
      payload = tokenService.verifyAccessToken(accessToken);
    } catch (err) {
      if (err instanceof AppError) {
        return { ok: false, code: err.code, message: err.message, statusCode: err.statusCode };
      }
      return { ok: false, code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 };
    }

    const hash = tokenService.hashToken(accessToken);
    const valid = await sessionService.isSessionValid(hash);
    if (!valid) {
      return { ok: false, code: "AUTH_SESSION_REVOKED", message: "Session has been revoked.", statusCode: 401 };
    }

    const updated = await usersRepository.updateProfile(payload.sub, input);

    return {
      ok: true,
      profile: {
        id:         updated.id,
        email:      updated.email,
        name:       updated.name,
        role:       updated.role,
        status:     updated.status,
        avatarUrl:  updated.avatarUrl,
        isVerified: updated.isVerified,
        createdAt:  toIso(updated.createdAt),
      },
    };
  }
}
