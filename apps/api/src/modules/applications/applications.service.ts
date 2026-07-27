import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { ApplicationsRepository } from "./applications.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { db } from "../../db/client.js";
import {
  authCredentials,
  driverProfiles,
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
} from "./applications.types.js";
import type { UserRole } from "@rapa-go/shared";
import { isApplicationTypeEnabled } from "../../config/features.js";
import {
  resolveApplicationAssetUrl,
  uploadApplicationAsset,
} from "./applicationStorage.service.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepo = new UsersRepository();
const repo = new ApplicationsRepository();

type AuthResult =
  | {
      ok: true;
      userId: string;
      role: string;
      email: string;
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
  };
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

      if (accessToken) {
        const auth = await authenticate(accessToken);

        if (!auth.ok) return auth;
        userId = auth.userId;
      }

      const insertData: typeof import("../../db/schema/index.js").applications.$inferInsert = {
        userId: userId ?? undefined,
        type: input.type,
        status: "pending",
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        ...(input.rut !== undefined ? { rut: input.rut } : {}),
        ...(input.birthDate !== undefined ? { birthDate: input.birthDate } : {}),
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
        if (input.licenseNumber !== undefined) insertData.licenseNumber = input.licenseNumber;
        if (input.licenseExpiry !== undefined) insertData.licenseExpiry = input.licenseExpiry;
        if (input.hasOwnVehicle !== undefined) insertData.hasOwnVehicle = input.hasOwnVehicle;
        if (input.licenseFrontUrl !== undefined) insertData.licenseFrontUrl = input.licenseFrontUrl;
        if (input.licenseBackUrl !== undefined) insertData.licenseBackUrl = input.licenseBackUrl;
        if (input.vehiclePhotoUrl !== undefined) insertData.vehiclePhotoUrl = input.vehiclePhotoUrl;
        if (input.vehicles !== undefined) insertData.vehicles = input.vehicles;
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

      void (async () => {
        try {
          const { notifyAsync } = await import("../notifications/notifications.helpers.js");
          const adminRows = await db.select().from(users).where(eq(users.role, "admin"));

          for (const admin of adminRows) {
            notifyAsync({
              userId: admin.id,
              type: "application_new",
              title: "Nueva postulación recibida",
              message: `${input.firstName} ${input.lastName} se postuló como ${input.type}`,
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
        message: "Postulación creada. Ahora se están guardando tus fotografías y documentos.",
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

    const updated = await repo.updateStatus(id, auth.userId, {
      status: input.status,
      ...(input.rejectionReason !== undefined
        ? { rejectionReason: input.rejectionReason }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
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
}
