import { OAuth2Client } from "google-auth-library";
import { TokenService } from "./token.service.js";
import { SessionService } from "./session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { UsersService } from "../users/users.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { AuthServiceResult, AuthUser } from "./auth.types.js";
import type { UserRole } from "@rapa-go/shared";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const usersService   = new UsersService();
const auditService   = new AuditService();

export class GoogleAuthService {
  async loginWithGoogle(idToken: string): Promise<AuthServiceResult> {
    const clientId = process.env["GOOGLE_CLIENT_ID"];
    if (!clientId) {
      return {
        ok:         false,
        code:       "AUTH_CONFIGURATION_ERROR",
        message:    "Google Login no está configurado. Contacta al administrador.",
        statusCode: 503,
      };
    }

    // Verify idToken and extract validated claims in one step.
    // All payload narrowing happens inside the IIFE where TypeScript can reason
    // about it cleanly — the outer scope only receives primitive string values.
    type GoogleClaims =
      | { ok: true;  email: string; name: string }
      | { ok: false; code: string;  message: string };

    const googleClaims: GoogleClaims = await (async (): Promise<GoogleClaims> => {
      try {
        const client = new OAuth2Client(clientId);
        const ticket = await client.verifyIdToken({ idToken, audience: clientId });
        const p = ticket.getPayload();

        // typeof narrowing required by exactOptionalPropertyTypes in tsconfig
        if (!p || typeof p.email !== "string" || p.email.length === 0) {
          return { ok: false, code: "AUTH_INVALID_GOOGLE_TOKEN", message: "No se pudo verificar el token de Google." };
        }
        if (p.email_verified !== true) {
          return { ok: false, code: "AUTH_EMAIL_NOT_VERIFIED", message: "El correo de Google no está verificado." };
        }

        const verifiedEmail = p.email.toLowerCase().trim();
        // noUncheckedIndexedAccess: split()[0] is string | undefined — use ?? as fallback
        const displayName = typeof p.name === "string" && p.name.length > 0
          ? p.name.trim()
          : (verifiedEmail.split("@")[0] ?? verifiedEmail);
        return {
          ok:    true,
          email: verifiedEmail,
          name:  displayName,
        };
      } catch {
        return { ok: false, code: "AUTH_INVALID_GOOGLE_TOKEN", message: "El token de Google no es válido o ha expirado." };
      }
    })();

    if (!googleClaims.ok) {
      return { ok: false, code: googleClaims.code, message: googleClaims.message, statusCode: 401 };
    }

    const { email, name } = googleClaims;

    let user = await usersRepo.findByEmail(email);
    const isNewUser = !user;

    if (user) {
      if (user.status === "suspended" || user.status === "banned") {
        return {
          ok:         false,
          code:       "AUTH_ACCOUNT_SUSPENDED",
          message:    "Tu cuenta está suspendida. Contacta al soporte.",
          statusCode: 403,
        };
      }
    } else {
      user = await usersService.createUser({
        email,
        name,
        role:   "passenger",
        status: "active",
      });
      // auth_credentials is intentionally not created — Google users have no local password
    }

    const authUser: AuthUser = {
      id:         user.id,
      email:      user.email,
      name:       user.name,
      role:       user.role as UserRole,
      avatarUrl:  user.avatarUrl,
      isVerified: user.isVerified,
    };

    const accessToken  = tokenService.issueAccessToken(authUser);
    const refreshToken = tokenService.issueRefreshToken();

    await sessionService.createSession({
      userId:          user.id,
      accessTokenHash: accessToken.hash,
      expiresAt:       accessToken.expiresAt,
    });

    await sessionService.createRefreshToken({
      userId:    user.id,
      tokenHash: refreshToken.hash,
      expiresAt: refreshToken.expiresAt,
    });

    auditService.recordSafe({
      eventType:   "auth.google.login.success",
      entityType:  "user",
      entityId:    user.id,
      actorUserId: user.id,
      metadata:    { role: user.role, isNewUser },
    });

    return {
      ok: true,
      session: {
        accessToken: accessToken.token,
        expiresAt:   accessToken.expiresAt.toISOString(),
        user:        authUser,
      },
    };
  }
}
