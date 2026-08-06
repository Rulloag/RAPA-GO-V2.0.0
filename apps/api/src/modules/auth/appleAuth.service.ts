import type { UserRole } from "@rapa-go/shared";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  legalDocuments,
  passengerProfiles,
  userAcceptances,
  userDocuments,
  users,
  type User,
} from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import { OAuthTokenCrypto } from "../../shared/security/oauthTokenCrypto.js";
import { AuditService } from "../audit/audit.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { OAuthIdentitiesRepository } from "./oauthIdentities.repository.js";
import type {
  AppleAuthRequest,
  AppleAuthResult,
  AppleLinkResult,
  ApplePassengerFareType,
} from "./appleAuth.types.js";
import { AppleIdentityTokenVerifier } from "./appleIdentityToken.verifier.js";
import { AppleTokenExchangeClient } from "./appleTokenExchange.client.js";
import type {
  ApplePreparedWebIdentity,
  AppleWebCompleteInput,
} from "./appleWeb.types.js";
import type { AuthUser } from "./auth.types.js";
import { SessionService } from "./session.service.js";
import { TokenService } from "./token.service.js";
import { buildLegalAcceptanceEvidence } from "../legal/legalEvidence.js";

const PROVIDER = "apple";
const REQUIRED_LEGAL_TYPES = [
  "terms_and_conditions",
  "privacy_policy",
  "user_conditions",
] as const;
const RESIDENCE_DOCUMENT_TYPE = "rapa_nui_residence";
const RESIDENCE_DOCUMENT_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);
const RESIDENCE_META_MARKER = "#rapagoMeta=";

type AppleAuthFailure = Extract<AppleAuthResult, { ok: false }>;

type VerifiedAppleClaims = Awaited<
  ReturnType<AppleIdentityTokenVerifier["verify"]>
>;

type AppleRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
  /** Fastify's request.id — used only to correlate safe diagnostic logs. */
  requestId?: string;
};

/**
 * Safe diagnostic log for the Apple sign-in pipeline: correlation id + stage
 * + booleans/codes only. Never logs authorizationCode, identityToken, the
 * Apple subject, private keys, or any other token/credential material.
 * Temporary — meant to be removed once the current investigation is closed.
 */
function logAppleStage(
  requestId: string | undefined,
  stage: string,
  details: Record<string, unknown> = {},
): void {
  console.log(`[Apple][${requestId ?? "no-request-id"}] ${stage}`, details);
}

type PassengerSetup = {
  phone: string;
  rut: string;
  requestedFareType: ApplePassengerFareType;
  legalDocumentsToAccept: Array<typeof legalDocuments.$inferSelect>;
  storedResidenceAccreditation: string | null;
  /**
   * Correo de contacto escrito por el usuario, solo cuando Apple no entregó
   * un correo verificado en el identity token. Nunca reemplaza al Apple
   * subject como identidad: solo se usa como valor informativo/contacto.
   */
  contactEmail: string | null;
};

function toUserRole(raw: string): UserRole {
  return raw as UserRole;
}

/** Mirrors AuthService's role-to-initial-status rule. */
function roleInitialStatus(role: UserRole): "active" | "pending" {
  return role === "passenger" ? "active" : "pending";
}

function sanitizeNamePart(part: string | undefined): string {
  return (part ?? "").trim().replace(/\s+/g, " ").slice(0, 50);
}

function buildName(name: AppleAuthRequest["name"], email: string): string {
  const given = sanitizeNamePart(name?.givenName);
  const family = sanitizeNamePart(name?.familyName);
  const full = [given, family].filter(Boolean).join(" ").trim();

  if (full.length >= 2) return full.slice(0, 100);

  const localPart = sanitizeNamePart(email.split("@")[0]);
  return localPart.length >= 2 ? localPart : "Usuario Apple";
}

