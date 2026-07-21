import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  authIdentities,
  legalDocuments,
  passengerProfiles,
  userAcceptances,
  users,
} from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import { OAuthTokenCrypto } from "../../shared/security/oauthTokenCrypto.js";
import { AuditService } from "../audit/audit.service.js";
import { UsersRepository } from "../users/users.repository.js";
import {
  authenticateActiveAccessToken,
  buildAuthUser,
} from "./auth.service.js";
import { AuthIdentitiesRepository } from "./authIdentities.repository.js";
import type {
  AppleAuthRequest,
  AppleAuthResult,
  AppleLinkResult,
  ApplePassengerFareType,
} from "./appleAuth.types.js";
import { AppleIdentityTokenVerifier } from "./appleIdentityToken.verifier.js";
import { AppleTokenExchangeClient } from "./appleTokenExchange.client.js";
import { SessionService } from "./session.service.js";
import { TokenService } from "./token.service.js";

const REQUIRED_LEGAL_TYPES = [
  "terms_and_conditions",
  "privacy_policy",
  "user_conditions",
] as const;
const PROVIDER = "apple" as const;

function sanitizeNamePart(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 50);
}

function buildDisplayName(
  name: AppleAuthRequest["name"],
  email: string,
): string {
  const fullName = [
    sanitizeNamePart(name?.givenName),
    sanitizeNamePart(name?.familyName),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName.length >= 2) return fullName.slice(0, 100);
  const emailName = sanitizeNamePart(email.split("@")[0]);
  return emailName.length >= 2 ? emailName : "Usuario Apple";
}

function normalizeFareType(
  value: ApplePassengerFareType | undefined,
): ApplePassengerFareType {
  if (value === "resident" || value === "foreigner") return value;
  return "chilean";
}

function normalizeApplePhone(value: string | undefined): string {
  return String(value ?? "")
    .replace(/[^+\d]/g, "")
    .trim()
    .slice(0, 16);
}

function isValidApplePhone(value: string): boolean {
  return /^\+?[0-9]{8,15}$/.test(value);
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const cause = "cause" in error ? error.cause : undefined;
  const causeCode =
    cause && typeof cause === "object" && "code" in cause
      ? String(cause.code)
      : "";
  return code === "23505" || causeCode === "23505";
}

export class AppleAuthService {
  constructor(
    private readonly usersRepository = new UsersRepository(),
    private readonly identitiesRepository = new AuthIdentitiesRepository(),
    private readonly auditService = new AuditService(),
    private readonly identityTokenVerifier = new AppleIdentityTokenVerifier(),
    private readonly tokenExchangeClient = new AppleTokenExchangeClient(),
    private readonly tokenService = new TokenService(),
    private readonly sessionService = new SessionService(),
  ) {}

  private async issueSession(
    user: typeof users.$inferSelect,
  ): Promise<AppleAuthResult> {
    const authUser = await buildAuthUser(user);
    const accessToken = this.tokenService.issueAccessToken(authUser);
    const refreshToken = this.tokenService.issueRefreshToken();

    await this.sessionService.createSession({
      userId: user.id,
      accessTokenHash: accessToken.hash,
      expiresAt: accessToken.expiresAt,
    });
    await this.sessionService.createRefreshToken({
      userId: user.id,
      tokenHash: refreshToken.hash,
      expiresAt: refreshToken.expiresAt,
    });

    return {
      ok: true,
      session: {
        accessToken: accessToken.token,
        expiresAt: accessToken.expiresAt.toISOString(),
        user: authUser,
      },
    };
  }

