import type {
  LoginRequest,
  RegisterRequest,
  AuthServiceResult,
  AuthUser,
  FacebookLoginPreparationResult,
  AuthActionResult,
  FacebookLinkStartResult,
} from "./auth.types.js";
import { UsersService } from "../users/users.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";
import { SessionService } from "./session.service.js";
import { AuthCredentialsRepository } from "./authCredentials.repository.js";
import { FacebookLoginExchangeRepository } from "./facebookLoginExchange.repository.js";
import { AuthIdentitiesRepository } from "./authIdentities.repository.js";
import { MailService } from "./mail.service.js";
import { AuditService } from "../audit/audit.service.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { UserRole } from "@rapa-go/shared";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  authCredentials,
  passengerProfiles,
  userAcceptances,
  userDocuments,
  users,
} from "../../db/schema/index.js";
import type {
  FacebookAccountSetupInput,
  FacebookResidentPrecheckInput,
  FacebookResidentStatusInput,
} from "./auth.schemas.js";
import {
  validateRequiredRegistrationLegalAcceptances,
} from "./registrationLegal.service.js";
import { buildLegalAcceptanceEvidence } from "../legal/legalEvidence.js";

function toUserRole(raw: string): UserRole {
  return raw as UserRole;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const usersRepository = new UsersRepository();
const usersService = new UsersService();
const passwordService = new PasswordService();
const tokenService = new TokenService();
const sessionService = new SessionService();
const credentialsRepo = new AuthCredentialsRepository();
const auditService = new AuditService();
const facebookLoginExchangeRepo = new FacebookLoginExchangeRepository();
const authIdentitiesRepo = new AuthIdentitiesRepository();
const mailService = new MailService();

function roleInitialStatus(role: UserRole): "active" | "pending" {
  return role === "passenger" ? "active" : "pending";
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const directCode =
    "code" in error ? String(error.code) : "";
  const cause = "cause" in error ? error.cause : undefined;
  const causeCode =
    cause && typeof cause === "object" && "code" in cause
      ? String(cause.code)
      : "";

  return directCode === "23505" || causeCode === "23505";
}

const FACEBOOK_RESIDENT_DOCUMENT_TYPE = "rapa_nui_residence";
const FACEBOOK_RESIDENT_DOCUMENT_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);
const FACEBOOK_RESIDENT_META_MARKER = "#rapagoMeta=";

type FacebookResidentVerificationStatus =
  | "missing"
  | "pending"
  | "approved"
  | "rejected";

type FacebookResidentDocumentMetadata = {
  version: 1;
  phone: string;
  rut: string;
  provider: "facebook" | "email";
  documentName: string;
  documentType: string;
  uploadedAt: string;
};

type FacebookResidentStatusResult = {
  ok: true;
  status: FacebookResidentVerificationStatus;
  message: string;
  userId?: string;
  documentId?: string;
  rejectionReason?: string | null;
};

type FacebookResidentPrecheckResult =
  | (FacebookResidentStatusResult & {
      status: "pending" | "approved";
      userId: string;
      documentId: string;
    })
  | {
      ok: false;
      code: string;
      message: string;
      statusCode: number;
    };

function normalizeResidentRut(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^0-9K]/g, "");
}

function stripResidentDocumentMetadata(value: string): string {
  const markerIndex = value.indexOf(FACEBOOK_RESIDENT_META_MARKER);
  return markerIndex >= 0 ? value.slice(0, markerIndex) : value;
}

function parseResidentDocumentMetadata(
  value: string | null | undefined,
): FacebookResidentDocumentMetadata | null {
  const raw = String(value ?? "");
  const markerIndex = raw.indexOf(FACEBOOK_RESIDENT_META_MARKER);

  if (markerIndex < 0) return null;

  try {
    const encoded = raw.slice(
      markerIndex + FACEBOOK_RESIDENT_META_MARKER.length,
    );
    const parsed = JSON.parse(
      decodeURIComponent(encoded),
    ) as Partial<FacebookResidentDocumentMetadata>;

    if (
      parsed.version !== 1 ||
      (parsed.provider !== "facebook" && parsed.provider !== "email") ||
      typeof parsed.rut !== "string"
    ) {
      return null;
    }

    return {
      version: 1,
      phone: String(parsed.phone ?? ""),
      rut: parsed.rut,
      provider: parsed.provider,
      documentName: String(parsed.documentName ?? "documento-residencia"),
      documentType: String(parsed.documentType ?? "application/octet-stream"),
      uploadedAt: String(parsed.uploadedAt ?? ""),
    };
  } catch {
    return null;
  }
}