function normalizeFareType(
  value: ApplePassengerFareType | undefined,
): ApplePassengerFareType | null {
  if (
    value === "resident" ||
    value === "chilean" ||
    value === "foreigner"
  ) {
    return value;
  }

  return null;
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

function requiresRutForFareType(value: ApplePassengerFareType): boolean {
  return value === "chilean" || value === "resident";
}

function requiresPassportForFareType(value: ApplePassengerFareType): boolean {
  return value === "foreigner";
}

function normalizeAppleRut(value: string | undefined): string {
  return String(value ?? "")
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim()
    .toUpperCase();
}

function isValidAppleRut(value: string): boolean {
  if (!/^\d{7,8}[0-9K]$/.test(value)) return false;

  const body = value.slice(0, -1);
  const dv = value.slice(-1);

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const expectedNumber = 11 - (sum % 11);
  const expectedDv =
    expectedNumber === 11 ? "0" : expectedNumber === 10 ? "K" : String(expectedNumber);

  return dv === expectedDv;
}

function normalizeApplePassport(value: string | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function isValidApplePassport(value: string): boolean {
  const clean = value.replace(/-/g, "");
  return clean.length >= 5 && clean.length <= 15;
}

function normalizeAppleContactEmail(value: string | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function isValidAppleContactEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateAppleResidenceAccreditation(
  input: NonNullable<AppleAuthRequest["residenceAccreditation"]>,
  rut?: string,
): { ok: true; storedDataUrl: string } | { ok: false; message: string } {
  const match = input.documentDataUrl
    .trim()
    .match(
      /^data:(application\/pdf|image\/jpeg|image\/png|image\/webp);base64,([A-Za-z0-9+/=\r\n]+)$/i,
    );

  if (!match) {
    return {
      ok: false,
      message: "La acreditación debe ser PDF, JPG, PNG o WEBP.",
    };
  }

  const mimeType = String(match[1] ?? "").toLowerCase();
  if (mimeType !== input.documentType.toLowerCase()) {
    return {
      ok: false,
      message:
        "El tipo real de la acreditación no coincide con el archivo enviado.",
    };
  }

  const bytes = Buffer.from(
    String(match[2] ?? "").replace(/\s+/g, ""),
    "base64",
  );
  const signatureIsValid =
    (mimeType === "application/pdf" &&
      bytes.subarray(0, 5).toString("ascii") === "%PDF-") ||
    (mimeType === "image/jpeg" &&
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff) ||
    (mimeType === "image/png" &&
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )) ||
    (mimeType === "image/webp" &&
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP");

  if (!signatureIsValid) {
    return {
      ok: false,
      message:
        "El contenido real no corresponde a un PDF o imagen permitida.",
    };
  }

  if (
    bytes.byteLength <= 0 ||
    bytes.byteLength > RESIDENCE_DOCUMENT_MAX_BYTES ||
    input.documentSize <= 0 ||
    input.documentSize > RESIDENCE_DOCUMENT_MAX_BYTES
  ) {
    return {
      ok: false,
      message: "La acreditación supera el máximo de 1.5 MB.",
    };
  }

  const metadata = encodeURIComponent(
    JSON.stringify({
      version: 1,
      provider: PROVIDER,
      documentName: input.documentName.trim(),
      documentType: input.documentType,
      uploadedAt: new Date().toISOString(),
      ...(rut ? { rut } : {}),
    }),
  );

  return {
    ok: true,
    storedDataUrl: `${input.documentDataUrl.trim()}${RESIDENCE_META_MARKER}${metadata}`,
  };
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

  private async issueSession(user: User): Promise<{
    authUser: AuthUser;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  }> {
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: toUserRole(user.role),
      avatarUrl: user.avatarUrl,
      isVerified: user.isVerified,
    };

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
      authUser,
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
      expiresAt: accessToken.expiresAt.toISOString(),
    };
  }

  async signIn(
    payload: AppleAuthRequest,
    metadata?: AppleRequestMetadata,
  ): Promise<AppleAuthResult> {
    const requestId = metadata?.requestId;
    logAppleStage(requestId, "signIn:start", {
      hasRole: Boolean(payload.role),
      role: payload.role ?? null,
      hasPhone: Boolean(payload.phone),
      hasFareType: Boolean(payload.passengerFareType),
      hasRut: Boolean(payload.rut),
      hasPassport: Boolean(payload.passport),
      hasContactEmail: Boolean(payload.contactEmail),
      hasResidenceAccreditation: Boolean(payload.residenceAccreditation),
      legalAcceptancesCount: payload.legalAcceptances?.length ?? 0,
    });

    // Verificamos primero el identity token. El authorizationCode es de un
    // solo uso y no debe consumirse antes de que el usuario termine el rol y,
    // para pasajeros, la configuración obligatoria.
    const identityClaims = await this.identityTokenVerifier.verify(
      payload.identityToken,
      {
        ...(payload.nonce !== undefined
          ? { expectedNonce: payload.nonce }
          : {}),
      },
    );

    logAppleStage(requestId, "signIn:identityTokenVerified", {
      hasEmail: Boolean(identityClaims.email),
      emailVerified: identityClaims.emailVerified,
      isPrivateEmail: identityClaims.isPrivateEmail,
      aud: identityClaims.aud,
    });

    const existing =
      await this.identitiesRepository.findByProviderAndSub(
        PROVIDER,
        identityClaims.sub,
      );

    logAppleStage(requestId, "signIn:existingIdentityLookup", {
      found: Boolean(existing),
    });

    if (existing) {
      return this.signInExisting(
        payload,
        identityClaims,
        existing.userId,
        existing.id,
        requestId,
      );
    }

    const precondition = this.checkNewAccountPreconditions(
      payload,
      identityClaims,
    );
    if (precondition) {
      logAppleStage(requestId, "signIn:newAccountPreconditionFailed", {
        code: precondition.ok === false ? precondition.code : null,
      });
      return precondition;
    }

    let passengerSetup: PassengerSetup | null = null;
    if (payload.role === "passenger") {
      const prepared = await this.preparePassengerSetup(
        payload,
        identityClaims,
      );
      if (!prepared.ok) {
        logAppleStage(requestId, "signIn:preparePassengerSetupFailed", {
          code: prepared.result.ok === false ? prepared.result.code : null,
        });
        return prepared.result;
      }
      passengerSetup = prepared.setup;
      logAppleStage(requestId, "signIn:preparePassengerSetupOk", {
        requestedFareType: passengerSetup.requestedFareType,
        usedContactEmailFallback: Boolean(passengerSetup.contactEmail),
      });
    }

    const candidateEmail =
      identityClaims.email?.toLowerCase().trim() ||
      passengerSetup?.contactEmail ||
      undefined;

    if (candidateEmail) {
      const emailOwner = await this.usersRepository.findByEmail(candidateEmail);

      if (emailOwner) {
        logAppleStage(requestId, "signIn:newAccountEmailConflict", {
          userId: emailOwner.id,
        });

        this.auditService.recordSafe({
          eventType: "auth.apple.login.conflict",
          entityType: "user",
          entityId: emailOwner.id,
          metadata: { reason: "email_taken_before_exchange" },
        });

        return {
          ok: false,
          code: "AUTH_APPLE_ACCOUNT_LINKING_REQUIRED",
          message:
            "Ya existe una cuenta con ese correo. Ingresa con tu método actual para vincular Apple.",
          statusCode: 409,
        };
      }
    }

    return this.exchangeAndCompleteNewAccount(
      payload,
      identityClaims,
      passengerSetup,
      metadata,
    );
  }

  async prepareWebFlow(
    input: {
      identityToken: string;
      authorizationCode: string;
      nonce: string;
      expectedClientId: string;
      redirectUri: string;
      name?: AppleAuthRequest["name"];
    },
    metadata?: AppleRequestMetadata,
  ): Promise<ApplePreparedWebIdentity> {
    const requestId = metadata?.requestId;
    logAppleStage(requestId, "web:prepare:start", {});

    const identityClaims = await this.identityTokenVerifier.verify(
      input.identityToken,
      { expectedNonce: input.nonce },
    );

    if (identityClaims.aud !== input.expectedClientId) {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_INVALID",
        message: "Apple returned an unexpected web client identifier.",
        statusCode: 401,
      });
    }

    const payload: AppleAuthRequest = {
      identityToken: input.identityToken,
      authorizationCode: input.authorizationCode,
      nonce: input.nonce,
      ...(input.name ? { name: input.name } : {}),
    };

    const exchanged = await this.exchangeIdentity(
      payload,
      identityClaims,
      requestId,
      input.redirectUri,
    );

    if (!exchanged.ok) {
      throw new AppError({
        code: exchanged.result.code,
        message: exchanged.result.message,
        statusCode: exchanged.result.statusCode ?? 401,
      });
    }

    logAppleStage(requestId, "web:prepare:complete", {
      hasEmail: Boolean(identityClaims.email),
      hasRefreshToken: Boolean(exchanged.encryptedRefreshToken),
    });

    return {
      sub: identityClaims.sub,
      aud: identityClaims.aud,
      ...(identityClaims.email
        ? { email: identityClaims.email }
        : {}),
      emailVerified: identityClaims.emailVerified,
      isPrivateEmail: identityClaims.isPrivateEmail,
      ...(input.name ? { name: input.name } : {}),
      ...(exchanged.encryptedRefreshToken
        ? { encryptedRefreshToken: exchanged.encryptedRefreshToken }
        : {}),
    };
  }

  async completeWebFlow(
    prepared: ApplePreparedWebIdentity,
    input: Omit<AppleWebCompleteInput, "flowToken">,
    metadata?: AppleRequestMetadata,
  ): Promise<AppleAuthResult> {
    const requestId = metadata?.requestId;
    const identityClaims: VerifiedAppleClaims = {
      sub: prepared.sub,
      aud: prepared.aud,
      email: prepared.email,
      emailVerified: prepared.emailVerified,
      isPrivateEmail: prepared.isPrivateEmail,
    };

    const existing =
      await this.identitiesRepository.findByProviderAndSub(
        PROVIDER,
        identityClaims.sub,
      );

    if (existing) {
      return this.signInExistingAfterExchange(
        identityClaims,
        existing.userId,
        existing.id,
        prepared.encryptedRefreshToken,
        requestId,
      );
    }

    const payload: AppleAuthRequest = {
      identityToken: "web-flow-prepared",
      authorizationCode: "web-flow-prepared",
      nonce: "0".repeat(64),
      role: "passenger",
      ...(prepared.name ? { name: prepared.name } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.contactEmail
        ? { contactEmail: input.contactEmail }
        : {}),
      ...(input.rut ? { rut: input.rut } : {}),
      ...(input.passport ? { passport: input.passport } : {}),
      ...(input.passengerFareType
        ? { passengerFareType: input.passengerFareType }
        : {}),
      ...(input.legalAcceptances
        ? { legalAcceptances: input.legalAcceptances }
        : {}),
      ...(input.residenceAccreditation
        ? { residenceAccreditation: input.residenceAccreditation }
        : {}),
    };

    const precondition = this.checkNewAccountPreconditions(
      payload,
      identityClaims,
    );

    if (precondition) return precondition;

    const passengerSetupResult = await this.preparePassengerSetup(
      payload,
      identityClaims,
    );

    if (!passengerSetupResult.ok) {
      return passengerSetupResult.result;
    }

    return this.completeNewAccountAfterExchange(
      payload,
      identityClaims,
      passengerSetupResult.setup,
      prepared.encryptedRefreshToken,
      metadata,
    );
  }

  async link(
    accessToken: string,
    payload: AppleAuthRequest,
  ): Promise<AppleLinkResult> {
    let tokenPayload;

    try {
      tokenPayload = this.tokenService.verifyAccessToken(accessToken);
    } catch (error) {
      if (error instanceof AppError) {
        return {
          ok: false,
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
        };
      }

      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "La sesión no es válida.",
        statusCode: 401,
      };
    }

    const accessTokenHash = this.tokenService.hashToken(accessToken);
    const sessionIsValid =
      await this.sessionService.isSessionValid(accessTokenHash);

    if (!sessionIsValid) {
      return {
        ok: false,
        code: "AUTH_SESSION_REVOKED",
        message: "La sesión fue revocada.",
        statusCode: 401,
      };
    }

    const user = await this.usersRepository.findById(tokenPayload.sub);

    if (!user || user.status !== "active") {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_UNAVAILABLE",
        message: "La cuenta no está disponible para vincular Apple.",
        statusCode: 403,
      };
    }

    const identityClaims = await this.identityTokenVerifier.verify(
      payload.identityToken,
      {
        ...(payload.nonce !== undefined
          ? { expectedNonce: payload.nonce }
          : {}),
      },
    );

    const existing =
      await this.identitiesRepository.findByProviderAndSub(
        PROVIDER,
        identityClaims.sub,
      );

    if (existing && existing.userId !== user.id) {
      return {
        ok: false,
        code: "AUTH_IDENTITY_ALREADY_LINKED",
        message:
          "Esta cuenta de Apple ya está vinculada a otra cuenta RAPA GO.",
        statusCode: 409,
      };
    }

    const exchanged = await this.exchangeIdentity(payload, identityClaims);
    if (!exchanged.ok) {
      return {
        ok: false,
        code: exchanged.result.code,
        message: exchanged.result.message,
        statusCode: exchanged.result.statusCode ?? 401,
      };
    }

    if (existing) {
      await this.identitiesRepository.updateProviderCredentials(
        existing.id,
        identityClaims.aud,
        exchanged.encryptedRefreshToken,
      );
    } else {
      const attached =
        await this.identitiesRepository.attachToExistingUser({
          userId: user.id,
          provider: PROVIDER,
          providerUserId: identityClaims.sub,
          providerClientId: identityClaims.aud,
          providerEmail: identityClaims.email,
          providerEmailVerified: identityClaims.emailVerified,
          providerIsPrivateEmail: identityClaims.isPrivateEmail,
          encryptedRefreshToken: exchanged.encryptedRefreshToken,
        });

      if (!attached) {
        const winner =
          await this.identitiesRepository.findByProviderAndSub(
            PROVIDER,
            identityClaims.sub,
          );

        if (!winner || winner.userId !== user.id) {
          return {
            ok: false,
            code: "AUTH_IDENTITY_ALREADY_LINKED",
            message:
              "Esta cuenta de Apple ya está vinculada a otra cuenta RAPA GO.",
            statusCode: 409,
          };
        }
      }
    }

    this.auditService.recordSafe({
      eventType: "auth.apple.link.success",
      entityType: "user",
      entityId: user.id,
      actorUserId: user.id,
      metadata: { role: user.role },
    });

    return {
      ok: true,
      message: "Cuenta de Apple vinculada correctamente.",
    };
  }

  private checkNewAccountPreconditions(
    payload: AppleAuthRequest,
    identityClaims: VerifiedAppleClaims,
  ): AppleAuthResult | null {
    if (!payload.role) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "role is required to create a new account.",
        statusCode: 400,
      };
    }

    const hasVerifiedIdentityEmail =
      Boolean(identityClaims.email) && identityClaims.emailVerified;

    if (payload.role !== "passenger" && !hasVerifiedIdentityEmail) {
      return {
        ok: false,
        code: "AUTH_APPLE_EMAIL_MISSING",
        message:
          "Apple no entregó un correo verificado para completar este registro.",
        statusCode: 400,
      };
    }

    if (payload.role !== "passenger") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message:
          "El registro con Apple está disponible solamente para pasajeros.",
        statusCode: 403,
      };
    }

    // Si Apple no entrega un correo verificado, el formulario de pasajero
    // solicita un correo de contacto. El Apple subject sigue siendo siempre
    // la identidad principal.
    return null;
  }

  private async preparePassengerSetup(
    payload: AppleAuthRequest,
    identityClaims: VerifiedAppleClaims,
  ): Promise<
    | { ok: true; setup: PassengerSetup }
    | { ok: false; result: AppleAuthFailure }
  > {
    const phone = normalizeApplePhone(payload.phone);
    const requestedFareType = normalizeFareType(payload.passengerFareType);

    if (!isValidApplePhone(phone) || !requestedFareType) {
      return {
        ok: false,
        result: {
          ok: false,
          code: "AUTH_APPLE_SETUP_REQUIRED",
          message:
            "Completa tu celular, categoría de pasajero y documentos legales para crear la cuenta con Apple.",
          statusCode: 409,
        },
      };
    }

    // Apple solo entrega correo verificado en el identity token; si no lo
    // entregó, el formulario de pasajero pide un correo de contacto. Nunca
    // reemplaza al Apple subject como identidad, solo sirve como dato de
    // contacto cuando no hay otro correo disponible.
    const hasVerifiedIdentityEmail =
      Boolean(identityClaims.email) && identityClaims.emailVerified;
    let contactEmail: string | null = null;

    if (!hasVerifiedIdentityEmail) {
      const normalizedContactEmail = normalizeAppleContactEmail(
        payload.contactEmail,
      );

      if (!payload.contactEmail) {
        return {
          ok: false,
          result: {
            ok: false,
            code: "AUTH_APPLE_SETUP_REQUIRED",
            message: "Ingresa tu correo electrónico de contacto.",
            statusCode: 409,
          },
        };
      }

      if (!isValidAppleContactEmail(normalizedContactEmail)) {
        return {
          ok: false,
          result: {
            ok: false,
            code: "AUTH_APPLE_SETUP_REQUIRED",
            message: "Ingresa un correo electrónico válido.",
            statusCode: 409,
          },
        };
      }

      contactEmail = normalizedContactEmail;
    }

    // RUT y pasaporte son mutuamente excluyentes: nunca se aceptan ambos a
    // la vez, sin importar la categoría.
    if (payload.rut && payload.passport) {
      return {
        ok: false,
        result: {
          ok: false,
          code: "AUTH_APPLE_SETUP_REQUIRED",
          message: "No debes enviar RUT y pasaporte al mismo tiempo.",
          statusCode: 409,
        },
      };
    }

    const rut = normalizeAppleRut(payload.rut);
    const passport = normalizeApplePassport(payload.passport);

    // chilean / resident: RUT obligatorio y válido, pasaporte no debe
    // enviarse. foreigner: pasaporte obligatorio y válido, RUT no debe
    // enviarse. Misma regla de negocio que el formulario de Facebook.
    if (requiresRutForFareType(requestedFareType)) {
      if (payload.passport) {
        return {
          ok: false,
          result: {
            ok: false,
            code: "AUTH_APPLE_SETUP_REQUIRED",
            message:
              "El pasaporte no corresponde a esta categoría de pasajero.",
            statusCode: 409,
          },
        };
      }

      if (!payload.rut || !isValidAppleRut(rut)) {
        return {
          ok: false,
          result: {
            ok: false,
            code: "AUTH_APPLE_SETUP_REQUIRED",
            message: "Ingresa un RUT válido para continuar con Apple.",
            statusCode: 409,
          },
        };
      }
    }

    if (requiresPassportForFareType(requestedFareType)) {
      if (payload.rut) {
        return {
          ok: false,
          result: {
            ok: false,
            code: "AUTH_APPLE_SETUP_REQUIRED",
            message: "El RUT no corresponde a esta categoría de pasajero.",
            statusCode: 409,
          },
        };
      }

      if (!payload.passport || !isValidApplePassport(passport)) {
        return {
          ok: false,
          result: {
            ok: false,
            code: "AUTH_APPLE_SETUP_REQUIRED",
            message: "Ingresa un pasaporte válido para continuar con Apple.",
            statusCode: 409,
          },
        };
      }
    }

    let legalDocumentsToAccept: Array<
      typeof legalDocuments.$inferSelect
    >;

    try {
      legalDocumentsToAccept = await this.validateLegalAcceptances(payload);
    } catch (error) {
      if (error instanceof AppError) {
        return {
          ok: false,
          result: {
            ok: false,
            code: error.code,
            message: error.message,
            statusCode: error.statusCode,
          },
        };
      }
      throw error;
    }

    let storedResidenceAccreditation: string | null = null;

    if (requestedFareType === "resident") {
      if (!payload.residenceAccreditation) {
        return {
          ok: false,
          result: {
            ok: false,
            code: "AUTH_RESIDENCE_ACCREDITATION_REQUIRED",
            message:
              "Debes adjuntar tu acreditación de residencia para continuar.",
            statusCode: 400,
          },
        };
      }

      const validation = validateAppleResidenceAccreditation(
        payload.residenceAccreditation,
        rut,
      );

      if (!validation.ok) {
        return {
          ok: false,
          result: {
            ok: false,
            code: "AUTH_RESIDENCE_ACCREDITATION_INVALID",
            message: validation.message,
            statusCode: 400,
          },
        };
      }

      storedResidenceAccreditation = validation.storedDataUrl;
    }

    return {
      ok: true,
      setup: {
        phone,
        rut: rut || passport,
        requestedFareType,
        legalDocumentsToAccept,
        storedResidenceAccreditation,
        contactEmail,
      },
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
      if (!document) {
        throw AppError.internal("Missing active legal document.");
      }
      return document;
    });
  }

  private async exchangeIdentity(
    payload: AppleAuthRequest,
    identityClaims: VerifiedAppleClaims,
    requestId?: string,
    redirectUri?: string,
  ): Promise<
    | { ok: true; encryptedRefreshToken: string | undefined }
    | { ok: false; result: AppleAuthFailure }
  > {
    logAppleStage(requestId, "exchangeIdentity:start", {
      aud: identityClaims.aud,
    });

    let exchange;
    try {
      exchange = await this.tokenExchangeClient.exchange(
        payload.authorizationCode,
        identityClaims.aud,
        redirectUri,
      );
    } catch (error) {
      logAppleStage(requestId, "exchangeIdentity:tokenExchangeThrew", {
        code: error instanceof AppError ? error.code : "UNKNOWN",
        statusCode: error instanceof AppError ? error.statusCode : null,
      });
      throw error;
    }

    logAppleStage(requestId, "exchangeIdentity:tokenExchangeOk", {
      hasRefreshToken: exchange.refreshToken !== undefined,
    });

    const exchangedClaims = await this.identityTokenVerifier.verify(
      exchange.idToken,
      {},
    );

    if (
      exchangedClaims.sub !== identityClaims.sub ||
      exchangedClaims.aud !== identityClaims.aud
    ) {
      logAppleStage(requestId, "exchangeIdentity:incoherentResponse", {});
      this.auditService.recordSafe({
        eventType: "auth.apple.login.failure",
        entityType: "auth",
        metadata: { reason: "token_incoherent" },
      });

      return {
        ok: false,
        result: {
          ok: false,
          code: "AUTH_APPLE_TOKEN_INCOHERENT",
          message:
            "La respuesta de Apple no coincide con la identidad presentada.",
          statusCode: 401,
        },
      };
    }

    const encryptedRefreshToken =
      exchange.refreshToken !== undefined
        ? OAuthTokenCrypto.encrypt(exchange.refreshToken)
        : undefined;

    return { ok: true, encryptedRefreshToken };
  }

  private async signInExisting(
    payload: AppleAuthRequest,
    identityClaims: VerifiedAppleClaims,
    userId: string,
    identityId: string,
    requestId?: string,
  ): Promise<AppleAuthResult> {
    const exchanged = await this.exchangeIdentity(
      payload,
      identityClaims,
      requestId,
    );

    if (!exchanged.ok) return exchanged.result;

    return this.signInExistingAfterExchange(
      identityClaims,
      userId,
      identityId,
      exchanged.encryptedRefreshToken,
      requestId,
    );
  }

  private async signInExistingAfterExchange(
    identityClaims: VerifiedAppleClaims,
    userId: string,
    identityId: string,
    encryptedRefreshToken: string | undefined,
    requestId?: string,
  ): Promise<AppleAuthResult> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "La cuenta asociada a Apple no existe.",
        statusCode: 401,
      };
    }

    if (
      user.status === "suspended" ||
      user.status === "banned" ||
      user.status === "deleted"
    ) {
      this.auditService.recordSafe({
        eventType: "auth.apple.login.failure",
        entityType: "user",
        entityId: user.id,
        actorUserId: user.id,
        metadata: { reason: "account_unavailable" },
      });

      return {
        ok: false,
        code:
          user.status === "deleted"
            ? "AUTH_ACCOUNT_DELETED"
            : "AUTH_ACCOUNT_SUSPENDED",
        message:
          user.status === "deleted"
            ? "Esta cuenta fue eliminada."
            : "Esta cuenta está bloqueada.",
        statusCode: 403,
      };
    }

    logAppleStage(requestId, "signInExisting:sessionIssuing", {
      userId: user.id,
    });

    return this.completeExistingUserSignIn(
      user,
      identityId,
      encryptedRefreshToken,
      identityClaims.aud,
    );
  }

  private async completeExistingUserSignIn(
    user: User,
    identityId: string,
    encryptedRefreshToken: string | undefined,
    providerClientId: string,
  ): Promise<AppleAuthResult> {
    await this.identitiesRepository.updateProviderCredentials(
      identityId,
      providerClientId,
      encryptedRefreshToken,
    );

    const session = await this.issueSession(user);

    this.auditService.recordSafe({
      eventType: "auth.apple.login.success",
      entityType: "user",
      entityId: user.id,
      actorUserId: user.id,
      metadata: { role: user.role },
    });

    return {
      ok: true,
      session: {
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
        user: session.authUser,
      },
      refreshToken: session.refreshToken,
    };
  }

  private async exchangeAndCompleteNewAccount(
    payload: AppleAuthRequest,
    identityClaims: VerifiedAppleClaims,
    passengerSetup: PassengerSetup | null,
    metadata?: AppleRequestMetadata,
  ): Promise<AppleAuthResult> {
    const requestId = metadata?.requestId;
    const exchanged = await this.exchangeIdentity(
      payload,
      identityClaims,
      requestId,
    );

    if (!exchanged.ok) return exchanged.result;

    return this.completeNewAccountAfterExchange(
      payload,
      identityClaims,
      passengerSetup,
      exchanged.encryptedRefreshToken,
      metadata,
    );
  }

  private async completeNewAccountAfterExchange(
    payload: AppleAuthRequest,
    identityClaims: VerifiedAppleClaims,
    passengerSetup: PassengerSetup | null,
    encryptedRefreshToken: string | undefined,
    metadata?: AppleRequestMetadata,
  ): Promise<AppleAuthResult> {
    const requestId = metadata?.requestId;
    logAppleStage(requestId, "completeNewAccountAfterExchange:start", {
      role: payload.role ?? null,
    });

    const email =
      identityClaims.email?.toLowerCase().trim() ||
      passengerSetup?.contactEmail ||
      undefined;

    if (!email || !payload.role || payload.role === "admin") {
      console.error(
        "[Apple] completeNewAccountAfterExchange: precondición faltante",
        {
          hasIdentityEmail: Boolean(identityClaims.email),
          hasContactEmail: Boolean(passengerSetup?.contactEmail),
          hasRole: Boolean(payload.role),
          role: payload.role ?? null,
        },
      );
      throw AppError.internal(
        "completeNewAccountAfterExchange called without validated preconditions.",
      );
    }

    const emailOwner = await this.usersRepository.findByEmail(email);
    if (emailOwner) {
      this.auditService.recordSafe({
        eventType: "auth.apple.login.conflict",
        entityType: "user",
        entityId: emailOwner.id,
        metadata: { reason: "email_taken" },
      });

      return {
        ok: false,
        code: "AUTH_APPLE_ACCOUNT_LINKING_REQUIRED",
        message:
          "Ya existe una cuenta con ese correo. Ingresa con tu método actual para vincular Apple.",
        statusCode: 409,
      };
    }

    logAppleStage(requestId, "completeNewAccountAfterExchange:creatingUser", {});

    const created = await this.identitiesRepository.createUserWithIdentity({
      email,
      name: buildName(payload.name, email),
      role: payload.role,
      status: roleInitialStatus(payload.role),
      isVerified: identityClaims.emailVerified,
      provider: PROVIDER,
      providerUserId: identityClaims.sub,
      providerClientId: identityClaims.aud,
      providerEmail: email,
      providerEmailVerified: identityClaims.emailVerified,
      providerIsPrivateEmail: identityClaims.isPrivateEmail,
      encryptedRefreshToken,
    });

    if (!created) {
      logAppleStage(requestId, "completeNewAccountAfterExchange:creationRace", {});

      const identity =
        await this.identitiesRepository.findByProviderAndSub(
          PROVIDER,
          identityClaims.sub,
        );

      if (!identity) {
        throw AppError.internal(
          "OAuth identity creation race could not be resolved.",
        );
      }

      const winnerUser = await this.usersRepository.findById(identity.userId);
      if (!winnerUser) {
        return {
          ok: false,
          code: "UNAUTHORIZED",
          message: "La cuenta asociada a Apple no existe.",
          statusCode: 401,
        };
      }

      if (
        winnerUser.status === "suspended" ||
        winnerUser.status === "banned" ||
        winnerUser.status === "deleted"
      ) {
        return {
          ok: false,
          code: "AUTH_ACCOUNT_SUSPENDED",
          message: "Esta cuenta está bloqueada.",
          statusCode: 403,
        };
      }

      return this.completeExistingUserSignIn(
        winnerUser,
        identity.id,
        encryptedRefreshToken,
        identityClaims.aud,
      );
    }

    logAppleStage(requestId, "completeNewAccountAfterExchange:userCreated", {
      userId: created.user.id,
    });

    if (payload.role === "passenger") {
      if (!passengerSetup) {
        throw AppError.internal(
          "Passenger account created without validated setup.",
        );
      }

      try {
        await this.persistPassengerSetup(
          created.user.id,
          passengerSetup,
          metadata,
        );
        logAppleStage(
          requestId,
          "completeNewAccountAfterExchange:passengerSetupPersisted",
          { userId: created.user.id },
        );
      } catch (error) {
        logAppleStage(
          requestId,
          "completeNewAccountAfterExchange:passengerSetupPersistenceFailed",
          {
            userId: created.user.id,
            errorName: error instanceof Error ? error.name : "UNKNOWN",
            code: error instanceof AppError ? error.code : null,
          },
        );
        this.auditService.recordSafe({
          eventType: "auth.apple.register.failure",
          entityType: "user",
          entityId: created.user.id,
          actorUserId: created.user.id,
          metadata: { reason: "passenger_setup_persistence_failed" },
        });

        try {
          await db.delete(users).where(eq(users.id, created.user.id));
        } catch {
          // La auditoría anterior deja evidencia para reparación administrativa.
        }

        throw error;
      }
    }

    const session = await this.issueSession(created.user);

    logAppleStage(requestId, "completeNewAccountAfterExchange:sessionIssued", {
      userId: created.user.id,
    });

    this.auditService.recordSafe({
      eventType: "auth.apple.register.success",
      entityType: "user",
      entityId: created.user.id,
      actorUserId: created.user.id,
      metadata: {
        role: created.user.role,
        isPrivateEmail: identityClaims.isPrivateEmail,
        passengerFareType:
          passengerSetup?.requestedFareType ?? null,
      },
    });

    return {
      ok: true,
      session: {
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
        user: session.authUser,
      },
      refreshToken: session.refreshToken,
    };
  }

  private async persistPassengerSetup(
    userId: string,
    setup: PassengerSetup,
    metadata?: AppleRequestMetadata,
  ): Promise<void> {
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(passengerProfiles).values({
        userId,
        phone: setup.phone,
        rut: setup.rut,
        requestedFareType: setup.requestedFareType,
        effectiveFareType: setup.requestedFareType,
        residenceVerificationStatus:
          setup.requestedFareType === "resident"
            ? "pending"
            : "not_required",
        residenceRequestedAt:
          setup.requestedFareType === "resident" ? now : null,
        updatedAt: now,
      });

      if (
        setup.requestedFareType === "resident" &&
        setup.storedResidenceAccreditation
      ) {
        await tx.insert(userDocuments).values({
          userId,
          documentType: RESIDENCE_DOCUMENT_TYPE,
          status: "uploaded",
          fileUrl: setup.storedResidenceAccreditation,
          rejectionReason: null,
          uploadedAt: now,
          reviewedAt: null,
          createdAt: now,
          updatedAt: now,
        });
      }

      await tx.insert(userAcceptances).values(
        setup.legalDocumentsToAccept.map((document) => ({
          userId,
          legalDocumentId: document.id,
          versionAccepted: document.version,
          ...buildLegalAcceptanceEvidence(
            document,
            "apple",
          ),
          ipAddress: metadata?.ipAddress ?? null,
          userAgent: metadata?.userAgent ?? null,
          acceptedAt: now,
        })),
      );
    });
  }
}
