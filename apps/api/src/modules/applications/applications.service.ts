  import { eq } from "drizzle-orm";
  import { TokenService } from "../auth/token.service.js";
  import { SessionService } from "../auth/session.service.js";
  import { UsersRepository } from "../users/users.repository.js";
  import { ApplicationsRepository } from "./applications.repository.js";
  import { AppError } from "../../shared/errors/AppError.js";
  import { db } from "../../db/client.js";
  import { users } from "../../db/schema/index.js";
  import type { CreateApplicationInput, ReviewApplicationInput } from "./applications.schemas.js";
  import type {
    ApplicationResponse,
    ApplicationResult,
    ApplicationsListResult,
    CreateApplicationResult,
  } from "./applications.types.js";
  import type { Application } from "../../db/schema/index.js";
  import type { UserRole } from "@rapa-go/shared";
  import { isApplicationTypeEnabled } from "../../config/features.js";

  const tokenService   = new TokenService();
  const sessionService = new SessionService();
  const usersRepo      = new UsersRepository();
  const repo           = new ApplicationsRepository();

  type AuthResult =
    | { ok: true; userId: string; role: string }
    | { ok: false; code: string; message: string; statusCode: number };

  async function authenticate(accessToken: string): Promise<AuthResult> {
    let payload;
    try {
      payload = tokenService.verifyAccessToken(accessToken);
    } catch (err) {
      if (err instanceof AppError) {
        return { ok: false, code: err.code, message: err.message, statusCode: err.statusCode };
      }
      return { ok: false, code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 };
    }

    const hash  = tokenService.hashToken(accessToken);
    const valid = await sessionService.isSessionValid(hash);
    if (!valid) {
      return { ok: false, code: "AUTH_SESSION_REVOKED", message: "Session has been revoked.", statusCode: 401 };
    }

    const user = await usersRepo.findById(payload.sub);
    if (!user) {
      return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
    }

    return { ok: true, userId: user.id, role: user.role };
  }

  function toResponse(a: Application): ApplicationResponse {
    return {
      id: a.id,
      userId: a.userId ?? null,
      type: a.type,
      status: a.status,
      firstName: a.firstName,
      lastName: a.lastName,
      email: a.email,
      phone: a.phone,
      rut: a.rut ?? null,
      birthDate: a.birthDate ?? null,
      city: a.city ?? null,
      emergencyContactName: a.emergencyContactName ?? null,
      emergencyContactPhone: a.emergencyContactPhone ?? null,
      vehicleBrand: a.vehicleBrand ?? null,
      vehicleModel: a.vehicleModel ?? null,
      vehicleYear: a.vehicleYear ?? null,
      vehiclePlate: a.vehiclePlate ?? null,
      vehicleColor: a.vehicleColor ?? null,
      licenseNumber: a.licenseNumber ?? null,
      licenseExpiry: a.licenseExpiry ?? null,
      hasOwnVehicle: a.hasOwnVehicle ?? false,
      experienceYears: a.experienceYears ?? null,
      specialties: a.specialties ?? null,
      offeredTours: a.offeredTours ?? null,
      hasVehicle: a.hasVehicle ?? false,
      vehicleDescription: a.vehicleDescription ?? null,
      maxGroupSize: a.maxGroupSize ?? null,
      languages: a.languages ?? null,
      companyName: a.companyName ?? null,
      companyRut: a.companyRut ?? null,
      idFrontUrl: a.idFrontUrl ?? null,
      idBackUrl: a.idBackUrl ?? null,
      licenseFrontUrl: a.licenseFrontUrl ?? null,
      licenseBackUrl: a.licenseBackUrl ?? null,
      certificateUrl: a.certificateUrl ?? null,
      profilePhotoUrl: a.profilePhotoUrl ?? null,
      reviewedBy: a.reviewedBy ?? null,
      reviewedAt: a.reviewedAt?.toISOString() ?? null,
      rejectionReason: a.rejectionReason ?? null,
      notes: a.notes ?? null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
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

        let userId: string | null = null;
        if (accessToken) {
          const auth = await authenticate(accessToken);
          if (auth.ok) {
            userId = auth.userId;
          }
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
          ...(input.emergencyContactName !== undefined ? { emergencyContactName: input.emergencyContactName } : {}),
          ...(input.emergencyContactPhone !== undefined ? { emergencyContactPhone: input.emergencyContactPhone } : {}),
          ...(input.idFrontUrl !== undefined ? { idFrontUrl: input.idFrontUrl } : {}),
          ...(input.idBackUrl !== undefined ? { idBackUrl: input.idBackUrl } : {}),
          ...(input.profilePhotoUrl !== undefined ? { profilePhotoUrl: input.profilePhotoUrl } : {}),
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
          }
        })();

        return { ok: true, id: application.id, status: "pending", message: "Postulación recibida. Te contactaremos dentro de 48 horas." };
      } catch (err) {
        if (err instanceof AppError) {
          return { ok: false, code: err.code, message: err.message, statusCode: err.statusCode };
        }
        return { ok: false, code: "INTERNAL_ERROR", message: String(err), statusCode: 500 };
      }
    }

    async getMyApplications(accessToken: string): Promise<ApplicationsListResult> {
      const auth = await authenticate(accessToken);
      if (!auth.ok) return auth;

      const items = await repo.findByUserId(auth.userId);
      return { ok: true, items: items.map(toResponse), total: items.length, page: 1 };
    }

    async listApplications(
      accessToken: string,
      filters: { type?: string; status?: string; page?: number; limit?: number },
    ): Promise<ApplicationsListResult> {
      const auth = await authenticate(accessToken);
      if (!auth.ok) return auth;
      if (auth.role !== "admin") {
        return { ok: false, code: "FORBIDDEN", message: "Admin access required.", statusCode: 403 };
      }

      const page  = filters.page  ?? 1;
      const limit = filters.limit ?? 20;
      const result = await repo.list({
        ...(filters.type   ? { type:   filters.type }   : {}),
        ...(filters.status ? { status: filters.status } : {}),
        page,
        limit,
      });
      return { ok: true, items: result.items.map(toResponse), total: result.total, page };
    }

    async getApplication(accessToken: string, id: string): Promise<ApplicationResult> {
      const auth = await authenticate(accessToken);
      if (!auth.ok) return auth;
      if (auth.role !== "admin") {
        return { ok: false, code: "FORBIDDEN", message: "Admin access required.", statusCode: 403 };
      }

      const application = await repo.findById(id);
      if (!application) {
        return { ok: false, code: "NOT_FOUND", message: "Application not found.", statusCode: 404 };
      }
      return { ok: true, application: toResponse(application) };
    }

    async reviewApplication(
      accessToken: string,
      id: string,
      input: ReviewApplicationInput,
    ): Promise<ApplicationResult> {
      const auth = await authenticate(accessToken);
      if (!auth.ok) return auth;
      if (auth.role !== "admin") {
        return { ok: false, code: "FORBIDDEN", message: "Admin access required.", statusCode: 403 };
      }

      const existing = await repo.findById(id);
      if (!existing) {
        return { ok: false, code: "NOT_FOUND", message: "Application not found.", statusCode: 404 };
      }

      if (input.status === "rejected" && !input.rejectionReason) {
        return { ok: false, code: "VALIDATION_ERROR", message: "Rejection reason is required when rejecting.", statusCode: 400 };
      }

      const updated = await repo.updateStatus(id, auth.userId, {
        status: input.status,
        ...(input.rejectionReason !== undefined ? { rejectionReason: input.rejectionReason } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      });

      if (!updated) {
        return { ok: false, code: "NOT_FOUND", message: "Application not found after update.", statusCode: 404 };
      }

      const { notifyAsync } = await import("../notifications/notifications.helpers.js");

      if (input.status === "approved") {
        try {
          const roleMap: Record<string, UserRole> = {
            driver: "driver",
            guide: "guide",
            rental_operator: "rental_operator",
          };
          const targetRole = roleMap[existing.type] ?? "passenger";

          const existingUser = await usersRepo.findByEmail(existing.email);
          if (existingUser) {
            await db.update(users).set({ role: targetRole, updatedAt: new Date() }).where(eq(users.id, existingUser.id));
            notifyAsync({
              userId: existingUser.id,
              type: "application_approved",
              title: "¡Tu postulación fue aprobada!",
              message: `Tu cuenta ha sido actualizada con el rol de ${existing.type}. Ya puedes acceder con tus credenciales.`,
              entityType: "application",
              entityId: id,
            });
          } else {
            const tempPassword = crypto.randomUUID();
            const { authCredentials } = await import("../../db/schema/index.js");
            const argon2 = await import("argon2");
            const passwordHash = await argon2.hash(tempPassword);

            const newUser = await usersRepo.createUser({
              email: existing.email,
              name: `${existing.firstName} ${existing.lastName}`,
              role: targetRole,
              status: "active",
            });

            await db.insert(authCredentials).values({ userId: newUser.id, passwordHash });

            notifyAsync({
              userId: newUser.id,
              type: "application_approved",
              title: "¡Tu postulación fue aprobada!",
              message: `Tu cuenta ha sido creada con el rol de ${existing.type}. Usa el correo ${existing.email} para iniciar sesión.`,
              entityType: "application",
              entityId: id,
            });
          }
        } catch {
        }
      } else if (input.status === "rejected") {
        if (existing.userId) {
          notifyAsync({
            userId: existing.userId,
            type: "application_rejected",
            title: "Postulación rechazada",
            message: `Tu postulación fue rechazada. Motivo: ${input.rejectionReason ?? ""}`,
            entityType: "application",
            entityId: id,
          });
        }
      } else if (input.status === "under_review") {
        if (existing.userId) {
          notifyAsync({
            userId: existing.userId,
            type: "application_under_review",
            title: "Tu postulación está en revisión",
            message: "Nuestro equipo está revisando tu postulación. Te notificaremos pronto.",
            entityType: "application",
            entityId: id,
          });
        }
      }

      return { ok: true, application: toResponse(updated) };
    }
  }