  private async verifyAndExchange(payload: AppleAuthRequest): Promise<{
    claims: Awaited<ReturnType<AppleIdentityTokenVerifier["verify"]>>;
    encryptedRefreshToken?: string;
  }> {
    const claims = await this.identityTokenVerifier.verify(
      payload.identityToken,
      { expectedNonce: payload.nonce },
    );

    const exchanged = await this.tokenExchangeClient.exchange(
      payload.authorizationCode,
      claims.aud,
    );
    const exchangedClaims = await this.identityTokenVerifier.verify(
      exchanged.idToken,
    );

    if (
      exchangedClaims.sub !== claims.sub ||
      exchangedClaims.aud !== claims.aud
    ) {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_INCOHERENT",
        message: "La respuesta de Apple no coincide con la identidad presentada.",
        statusCode: 401,
      });
    }

    return {
      claims,
      ...(exchanged.refreshToken
        ? {
            encryptedRefreshToken: OAuthTokenCrypto.encrypt(
              exchanged.refreshToken,
            ),
          }
        : {}),
    };
  }

  private async validateLegalAcceptances(
    payload: AppleAuthRequest,
  ): Promise<Array<typeof legalDocuments.$inferSelect>> {
    const activeDocuments = await db
      .select()
      .from(legalDocuments)
      .where(
        and(
          eq(legalDocuments.isActive, true),
          inArray(legalDocuments.type, [...REQUIRED_LEGAL_TYPES]),
        ),
      );

    const activeByType = new Map(
      activeDocuments.map((document) => [document.type, document]),
    );
    const submittedById = new Map(
      (payload.legalAcceptances ?? []).map((item) => [
        item.legalDocumentId,
        item.version,
      ]),
    );

    for (const type of REQUIRED_LEGAL_TYPES) {
      const document = activeByType.get(type);
      if (!document) {
        throw new AppError({
          code: "LEGAL_DOCUMENT_UNAVAILABLE",
          message: `El documento legal obligatorio ${type} no está disponible.`,
          statusCode: 503,
        });
      }
      if (submittedById.get(document.id) !== document.version) {
        throw new AppError({
          code: "LEGAL_ACCEPTANCE_REQUIRED",
          message:
            "Debes aceptar Términos, Privacidad y Condiciones para Usuarios antes de crear la cuenta con Apple.",
          statusCode: 409,
        });
      }
    }

    return REQUIRED_LEGAL_TYPES.map((type) => {
      const document = activeByType.get(type);
      if (!document) throw AppError.internal("Missing active legal document.");
      return document;
    });
  }

  async signIn(
    payload: AppleAuthRequest,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<AppleAuthResult> {
    let verifiedClaims: Awaited<
      ReturnType<AppleIdentityTokenVerifier["verify"]>
    >;
    try {
      verifiedClaims = await this.identityTokenVerifier.verify(
        payload.identityToken,
        { expectedNonce: payload.nonce },
      );
    } catch (error) {
      if (error instanceof AppError) {
        return {
          ok: false,
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
        };
      }
      throw error;
    }

    const existingIdentity =
      await this.identitiesRepository.findActiveByProviderSubject(
        PROVIDER,
        verifiedClaims.sub,
      );

    if (existingIdentity) {
      try {
        const exchanged = await this.verifyAndExchange(payload);
        if (exchanged.encryptedRefreshToken) {
          await this.identitiesRepository.updateEncryptedRefreshToken(
            existingIdentity.id,
            exchanged.encryptedRefreshToken,
          );
        }
        await this.identitiesRepository.touchLastLogin(existingIdentity.id);

        const user = await this.usersRepository.findById(
          existingIdentity.userId,
        );
        if (!user) {
          return {
            ok: false,
            code: "UNAUTHORIZED",
            message: "La cuenta asociada a Apple no existe.",
            statusCode: 401,
          };
        }
        if (user.status !== "active") {
          return {
            ok: false,
            code:
              user.status === "deleted"
                ? "AUTH_ACCOUNT_DELETED"
                : user.status === "pending"
                  ? "AUTH_ACCOUNT_PENDING"
                  : "AUTH_ACCOUNT_SUSPENDED",
            message:
              user.status === "pending"
                ? "La cuenta todavía está pendiente de aprobación."
                : user.status === "deleted"
                  ? "Esta cuenta fue eliminada."
                  : "Esta cuenta está bloqueada.",
            statusCode: 403,
          };
        }

        this.auditService.recordSafe({
          eventType: "auth.apple.login.success",
          entityType: "user",
          entityId: user.id,
          actorUserId: user.id,
          metadata: { provider: PROVIDER },
        });
        return await this.issueSession(user);
      } catch (error) {
        if (error instanceof AppError) {
          return {
            ok: false,
            code: error.code,
            message: error.message,
            statusCode: error.statusCode,
          };
        }
        throw error;
      }
    }

    const email = verifiedClaims.email?.trim().toLowerCase();
    if (!email || !verifiedClaims.emailVerified) {
      return {
        ok: false,
        code: "AUTH_APPLE_EMAIL_MISSING",
        message:
          "Apple no entregó un correo verificado para crear la cuenta.",
        statusCode: 400,
      };
    }

    const emailOwner = await this.usersRepository.findByEmail(email);
    if (emailOwner) {
      return {
        ok: false,
        code: "AUTH_APPLE_ACCOUNT_LINKING_REQUIRED",
        message:
          "Ya existe una cuenta con ese correo. Ingresa con tu método actual y vincula Apple desde Perfil > Seguridad.",
        statusCode: 409,
      };
    }

    let legalDocumentsToAccept;
    try {
      legalDocumentsToAccept = await this.validateLegalAcceptances(payload);
    } catch (error) {
      if (error instanceof AppError) {
        return {
          ok: false,
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
        };
      }
      throw error;
    }

    let exchanged;
    try {
      exchanged = await this.verifyAndExchange(payload);
    } catch (error) {
      if (error instanceof AppError) {
        return {
          ok: false,
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
        };
      }
      throw error;
    }

    const phone = normalizeApplePhone(payload.phone);
    if (!isValidApplePhone(phone)) {
      return {
        ok: false,
        code: "AUTH_APPLE_PHONE_REQUIRED",
        message:
          "Apple no comparte tu número de teléfono. Ingresa un celular válido para completar tu cuenta RAPA GO.",
        statusCode: 400,
      };
    }

    const requestedFareType = normalizeFareType(payload.passengerFareType);
    const verificationStatus =
      requestedFareType === "resident" ? "pending" : "not_required";
    const effectiveFareType =
      requestedFareType === "resident" ? "chilean" : requestedFareType;
    const now = new Date();

    try {
      const createdUser = await db.transaction(async (tx) => {
        const userRows = await tx
          .insert(users)
          .values({
            email,
            name: buildDisplayName(payload.name, email),
            role: "passenger",
            status: "active",
            isVerified: true,
          })
          .returning();
        const user = userRows[0];
        if (!user) throw AppError.internal("User insert returned no rows.");

        await tx.insert(passengerProfiles).values({
          userId: user.id,
          phone,
          requestedFareType,
          effectiveFareType,
          residenceVerificationStatus: verificationStatus,
          residenceRequestedAt:
            requestedFareType === "resident" ? now : null,
          updatedAt: now,
        });

        await tx.insert(authIdentities).values({
          userId: user.id,
          provider: PROVIDER,
          providerSubject: exchanged.claims.sub,
          providerEmail: email,
          emailVerified: exchanged.claims.emailVerified,
          providerIsPrivateEmail: exchanged.claims.isPrivateEmail,
          encryptedRefreshToken:
            exchanged.encryptedRefreshToken ?? null,
          linkedAt: now,
          lastLoginAt: now,
        });

        await tx.insert(userAcceptances).values(
          legalDocumentsToAccept.map((document) => ({
            userId: user.id,
            legalDocumentId: document.id,
            versionAccepted: document.version,
            ipAddress: metadata?.ipAddress ?? null,
            userAgent: metadata?.userAgent ?? null,
          })),
        );

        return user;
      });

      this.auditService.recordSafe({
        eventType: "auth.apple.register.success",
        entityType: "user",
        entityId: createdUser.id,
        actorUserId: createdUser.id,
        metadata: {
          provider: PROVIDER,
          isPrivateEmail: exchanged.claims.isPrivateEmail,
          passengerFareType: requestedFareType,
        },
      });

      return await this.issueSession(createdUser);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const concurrentIdentity =
          await this.identitiesRepository.findActiveByProviderSubject(
            PROVIDER,
            exchanged.claims.sub,
          );
        if (concurrentIdentity) {
          const user = await this.usersRepository.findById(
            concurrentIdentity.userId,
          );
          if (user?.status === "active") return await this.issueSession(user);
        }
        return {
          ok: false,
          code: "AUTH_APPLE_ACCOUNT_LINKING_REQUIRED",
          message:
            "La cuenta ya existe. Ingresa con tu método actual y vincula Apple desde Perfil > Seguridad.",
          statusCode: 409,
        };
      }
      if (error instanceof AppError) {
        return {
          ok: false,
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
        };
      }
      throw error;
    }
  }

  async link(
    accessToken: string,
    payload: AppleAuthRequest,
  ): Promise<AppleLinkResult> {
    const auth = await authenticateActiveAccessToken(accessToken);
    if (!auth.ok) return auth;

    try {
      const exchanged = await this.verifyAndExchange(payload);
      const alreadyLinked =
        await this.identitiesRepository.findActiveByProviderSubject(
          PROVIDER,
          exchanged.claims.sub,
        );

      if (alreadyLinked && alreadyLinked.userId !== auth.user.id) {
        return {
          ok: false,
          code: "AUTH_IDENTITY_ALREADY_LINKED",
          message:
            "Esta cuenta de Apple ya está vinculada a otra cuenta RAPA GO.",
          statusCode: 409,
        };
      }

      await this.identitiesRepository.link({
        userId: auth.user.id,
        provider: PROVIDER,
        providerSubject: exchanged.claims.sub,
        providerEmail: exchanged.claims.email ?? null,
        emailVerified: exchanged.claims.emailVerified,
        providerIsPrivateEmail: exchanged.claims.isPrivateEmail,
        encryptedRefreshToken:
          exchanged.encryptedRefreshToken ?? null,
      });

      this.auditService.recordSafe({
        eventType: "auth.identity.linked",
        entityType: "user",
        entityId: auth.user.id,
        actorUserId: auth.user.id,
        metadata: { provider: PROVIDER },
      });

      return {
        ok: true,
        message: "Apple quedó vinculado correctamente.",
      };
    } catch (error) {
      if (error instanceof AppError) {
        return {
          ok: false,
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
        };
      }
      throw error;
    }
  }

  async getLinkedAppleIdentity(userId: string) {
    return db
      .select()
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.userId, userId),
          eq(authIdentities.provider, PROVIDER),
          isNull(authIdentities.revokedAt),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);
  }
}
