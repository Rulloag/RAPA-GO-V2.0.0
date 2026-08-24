import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { ApplicationsRepository } from "./applications.repository.js";
import { LegalRepository } from "../legal/legal.repository.js";
import { MailService } from "../auth/mail.service.js";
import { buildLegalAcceptanceEvidence } from "../legal/legalEvidence.js";
import {
  generateDriverContractPdf,
  generateLegalDocumentPdf,
} from "./driverContractPdf.service.js";
import { AppError } from "../../shared/errors/AppError.js";
import { resolveProvisionDriverVehicleCategory } from "../drivers/driverProfile.schemas.js";
import { db } from "../../db/client.js";
import {
  authCredentials,
  driverProfiles,
  passengerProfiles,
  userDocuments,
  users,
} from "../../db/schema/index.js";
import type {
  Application,
  NewDriverProfile,
} from "../../db/schema/index.js";
import type {
  CreateApplicationInput,
  ReviewApplicationInput,
  UploadApplicationFileInput,
} from "./applications.schemas.js";
import type {
  ApplicationResponse,
  ApplicationResult,
  ApplicationsListResult,
  CreateApplicationResult,
  ApplicationContractResult,
  ContractDeliveryResult,
} from "./applications.types.js";
import type { UserRole } from "@rapa-go/shared";
import { normalizeRut, rutIdentityKey, validateRut } from "@rapa-go/shared";
import { isApplicationTypeEnabled } from "../../config/features.js";
import {
  resolveApplicationAssetUrl,
  uploadApplicationAsset,
} from "./applicationStorage.service.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepo = new UsersRepository();
const repo = new ApplicationsRepository();
const legalRepo = new LegalRepository();
const mailService = new MailService();

function minutesFromClock(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function isTwelveHourRestWindow(start: string, end: string): boolean {
  const startMinutes = minutesFromClock(start);
  const endMinutes = minutesFromClock(end);
  return (endMinutes - startMinutes + 24 * 60) % (24 * 60) === 12 * 60;
}

function normalizeReviewChecklist(
  checklist:
    | ReviewApplicationInput["reviewChecklist"]
    | Record<string, boolean>
    | null
    | undefined,
): Record<string, boolean> | null {
  if (!checklist) return null;

  const normalized: Record<string, boolean> = {};

  for (const [key, value] of Object.entries(checklist)) {
    if (typeof value === "boolean") {
      normalized[key] = value;
    }
  }

  return normalized;
}

function requiredChecklistApproved(
  checklist: Record<string, boolean> | null | undefined,
): boolean {
  const required = [
    "identity",
    "driverLicense",
    "profilePhoto",
    "vehicle",
    "residence",
    "taxDomicile",
    "restWindow",
  ];

  return required.every((key) => checklist?.[key] === true);
}

type AuthResult =
  | {
      ok: true;
      userId: string;
      role: string;
      email: string;
      name: string;
    }
  | {
      ok: false;
      code: string;
      message: string;
      statusCode: number;
    };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload;

  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (err) {
    if (err instanceof AppError) {
      return {
        ok: false,
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
      };
    }

    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Invalid access token.",
      statusCode: 401,
    };
  }

  const hash = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);

  if (!valid) {
    return {
      ok: false,
      code: "AUTH_SESSION_REVOKED",
      message: "Session has been revoked.",
      statusCode: 401,
    };
  }

  const user = await usersRepo.findById(payload.sub);

  if (!user) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "User not found.",
      statusCode: 404,
    };
  }

  return {
    ok: true,
    userId: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
  };
}


function splitLockedAccountName(name: string): {
  firstName: string;
  lastName: string;
} {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function normalizeLockedPhoneValue(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .replace(/\D/g, "");
}

function resolveLockedRut(
  profileRut: string | null | undefined,
  inputRut: string | null | undefined,
):
  | { ok: true; rut: string }
  | { ok: false; code: string; message: string; statusCode: number } {
  const lockedRaw = String(profileRut ?? "").trim();
  const submittedRaw = String(inputRut ?? "").trim();
  const source = lockedRaw || submittedRaw;

  if (!source) {
    return {
      ok: false,
      code: "PROFILE_IDENTITY_INCOMPLETE",
      message:
        "Tu cuenta no tiene completos el nombre, apellido, correo, teléfono o RUT. Solicita la corrección mediante soporte antes de postular como conductor.",
      statusCode: 409,
    };
  }

  if (!validateRut(source)) {
    return {
      ok: false,
      code: "PROFILE_IDENTITY_INVALID_RUT",
      message:
        "El RUT registrado en tu cuenta no es válido. Solicita la corrección mediante soporte. No se corrige automáticamente.",
      statusCode: 409,
    };
  }

  if (lockedRaw && submittedRaw && rutIdentityKey(lockedRaw) !== rutIdentityKey(submittedRaw)) {
    return {
      ok: false,
      code: "PROFILE_IDENTITY_MISMATCH",
      message:
        "El RUT enviado no coincide con el registrado en tu cuenta. Solicita cualquier corrección mediante soporte.",
      statusCode: 409,
    };
  }

  return { ok: true, rut: normalizeRut(lockedRaw || submittedRaw) };
}

type LockedDriverIdentity = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  rut: string;
  birthDate: string | null;
};