function hasExpectedDocumentSignature(
  bytes: Buffer,
  mimeType: string,
): boolean {
  if (mimeType === "application/pdf") {
    return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  }

  if (mimeType === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }

  if (mimeType === "image/png") {
    const signature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    return (
      bytes.length >= signature.length &&
      bytes.subarray(0, signature.length).equals(signature)
    );
  }

  if (mimeType === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}

function validateResidentDocumentDataUrl(input: {
  documentDataUrl: string;
  documentType: string;
  documentSize: number;
}): { ok: true; dataUrl: string } | {
  ok: false;
  message: string;
} {
  const dataUrl = stripResidentDocumentMetadata(
    input.documentDataUrl.trim(),
  );

  const match = dataUrl.match(
    /^data:(application\/pdf|image\/jpeg|image\/png|image\/webp);base64,([A-Za-z0-9+/=\r\n]+)$/i,
  );

  if (!match) {
    return {
      ok: false,
      message: "El documento debe ser PDF, JPG, PNG o WEBP.",
    };
  }

  const mimeType = String(match[1] ?? "").toLowerCase();
  const requestedType = input.documentType.toLowerCase();

  if (mimeType !== requestedType) {
    return {
      ok: false,
      message: "El tipo real del documento no coincide con el archivo enviado.",
    };
  }

  const base64Payload = String(match[2] ?? "").replace(/\s+/g, "");

  let decodedBuffer: Buffer;

  try {
    decodedBuffer = Buffer.from(base64Payload, "base64");
  } catch {
    return {
      ok: false,
      message: "No se pudo leer el documento enviado.",
    };
  }

  const decodedBytes = decodedBuffer.byteLength;

  if (!hasExpectedDocumentSignature(decodedBuffer, mimeType)) {
    return {
      ok: false,
      message:
        "El contenido real del archivo no corresponde a un PDF o imagen permitida.",
    };
  }

  if (
    decodedBytes <= 0 ||
    decodedBytes > FACEBOOK_RESIDENT_DOCUMENT_MAX_BYTES ||
    input.documentSize > FACEBOOK_RESIDENT_DOCUMENT_MAX_BYTES
  ) {
    return {
      ok: false,
      message: "El documento supera el máximo de 1.5 MB.",
    };
  }

  const toleratedDifference = Math.max(
    2048,
    Math.ceil(input.documentSize * 0.02),
  );

  if (Math.abs(decodedBytes - input.documentSize) > toleratedDifference) {
    return {
      ok: false,
      message: "El tamaño del documento no coincide con el archivo enviado.",
    };
  }

  return {
    ok: true,
    dataUrl,
  };
}

function attachResidentDocumentMetadata(
  dataUrl: string,
  metadata: FacebookResidentDocumentMetadata,
): string {
  return `${stripResidentDocumentMetadata(dataUrl)}${FACEBOOK_RESIDENT_META_MARKER}${encodeURIComponent(
    JSON.stringify(metadata),
  )}`;
}

function mapResidentDocumentStatus(
  status: string | null | undefined,
): FacebookResidentVerificationStatus {
  const normalized = String(status ?? "").trim().toLowerCase();

  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  if (
    normalized === "pending" ||
    normalized === "uploaded" ||
    normalized === "under_review"
  ) {
    return "pending";
  }

  return "missing";
}

async function findLatestFacebookResidentDocument(
  userId: string,
): Promise<typeof userDocuments.$inferSelect | null> {
  const rows = await db
    .select()
    .from(userDocuments)
    .where(
      and(
        eq(userDocuments.userId, userId),
        eq(userDocuments.documentType, FACEBOOK_RESIDENT_DOCUMENT_TYPE),
      ),
    )
    .orderBy(desc(userDocuments.updatedAt))
    .limit(1);

  return rows[0] ?? null;
}

function residentStatusMessage(
  status: FacebookResidentVerificationStatus,
  rejectionReason?: string | null,
): string {
  if (status === "approved") {
    return "Tu acreditación RAPA NUI / RESIDENTE RAPA NUI fue aprobada y la categoría se mantiene activa.";
  }

  if (status === "rejected") {
    return rejectionReason?.trim()
      ? `Tu acreditación fue rechazada. Motivo: ${rejectionReason.trim()}. El administrador actualizó tu categoría tarifaria.`
      : "Tu acreditación fue rechazada y el administrador actualizó tu categoría tarifaria.";
  }

  if (status === "pending") {
    return "Tu acreditación fue enviada al administrador. La categoría RAPA NUI / RESIDENTE RAPA NUI permanece activa durante la revisión.";
  }

  return "Todavía no existe una acreditación RAPA NUI / RESIDENTE RAPA NUI para este correo.";
}


type PassengerFareType = "resident" | "chilean" | "foreigner";
type ResidenceVerificationStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";

function normalizePassengerFareType(
  value: unknown,
): PassengerFareType {
  if (value === "resident") return "resident";
  if (value === "foreigner") return "foreigner";
  return "chilean";
}

function effectivePassengerFareType(
  requested: PassengerFareType,
  status: ResidenceVerificationStatus,
  currentEffective?: string | null,
): PassengerFareType {
  if (requested !== "resident") return requested;
  if (status !== "rejected") return "resident";

  return currentEffective === "foreigner" ? "foreigner" : "chilean";
}

export async function upsertPassengerFareProfile(input: {
  userId: string;
  phone?: string | null | undefined;
  requestedFareType: PassengerFareType;
  verificationStatus: ResidenceVerificationStatus;
}): Promise<typeof passengerProfiles.$inferSelect> {
  const currentProfile = await findPassengerFareProfile(input.userId);
  const effectiveFareType = effectivePassengerFareType(
    input.requestedFareType,
    input.verificationStatus,
    currentProfile?.effectiveFareType,
  );
  const now = new Date();

  const rows = await db
    .insert(passengerProfiles)
    .values({
      userId: input.userId,
      phone: input.phone?.trim() || null,
      requestedFareType: input.requestedFareType,
      effectiveFareType,
      residenceVerificationStatus: input.verificationStatus,
      residenceRequestedAt:
        input.requestedFareType === "resident" ? now : null,
      residenceReviewedAt:
        input.verificationStatus === "approved" ||
        input.verificationStatus === "rejected"
          ? now
          : null,
      residenceRejectionReason: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: passengerProfiles.userId,
      set: {
        ...(input.phone !== undefined
          ? { phone: input.phone?.trim() || null }
          : {}),
        requestedFareType: input.requestedFareType,
        effectiveFareType,
        residenceVerificationStatus: input.verificationStatus,
        residenceRequestedAt:
          input.requestedFareType === "resident" ? now : null,
        residenceReviewedAt:
          input.verificationStatus === "approved" ||
          input.verificationStatus === "rejected"
            ? now
            : null,
        residenceRejectionReason: null,
        updatedAt: now,
      },
    })
    .returning();

  const profile = rows[0];

  if (!profile) {
    throw AppError.internal(
      "No se pudo guardar la categoría tarifaria del pasajero.",
    );
  }

  return profile;
}

async function findPassengerFareProfile(
  userId: string,
): Promise<typeof passengerProfiles.$inferSelect | null> {
  const rows = await db
    .select()
    .from(passengerProfiles)
    .where(eq(passengerProfiles.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function buildAuthUser(
  user: typeof users.$inferSelect,
): Promise<AuthUser> {
  const [profile, credentials, externalProviders] = await Promise.all([
    findPassengerFareProfile(user.id),
    credentialsRepo.findByUserId(user.id),
    authIdentitiesRepo.listActiveProviders(user.id),
  ]);

  const authProviders = [
    ...(credentials ? (["password"] as const) : []),
    ...externalProviders,
  ];

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: toUserRole(user.role),
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
    authProviders,
    hasPassword: Boolean(credentials),
    ...(profile?.phone ? { phone: profile.phone } : {}),
    ...(profile
      ? {
          requestedPassengerFareType: normalizePassengerFareType(
            profile.requestedFareType,
          ),
          passengerFareType: normalizePassengerFareType(
            profile.effectiveFareType,
          ),
          residenceVerificationStatus:
            profile.residenceVerificationStatus as ResidenceVerificationStatus,
        }
      : {}),
  };
}

async function reactivatePassengerResidenceAccount(
  user: typeof users.$inferSelect,
): Promise<typeof users.$inferSelect> {
  if (user.role !== "passenger" || user.status !== "pending") {
    return user;
  }

  const profile = await findPassengerFareProfile(user.id);
  const status = String(
    profile?.residenceVerificationStatus ?? "",
  ).toLowerCase();

  if (!["pending", "approved", "rejected"].includes(status)) {
    return user;
  }

  const rows = await db
    .update(users)
    .set({
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning();

  return rows[0] ?? user;
}

export async function authenticateActiveAccessToken(
  accessToken: string,
): Promise<
  | { ok: true; user: typeof users.$inferSelect }
  | {
      ok: false;
      code: string;
      message: string;
      statusCode: number;
    }
> {
  if (!accessToken) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Falta el token de acceso.",
      statusCode: 401,
    };
  }

  let payload;

  try {
    payload = tokenService.verifyAccessToken(accessToken);
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

  const sessionValid = await sessionService.isSessionValid(
    tokenService.hashToken(accessToken),
  );

  if (!sessionValid) {
    return {
      ok: false,
      code: "AUTH_SESSION_REVOKED",
      message: "La sesión fue cerrada.",
      statusCode: 401,
    };
  }

  const user = await usersRepository.findById(payload.sub);

  if (!user || user.status !== "active") {
    return {
      ok: false,
      code: user?.status === "deleted"
        ? "AUTH_ACCOUNT_DELETED"
        : "AUTH_ACCOUNT_UNAVAILABLE",
      message: user?.status === "deleted"
        ? "Esta cuenta fue eliminada."
        : "La cuenta no está habilitada.",
      statusCode: 403,
    };
  }

  return { ok: true, user };
}

export class AuthService {
  async register(
    payload: RegisterRequest,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthServiceResult> {
    if (payload.role !== "passenger") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message:
          "Solo las cuentas de pasajero pueden registrarse públicamente. Los conductores y prestadores deben usar el flujo de postulación.",
        statusCode: 403,
      };
    }

    const email = payload.email.toLowerCase().trim();

    try {
      const existing = await usersRepository.findByEmail(email);
      if (existing) {
        return {
          ok: false,
          code: "AUTH_EMAIL_TAKEN",
          message: "Email address is already registered.",
          statusCode: 409,
        };
      }

      const legalDocumentsToAccept =
        await validateRequiredRegistrationLegalAcceptances(
          payload.legalAcceptances,
        );
      const passwordHash = await passwordService.hashPassword(
        payload.password,
      );
      const requestedFareType = normalizePassengerFareType(
        payload.passengerFareType,
      );
      const verificationStatus: ResidenceVerificationStatus =
        requestedFareType === "resident"
          ? "pending"
          : "not_required";
      const effectiveFareType = requestedFareType;
      const now = new Date();

      let storedResidenceAccreditation: string | null = null;
      let residenceAccreditationMetadata:
        | FacebookResidentDocumentMetadata
        | null = null;

      if (requestedFareType === "resident") {
        const accreditation = payload.residenceAccreditation;

        if (!accreditation) {
          return {
            ok: false,
            code: "AUTH_RESIDENCE_ACCREDITATION_REQUIRED",
            message: "Debes adjuntar tu acreditación de residencia para continuar.",
            statusCode: 400,
          };
        }

        const documentValidation = validateResidentDocumentDataUrl({
          documentDataUrl: accreditation.documentDataUrl,
          documentType: accreditation.documentType,
          documentSize: accreditation.documentSize,
        });

        if (!documentValidation.ok) {
          return {
            ok: false,
            code: "AUTH_RESIDENCE_ACCREDITATION_INVALID",
            message: documentValidation.message,
            statusCode: 400,
          };
        }

        residenceAccreditationMetadata = {
          version: 1,
          phone: payload.phone?.trim() ?? "",
          rut: normalizeResidentRut(payload.rut),
          provider: "email",
          documentName: accreditation.documentName.trim(),
          documentType: accreditation.documentType,
          uploadedAt: now.toISOString(),
        };
        storedResidenceAccreditation = attachResidentDocumentMetadata(
          documentValidation.dataUrl,
          residenceAccreditationMetadata,
        );
      }

      const user = await db.transaction(async (tx) => {
        const userRows = await tx
          .insert(users)
          .values({
            email,
            name: payload.name,
            role: payload.role,
            status: roleInitialStatus(payload.role),
          })
          .returning();
        const createdUser = userRows[0];

        if (!createdUser) {
          throw AppError.internal("User insert returned no rows.");
        }

        await tx.insert(authCredentials).values({
          userId: createdUser.id,
          passwordHash,
          passwordUpdatedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: now,
        });

        await tx.insert(passengerProfiles).values({
          userId: createdUser.id,
          phone: payload.phone ?? null,
          requestedFareType,
          effectiveFareType,
          residenceVerificationStatus: verificationStatus,
          residenceRequestedAt:
            requestedFareType === "resident" ? now : null,
          updatedAt: now,
        });

        if (
          requestedFareType === "resident" &&
          storedResidenceAccreditation &&
          residenceAccreditationMetadata
        ) {
          await tx.insert(userDocuments).values({
            userId: createdUser.id,
            documentType: FACEBOOK_RESIDENT_DOCUMENT_TYPE,
            status: "uploaded",
            fileUrl: storedResidenceAccreditation,
            rejectionReason: null,
            uploadedAt: now,
            reviewedAt: null,
            createdAt: now,
            updatedAt: now,
          });
        }

        await tx.insert(userAcceptances).values(
          legalDocumentsToAccept.map((document) => ({
            userId: createdUser.id,
            legalDocumentId: document.id,
            versionAccepted: document.version,
            ...buildLegalAcceptanceEvidence(
              document,
              "password",
            ),
            ipAddress: metadata?.ipAddress ?? null,
            userAgent: metadata?.userAgent ?? null,
            acceptedAt: now,
          })),
        );

        return createdUser;
      });

      const authUser = await buildAuthUser(user);
      const accessToken = tokenService.issueAccessToken(authUser);
      const refreshToken = tokenService.issueRefreshToken();

      await sessionService.createSession({
        userId: user.id,
        accessTokenHash: accessToken.hash,
        expiresAt: accessToken.expiresAt,
      });

      await sessionService.createRefreshToken({
        userId: user.id,
        tokenHash: refreshToken.hash,
        expiresAt: refreshToken.expiresAt,
      });

      auditService.recordSafe({
        eventType: "auth.register.success",
        entityType: "user",
        entityId: user.id,
        actorUserId: user.id,
        metadata: {
          role: user.role,
          status: user.status,
          legalVersions: legalDocumentsToAccept.map((document) => ({
            type: document.type,
            version: document.version,
          })),
        },
      });

      return {
        ok: true,
        session: {
          accessToken: accessToken.token,
          expiresAt: accessToken.expiresAt.toISOString(),
          user: authUser,
        },
        refreshToken: refreshToken.token,
      };
    } catch (err) {
      if (
        (err instanceof AppError && err.code === "AUTH_EMAIL_TAKEN") ||
        isUniqueViolation(err)
      ) {
        auditService.recordSafe({
          eventType: "auth.register.failure",
          entityType: "user",
          metadata: { reason: "email_taken", email },
        });

        return {
          ok: false,
          code: "AUTH_EMAIL_TAKEN",
          message: "Email address is already registered.",
          statusCode: 409,
        };
      }

      if (err instanceof AppError) {
        return {
          ok: false,
          code: err.code,
          message: err.message,
          statusCode: err.statusCode,
        };
      }

      auditService.recordSafe({
        eventType: "auth.register.failure",
        entityType: "user",
        metadata: { reason: "internal_error", email },
      });

      throw err;
    }
  }

  async login(payload: LoginRequest): Promise<AuthServiceResult> {
    const email = payload.email.toLowerCase().trim();

    let user = await usersRepository.findByEmail(email);

    if (!user) {
      return {
        ok: false,
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      };
    }

    if (user.status === "deleted") {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_DELETED",
        message: "Esta cuenta fue eliminada.",
        statusCode: 403,
      };
    }

    user = await reactivatePassengerResidenceAccount(user);

    if (user.status === "pending") {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_PENDING",
        message: "Tu cuenta todavía está pendiente de aprobación.",
        statusCode: 403,
      };
    }

    if (user.status === "suspended" || user.status === "banned") {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_SUSPENDED",
        message: "Esta cuenta está bloqueada. Contacta a soporte.",
        statusCode: 403,
      };
    }

    const credentials = await credentialsRepo.findByUserId(user.id);

    if (!credentials) {
      return {
        ok: false,
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      };
    }

    if (credentials.lockedUntil && credentials.lockedUntil > new Date()) {
      auditService.recordSafe({
        eventType: "auth.login.failure",
        entityType: "user",
        entityId: user.id,
        actorUserId: user.id,
        metadata: { reason: "account_locked" },
      });

      return {
        ok: false,
        code: "AUTH_ACCOUNT_LOCKED",
        message: "Account is temporarily locked. Please try again later.",
      };
    }

    const valid = await passwordService.verifyPassword(
      credentials.passwordHash,
      payload.password,
    );

    if (!valid) {
      const updated = await credentialsRepo.incrementFailedAttempts(user.id);

      if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        const until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await credentialsRepo.lockUntil(user.id, until);
      }

      auditService.recordSafe({
        eventType: "auth.login.failure",
        entityType: "user",
        entityId: user.id,
        actorUserId: user.id,
        metadata: {
          reason: "invalid_password",
          attempts: updated.failedLoginAttempts,
        },
      });

      return {
        ok: false,
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      };
    }

    await credentialsRepo.resetFailedAttempts(user.id);

    const authUser = await buildAuthUser(user);

    const accessToken = tokenService.issueAccessToken(authUser);
    const refreshToken = tokenService.issueRefreshToken();

    await sessionService.createSession({
      userId: user.id,
      accessTokenHash: accessToken.hash,
      expiresAt: accessToken.expiresAt,
    });

    await sessionService.createRefreshToken({
      userId: user.id,
      tokenHash: refreshToken.hash,
      expiresAt: refreshToken.expiresAt,
    });

    auditService.recordSafe({
      eventType: "auth.login.success",
      entityType: "user",
      entityId: user.id,
      actorUserId: user.id,
      metadata: { role: user.role },
    });

    return {
      ok: true,
      session: {
        accessToken: accessToken.token,
        expiresAt: accessToken.expiresAt.toISOString(),
        user: authUser,
      },
      refreshToken: refreshToken.token,
    };
  }

  async getFacebookResidentPrecheckStatus(
    input: FacebookResidentStatusInput,
  ): Promise<FacebookResidentStatusResult> {
    const email = input.email.toLowerCase().trim();
    const rut = normalizeResidentRut(input.rut);
    const user = await usersRepository.findByEmail(email);

    if (!user) {
      return {
        ok: true,
        status: "missing",
        message: residentStatusMessage("missing"),
      };
    }

    const document = await findLatestFacebookResidentDocument(user.id);

    if (!document) {
      return {
        ok: true,
        status: "missing",
        message: residentStatusMessage("missing"),
        userId: user.id,
      };
    }

    const metadata = parseResidentDocumentMetadata(document.fileUrl);

    if (
      metadata?.rut &&
      normalizeResidentRut(metadata.rut) !== rut
    ) {
      return {
        ok: true,
        status: "missing",
        message: residentStatusMessage("missing"),
      };
    }

    const status = mapResidentDocumentStatus(document.status);

    return {
      ok: true,
      status,
      message: residentStatusMessage(status, document.rejectionReason),
      userId: user.id,
      documentId: document.id,
      rejectionReason: document.rejectionReason,
    };
  }

  async submitFacebookResidentPrecheck(
    input: FacebookResidentPrecheckInput,
  ): Promise<FacebookResidentPrecheckResult> {
    const email = input.email.toLowerCase().trim();
    const rut = normalizeResidentRut(input.rut);
    const provider = input.provider ?? "facebook";
    const documentValidation = validateResidentDocumentDataUrl(input);

    if (!documentValidation.ok) {
      return {
        ok: false,
        code: "AUTH_RESIDENCE_DOCUMENT_INVALID",
        message: documentValidation.message,
        statusCode: 400,
      };
    }

    let user = await usersRepository.findByEmail(email);

    if (user?.status === "deleted") {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_DELETED",
        message: "Esta cuenta fue eliminada.",
        statusCode: 403,
      };
    }

    if (
      user &&
      (user.status === "suspended" || user.status === "banned")
    ) {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_SUSPENDED",
        message: "Esta cuenta está bloqueada. Contacta a soporte.",
        statusCode: 403,
      };
    }

    if (user?.role === "admin") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Este correo pertenece a una cuenta administrativa.",
        statusCode: 403,
      };
    }

    if (!user) {
      try {
        user = await usersService.createUser({
          email,
          name: "Pasajero Facebook",
          role: "passenger",
          status: "active",
        });
      } catch (error) {
        user = await usersRepository.findByEmail(email);

        if (!user) throw error;
      }
    }

    const existingDocument =
      await findLatestFacebookResidentDocument(user.id);

    if (existingDocument) {
      const existingMetadata = parseResidentDocumentMetadata(
        existingDocument.fileUrl,
      );

      if (
        existingMetadata?.rut &&
        normalizeResidentRut(existingMetadata.rut) !== rut
      ) {
        return {
          ok: false,
          code: "AUTH_RESIDENCE_IDENTITY_MISMATCH",
          message:
            "El RUT no coincide con la solicitud de residencia registrada para este correo.",
          statusCode: 409,
        };
      }

      if (
        mapResidentDocumentStatus(existingDocument.status) === "approved"
      ) {
        return {
          ok: true,
          status: "approved",
          message: residentStatusMessage("approved"),
          userId: user.id,
          documentId: existingDocument.id,
          rejectionReason: null,
        };
      }
    }

    const now = new Date();
    const metadata: FacebookResidentDocumentMetadata = {
      version: 1,
      phone: input.phone.trim(),
      rut,
      provider,
      documentName: input.documentName.trim(),
      documentType: input.documentType,
      uploadedAt: now.toISOString(),
    };
    const storedDocument = attachResidentDocumentMetadata(
      documentValidation.dataUrl,
      metadata,
    );

    let documentId: string;

    if (existingDocument) {
      const rows = await db
        .update(userDocuments)
        .set({
          status: "uploaded",
          fileUrl: storedDocument,
          rejectionReason: null,
          uploadedAt: now,
          reviewedAt: null,
          updatedAt: now,
        })
        .where(eq(userDocuments.id, existingDocument.id))
        .returning({ id: userDocuments.id });

      const updated = rows[0];

      if (!updated) {
        throw AppError.internal(
          "No se pudo actualizar el documento de residencia.",
        );
      }

      documentId = updated.id;
    } else {
      const rows = await db
        .insert(userDocuments)
        .values({
          userId: user.id,
          documentType: FACEBOOK_RESIDENT_DOCUMENT_TYPE,
          status: "uploaded",
          fileUrl: storedDocument,
          rejectionReason: null,
          uploadedAt: now,
          reviewedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: userDocuments.id });

      const created = rows[0];

      if (!created) {
        throw AppError.internal(
          "No se pudo crear el documento de residencia.",
        );
      }

      documentId = created.id;
    }

    if (user.status === "pending" && user.role === "passenger") {
      const activeRows = await db
        .update(users)
        .set({
          status: "active",
          updatedAt: now,
        })
        .where(eq(users.id, user.id))
        .returning();

      user = activeRows[0] ?? user;
    }

    await upsertPassengerFareProfile({
      userId: user.id,
      phone: input.phone,
      requestedFareType: "resident",
      verificationStatus: "pending",
    });

    auditService.recordSafe({
      eventType: "auth.resident_precheck.submitted",
      entityType: "user_document",
      entityId: documentId,
      actorUserId: user.id,
      metadata: {
        provider,
        documentType: FACEBOOK_RESIDENT_DOCUMENT_TYPE,
        userStatus: "active",
        effectiveFareType: "resident",
      },
    });

    return {
      ok: true,
      status: "pending",
      message: residentStatusMessage("pending"),
      userId: user.id,
      documentId,
      rejectionReason: null,
    };
  }

  async loginWithFacebook(
    profile: {
      facebookId: string;
      email: string;
      name: string;
      avatarUrl?: string | null;
    },
  ): Promise<FacebookLoginPreparationResult> {
    const email = profile.email.toLowerCase().trim();
    const identity =
      await authIdentitiesRepo.findActiveByProviderSubject(
        "facebook",
        profile.facebookId,
      );

    let user = identity
      ? await usersRepository.findById(identity.userId)
      : null;

    if (identity && !user) {
      return {
        ok: false,
        code: "AUTH_FACEBOOK_IDENTITY_ORPHANED",
        message:
          "La vinculación de Facebook no está disponible. Contacta a soporte.",
        statusCode: 409,
      };
    }

    if (!identity) {
      const existingByEmail = await usersRepository.findByEmail(email);

      if (existingByEmail) {
        const credentials =
          await credentialsRepo.findByUserId(existingByEmail.id);
        const existingFacebookIdentity =
          await authIdentitiesRepo.findActiveByUserProvider(
            existingByEmail.id,
            "facebook",
          );

        if (existingFacebookIdentity) {
          return {
            ok: false,
            code: "AUTH_FACEBOOK_ALREADY_LINKED",
            message:
              "Esta cuenta RAPA GO ya tiene otra identidad de Facebook vinculada. Ingresa con tu método habitual o contacta a soporte.",
            statusCode: 409,
          };
        }

        if (credentials) {
          const linkCode = await facebookLoginExchangeRepo.create(
            existingByEmail.id,
            "link",
          );

          auditService.recordSafe({
            eventType: "auth.facebook.existing_account_link_required",
            entityType: "user",
            entityId: existingByEmail.id,
            actorUserId: existingByEmail.id,
            metadata: { provider: "facebook" },
          });

          return {
            ok: true,
            kind: "link_existing",
            linkCode,
            email,
            facebookId: profile.facebookId,
            name: profile.name,
            avatarUrl: profile.avatarUrl ?? null,
          };
        }

        user = existingByEmail;

        await authIdentitiesRepo.link({
          userId: user.id,
          provider: "facebook",
          providerSubject: profile.facebookId,
          providerEmail: email,
          emailVerified: true,
        });

        auditService.recordSafe({
          eventType: "auth.facebook.legacy_identity_claimed",
          entityType: "user",
          entityId: user.id,
          actorUserId: user.id,
          metadata: { provider: "facebook" },
        });
      } else {
        user = await usersService.createUser({
          email,
          name: profile.name,
          role: "passenger",
          status: "active",
        });

        await authIdentitiesRepo.link({
          userId: user.id,
          provider: "facebook",
          providerSubject: profile.facebookId,
          providerEmail: email,
          emailVerified: true,
        });

        auditService.recordSafe({
          eventType: "auth.facebook.register.success",
          entityType: "user",
          entityId: user.id,
          actorUserId: user.id,
          metadata: {
            provider: "facebook",
            facebookId: profile.facebookId,
          },
        });
      }
    } else {
      await authIdentitiesRepo.touchLastLogin(identity.id);
    }

    if (!user) {
      throw AppError.internal(
        "Facebook login did not resolve a user.",
      );
    }

    if (user.status === "deleted") {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_DELETED",
        message: "Esta cuenta fue eliminada.",
        statusCode: 403,
      };
    }

    if (user.status === "suspended" || user.status === "banned") {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_SUSPENDED",
        message: "Esta cuenta está bloqueada. Contacta a soporte.",
        statusCode: 403,
      };
    }

    if (!user.avatarUrl && profile.avatarUrl) {
      const rows = await db
        .update(users)
        .set({
          avatarUrl: profile.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();

      user = rows[0] ?? user;
    }

    const passengerProfile = await findPassengerFareProfile(user.id);
    const requestedFareType = String(
      passengerProfile?.requestedFareType ?? "",
    );
    const hasCompletedProfile = Boolean(
      passengerProfile?.phone?.trim() &&
        ["resident", "chilean", "foreigner"].includes(
          requestedFareType,
        ),
    );

    if (!hasCompletedProfile) {
      const setupCode = await facebookLoginExchangeRepo.create(
        user.id,
        "setup",
      );

      auditService.recordSafe({
        eventType: "auth.facebook.setup.required",
        entityType: "user",
        entityId: user.id,
        actorUserId: user.id,
        metadata: { provider: "facebook" },
      });

      return {
        ok: true,
        kind: "setup",
        setupCode,
      };
    }

    user = await reactivatePassengerResidenceAccount(user);

    if (user.status === "pending") {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_PENDING",
        message:
          "Tu cuenta está pendiente de aprobación por el administrador.",
        statusCode: 403,
      };
    }

    const exchangeCode = await facebookLoginExchangeRepo.create(
      user.id,
      "login",
    );

    auditService.recordSafe({
      eventType: "auth.facebook.login.prepared",
      entityType: "user",
      entityId: user.id,
      actorUserId: user.id,
      metadata: {
        provider: "facebook",
        facebookId: profile.facebookId,
      },
    });

    return {
      ok: true,
      kind: "login",
      exchangeCode,
    };
  }

  async completeFacebookAccountSetup(
    input: FacebookAccountSetupInput,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<
    | { ok: true; exchangeCode: string }
    | {
        ok: false;
        code: string;
        message: string;
        statusCode: number;
      }
  > {
    const userId = await facebookLoginExchangeRepo.consume(
      input.setupCode,
      "setup",
    );

    if (!userId) {
      return {
        ok: false,
        code: "AUTH_FACEBOOK_SETUP_INVALID",
        message:
          "La validación de Facebook expiró. Vuelve a presionar Continuar con Facebook.",
        statusCode: 401,
      };
    }

    let user = await usersRepository.findById(userId);

    if (!user) {
      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "Usuario no encontrado.",
        statusCode: 401,
      };
    }

    if (user.status === "deleted") {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_DELETED",
        message: "Esta cuenta fue eliminada.",
        statusCode: 403,
      };
    }

    if (user.status === "suspended" || user.status === "banned") {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_SUSPENDED",
        message: "Esta cuenta está bloqueada. Contacta a soporte.",
        statusCode: 403,
      };
    }

    let legalDocumentsToAccept: Awaited<
      ReturnType<typeof validateRequiredRegistrationLegalAcceptances>
    >;
    try {
      legalDocumentsToAccept =
        await validateRequiredRegistrationLegalAcceptances(
          input.legalAcceptances,
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

    const residentDocument =
      await findLatestFacebookResidentDocument(user.id);
    const residentDocumentStatus = mapResidentDocumentStatus(
      residentDocument?.status,
    );

    if (input.passengerFareType === "resident") {
      if (!residentDocument || residentDocumentStatus === "missing") {
        return {
          ok: false,
          code: "AUTH_RESIDENCE_ACCREDITATION_REQUIRED",
          message: "Debes adjuntar tu acreditación de residencia para continuar.",
          statusCode: 400,
        };
      }

      if (residentDocumentStatus === "rejected") {
        return {
          ok: false,
          code: "AUTH_RESIDENCE_ACCREDITATION_REJECTED",
          message:
            "La acreditación anterior fue rechazada. Adjunta una nueva acreditación para continuar como RAPA NUI / RESIDENTE RAPA NUI.",
          statusCode: 409,
        };
      }

      const verificationStatus: ResidenceVerificationStatus =
        residentDocumentStatus === "approved" ? "approved" : "pending";

      await upsertPassengerFareProfile({
        userId: user.id,
        phone: input.phone,
        requestedFareType: "resident",
        verificationStatus,
      });
    } else {
      await upsertPassengerFareProfile({
        userId: user.id,
        phone: input.phone,
        requestedFareType: input.passengerFareType,
        verificationStatus: "not_required",
      });

      if (
        residentDocument &&
        (residentDocumentStatus === "pending" ||
          residentDocumentStatus === "rejected")
      ) {
        const now = new Date();

        await db
          .update(userDocuments)
          .set({
            status: "withdrawn",
            rejectionReason:
              "El usuario eligió ingresar con otro tipo de pasajero.",
            reviewedAt: now,
            updatedAt: now,
          })
          .where(eq(userDocuments.id, residentDocument.id));
      }
    }

    user = await reactivatePassengerResidenceAccount(user);

    if (user.status !== "active") {
      return {
        ok: false,
        code:
          user.status === "pending"
            ? "AUTH_ACCOUNT_PENDING"
            : "AUTH_ACCOUNT_SUSPENDED",
        message:
          user.status === "pending"
            ? "Tu cuenta todavía está pendiente de aprobación."
            : "Esta cuenta está bloqueada. Contacta a soporte.",
        statusCode: 403,
      };
    }

    const acceptedAt = new Date();

    for (const document of legalDocumentsToAccept) {
      await db
        .insert(userAcceptances)
        .values({
          userId: user.id,
          legalDocumentId: document.id,
          versionAccepted: document.version,
          ...buildLegalAcceptanceEvidence(
            document,
            "facebook",
          ),
          ipAddress: metadata?.ipAddress ?? null,
          userAgent: metadata?.userAgent ?? null,
          acceptedAt,
        })
        .onConflictDoUpdate({
          target: [
            userAcceptances.userId,
            userAcceptances.legalDocumentId,
          ],
          set: {
            versionAccepted: document.version,
            ...buildLegalAcceptanceEvidence(
              document,
              "facebook",
            ),
            ipAddress: metadata?.ipAddress ?? null,
            userAgent: metadata?.userAgent ?? null,
            acceptedAt,
          },
        });
    }

    const exchangeCode = await facebookLoginExchangeRepo.create(
      user.id,
      "login",
    );

    auditService.recordSafe({
      eventType: "auth.facebook.setup.completed",
      entityType: "user",
      entityId: user.id,
      actorUserId: user.id,
      metadata: {
        provider: "facebook",
        passengerFareType: input.passengerFareType,
        legalVersions: legalDocumentsToAccept.map((document) => ({
          type: document.type,
          version: document.version,
        })),
      },
    });

    return { ok: true, exchangeCode };
  }

  async completeFacebookExistingAccountLink(input: {
    linkCode: string;
    email: string;
    facebookId: string;
    name: string;
    avatarUrl?: string | null;
    password: string;
  }): Promise<
    | { ok: true; exchangeCode: string }
    | {
        ok: false;
        code: string;
        message: string;
        statusCode: number;
      }
  > {
    const userId = await facebookLoginExchangeRepo.peek(
      input.linkCode,
      "link",
    );

    if (!userId) {
      return {
        ok: false,
        code: "AUTH_FACEBOOK_LINK_EXPIRED",
        message:
          "La vinculación con Facebook expiró. Vuelve a presionar Continuar con Facebook.",
        statusCode: 401,
      };
    }

    let user = await usersRepository.findById(userId);

    if (!user) {
      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "Usuario no encontrado.",
        statusCode: 401,
      };
    }

    if (user.email.trim().toLowerCase() !== input.email.trim().toLowerCase()) {
      return {
        ok: false,
        code: "AUTH_FACEBOOK_LINK_INVALID",
        message: "La cuenta de Facebook no coincide con la cuenta RAPA GO.",
        statusCode: 409,
      };
    }

    if (user.role === "admin") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Las cuentas administrativas no pueden vincularse desde este flujo.",
        statusCode: 403,
      };
    }

    if (user.status === "deleted") {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_DELETED",
        message: "Esta cuenta fue eliminada.",
        statusCode: 403,
      };
    }

    user = await reactivatePassengerResidenceAccount(user);

    if (user.status === "pending") {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_PENDING",
        message: "Tu cuenta todavía está pendiente de aprobación.",
        statusCode: 403,
      };
    }

    if (user.status === "suspended" || user.status === "banned") {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_SUSPENDED",
        message: "Esta cuenta está bloqueada. Contacta a soporte.",
        statusCode: 403,
      };
    }

    const credentials = await credentialsRepo.findByUserId(user.id);

    if (!credentials) {
      return {
        ok: false,
        code: "AUTH_PASSWORD_NOT_CONFIGURED",
        message:
          "Esta cuenta no tiene contraseña configurada. Ingresa con tu método habitual o contacta a soporte.",
        statusCode: 409,
      };
    }

    if (credentials.lockedUntil && credentials.lockedUntil > new Date()) {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_LOCKED",
        message:
          "La cuenta está bloqueada temporalmente por seguridad. Intenta nuevamente más tarde.",
        statusCode: 423,
      };
    }

    const validPassword = await passwordService.verifyPassword(
      credentials.passwordHash,
      input.password,
    );

    if (!validPassword) {
      const updated = await credentialsRepo.incrementFailedAttempts(user.id);

      if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        const until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await credentialsRepo.lockUntil(user.id, until);
      }

      auditService.recordSafe({
        eventType: "auth.facebook.existing_account_link_failure",
        entityType: "user",
        entityId: user.id,
        actorUserId: user.id,
        metadata: {
          reason: "invalid_password",
          attempts: updated.failedLoginAttempts,
        },
      });

      return {
        ok: false,
        code: "AUTH_INVALID_CREDENTIALS",
        message: "La contraseña de RAPA GO no es correcta.",
        statusCode: 401,
      };
    }

    const consumedUserId = await facebookLoginExchangeRepo.consume(
      input.linkCode,
      "link",
    );

    if (consumedUserId !== user.id) {
      return {
        ok: false,
        code: "AUTH_FACEBOOK_LINK_EXPIRED",
        message:
          "La vinculación con Facebook expiró o ya fue utilizada. Inicia el proceso nuevamente.",
        statusCode: 401,
      };
    }

    try {
      await authIdentitiesRepo.link({
        userId: user.id,
        provider: "facebook",
        providerSubject: input.facebookId,
        providerEmail: input.email,
        emailVerified: true,
      });
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

    await credentialsRepo.resetFailedAttempts(user.id);

    if (!user.avatarUrl && input.avatarUrl) {
      const rows = await db
        .update(users)
        .set({
          avatarUrl: input.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();

      user = rows[0] ?? user;
    }

    const exchangeCode = await facebookLoginExchangeRepo.create(
      user.id,
      "login",
    );

    auditService.recordSafe({
      eventType: "auth.facebook.existing_account_linked",
      entityType: "user",
      entityId: user.id,
      actorUserId: user.id,
      metadata: { provider: "facebook" },
    });

    return { ok: true, exchangeCode };
  }

  async prepareFacebookIdentityLink(
    accessToken: string,
  ): Promise<FacebookLinkStartResult> {
    const auth = await authenticateActiveAccessToken(accessToken);
    if (!auth.ok) return auth;

    const existing =
      await authIdentitiesRepo.findActiveByUserProvider(
        auth.user.id,
        "facebook",
      );

    if (existing) {
      return {
        ok: false,
        code: "AUTH_FACEBOOK_ALREADY_LINKED",
        message: "Facebook ya está vinculado a esta cuenta.",
        statusCode: 409,
      };
    }

    const linkCode = await facebookLoginExchangeRepo.create(
      auth.user.id,
      "link",
    );

    return { ok: true, linkCode };
  }

  async completeFacebookIdentityLink(
    linkCode: string,
    profile: {
      facebookId: string;
      email: string;
      name: string;
    },
  ): Promise<AuthActionResult> {
    const userId = await facebookLoginExchangeRepo.consume(
      linkCode,
      "link",
    );

    if (!userId) {
      return {
        ok: false,
        code: "AUTH_FACEBOOK_LINK_EXPIRED",
        message:
          "La vinculación expiró o ya fue utilizada. Iníciala nuevamente desde Perfil > Seguridad.",
        statusCode: 400,
      };
    }

    const user = await usersRepository.findById(userId);

    if (!user || user.status !== "active") {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_UNAVAILABLE",
        message: "La cuenta no está disponible para vincular Facebook.",
        statusCode: 403,
      };
    }

    try {
      await authIdentitiesRepo.link({
        userId: user.id,
        provider: "facebook",
        providerSubject: profile.facebookId,
        providerEmail: profile.email,
        emailVerified: true,
      });
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

    auditService.recordSafe({
      eventType: "auth.identity.linked",
      entityType: "user",
      entityId: user.id,
      actorUserId: user.id,
      metadata: { provider: "facebook" },
    });

    return {
      ok: true,
      message: "Facebook quedó vinculado correctamente.",
    };
  }

  async createPassword(
    accessToken: string,
    newPassword: string,
  ): Promise<AuthActionResult> {
    const auth = await authenticateActiveAccessToken(accessToken);
    if (!auth.ok) return auth;

    const existing = await credentialsRepo.findByUserId(auth.user.id);

    if (existing) {
      return {
        ok: false,
        code: "AUTH_PASSWORD_ALREADY_SET",
        message:
          "Esta cuenta ya tiene contraseña. Usa Recuperar contraseña para cambiarla.",
        statusCode: 409,
      };
    }

    const passwordHash = await passwordService.hashPassword(newPassword);
    await credentialsRepo.createForUser(auth.user.id, passwordHash);

    auditService.recordSafe({
      eventType: "auth.password.created",
      entityType: "user",
      entityId: auth.user.id,
      actorUserId: auth.user.id,
      metadata: { source: "profile_security" },
    });

    void mailService
      .sendPasswordChangedEmail(auth.user.email)
      .catch(() => {});

    return {
      ok: true,
      message:
        "Contraseña creada. Desde ahora también puedes ingresar con correo y contraseña.",
    };
  }

  async exchangeFacebookLogin(
    exchangeCode: string,
  ): Promise<AuthServiceResult> {
    const userId = await facebookLoginExchangeRepo.consume(exchangeCode);

    if (!userId) {
      return {
        ok: false,
        code: "AUTH_FACEBOOK_EXCHANGE_INVALID",
        message: "El inicio con Facebook expiró o ya fue utilizado.",
        statusCode: 401,
      };
    }

    let user = await usersRepository.findById(userId);

    if (!user) {
      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "Usuario no encontrado.",
        statusCode: 401,
      };
    }

    user = await reactivatePassengerResidenceAccount(user);

    if (user.status !== "active") {
      return {
        ok: false,
        code:
          user.status === "pending"
            ? "AUTH_ACCOUNT_PENDING"
            : user.status === "deleted"
              ? "AUTH_ACCOUNT_DELETED"
              : "AUTH_ACCOUNT_SUSPENDED",
        message:
          user.status === "pending"
            ? "Tu cuenta todavía está pendiente de aprobación."
            : user.status === "deleted"
              ? "Esta cuenta fue eliminada."
              : "Esta cuenta está bloqueada. Contacta a soporte.",
        statusCode: 403,
      };
    }

    const authUser = await buildAuthUser(user);

    const accessToken = tokenService.issueAccessToken(authUser);
    const refreshToken = tokenService.issueRefreshToken();

    await sessionService.createSession({
      userId: user.id,
      accessTokenHash: accessToken.hash,
      expiresAt: accessToken.expiresAt,
    });

    await sessionService.createRefreshToken({
      userId: user.id,
      tokenHash: refreshToken.hash,
      expiresAt: refreshToken.expiresAt,
    });

    auditService.recordSafe({
      eventType: "auth.facebook.login.success",
      entityType: "user",
      entityId: user.id,
      actorUserId: user.id,
      metadata: { provider: "facebook" },
    });

    return {
      ok: true,
      session: {
        accessToken: accessToken.token,
        expiresAt: accessToken.expiresAt.toISOString(),
        user: authUser,
      },
      refreshToken: refreshToken.token,
    };
  }


  async refreshSession(
    rawRefreshToken: string,
  ): Promise<AuthServiceResult> {
    const refreshTokenValue = rawRefreshToken.trim();

    if (!/^[a-f0-9]{96}$/i.test(refreshTokenValue)) {
      return {
        ok: false,
        code: "AUTH_REFRESH_TOKEN_INVALID",
        message: "La sesión no se puede renovar.",
        statusCode: 401,
      };
    }

    const consumed = await sessionService.consumeRefreshToken(
      tokenService.hashToken(refreshTokenValue),
    );

    if (!consumed) {
      return {
        ok: false,
        code: "AUTH_REFRESH_TOKEN_INVALID",
        message: "La sesión expiró o ya fue renovada.",
        statusCode: 401,
      };
    }

    const user = await usersRepository.findById(consumed.userId);

    if (!user) {
      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "Usuario no encontrado.",
        statusCode: 401,
      };
    }

    if (user.status !== "active") {
      await sessionService.revokeAllForUser(user.id);

      return {
        ok: false,
        code:
          user.status === "deleted"
            ? "AUTH_ACCOUNT_DELETED"
            : "AUTH_ACCOUNT_SUSPENDED",
        message:
          user.status === "deleted"
            ? "Esta cuenta fue eliminada."
            : "Esta cuenta no está habilitada.",
        statusCode: user.status === "deleted" ? 401 : 403,
      };
    }

    const authUser = await buildAuthUser(user);
    const accessToken = tokenService.issueAccessToken(authUser);
    const nextRefreshToken = tokenService.issueRefreshToken();

    await sessionService.createSession({
      userId: user.id,
      accessTokenHash: accessToken.hash,
      expiresAt: accessToken.expiresAt,
    });

    await sessionService.createRefreshToken({
      userId: user.id,
      tokenHash: nextRefreshToken.hash,
      expiresAt: nextRefreshToken.expiresAt,
      rotatedFromTokenId: consumed.id,
    });

    auditService.recordSafe({
      eventType: "auth.session.refresh.success",
      entityType: "user",
      entityId: user.id,
      actorUserId: user.id,
      metadata: { rotatedFromTokenId: consumed.id },
    });

    return {
      ok: true,
      session: {
        accessToken: accessToken.token,
        expiresAt: accessToken.expiresAt.toISOString(),
        user: authUser,
      },
      refreshToken: nextRefreshToken.token,
    };
  }

  async logout(accessToken: string): Promise<{ ok: boolean }> {
    if (!accessToken) return { ok: true };

    try {
      const hash = tokenService.hashToken(accessToken);
      await sessionService.revokeSessionByTokenHash(hash);
      return { ok: true };
    } catch {
      return { ok: true };
    }
  }

  async getMe(accessToken: string): Promise<AuthServiceResult> {
    let payload;

    try {
      payload = tokenService.verifyAccessToken(accessToken);
    } catch (err) {
      if (err instanceof AppError) {
        return {
          ok: false,
          code: err.code,
          message: err.message,
        };
      }

      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "Invalid access token.",
      };
    }

    const hash = tokenService.hashToken(accessToken);
    const sessionValid = await sessionService.isSessionValid(hash);

    if (!sessionValid) {
      return {
        ok: false,
        code: "AUTH_SESSION_REVOKED",
        message: "Session has been revoked.",
      };
    }

    const user = await usersRepository.findById(payload.sub);

    if (!user) {
      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "User not found.",
      };
    }

    if (user.status === "deleted") {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_DELETED",
        message: "Esta cuenta fue eliminada.",
        statusCode: 401,
      };
    }

    if (user.status === "suspended" || user.status === "banned") {
      return {
        ok: false,
        code: "AUTH_ACCOUNT_SUSPENDED",
        message: "Account is suspended.",
        statusCode: 403,
      };
    }

    const authUser = await buildAuthUser(user);

    return {
      ok: true,
      session: {
        accessToken,
        expiresAt: new Date((payload.exp ?? 0) * 1000).toISOString(),
        user: authUser,
      },
    };
  }
}