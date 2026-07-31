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
import { AuditService } from "../audit/audit.service.js";
import { buildLegalAcceptanceEvidence } from "../legal/legalEvidence.js";
import { UsersRepository } from "../users/users.repository.js";
import { OAuthIdentitiesRepository } from "./oauthIdentities.repository.js";
import { SessionService } from "./session.service.js";
import { TokenService } from "./token.service.js";
import type { AuthUser } from "./auth.types.js";
import type {
  GoogleAuthRequest,
  GoogleAuthResult,
  GooglePassengerFareType,
} from "./googleAuth.types.js";
import {
  GoogleIdentityTokenVerifier,
  type VerifiedGoogleIdentity,
} from "./googleIdentityToken.verifier.js";

const PROVIDER = "google";
const REQUIRED_LEGAL_TYPES = [
  "terms_and_conditions",
  "privacy_policy",
  "user_conditions",
] as const;
const RESIDENCE_DOCUMENT_TYPE = "rapa_nui_residence";
const RESIDENCE_DOCUMENT_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);
const RESIDENCE_META_MARKER = "#rapagoMeta=";

type GoogleRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};

type PassengerSetup = {
  phone: string;
  requestedFareType: GooglePassengerFareType;
  legalDocumentsToAccept: Array<typeof legalDocuments.$inferSelect>;
  storedResidenceAccreditation: string | null;
};

function toUserRole(raw: string): UserRole {
  return raw as UserRole;
}

function normalizePhone(value: string | undefined): string {
  return String(value ?? "")
    .replace(/[^+\d]/g, "")
    .trim()
    .slice(0, 16);
}

function isValidPhone(value: string): boolean {
  return /^\+?[0-9]{8,15}$/.test(value);
}

function normalizeFareType(
  value: GooglePassengerFareType | undefined,
): GooglePassengerFareType | null {
  return value === "resident" || value === "chilean" || value === "foreigner"
    ? value
    : null;
}

function normalizeRut(value: string | undefined): string {
  return String(value ?? "")
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim()
    .toUpperCase();
}

function isValidRut(value: string): boolean {
  if (!/^\d{7,8}[0-9K]$/.test(value)) return false;

  const body = value.slice(0, -1);
  const dv = value.slice(-1);
  let sum = 0;
  let multiplier = 2;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const expectedNumber = 11 - (sum % 11);
  const expectedDv =
    expectedNumber === 11
      ? "0"
      : expectedNumber === 10
        ? "K"
        : String(expectedNumber);

  return dv === expectedDv;
}