async function resolveLockedDriverIdentity(
  auth: Extract<AuthResult, { ok: true }>,
  input: Extract<CreateApplicationInput, { type: "driver" }>,
): Promise<
  | { ok: true; identity: LockedDriverIdentity }
  | {
      ok: false;
      code: string;
      message: string;
      statusCode: number;
    }
> {
  const rows = await db
    .select()
    .from(passengerProfiles)
    .where(eq(passengerProfiles.userId, auth.userId))
    .limit(1);
  const profile = rows[0] ?? null;
  const names = splitLockedAccountName(auth.name);

  const phone = profile?.phone?.trim() || input.phone.trim();
  const resolvedRut = resolveLockedRut(profile?.rut, input.rut);
  if (!resolvedRut.ok) {
    return resolvedRut;
  }

  const birthDate =
    input.birthDate?.trim() || profile?.birthDate?.trim() || null;

  if (
    !names.firstName ||
    !names.lastName ||
    !auth.email.trim() ||
    !phone
  ) {
    return {
      ok: false,
      code: "PROFILE_IDENTITY_INCOMPLETE",
      message:
        "Tu cuenta no tiene completos el nombre, apellido, correo, teléfono o RUT. Solicita la corrección mediante soporte antes de postular como conductor.",
      statusCode: 409,
    };
  }

  if (
    profile?.phone &&
    input.phone &&
    normalizeLockedPhoneValue(profile.phone) !==
      normalizeLockedPhoneValue(input.phone)
  ) {
    return {
      ok: false,
      code: "PROFILE_IDENTITY_MISMATCH",
      message:
        "El teléfono enviado no coincide con el registrado en tu cuenta. Solicita cualquier corrección mediante soporte.",
      statusCode: 409,
    };
  }

  const identity: LockedDriverIdentity = {
    firstName: names.firstName,
    lastName: names.lastName,
    email: auth.email.trim().toLowerCase(),
    phone,
    rut: resolvedRut.rut,
    birthDate,
  };

  const now = new Date();
  await db
    .insert(passengerProfiles)
    .values({
      userId: auth.userId,
      phone,
      rut: resolvedRut.rut,
      birthDate,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: passengerProfiles.userId,
      set: {
        phone,
        rut: resolvedRut.rut,
        birthDate,
        updatedAt: now,
      },
    });

  return { ok: true, identity };
}

