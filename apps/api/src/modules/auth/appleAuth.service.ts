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
  // Sanitized through the same trim+length-cap as the given/family-name
  // path — the local part is attacker-influenced input (email addresses
  // aren't restricted to friendly-looking text) and must be bounded the
  // same way before it's ever stored.
  const localPart = sanitizeNamePart(email.split("@")[0]);
  return localPart || "Apple User";
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
    // 1. Verify the identityToken presented by the client. This alone is
    //    enough to know the Apple sub and (usually) email — no need to
    //    touch Apple's token endpoint yet.
    const identityClaims = await this.identityTokenVerifier.verify(payload.identityToken, {
      ...(payload.nonce !== undefined ? { expectedNonce: payload.nonce } : {}),
    });

    const existing = await this.identitiesRepository.findByProviderAndSub(PROVIDER, identityClaims.sub);
    if (existing) {
      return this.signInExisting(payload, identityClaims, existing.userId, existing.id);
    }

    // New-account preconditions (email present, not already taken, role
    // supplied and not admin) are checked BEFORE exchanging authorizationCode.
    // Apple authorization codes are single-use: if we consumed it here and
    // then found role was missing, the client's natural retry (same code,
    // now with role attached) would fail at Apple with invalid_grant,
    // permanently breaking the "pick a role and retry" flow. Deferring the
    // exchange until we know this attempt can actually complete keeps that
    // retry — and the authorizationCode — valid.
    const precondition = this.checkNewAccountPreconditions(payload, identityClaims);
    if (precondition) return precondition;

    return this.exchangeAndCompleteNewAccount(payload, identityClaims);
  }

  /**
   * Validates everything about a new-account request that doesn't require
   * calling Apple's token endpoint. Returns an error result if any check
   * fails, or `null` if the request may proceed to the (code-consuming)
   * exchange step.
   */
  private checkNewAccountPreconditions(
    payload: AppleAuthRequest,
    identityClaims: Awaited<ReturnType<AppleIdentityTokenVerifier["verify"]>>,
  ): AppleAuthResult | null {
    const email = identityClaims.email?.toLowerCase().trim();
    if (!email) {
      return {
        ok: false,
        code: "AUTH_APPLE_EMAIL_MISSING",
        message: "Apple did not provide an email for this account.",
        statusCode: 400,
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

    return null;
  }

  private async exchangeIdentity(
    payload: AppleAuthRequest,
    identityClaims: Awaited<ReturnType<AppleIdentityTokenVerifier["verify"]>>,
  ): Promise<{ ok: true; encryptedRefreshToken: string | undefined } | { ok: false; result: AppleAuthResult }> {
    // Exchange the authorizationCode with Apple, using the exact client_id
    // the identityToken was issued for.
    const exchange = await this.tokenExchangeClient.exchange(payload.authorizationCode, identityClaims.aud);

    // The exchanged id_token must describe the same Apple account as the
    // identityToken the client presented — never trust the two independently.
    const exchangedClaims = await this.identityTokenVerifier.verify(exchange.idToken, {});
    if (exchangedClaims.sub !== identityClaims.sub) {
      this.auditService.recordSafe({
        eventType:  "auth.apple.login.failure",
        entityType: "auth",
        metadata:   { reason: "token_incoherent" },
      });
      return {
        ok: false,
        result: {
          ok: false,
          code: "AUTH_APPLE_TOKEN_INCOHERENT",
          message: "Apple's token exchange response does not match the presented identity token.",
          statusCode: 401,
        },
      };
    }

    // Refresh token is encrypted before it ever touches application memory
    // beyond this scope — never logged, never returned to the client.
    const encryptedRefreshToken = exchange.refreshToken !== undefined
      ? OAuthTokenCrypto.encrypt(exchange.refreshToken)
      : undefined;

    return { ok: true, encryptedRefreshToken };
  }

  private async signInExisting(
    payload: AppleAuthRequest,
    identityClaims: Awaited<ReturnType<AppleIdentityTokenVerifier["verify"]>>,
    userId: string,
    identityId: string,
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

    const exchanged = await this.exchangeIdentity(payload, identityClaims);
    if (!exchanged.ok) return exchanged.result;

    return this.completeExistingUserSignIn(user, identityId, exchanged.encryptedRefreshToken);
  }

  /**
   * Final step shared by both the "identity already existed" path and the
   * new-account race-loss fallback below — issues the Rapa Go session
   * without ever exchanging authorizationCode a second time within the same
   * request (the race fallback already has its encryptedRefreshToken from
   * the exchange exchangeAndCompleteNewAccount performed once).
   */
  private async completeExistingUserSignIn(
    user: User,
    identityId: string,
    encryptedRefreshToken: string | undefined,
  ): Promise<AppleAuthResult> {
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

  private async exchangeAndCompleteNewAccount(
    payload: AppleAuthRequest,
    identityClaims: Awaited<ReturnType<AppleIdentityTokenVerifier["verify"]>>,
  ): Promise<AppleAuthResult> {
    const email = identityClaims.email?.toLowerCase().trim();
    // Preconditions already guarantee email and role are present — this is
    // unreachable in practice, kept only to satisfy the type checker.
    if (!email || !payload.role || payload.role === "admin") {
      throw AppError.internal("exchangeAndCompleteNewAccount called without validated preconditions.");
    }

    // Never auto-link on email match — a matching email only means "someone
    // registered this address before", not "this is the same person". The
    // account owner must link explicitly, authenticated as themselves
    // (a later PR); here we only report the conflict. Checked again here
    // (not just in checkNewAccountPreconditions) to close the window
    // between that check and this one — still before the code-consuming
    // exchange, so a real conflict never burns the authorizationCode either.
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

    const exchanged = await this.exchangeIdentity(payload, identityClaims);
    if (!exchanged.ok) return exchanged.result;

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
      encryptedRefreshToken: exchanged.encryptedRefreshToken,
    });

    if (!created) {
      // Unique(provider, provider_user_id) violation: a concurrent request
      // for the exact same Apple account won the race and created it first.
      // We've already exchanged the authorizationCode once above (as part of
      // this same request) — completeExistingUserSignIn reuses that result
      // rather than exchanging (the now-single-use) code a second time.
      const identity = await this.identitiesRepository.findByProviderAndSub(PROVIDER, identityClaims.sub);
      if (!identity) {
        throw AppError.internal("OAuth identity creation race could not be resolved.");
      }
      const winnerUser = await this.usersRepository.findById(identity.userId);
      if (!winnerUser) {
        return { ok: false, code: "UNAUTHORIZED", message: "User not found.", statusCode: 401 };
      }
      if (winnerUser.status === "suspended" || winnerUser.status === "banned") {
        return { ok: false, code: "AUTH_ACCOUNT_SUSPENDED", message: "Account is suspended.", statusCode: 403 };
      }
      return this.completeExistingUserSignIn(winnerUser, identity.id, exchanged.encryptedRefreshToken);
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
