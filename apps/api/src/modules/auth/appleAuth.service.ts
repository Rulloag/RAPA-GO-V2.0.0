import type { UserRole } from "@rapa-go/shared";
import { UsersRepository } from "../users/users.repository.js";
import { OAuthIdentitiesRepository } from "./oauthIdentities.repository.js";
import { TokenService } from "./token.service.js";
import { SessionService } from "./session.service.js";
import { AuditService } from "../audit/audit.service.js";
import { AppleIdentityTokenVerifier } from "./appleIdentityToken.verifier.js";
import { AppleTokenExchangeClient } from "./appleTokenExchange.client.js";
import { OAuthTokenCrypto } from "../../shared/security/oauthTokenCrypto.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { AppleAuthRequest, AppleAuthResult } from "./appleAuth.types.js";
import type { AuthUser } from "./auth.types.js";
import type { User } from "../../db/schema/index.js";

const PROVIDER = "apple";

function toUserRole(raw: string): UserRole {
  return raw as UserRole;
}

/** Mirrors AuthService's role→initial-status rule (kept local to avoid coupling). */
function roleInitialStatus(role: UserRole): "active" | "pending" {
  return role === "passenger" ? "active" : "pending";
}

function sanitizeNamePart(part: string | undefined): string {
  return (part ?? "").trim().slice(0, 50);
}

function buildName(name: AppleAuthRequest["name"], email: string): string {
  const given  = sanitizeNamePart(name?.givenName);
  const family = sanitizeNamePart(name?.familyName);
  const full = [given, family].filter(Boolean).join(" ").trim();
  if (full) return full;
  // Apple only sends the name on the very first authorization. If it's
  // absent (returning user, or user declined to share it), fall back to
  // the local part of the email so `users.name` (NOT NULL) is never empty.
  return email.split("@")[0] ?? "Apple User";
}

export class AppleAuthService {
  constructor(
    private readonly usersRepository = new UsersRepository(),
    private readonly identitiesRepository = new OAuthIdentitiesRepository(),
    private readonly auditService = new AuditService(),
    private readonly identityTokenVerifier = new AppleIdentityTokenVerifier(),
    private readonly tokenExchangeClient = new AppleTokenExchangeClient(),
    private readonly tokenService = new TokenService(),
    private readonly sessionService = new SessionService(),
  ) {}

  private async issueSession(user: User): Promise<{ authUser: AuthUser; accessToken: string; refreshToken: string; expiresAt: string }> {
    const authUser: AuthUser = {
      id:         user.id,
      email:      user.email,
      name:       user.name,
      role:       toUserRole(user.role),
      avatarUrl:  user.avatarUrl,
      isVerified: user.isVerified,
    };

    const accessToken  = this.tokenService.issueAccessToken(authUser);
    const refreshToken = this.tokenService.issueRefreshToken();

    await this.sessionService.createSession({
      userId:          user.id,
      accessTokenHash: accessToken.hash,
      expiresAt:       accessToken.expiresAt,
    });
    await this.sessionService.createRefreshToken({
      userId:    user.id,
      tokenHash: refreshToken.hash,
      expiresAt: refreshToken.expiresAt,
    });

    return {
      authUser,
      accessToken:  accessToken.token,
      refreshToken: refreshToken.token,
      expiresAt:    accessToken.expiresAt.toISOString(),
    };
  }

  async signIn(payload: AppleAuthRequest): Promise<AppleAuthResult> {
    // 1. Verify the identityToken presented by the client.
    const identityClaims = await this.identityTokenVerifier.verify(payload.identityToken, {
      ...(payload.nonce !== undefined ? { expectedNonce: payload.nonce } : {}),
    });

    // 2. Exchange the authorizationCode with Apple, using the exact client_id
    //    the identityToken was issued for.
    const exchange = await this.tokenExchangeClient.exchange(payload.authorizationCode, identityClaims.aud);

    // 3. The exchanged id_token must describe the same Apple account as the
    //    identityToken the client presented — never trust the two independently.
    const exchangedClaims = await this.identityTokenVerifier.verify(exchange.idToken, {});
    if (exchangedClaims.sub !== identityClaims.sub) {
      this.auditService.recordSafe({
        eventType:  "auth.apple.login.failure",
        entityType: "auth",
        metadata:   { reason: "token_incoherent" },
      });
      return {
        ok: false,
        code: "AUTH_APPLE_TOKEN_INCOHERENT",
        message: "Apple's token exchange response does not match the presented identity token.",
        statusCode: 401,
      };
    }

    // Refresh token is encrypted before it ever touches application memory
    // beyond this scope — never logged, never returned to the client.
    const encryptedRefreshToken = exchange.refreshToken !== undefined
      ? OAuthTokenCrypto.encrypt(exchange.refreshToken)
      : undefined;

    const existing = await this.identitiesRepository.findByProviderAndSub(PROVIDER, identityClaims.sub);
    if (existing) {
      return this.signInExisting(existing.userId, existing.id, encryptedRefreshToken);
    }

    return this.signInNew(payload, identityClaims, encryptedRefreshToken);
  }

