import crypto from "node:crypto";
import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { RidesRepository } from "../rides/rides.repository.js";
import { NotificationsRepository } from "../notifications/notifications.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { SupportRepository } from "./support.repository.js";
import type {
  AddSupportMessageInput,
  AdminSupportListQuery,
  AdminSupportUpdateInput,
  CreateSupportCaseInput,
  SupportStatus,
} from "./support.schemas.js";
import type {
  SupportCase,
  SupportCaseEvent,
  SupportCaseResponse,
  SupportCaseDetailResponse,
  SupportCaseDetailResult,
  SupportCaseResult,
  SupportCasesListResult,
  SupportCaseUpdateResult,
  SupportCaseWithRequester,
} from "./support.types.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepo = new UsersRepository();
const ridesRepo = new RidesRepository();
const supportRepo = new SupportRepository();
const notificationsRepo = new NotificationsRepository();

type AuthResult =
  | {
      ok: true;
      userId: string;
      role: string;
      name: string;
      email: string;
    }
  | { ok: false; code: string; message: string; statusCode: number };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload: { sub: string };
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
      message: "Invalid access token.",
      statusCode: 401,
    };
  }

  const valid = await sessionService.isSessionValid(
    tokenService.hashToken(accessToken),
  );
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

  if (user.status !== "active") {
    const code =
      user.status === "pending"
        ? "AUTH_ACCOUNT_PENDING"
        : user.status === "deleted"
          ? "AUTH_ACCOUNT_DELETED"
          : "AUTH_ACCOUNT_SUSPENDED";
    return {
      ok: false,
      code,
      message: "La cuenta no está habilitada para usar soporte.",
      statusCode: 401,
    };
  }

  return {
    ok: true,
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  };
}

function makeTrackingCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `RGS-${date}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

function serializeCase(
  row: SupportCase | SupportCaseWithRequester,
): SupportCaseResponse {
  const extended = row as Partial<SupportCaseWithRequester>;
  return {
    id: row.id,
    trackingCode: row.trackingCode,
    requesterUserId: row.requesterUserId,
    requesterRole: row.requesterRole,
    requesterName: extended.requesterName ?? null,
    requesterEmail: extended.requesterEmail ?? row.contactEmail ?? null,
    rideRequestId: row.rideRequestId ?? null,
    category: row.category,
    subject: row.subject,
    description: row.description,
    priority: row.priority,
    status: row.status,
    contactPhone: row.contactPhone ?? null,
    contactEmail: row.contactEmail ?? null,
    lostItemDescription: row.lostItemDescription ?? null,
    lostItemLastSeenAt: row.lostItemLastSeenAt?.toISOString() ?? null,
    assignedAdminUserId: row.assignedAdminUserId ?? null,
    assignedAdminName: extended.assignedAdminName ?? null,
    adminResolution: row.adminResolution ?? null,
    firstResponseAt: row.firstResponseAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeEvent(
  event: SupportCaseEvent,
  includeInternal: boolean,
) {
  return {
    id: event.id,
    supportCaseId: event.supportCaseId,
    actorUserId: event.actorUserId ?? null,
    actorRole: event.actorRole,
    eventType: event.eventType,
    fromStatus: event.fromStatus ?? null,
    toStatus: event.toStatus ?? null,
    publicMessage: event.publicMessage ?? null,
    internalNote: includeInternal ? event.internalNote ?? null : null,
    createdAt: event.createdAt.toISOString(),
  };
}

async function buildDetail(
  supportCase: SupportCaseWithRequester,
  includeInternal: boolean,
): Promise<SupportCaseDetailResponse> {
  const events = await supportRepo.listEvents(supportCase.id);
  return {
    supportCase: serializeCase(supportCase),
    events: events.map((event) => serializeEvent(event, includeInternal)),
  };
}

async function notifyAdminsOfNewCase(supportCase: SupportCase): Promise<void> {
  const adminIds = await supportRepo.findActiveAdminIds();
  await Promise.allSettled(
    adminIds.map((adminId) =>
      notificationsRepo.create({
        userId: adminId,
        type: "support_case_created",
        title: `Nuevo caso ${supportCase.trackingCode}`,
        message: supportCase.subject,
        entityType: "support_case",
        entityId: supportCase.id,
        actionUrl: "/admin/support",
      }),
    ),
  );
}

export class SupportService {
  async createCase(
    accessToken: string,
    input: CreateSupportCaseInput,
  ): Promise<SupportCaseResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger" && auth.role !== "driver") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Solo pasajeros y conductores pueden crear casos de soporte.",
        statusCode: 403,
      };
    }

    let linkedRide = null;
    if (input.rideRequestId) {
      linkedRide = await ridesRepo.findById(input.rideRequestId);
      if (!linkedRide) {
        return {
          ok: false,
          code: "RIDE_NOT_FOUND",
          message: "No encontramos el viaje seleccionado.",
          statusCode: 404,
        };
      }
      const belongsToRequester =
        linkedRide.passengerUserId === auth.userId ||
        linkedRide.driverUserId === auth.userId;
      if (!belongsToRequester) {
        return {
          ok: false,
          code: "AUTH_FORBIDDEN",
          message: "No puedes asociar un caso a un viaje de otra cuenta.",
          statusCode: 403,
        };
      }
    }

    if (input.category === "lost_item") {
      if (!linkedRide) {
        return {
          ok: false,
          code: "LOST_ITEM_RIDE_REQUIRED",
          message: "Selecciona el viaje completado donde se perdió el objeto.",
          statusCode: 400,
        };
      }
      if (linkedRide.status !== "completed") {
        return {
          ok: false,
          code: "LOST_ITEM_RIDE_NOT_COMPLETED",
          message: "Los objetos perdidos solo pueden reportarse en viajes completados.",
          statusCode: 409,
        };
      }
    }

    const created = await supportRepo.createCase(
      {
        trackingCode: makeTrackingCode(),
        requesterUserId: auth.userId,
        requesterRole: auth.role,
        rideRequestId: input.rideRequestId ?? null,
        category: input.category,
        subject: input.subject,
        description: input.description,
        priority: input.category === "safety" ? "urgent" : input.priority,
        status: "open",
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? auth.email,
        lostItemDescription: input.lostItemDescription ?? null,
        lostItemLastSeenAt: input.lostItemLastSeenAt
          ? new Date(input.lostItemLastSeenAt)
          : null,
      },
      auth.role,
    );

    await notifyAdminsOfNewCase(created);
    return { ok: true, supportCase: serializeCase(created) };
  }

  async listMine(accessToken: string): Promise<SupportCasesListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    const items = await supportRepo.listByRequester(auth.userId);
    return { ok: true, items: items.map(serializeCase) };
  }

  async getMine(
    accessToken: string,
    caseId: string,
  ): Promise<SupportCaseDetailResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    const supportCase = await supportRepo.findByIdWithRequester(caseId);
    if (!supportCase) {
      return {
        ok: false,
        code: "SUPPORT_CASE_NOT_FOUND",
        message: "Caso no encontrado.",
        statusCode: 404,
      };
    }
    if (supportCase.requesterUserId !== auth.userId) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "No puedes consultar el caso de otra cuenta.",
        statusCode: 403,
      };
    }
    return { ok: true, detail: await buildDetail(supportCase, false) };
  }

  async addMessage(
    accessToken: string,
    caseId: string,
    input: AddSupportMessageInput,
  ): Promise<SupportCaseDetailResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    const supportCase = await supportRepo.findByIdWithRequester(caseId);
    if (!supportCase) {
      return {
        ok: false,
        code: "SUPPORT_CASE_NOT_FOUND",
        message: "Caso no encontrado.",
        statusCode: 404,
      };
    }
    if (supportCase.requesterUserId !== auth.userId) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "No puedes responder el caso de otra cuenta.",
        statusCode: 403,
      };
    }
    if (["closed", "rejected"].includes(supportCase.status)) {
      return {
        ok: false,
        code: "SUPPORT_CASE_CLOSED",
        message: "Este caso ya está cerrado.",
        statusCode: 409,
      };
    }

    const nextStatus =
      supportCase.status === "waiting_user" ? "in_review" : supportCase.status;
    await supportRepo.addRequesterMessage({
      supportCaseId: caseId,
      actorUserId: auth.userId,
      actorRole: auth.role,
      message: input.message,
      fromStatus: supportCase.status,
      toStatus: nextStatus,
    });

    const adminIds = supportCase.assignedAdminUserId
      ? [supportCase.assignedAdminUserId]
      : await supportRepo.findActiveAdminIds();
    await Promise.allSettled(
      adminIds.map((adminId) =>
        notificationsRepo.create({
          userId: adminId,
          type: "support_case_message",
          title: `Respuesta en ${supportCase.trackingCode}`,
          message: input.message.slice(0, 180),
          entityType: "support_case",
          entityId: supportCase.id,
          actionUrl: "/admin/support",
        }),
      ),
    );

    const refreshed = await supportRepo.findByIdWithRequester(caseId);
    if (!refreshed) {
      return {
        ok: false,
        code: "SUPPORT_CASE_NOT_FOUND",
        message: "Caso no encontrado después de actualizar.",
        statusCode: 404,
      };
    }
    return { ok: true, detail: await buildDetail(refreshed, false) };
  }

  async listForAdmin(
    accessToken: string,
    filters: AdminSupportListQuery,
  ): Promise<SupportCasesListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Solo administración puede revisar los casos.",
        statusCode: 403,
      };
    }
    const items = await supportRepo.listForAdmin(filters);
    return { ok: true, items: items.map(serializeCase) };
  }

  async getForAdmin(
    accessToken: string,
    caseId: string,
  ): Promise<SupportCaseDetailResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Solo administración puede revisar los casos.",
        statusCode: 403,
      };
    }
    const supportCase = await supportRepo.findByIdWithRequester(caseId);
    if (!supportCase) {
      return {
        ok: false,
        code: "SUPPORT_CASE_NOT_FOUND",
        message: "Caso no encontrado.",
        statusCode: 404,
      };
    }
    return { ok: true, detail: await buildDetail(supportCase, true) };
  }

  async updateForAdmin(
    accessToken: string,
    caseId: string,
    input: AdminSupportUpdateInput,
  ): Promise<SupportCaseUpdateResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Solo administración puede actualizar los casos.",
        statusCode: 403,
      };
    }

    const current = await supportRepo.findByIdWithRequester(caseId);
    if (!current) {
      return {
        ok: false,
        code: "SUPPORT_CASE_NOT_FOUND",
        message: "Caso no encontrado.",
        statusCode: 404,
      };
    }

    const nextStatus = input.status ?? (current.status as SupportStatus);
    const now = new Date();
    const firstResponseAt =
      current.firstResponseAt ??
      (input.publicMessage || input.internalNote || input.status ? now : null);

    const updated = await supportRepo.updateByAdmin({
      supportCaseId: caseId,
      actorUserId: auth.userId,
      actorRole: auth.role,
      fromStatus: current.status,
      patch: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.assignToMe ? { assignedAdminUserId: auth.userId } : {}),
        ...(input.resolution !== undefined
          ? { adminResolution: input.resolution }
          : {}),
        ...(firstResponseAt ? { firstResponseAt } : {}),
        ...(nextStatus === "resolved" ? { resolvedAt: now } : {}),
        ...(nextStatus === "closed" ? { closedAt: now } : {}),
      },
      event: {
        actorUserId: auth.userId,
        actorRole: auth.role,
        eventType:
          input.status && input.status !== current.status
            ? "status_changed"
            : "admin_update",
        fromStatus: current.status,
        toStatus: nextStatus,
        publicMessage: input.publicMessage ?? null,
        internalNote: input.internalNote ?? null,
      },
    });

    if (!updated) {
      return {
        ok: false,
        code: "SUPPORT_CASE_NOT_FOUND",
        message: "Caso no encontrado.",
        statusCode: 404,
      };
    }

    if (input.publicMessage || input.status || input.resolution) {
      await notificationsRepo.create({
        userId: current.requesterUserId,
        type: "support_case_updated",
        title: `Actualización ${current.trackingCode}`,
        message:
          input.publicMessage ??
          input.resolution ??
          `Estado actualizado a ${nextStatus}.`,
        entityType: "support_case",
        entityId: current.id,
        actionUrl: "/support-center",
      });
    }

    const refreshed = await supportRepo.findByIdWithRequester(caseId);
    if (!refreshed) {
      return {
        ok: false,
        code: "SUPPORT_CASE_NOT_FOUND",
        message: "Caso no encontrado después de actualizar.",
        statusCode: 404,
      };
    }
    return { ok: true, detail: await buildDetail(refreshed, true) };
  }
}