async function toResponse(application: Application): Promise<ApplicationResponse> {
  const [
    idFrontUrl,
    idBackUrl,
    licenseFrontUrl,
    licenseBackUrl,
    certificateUrl,
    profilePhotoUrl,
    vehiclePhotoUrl,
  ] = await Promise.all([
    resolveApplicationAssetUrl(application.idFrontUrl),
    resolveApplicationAssetUrl(application.idBackUrl),
    resolveApplicationAssetUrl(application.licenseFrontUrl),
    resolveApplicationAssetUrl(application.licenseBackUrl),
    resolveApplicationAssetUrl(application.certificateUrl),
    resolveApplicationAssetUrl(application.profilePhotoUrl),
    resolveApplicationAssetUrl(application.vehiclePhotoUrl),
  ]);

  return {
    id: application.id,
    userId: application.userId ?? null,
    type: application.type,
    status: application.status,
    firstName: application.firstName,
    lastName: application.lastName,
    email: application.email,
    phone: application.phone,
    rut: application.rut ?? null,
    birthDate: application.birthDate ?? null,
    city: application.city ?? null,
    emergencyContactName: application.emergencyContactName ?? null,
    emergencyContactPhone: application.emergencyContactPhone ?? null,
    vehicleBrand: application.vehicleBrand ?? null,
    vehicleModel: application.vehicleModel ?? null,
    vehicleYear: application.vehicleYear ?? null,
    vehiclePlate: application.vehiclePlate ?? null,
    vehicleColor: application.vehicleColor ?? null,
    vehicleCategory: application.vehicleCategory ?? null,
    vehiclePhotoUrl,
    vehicles: Array.isArray(application.vehicles)
      ? application.vehicles
      : [],
    licenseNumber: application.licenseNumber ?? null,
    licenseExpiry: application.licenseExpiry ?? null,
    hasOwnVehicle: application.hasOwnVehicle ?? false,
    experienceYears: application.experienceYears ?? null,
    specialties: application.specialties ?? null,
    offeredTours: application.offeredTours ?? null,
    hasVehicle: application.hasVehicle ?? false,
    vehicleDescription: application.vehicleDescription ?? null,
    maxGroupSize: application.maxGroupSize ?? null,
    languages: application.languages ?? null,
    companyName: application.companyName ?? null,
    companyRut: application.companyRut ?? null,
    idFrontUrl,
    idBackUrl,
    licenseFrontUrl,
    licenseBackUrl,
    certificateUrl,
    profilePhotoUrl,
    driverContractDocumentId: application.driverContractDocumentId ?? null,
    driverContractVersion: application.driverContractVersion ?? null,
    driverContractAcceptedAt:
      application.driverContractAcceptedAt?.toISOString() ?? null,
    driverContractAcceptance:
      application.driverContractAcceptance &&
      typeof application.driverContractAcceptance === "object"
        ? application.driverContractAcceptance
        : null,
    restWindowStart: application.restWindowStart ?? null,
    restWindowEnd: application.restWindowEnd ?? null,
    documentReviewStatus: application.documentReviewStatus,
    trainingStatus: application.trainingStatus,
    reviewChecklist:
      application.reviewChecklist &&
      typeof application.reviewChecklist === "object"
        ? application.reviewChecklist
        : {},
    contractDeliveryStatus: application.contractDeliveryStatus,
    contractDeliveredAt:
      application.contractDeliveredAt?.toISOString() ?? null,
    contractDeliveryError: application.contractDeliveryError ?? null,
    approvalDeliveryStatus: application.approvalDeliveryStatus,
    approvalDeliveredAt:
      application.approvalDeliveredAt?.toISOString() ?? null,
    approvalDeliveryError: application.approvalDeliveryError ?? null,
    reviewedBy: application.reviewedBy ?? null,
    reviewedAt: application.reviewedAt?.toISOString() ?? null,
    rejectionReason: application.rejectionReason ?? null,
    notes: application.notes ?? null,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}

async function provisionApprovedDriver(
  userId: string,
  application: Application,
): Promise<void> {
  const profileValues: Partial<NewDriverProfile> = {
    phone: application.phone,
    vehicleBrand: application.vehicleBrand,
    vehicleModel: application.vehicleModel,
    vehicleYear: application.vehicleYear,
    vehiclePlate: application.vehiclePlate,
    vehicleColor: application.vehicleColor,
    vehicleCategory: resolveProvisionDriverVehicleCategory(
      (application as Application & { vehicleCategory?: string | null })
        .vehicleCategory,
    ),
    licenseNumber: application.licenseNumber,
    licenseExpiry: application.licenseExpiry,
    profilePhotoUrl: application.profilePhotoUrl,
    vehiclePhotoUrl: application.vehiclePhotoUrl,
    updatedAt: new Date(),
  };

  await db.insert(driverProfiles).values({
    userId,
    ...profileValues,
  }).onConflictDoUpdate({
    target: driverProfiles.userId,
    set: profileValues,
  });

  const documents = [
    ["identity_document_front", application.idFrontUrl],
    ["identity_document_back", application.idBackUrl],
    ["driver_license_front", application.licenseFrontUrl],
    ["driver_license_back", application.licenseBackUrl],
    ["profile_photo", application.profilePhotoUrl],
    ["vehicle_photo", application.vehiclePhotoUrl],
  ] as const;

  for (const [documentType, fileUrl] of documents) {
    if (!fileUrl) continue;

    const now = new Date();

    await db.insert(userDocuments).values({
      userId,
      documentType,
      status: "approved",
      fileUrl,
      uploadedAt: now,
      reviewedAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [
        userDocuments.userId,
        userDocuments.documentType,
      ],
      set: {
        status: "approved",
        fileUrl,
        rejectionReason: null,
        uploadedAt: now,
        reviewedAt: now,
        updatedAt: now,
      },
    });
  }
}

async function getDriverContractForApplication(
  application: Application,
): Promise<import("../../db/schema/index.js").LegalDocument | null> {
  if (!application.driverContractDocumentId) return null;

  const document = await legalRepo.findById(
    application.driverContractDocumentId,
  );

  if (
    !document ||
    document.type !== "driver_conditions" ||
    document.version !== application.driverContractVersion
  ) {
    return null;
  }

  return document;
}

async function deliverDriverContract(
  application: Application,
): Promise<void> {
  const document = await getDriverContractForApplication(application);

  if (!document) {
    await repo.updateContractDelivery(application.id, {
      status: "failed",
      error: "No se encontró la versión del contrato aceptado.",
    });
    return;
  }

  const privacyDocuments = await legalRepo.findAll({
    type: "privacy_policy",
    isActive: true,
  });
  const privacyDocument = privacyDocuments[0] ?? null;

  if (!privacyDocument) {
    await repo.updateContractDelivery(application.id, {
      status: "failed",
      error: "No se encontró la Política de Privacidad vigente.",
    });
    return;
  }

  const pdfBuffer = generateDriverContractPdf(application, document);
  const privacyPolicyPdfBuffer = generateLegalDocumentPdf(
    privacyDocument,
    "RAPA GO - POLÍTICA DE PRIVACIDAD VIGENTE",
  );

  try {
    await mailService.sendDriverContractAccepted({
      to: application.email,
      name: `${application.firstName} ${application.lastName}`.trim(),
      applicationId: application.id,
      contractVersion: document.version,
      pdfBuffer,
      privacyPolicyVersion: privacyDocument.version,
      privacyPolicyPdfBuffer,
    });

    await repo.updateContractDelivery(application.id, {
      status: "sent",
      deliveredAt: new Date(),
      error: null,
    });
  } catch (error) {
    await repo.updateContractDelivery(application.id, {
      status: "failed",
      error:
        error instanceof Error
          ? error.message.slice(0, 800)
          : String(error).slice(0, 800),
    });
  }
}

function driverApprovalEmailEnabled(): boolean {
  const configured = process.env["DRIVER_APPROVAL_EMAIL_ENABLED"]
    ?.trim()
    .toLowerCase();

  if (configured === "true") return true;
  if (configured === "false") return false;

  return process.env["NODE_ENV"] !== "test";
}

async function deliverDriverApproval(
  application: Application,
): Promise<void> {
  if (!driverApprovalEmailEnabled()) return;
  if (application.type !== "driver" || application.status !== "approved") {
    return;
  }

  const document = await getDriverContractForApplication(application);

  if (!document) {
    await repo.updateApprovalDelivery(application.id, {
      status: "failed",
      error: "No se encontró la versión del contrato aceptado.",
    });
    return;
  }

  const pdfBuffer = generateDriverContractPdf(application, document);

  try {
    await mailService.sendDriverApplicationApproved({
      to: application.email,
      name: `${application.firstName} ${application.lastName}`.trim(),
      applicationId: application.id,
      contractVersion: document.version,
      pdfBuffer,
    });

    await repo.updateApprovalDelivery(application.id, {
      status: "sent",
      deliveredAt: new Date(),
      error: null,
    });
  } catch (error) {
    await repo.updateApprovalDelivery(application.id, {
      status: "failed",
      error:
        error instanceof Error
          ? error.message.slice(0, 800)
          : String(error).slice(0, 800),
    });
  }
}

export class ApplicationsService {
  async createApplication(
    accessToken: string | null,
    input: CreateApplicationInput,
  ): Promise<CreateApplicationResult> {
    try {
      if (!isApplicationTypeEnabled(input.type)) {
        return {
          ok: false,
          code: "FEATURE_NOT_AVAILABLE",
          message: "Esta postulación no está disponible en la versión actual de RAPA GO.",
          statusCode: 404,
        };
      }

      if (input.type === "driver" && !accessToken) {
        return {
          ok: false,
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión antes de postular como conductor.",
          statusCode: 401,
        };
      }

      let userId: string | null = null;
      let authenticatedUser:
        | Extract<AuthResult, { ok: true }>
        | null = null;
      let lockedDriverIdentity: LockedDriverIdentity | null = null;
      let driverContractDocument:
        | import("../../db/schema/index.js").LegalDocument
        | null = null;

      if (accessToken) {
        const auth = await authenticate(accessToken);

        if (!auth.ok) return auth;
        authenticatedUser = auth;
        userId = auth.userId;
      }

      if (input.type === "driver") {
        if (!authenticatedUser) {
          return {
            ok: false,
            code: "UNAUTHORIZED",
            message: "Debes iniciar sesión antes de postular como conductor.",
            statusCode: 401,
          };
        }

        const identityResult = await resolveLockedDriverIdentity(
          authenticatedUser,
          input,
        );

        if (!identityResult.ok) return identityResult;
        lockedDriverIdentity = identityResult.identity;

        const acceptance = input.driverContractAcceptance;
        driverContractDocument = await legalRepo.findById(
          acceptance.legalDocumentId,
        );

        if (
          !driverContractDocument ||
          !driverContractDocument.isActive ||
          driverContractDocument.type !== "driver_conditions" ||
          driverContractDocument.version !== acceptance.version
        ) {
          return {
            ok: false,
            code: "DRIVER_CONTRACT_VERSION_INVALID",
            message:
              "El contrato de conductor cambió o ya no está vigente. Recarga la página, léelo nuevamente y vuelve a aceptar.",
            statusCode: 409,
          };
        }

        if (
          !isTwelveHourRestWindow(
            acceptance.restWindowStart,
            acceptance.restWindowEnd,
          )
        ) {
          return {
            ok: false,
            code: "INVALID_REST_WINDOW",
            message:
              "La franja de desconexión debe cubrir exactamente 12 horas continuas.",
            statusCode: 400,
          };
        }
      }

      const insertData: typeof import("../../db/schema/index.js").applications.$inferInsert = {
        userId: userId ?? undefined,
        type: input.type,
        status: "pending",
        firstName: lockedDriverIdentity?.firstName ?? input.firstName,
        lastName: lockedDriverIdentity?.lastName ?? input.lastName,
        email: lockedDriverIdentity?.email ?? input.email,
        phone: lockedDriverIdentity?.phone ?? input.phone,
        ...((lockedDriverIdentity?.rut ?? input.rut) !== undefined
          ? { rut: lockedDriverIdentity?.rut ?? input.rut }
          : {}),
        ...((lockedDriverIdentity?.birthDate ?? input.birthDate) !== undefined &&
        (lockedDriverIdentity?.birthDate ?? input.birthDate) !== null
          ? { birthDate: lockedDriverIdentity?.birthDate ?? input.birthDate }
          : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.emergencyContactName !== undefined
          ? { emergencyContactName: input.emergencyContactName }
          : {}),
        ...(input.emergencyContactPhone !== undefined
          ? { emergencyContactPhone: input.emergencyContactPhone }
          : {}),
        ...(input.idFrontUrl !== undefined ? { idFrontUrl: input.idFrontUrl } : {}),
        ...(input.idBackUrl !== undefined ? { idBackUrl: input.idBackUrl } : {}),
        ...(input.profilePhotoUrl !== undefined
          ? { profilePhotoUrl: input.profilePhotoUrl }
          : {}),
      };

      if (input.type === "driver") {
        if (input.vehicleBrand !== undefined) insertData.vehicleBrand = input.vehicleBrand;
        if (input.vehicleModel !== undefined) insertData.vehicleModel = input.vehicleModel;
        if (input.vehicleYear !== undefined) insertData.vehicleYear = input.vehicleYear;
        if (input.vehiclePlate !== undefined) insertData.vehiclePlate = input.vehiclePlate;
        if (input.vehicleColor !== undefined) insertData.vehicleColor = input.vehicleColor;
        if (input.vehicleCategory !== undefined) {
          insertData.vehicleCategory = input.vehicleCategory;
        } else if (Array.isArray(input.vehicles) && input.vehicles[0]?.category) {
          insertData.vehicleCategory = input.vehicles[0].category;
        }
        if (input.licenseNumber !== undefined) insertData.licenseNumber = input.licenseNumber;
        if (input.licenseExpiry !== undefined) insertData.licenseExpiry = input.licenseExpiry;
        if (input.hasOwnVehicle !== undefined) insertData.hasOwnVehicle = input.hasOwnVehicle;
        if (input.licenseFrontUrl !== undefined) insertData.licenseFrontUrl = input.licenseFrontUrl;
        if (input.licenseBackUrl !== undefined) insertData.licenseBackUrl = input.licenseBackUrl;
        if (input.vehiclePhotoUrl !== undefined) insertData.vehiclePhotoUrl = input.vehiclePhotoUrl;
        if (input.vehicles !== undefined) insertData.vehicles = input.vehicles;

        const acceptance = input.driverContractAcceptance;
        insertData.driverContractDocumentId = acceptance.legalDocumentId;
        insertData.driverContractVersion = acceptance.version;
        insertData.driverContractAcceptedAt = acceptance.clientAcceptedAt
          ? new Date(acceptance.clientAcceptedAt)
          : new Date();
        insertData.driverContractAcceptance = {
          acceptedContract: acceptance.acceptedContract,
          acceptedDocumentsTruth: acceptance.acceptedDocumentsTruth,
          acceptedIndependentNature: acceptance.acceptedIndependentNature,
          acceptedPrivacyGeolocation: acceptance.acceptedPrivacyGeolocation,
          ...(acceptance.acceptedSensitiveData !== undefined
            ? { acceptedSensitiveData: acceptance.acceptedSensitiveData }
            : {}),
          acceptedRestWindow: acceptance.acceptedRestWindow,
          acceptedPersonalService: acceptance.acceptedPersonalService,
          clientAcceptedAt: acceptance.clientAcceptedAt ?? null,
        };
        insertData.restWindowStart = acceptance.restWindowStart;
        insertData.restWindowEnd = acceptance.restWindowEnd;
        insertData.documentReviewStatus = "pending";
        insertData.trainingStatus = "pending";
        insertData.contractDeliveryStatus = "pending";
      } else if (input.type === "guide") {
        if (input.experienceYears !== undefined) insertData.experienceYears = input.experienceYears;
        if (input.specialties !== undefined) insertData.specialties = input.specialties;
        if (input.offeredTours !== undefined) insertData.offeredTours = input.offeredTours;
        if (input.hasVehicle !== undefined) insertData.hasVehicle = input.hasVehicle;
        if (input.vehicleDescription !== undefined) insertData.vehicleDescription = input.vehicleDescription;
        if (input.maxGroupSize !== undefined) insertData.maxGroupSize = input.maxGroupSize;
        if (input.languages !== undefined) insertData.languages = input.languages;
        if (input.certificateUrl !== undefined) insertData.certificateUrl = input.certificateUrl;
      } else if (input.type === "rental_operator") {
        if (input.companyName !== undefined) insertData.companyName = input.companyName;
        if (input.companyRut !== undefined) insertData.companyRut = input.companyRut;
      }

      const application = await repo.create(insertData);

      if (
        input.type === "driver" &&
        userId &&
        driverContractDocument
      ) {
        await legalRepo.createAcceptance({
          userId,
          legalDocumentId: driverContractDocument.id,
          versionAccepted: driverContractDocument.version,
          ...buildLegalAcceptanceEvidence(
            driverContractDocument,
            "driver_application",
          ),
        });

        void deliverDriverContract(application);
      }

      void (async () => {
        try {
          const { notifyAsync } = await import("../notifications/notifications.helpers.js");
          const adminRows = await db.select().from(users).where(eq(users.role, "admin"));

          for (const admin of adminRows) {
            notifyAsync({
              userId: admin.id,
              type: "application_new",
              title: "Nueva postulación recibida",
              message: `${application.firstName} ${application.lastName} se postuló como ${application.type}`,
              entityType: "application",
              entityId: application.id,
            });
          }
        } catch {
          // La notificación no bloquea la postulación.
        }
      })();

      return {
        ok: true,
        id: application.id,
        status: "pending",
        message: input.type === "driver"
          ? "Postulación enviada. Tu contrato fue registrado y enviaremos una copia PDF a tu correo. La aceptación no habilita la cuenta hasta completar la revisión documental y la capacitación."
          : "Postulación creada. Ahora se están guardando tus fotografías y documentos.",
      };
    } catch (err) {
      if (err instanceof AppError) {
        return {
          ok: false,
          code: err.code,
          message: err.message,
          statusCode: err.statusCode,
        };
      }

      return {
        ok: false,
        code: "INTERNAL_ERROR",
        message: String(err),
        statusCode: 500,
      };
    }
  }

  async uploadApplicationFile(
    accessToken: string,
    id: string,
    input: UploadApplicationFileInput,
    fileBuffer: Buffer,
  ): Promise<ApplicationResult> {
    try {
      const auth = await authenticate(accessToken);
      if (!auth.ok) return auth;

      const existing = await repo.findById(id);

      if (!existing) {
        return {
          ok: false,
          code: "NOT_FOUND",
          message: "Application not found.",
          statusCode: 404,
        };
      }

      if (
        auth.role !== "admin" &&
        existing.userId !== auth.userId
      ) {
        return {
          ok: false,
          code: "FORBIDDEN",
          message: "No puedes modificar esta postulación.",
          statusCode: 403,
        };
      }

      if (existing.status === "approved" || existing.status === "rejected") {
        return {
          ok: false,
          code: "APPLICATION_LOCKED",
          message: "La postulación ya fue cerrada y no admite reemplazos.",
          statusCode: 409,
        };
      }

      const storedUrl = await uploadApplicationAsset(id, input, fileBuffer);

      const fieldByKind = {
        id_front: "idFrontUrl",
        id_back: "idBackUrl",
        license_front: "licenseFrontUrl",
        license_back: "licenseBackUrl",
        profile_photo: "profilePhotoUrl",
        vehicle_photo: "vehiclePhotoUrl",
      } as const;

      const field = fieldByKind[input.kind];
      const updated = await repo.updateAssets(id, {
        [field]: storedUrl,
      });

      if (!updated) {
        return {
          ok: false,
          code: "NOT_FOUND",
          message: "Application not found after upload.",
          statusCode: 404,
        };
      }

      return {
        ok: true,
        application: await toResponse(updated),
      };
    } catch (err) {
      if (err instanceof AppError) {
        return {
          ok: false,
          code: err.code,
          message: err.message,
          statusCode: err.statusCode,
        };
      }

      return {
        ok: false,
        code: "APPLICATION_FILE_UPLOAD_FAILED",
        message: err instanceof Error ? err.message : String(err),
        statusCode: 500,
      };
    }
  }

  async getMyApplications(accessToken: string): Promise<ApplicationsListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const items = await repo.findByUserId(auth.userId);

    return {
      ok: true,
      items: await Promise.all(items.map(toResponse)),
      total: items.length,
      page: 1,
    };
  }

  async listApplications(
    accessToken: string,
    filters: {
      type?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<ApplicationsListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "Admin access required.",
        statusCode: 403,
      };
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const result = await repo.list({
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      page,
      limit,
    });

    return {
      ok: true,
      items: await Promise.all(result.items.map(toResponse)),
      total: result.total,
      page,
    };
  }

  async getApplication(
    accessToken: string,
    id: string,
  ): Promise<ApplicationResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "Admin access required.",
        statusCode: 403,
      };
    }

    const application = await repo.findById(id);

    if (!application) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Application not found.",
        statusCode: 404,
      };
    }

    return {
      ok: true,
      application: await toResponse(application),
    };
  }

  async reviewApplication(
    accessToken: string,
    id: string,
    input: ReviewApplicationInput,
  ): Promise<ApplicationResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "Admin access required.",
        statusCode: 403,
      };
    }

    const existing = await repo.findById(id);

    if (!existing) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Application not found.",
        statusCode: 404,
      };
    }

    if (input.status === "rejected" && !input.rejectionReason) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Rejection reason is required when rejecting.",
        statusCode: 400,
      };
    }

    let targetUserId = existing.userId;
    const { notifyAsync } = await import("../notifications/notifications.helpers.js");

    if (input.status === "approved") {
      if (existing.type === "driver") {
        const requiredFiles = [
          existing.idFrontUrl,
          existing.idBackUrl,
          existing.licenseFrontUrl,
          existing.licenseBackUrl,
          existing.profilePhotoUrl,
          existing.vehiclePhotoUrl,
        ];

        const missingFiles = requiredFiles.filter(
          (value) => !value,
        ).length;

        if (missingFiles > 0) {
          return {
            ok: false,
            code: "DRIVER_DOCUMENTS_INCOMPLETE",
            message: `No puedes aprobar esta postulación: faltan ${missingFiles} de los 6 archivos obligatorios.`,
            statusCode: 400,
          };
        }

        const documentReviewStatus =
          input.documentReviewStatus ?? existing.documentReviewStatus;
        const trainingStatus =
          input.trainingStatus ?? existing.trainingStatus;
        const checklist = normalizeReviewChecklist(
          input.reviewChecklist ??
            (existing.reviewChecklist as Record<string, boolean> | null),
        );

        if (
          !existing.driverContractDocumentId ||
          !existing.driverContractVersion ||
          !existing.driverContractAcceptedAt
        ) {
          return {
            ok: false,
            code: "DRIVER_CONTRACT_NOT_ACCEPTED",
            message:
              "No puedes habilitar al conductor porque no existe una aceptación contractual versionada.",
            statusCode: 400,
          };
        }

        if (documentReviewStatus !== "approved") {
          return {
            ok: false,
            code: "DRIVER_DOCUMENT_REVIEW_PENDING",
            message:
              "Primero debes aprobar la revisión documental del conductor.",
            statusCode: 400,
          };
        }

        if (trainingStatus !== "approved") {
          return {
            ok: false,
            code: "DRIVER_TRAINING_PENDING",
            message:
              "Primero debes registrar la capacitación como aprobada.",
            statusCode: 400,
          };
        }

        if (!requiredChecklistApproved(checklist)) {
          return {
            ok: false,
            code: "DRIVER_CHECKLIST_INCOMPLETE",
            message:
              "Completa el checklist de identidad, licencia, vehículo, residencia, domicilio tributario y franja de desconexión.",
            statusCode: 400,
          };
        }
      }

      try {
        const roleMap: Record<string, UserRole> = {
          driver: "driver",
          guide: "guide",
          rental_operator: "rental_operator",
        };

        const targetRole = roleMap[existing.type] ?? "passenger";
        const existingUser = await usersRepo.findByEmail(existing.email);

        if (existingUser) {
          targetUserId = existingUser.id;

          await db.update(users).set({
            role: targetRole,
            updatedAt: new Date(),
          }).where(eq(users.id, existingUser.id));
        } else {
          const tempPassword = randomUUID();
          const argon2 = await import("argon2");
          const passwordHash = await argon2.hash(tempPassword);

          const newUser = await usersRepo.createUser({
            email: existing.email,
            name: `${existing.firstName} ${existing.lastName}`,
            role: targetRole,
            status: "active",
          });

          targetUserId = newUser.id;

          await db.insert(authCredentials).values({
            userId: newUser.id,
            passwordHash,
          });
        }

        if (!targetUserId) {
          throw AppError.internal(
            "No se pudo identificar la cuenta del conductor aprobado.",
          );
        }

        await repo.attachUser(id, targetUserId);

        if (existing.type === "driver") {
          await provisionApprovedDriver(targetUserId, existing);
        }
      } catch (error) {
        return {
          ok: false,
          code: "DRIVER_PROVISIONING_FAILED",
          message:
            error instanceof Error
              ? `No se pudo crear el perfil automático del conductor: ${error.message}`
              : "No se pudo crear el perfil automático del conductor.",
          statusCode: 500,
        };
      }
    }

    const normalizedReviewChecklist =
      input.reviewChecklist === undefined
        ? undefined
        : normalizeReviewChecklist(input.reviewChecklist) ?? {};

    const updated = await repo.updateStatus(id, auth.userId, {
      status: input.status,
      ...(input.rejectionReason !== undefined
        ? { rejectionReason: input.rejectionReason }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.documentReviewStatus !== undefined
        ? { documentReviewStatus: input.documentReviewStatus }
        : {}),
      ...(input.trainingStatus !== undefined
        ? { trainingStatus: input.trainingStatus }
        : {}),
      ...(normalizedReviewChecklist !== undefined
        ? { reviewChecklist: normalizedReviewChecklist }
        : {}),
    });

    if (!updated) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Application not found after update.",
        statusCode: 404,
      };
    }

    if (input.status === "approved" && targetUserId) {
      notifyAsync({
        userId: targetUserId,
        type: "application_approved",
        title: "¡Tu postulación fue aprobada!",
        message: "Tu perfil, fotografías, documentos y vehículo quedaron cargados automáticamente.",
        entityType: "application",
        entityId: id,
      });
      void deliverDriverApproval(updated);
    } else if (input.status === "rejected" && existing.userId) {
      notifyAsync({
        userId: existing.userId,
        type: "application_rejected",
        title: "Postulación rechazada",
        message: `Tu postulación fue rechazada. Motivo: ${input.rejectionReason ?? ""}`,
        entityType: "application",
        entityId: id,
      });
    } else if (input.status === "under_review" && existing.userId) {
      notifyAsync({
        userId: existing.userId,
        type: "application_under_review",
        title: "Tu postulación está en revisión",
        message: "Nuestro equipo está revisando tu postulación. Te notificaremos pronto.",
        entityType: "application",
        entityId: id,
      });
    }

    return {
      ok: true,
      application: await toResponse(updated),
    };
  }
  async getApplicationContract(
    accessToken: string,
    id: string,
  ): Promise<ApplicationContractResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const application = await repo.findById(id);

    if (!application) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Application not found.",
        statusCode: 404,
      };
    }

    if (
      auth.role !== "admin" &&
      application.userId !== auth.userId
    ) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "No puedes descargar este contrato.",
        statusCode: 403,
      };
    }

    const document = await getDriverContractForApplication(application);

    if (!document) {
      return {
        ok: false,
        code: "DRIVER_CONTRACT_NOT_FOUND",
        message: "No se encontró la versión contractual aceptada.",
        statusCode: 404,
      };
    }

    return {
      ok: true,
      fileName: `Contrato-Rapa-Go-${application.id}.pdf`,
      contentType: "application/pdf",
      buffer: generateDriverContractPdf(application, document),
    };
  }

  async resendApplicationContract(
    accessToken: string,
    id: string,
  ): Promise<ContractDeliveryResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "Admin access required.",
        statusCode: 403,
      };
    }

    const application = await repo.findById(id);

    if (!application) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Application not found.",
        statusCode: 404,
      };
    }

    await repo.updateContractDelivery(id, {
      status: "pending",
      error: null,
    });
    await deliverDriverContract(application);

    const updated = await repo.findById(id);

    return {
      ok: true,
      status: updated?.contractDeliveryStatus ?? "failed",
      deliveredAt:
        updated?.contractDeliveredAt?.toISOString() ?? null,
    };
  }

  async resendApplicationApproval(
    accessToken: string,
    id: string,
  ): Promise<ContractDeliveryResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "Admin access required.",
        statusCode: 403,
      };
    }

    const application = await repo.findById(id);

    if (!application) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Application not found.",
        statusCode: 404,
      };
    }

    if (application.type !== "driver" || application.status !== "approved") {
      return {
        ok: false,
        code: "APPLICATION_NOT_APPROVED",
        message:
          "El correo de habilitación solo puede enviarse a conductores aprobados.",
        statusCode: 409,
      };
    }

    await repo.updateApprovalDelivery(id, {
      status: "pending",
      error: null,
    });
    await deliverDriverApproval(application);

    const updated = await repo.findById(id);

    return {
      ok: true,
      status: updated?.approvalDeliveryStatus ?? "failed",
      deliveredAt:
        updated?.approvalDeliveredAt?.toISOString() ?? null,
    };
  }

}