  private async signInExisting(
    userId: string,
    identityId: string,
    encryptedRefreshToken: string | undefined,
  ): Promise<AppleAuthResult> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      return { ok: false, code: "UNAUTHORIZED", message: "User not found.", statusCode: 401 };
    }
    if (user.status === "suspended" || user.status === "banned") {
      this.auditService.recordSafe({
        eventType:   "auth.apple.login.failure",
        entityType:  "user",
        entityId:    user.id,
        actorUserId: user.id,
        metadata:    { reason: "account_suspended" },
      });
      return { ok: false, code: "AUTH_ACCOUNT_SUSPENDED", message: "Account is suspended.", statusCode: 403 };
    }

    if (encryptedRefreshToken !== undefined) {
      await this.identitiesRepository.updateEncryptedRefreshToken(identityId, encryptedRefreshToken);
    }

    const session = await this.issueSession(user);

    this.auditService.recordSafe({
      eventType:   "auth.apple.login.success",
      entityType:  "user",
      entityId:    user.id,
      actorUserId: user.id,
      metadata:    { role: user.role },
    });

    return {
      ok: true,
      session: {
        accessToken: session.accessToken,
        expiresAt:   session.expiresAt,
        user:        session.authUser,
      },
      refreshToken: session.refreshToken,
    };
  }

  private async signInNew(
    payload: AppleAuthRequest,
    identityClaims: Awaited<ReturnType<AppleIdentityTokenVerifier["verify"]>>,
    encryptedRefreshToken: string | undefined,
  ): Promise<AppleAuthResult> {
    const email = identityClaims.email?.toLowerCase().trim();
    if (!email) {
      return {
        ok: false,
        code: "AUTH_APPLE_EMAIL_MISSING",
        message: "Apple did not provide an email for this account.",
        statusCode: 400,
      };
    }

    // Never auto-link on email match — a matching email only means "someone
    // registered this address before", not "this is the same person". The
    // account owner must link explicitly, authenticated as themselves
    // (a later PR); here we only report the conflict.
    const emailOwner = await this.usersRepository.findByEmail(email);
    if (emailOwner) {
      this.auditService.recordSafe({
        eventType:  "auth.apple.login.conflict",
        entityType: "user",
        entityId:   emailOwner.id,
        metadata:   { reason: "email_taken" },
      });
      return {
        ok: false,
        code: "AUTH_APPLE_ACCOUNT_LINKING_REQUIRED",
        message: "An account with this email already exists. Sign in with your existing method to link Apple.",
        statusCode: 409,
      };
    }

    if (!payload.role) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "role is required to create a new account.",
        statusCode: 400,
      };
    }
    if (payload.role === "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin accounts cannot be registered publicly.", statusCode: 403 };
    }

    const name = buildName(payload.name, email);

    const created = await this.identitiesRepository.createUserWithIdentity({
      email,
      name,
      role:   payload.role,
      status: roleInitialStatus(payload.role),
      // Apple only asserts a verified email for accounts it controls
      // (including private-relay addresses) — safe to trust as verified.
      isVerified: identityClaims.emailVerified,
      provider:                PROVIDER,
      providerUserId:          identityClaims.sub,
      providerEmail:           email,
      providerEmailVerified:   identityClaims.emailVerified,
      providerIsPrivateEmail:  identityClaims.isPrivateEmail,
      encryptedRefreshToken,
    });

    if (!created) {
      // Unique(provider, provider_user_id) violation: a concurrent request
      // for the exact same Apple account won the race and created it first.
      const identity = await this.identitiesRepository.findByProviderAndSub(PROVIDER, identityClaims.sub);
      if (!identity) {
        throw AppError.internal("OAuth identity creation race could not be resolved.");
      }
      return this.signInExisting(identity.userId, identity.id, encryptedRefreshToken);
    }

    const session = await this.issueSession(created.user);

    this.auditService.recordSafe({
      eventType:   "auth.apple.register.success",
      entityType:  "user",
      entityId:    created.user.id,
      actorUserId: created.user.id,
      metadata:    { role: created.user.role, isPrivateEmail: identityClaims.isPrivateEmail },
    });

    return {
      ok: true,
      session: {
        accessToken: session.accessToken,
        expiresAt:   session.expiresAt,
        user:        session.authUser,
      },
      refreshToken: session.refreshToken,
    };
  }
}