function normalizePassport(value: string | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function isValidPassport(value: string): boolean {
  const clean = value.replace(/-/g, "");
  return clean.length >= 5 && clean.length <= 15;
}

function validateResidenceAccreditation(
  input: NonNullable<GoogleAuthRequest["residenceAccreditation"]>,
  rut: string,
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

  if (
    bytes.length === 0 ||
    bytes.length > RESIDENCE_DOCUMENT_MAX_BYTES ||
    bytes.length !== input.documentSize
  ) {
    return {
      ok: false,
      message: "La acreditación está vacía, incompleta o supera 1.5 MB.",
    };
  }

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
      message: "La acreditación no contiene un archivo válido.",
    };
  }

  const safeName = input.documentName
    .replace(/[\\/<>:"'|?*{}()[\];]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 90) || "acreditacion-residencia";
  const metadata = Buffer.from(
    JSON.stringify({
      version: 1,
      provider: PROVIDER,
      documentName: safeName,
      documentType: input.documentType,
      uploadedAt: new Date().toISOString(),
      rut,
    }),
  ).toString("base64url");

  return {
    ok: true,
    storedDataUrl: `${input.documentDataUrl.trim()}${RESIDENCE_META_MARKER}${metadata}`,
  };
}

export class GoogleAuthService {
  constructor(
    private readonly usersRepository = new UsersRepository(),
    private readonly identitiesRepository = new OAuthIdentitiesRepository(),
    private readonly auditService = new AuditService(),
    private readonly identityVerifier = new GoogleIdentityTokenVerifier(),
    private readonly tokenService = new TokenService(),
    private readonly sessionService = new SessionService(),
  ) {}

  async signIn(
    payload: GoogleAuthRequest,
    metadata?: GoogleRequestMetadata,
  ): Promise<GoogleAuthResult> {
    const identity = await this.identityVerifier.verify(payload.idToken);
    const existing = await this.identitiesRepository.findByProviderAndSub(
      PROVIDER,
      identity.sub,
    );

    if (existing) {
      return this.signInExisting(
        identity,
        existing.userId,
        existing.id,
      );
    }

    const prepared = await this.preparePassengerSetup(payload, identity.email);
    if (!prepared.ok) return prepared.result;

    const emailOwner = await this.usersRepository.findByEmail(identity.email);
    if (emailOwner) {
      this.auditService.recordSafe({
        eventType: "auth.google.login.conflict",
        entityType: "user",
        entityId: emailOwner.id,
        metadata: { reason: "email_taken" },
      });

      return {
        ok: false,
        code: "AUTH_GOOGLE_ACCOUNT_LINKING_REQUIRED",
        message:
          "Ya existe una cuenta con ese correo. Ingresa con tu método actual antes de vincular Google.",
        statusCode: 409,
      };
    }

    const created = await this.identitiesRepository.createUserWithIdentity({
      email: identity.email,
      name: identity.name,
      role: "passenger",
      status: "active",
      isVerified: true,
      provider: PROVIDER,
      providerUserId: identity.sub,
      providerClientId: identity.aud,
      providerEmail: identity.email,
      providerEmailVerified: true,
      providerIsPrivateEmail: false,
      encryptedRefreshToken: undefined,
    });

    if (!created) {
      const winner = await this.identitiesRepository.findByProviderAndSub(
        PROVIDER,
        identity.sub,
      );

      if (!winner) {
        throw AppError.internal(
          "Google identity creation race could not be resolved.",
        );
      }

      return this.signInExisting(
        identity,
        winner.userId,
        winner.id,
      );
    }

    try {
      await this.persistPassengerSetup(
        created.user.id,
        prepared.setup,
        metadata,
      );
    } catch (error) {
      this.auditService.recordSafe({
        eventType: "auth.google.register.failure",
        entityType: "user",
        entityId: created.user.id,
        actorUserId: created.user.id,
        metadata: { reason: "passenger_setup_persistence_failed" },
      });

      try {
        await db.delete(users).where(eq(users.id, created.user.id));
      } catch {
        // La auditoría anterior mantiene evidencia para reparación manual.
      }

      throw error;
    }

    const session = await this.issueSession(created.user);

    this.auditService.recordSafe({
      eventType: "auth.google.register.success",
      entityType: "user",
      entityId: created.user.id,
      actorUserId: created.user.id,
      metadata: {
        role: "passenger",
        passengerFareType: prepared.setup.requestedFareType,
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

  private async preparePassengerSetup(
    payload: GoogleAuthRequest,
    displayEmail: string,
  ): Promise<
    | { ok: true; setup: PassengerSetup }
    | { ok: false; result: Extract<GoogleAuthResult, { ok: false }> }
  > {
    const phone = normalizePhone(payload.phone);
    const requestedFareType = normalizeFareType(payload.passengerFareType);

    if (!isValidPhone(phone) || !requestedFareType) {
      return {
        ok: false,
        result: {
          ok: false,
          code: "AUTH_GOOGLE_SETUP_REQUIRED",
          message:
            "Completa tu celular, categoría de pasajero y documentos legales para crear la cuenta con Google.",
          statusCode: 409,
          displayEmail,
        },
      };
    }

    if (payload.rut && payload.passport) {
      return {
        ok: false,
        result: {
          ok: false,
          code: "AUTH_GOOGLE_SETUP_REQUIRED",
          message: "No debes enviar RUT y pasaporte al mismo tiempo.",
          statusCode: 409,
          displayEmail,
        },
      };
    }

    const rut = normalizeRut(payload.rut);
    const passport = normalizePassport(payload.passport);

    if (requestedFareType === "resident" || requestedFareType === "chilean") {
      if (!payload.rut || !isValidRut(rut) || payload.passport) {
        return {
          ok: false,
          result: {
            ok: false,
            code: "AUTH_GOOGLE_SETUP_REQUIRED",
            message: "Ingresa un RUT válido para continuar con Google.",
            statusCode: 409,
            displayEmail,
          },
        };
      }
    }

    if (requestedFareType === "foreigner") {
      if (!payload.passport || !isValidPassport(passport) || payload.rut) {
        return {
          ok: false,
          result: {
            ok: false,
            code: "AUTH_GOOGLE_SETUP_REQUIRED",
            message: "Ingresa un pasaporte válido para continuar con Google.",
            statusCode: 409,
            displayEmail,
          },
        };
      }
    }

    let legalDocumentsToAccept: Array<typeof legalDocuments.$inferSelect>;

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
            displayEmail,
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
            displayEmail,
          },
        };
      }

      const validated = validateResidenceAccreditation(
        payload.residenceAccreditation,
        rut,
      );

      if (!validated.ok) {
        return {
          ok: false,
          result: {
            ok: false,
            code: "AUTH_RESIDENCE_ACCREDITATION_INVALID",
            message: validated.message,
            statusCode: 400,
            displayEmail,
          },
        };
      }

      storedResidenceAccreditation = validated.storedDataUrl;
    }

    return {
      ok: true,
      setup: {
        phone,
        requestedFareType,
        legalDocumentsToAccept,
        storedResidenceAccreditation,
      },
    };
  }

  private async validateLegalAcceptances(
    payload: GoogleAuthRequest,
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
            "Debes aceptar Términos, Privacidad y Condiciones para Usuarios antes de crear la cuenta con Google.",
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

  private async signInExisting(
    identity: VerifiedGoogleIdentity,
    userId: string,
    identityId: string,
  ): Promise<GoogleAuthResult> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "La cuenta asociada a Google no existe.",
        statusCode: 401,
      };
    }

    if (
      user.status === "suspended" ||
      user.status === "banned" ||
      user.status === "deleted"
    ) {
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

    await this.identitiesRepository.updateProviderCredentials(
      identityId,
      identity.aud,
    );

    const session = await this.issueSession(user);

    this.auditService.recordSafe({
      eventType: "auth.google.login.success",
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

  private async persistPassengerSetup(
    userId: string,
    setup: PassengerSetup,
    metadata?: GoogleRequestMetadata,
  ): Promise<void> {
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(passengerProfiles).values({
        userId,
        phone: setup.phone,
        requestedFareType: setup.requestedFareType,
        effectiveFareType: setup.requestedFareType,
        residenceVerificationStatus:
          setup.requestedFareType === "resident" ? "pending" : "not_required",
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
          ...buildLegalAcceptanceEvidence(document, "google"),
          ipAddress: metadata?.ipAddress ?? null,
          userAgent: metadata?.userAgent ?? null,
          acceptedAt: now,
        })),
      );
    });
  }
}
