import { OAuth2Client } from "google-auth-library";
import { TokenService } from "./token.service.js";
import { SessionService } from "./session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { UsersService } from "../users/users.service.js";
import { AuditService } from "../audit/audit.service.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { AuthServiceResult, AuthUser } from "./auth.types.js";
import type { UserRole } from "@rapa-go/shared";

// Fix 4: singleton — JWKS cache persists across all requests
const googleOAuth2Client = new OAuth2Client();

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const usersService   = new UsersService();
const auditService   = new AuditService();

function isGoogleNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: string }).code ?? "";
  return (
    ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED"].includes(code) ||
    err.name === "FetchError"
  );
}

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

    // Fix 3: distinguish network errors (503) from invalid tokens (401)
    type GoogleClaims =
      | { ok: true;  email: string; name: string }
      | { ok: false; code: string;  message: string; statusCode?: number };

    const googleClaims: GoogleClaims = await (async (): Promise<GoogleClaims> => {
      try {
        // Fix 4: reuse module-level singleton; pass audience at verify time
        const ticket = await googleOAuth2Client.verifyIdToken({ idToken, audience: clientId });
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
      } catch (err) {
        // Fix 3: surface Google outages as 503 instead of misleading 401
        if (isGoogleNetworkError(err)) {
          return {
            ok:         false,
            code:       "AUTH_GOOGLE_UNREACHABLE",
            message:    "El servicio de autenticación de Google no está disponible. Intenta de nuevo.",
            statusCode: 503,
          };
        }
        return { ok: false, code: "AUTH_INVALID_GOOGLE_TOKEN", message: "El token de Google no es válido o ha expirado." };
      }
    })();

    if (!googleClaims.ok) {
      return { ok: false, code: googleClaims.code, message: googleClaims.message, statusCode: googleClaims.statusCode ?? 401 };
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
      // Fix 2: handle concurrent first-time logins for the same email
      try {
        user = await usersService.createUser({
          email,
          name,
          role:       "passenger",
          status:     "active",
          isVerified: true,   // Fix 1: Google already confirmed email_verified === true
        });
      } catch (createErr) {
        if (createErr instanceof AppError && createErr.code === "AUTH_EMAIL_TAKEN") {
          // Another concurrent request created the user between our findByEmail and createUser
          const concurrent = await usersRepo.findByEmail(email);
          if (!concurrent) {
            return { ok: false, code: "INTERNAL_ERROR", message: "Error interno. Intenta de nuevo.", statusCode: 500 };
          }
          if (concurrent.status === "suspended" || concurrent.status === "banned") {
            return { ok: false, code: "AUTH_ACCOUNT_SUSPENDED", message: "Tu cuenta está suspendida. Contacta al soporte.", statusCode: 403 };
          }
          user = concurrent;
        } else {
          throw createErr;
        }
      }
    }

    // TypeScript guard — both branches above guarantee a non-null user
    if (!user) {
      return { ok: false, code: "INTERNAL_ERROR", message: "Error interno. Intenta de nuevo.", statusCode: 500 };
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

    await Promise.all([
      sessionService.createSession({
        userId:          user.id,
        accessTokenHash: accessToken.hash,
        expiresAt:       accessToken.expiresAt,
      }),
      sessionService.createRefreshToken({
        userId:    user.id,
        tokenHash: refreshToken.hash,
        expiresAt: refreshToken.expiresAt,
      }),
    ]);

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
