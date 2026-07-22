import { createHash, randomInt } from "node:crypto";

import { AppError } from "../../shared/errors/AppError.js";
import { AuditService } from "../audit/audit.service.js";
import { MailService } from "../auth/mail.service.js";
import { SessionService } from "../auth/session.service.js";
import { TokenService } from "../auth/token.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { AccountDeletionRepository } from "./accountDeletion.repository.js";
import type {
  CreateAccountDeletionRequestInput,
  ListAccountDeletionRequestsQuery,
  PublicAccountDeletionCodeRequestInput,
  PublicAccountDeletionStatusQuery,
  PublicAccountDeletionSubmitInput,
  ReviewAccountDeletionRequestInput,
} from "./accountDeletion.schemas.js";
import type {
  AccountDeletionAdminResponse,
  AccountDeletionRequestResponse,
  PublicAccountDeletionStatusResponse,
} from "./accountDeletion.types.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepository = new UsersRepository();
const repository = new AccountDeletionRepository();
const auditService = new AuditService();
const mailService = new MailService();

type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
};

type ServiceFailure = {
  ok: false;
  code: string;
  message: string;
  statusCode: number;
};

type UserRequestResult =
  | { ok: true; request: AccountDeletionRequestResponse | null }
  | ServiceFailure;

type AdminListResult =
  | { ok: true; requests: AccountDeletionAdminResponse[] }
  | ServiceFailure;

type AdminRequestResult =
  | { ok: true; request: AccountDeletionRequestResponse }
  | ServiceFailure;

type PublicCodeResult =
  | { ok: true; message: string; expiresMinutes: number }
  | ServiceFailure;

type PublicSubmitResult =
  | { ok: true; request: AccountDeletionRequestResponse }
  | ServiceFailure;

type PublicStatusResult =
  | { ok: true; request: PublicAccountDeletionStatusResponse }
  | ServiceFailure;

const PUBLIC_CODE_MESSAGE =
  "Si el correo pertenece a una cuenta elegible, enviaremos un código de verificación.";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeContext(
  value: string | null | undefined,
  maximumLength: number,
): string | null {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, maximumLength) : null;
}

async function waitForMinimumDuration(
  startedAt: number,
  minimumMilliseconds = 400,
): Promise<void> {
  const remaining = minimumMilliseconds - (Date.now() - startedAt);

  if (remaining > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, remaining);
    });
  }
}

async function authenticate(
  accessToken: string,
): Promise<AuthenticatedUser | ServiceFailure> {
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
      message: "Token de acceso inválido.",
      statusCode: 401,
    };
  }

  const hash = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);

  if (!valid) {
    return {
      ok: false,
      code: "AUTH_SESSION_REVOKED",
      message: "La sesión fue cerrada.",
      statusCode: 401,
    };
  }

  const user = await usersRepository.findById(payload.sub);

  if (!user) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "No se encontró la cuenta.",
      statusCode: 404,
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

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}

function isFailure(
  value: AuthenticatedUser | ServiceFailure,
): value is ServiceFailure {
  return "ok" in value && value.ok === false;
}

export class AccountDeletionService {
  async getMyLatestRequest(
    accessToken: string,
  ): Promise<UserRequestResult> {
    const auth = await authenticate(accessToken);
    if (isFailure(auth)) return auth;

    const request = await repository.findLatestByUserId(auth.id);
    return { ok: true, request };
  }

  async createRequest(
    accessToken: string,
    input: CreateAccountDeletionRequestInput,
  ): Promise<UserRequestResult> {
    const auth = await authenticate(accessToken);
    if (isFailure(auth)) return auth;

    if (!["passenger", "driver"].includes(auth.role)) {
      return {
        ok: false,
        code: "ACCOUNT_DELETION_ROLE_NOT_SUPPORTED",
        message:
          "Este flujo está disponible para cuentas de pasajero y conductor.",
        statusCode: 403,
      };
    }

    const pending = await repository.findPendingByUserId(auth.id);

    if (pending) {
      return {
        ok: false,
        code: "ACCOUNT_DELETION_ALREADY_PENDING",
        message:
          "Ya existe una solicitud pendiente de revisión para esta cuenta.",
        statusCode: 409,
      };
    }

    const request = await repository.create(
      auth.id,
      auth.role,
      input,
    );

    await repository.notifyAdminsOfNewRequest(
      request.id,
      auth.name,
      auth.role,
    );

    auditService.recordSafe({
      actorUserId: auth.id,
      eventType: "account_deletion.requested",
      entityType: "account_deletion_request",
      entityId: request.id,
      metadata: {
        requesterRole: auth.role,
      },
    });

    void mailService
      .sendAccountDeletionRequestReceived(
        auth.email,
        request.trackingCode,
      )
      .catch(() => {});

    return { ok: true, request };
  }

  async requestPublicVerification(
    input: PublicAccountDeletionCodeRequestInput,
    context: {
      requestIp?: string | null;
      requestUserAgent?: string | null;
    },
  ): Promise<PublicCodeResult> {
    const startedAt = Date.now();
    const email = input.email.trim().toLowerCase();
    const emailHash = sha256(email);
    const expiresMinutes = 10;

    try {
      const user = await usersRepository.findByEmail(email);

      if (
        !user ||
        !["passenger", "driver"].includes(user.role) ||
        user.status === "deleted"
      ) {
        return {
          ok: true,
          message: PUBLIC_CODE_MESSAGE,
          expiresMinutes,
        };
      }

      const recent = await repository.hasRecentPublicVerification(
        emailHash,
        new Date(Date.now() - 60_000),
      );

      if (recent) {
        return {
          ok: true,
          message: PUBLIC_CODE_MESSAGE,
          expiresMinutes,
        };
      }

      const code = randomInt(0, 1_000_000)
        .toString()
        .padStart(6, "0");
      const codeHash = sha256(`${emailHash}:${code}`);
      const verificationId =
        await repository.createPublicVerification({
          userId: user.id,
          emailHash,
          codeHash,
          expiresAt: new Date(
            Date.now() + expiresMinutes * 60_000,
          ),
          requestIp: normalizeContext(context.requestIp, 64),
          requestUserAgent: normalizeContext(
            context.requestUserAgent,
            500,
          ),
        });

      try {
        await mailService.sendAccountDeletionVerificationCode(
          user.email,
          code,
          expiresMinutes,
        );

        auditService.recordSafe({
          actorUserId: user.id,
          eventType: "account_deletion.public_code_sent",
          entityType: "account_deletion_verification",
          entityId: verificationId,
          metadata: {
            channel: "web",
          },
        });
      } catch {
        await repository
          .revokePublicVerification(verificationId)
          .catch(() => {});

        auditService.recordSafe({
          actorUserId: user.id,
          eventType: "account_deletion.public_code_delivery_failed",
          entityType: "account_deletion_verification",
          entityId: verificationId,
        });
      }

      return {
        ok: true,
        message: PUBLIC_CODE_MESSAGE,
        expiresMinutes,
      };
    } finally {
      await waitForMinimumDuration(startedAt);
    }
  }

  async submitPublicRequest(
    input: PublicAccountDeletionSubmitInput,
  ): Promise<PublicSubmitResult> {
    const email = input.email.trim().toLowerCase();
    const emailHash = sha256(email);
    const codeHash = sha256(`${emailHash}:${input.code}`);
    const user = await usersRepository.findByEmail(email);

    if (
      !user ||
      !["passenger", "driver"].includes(user.role) ||
      user.status === "deleted"
    ) {
      return {
        ok: false,
        code: "ACCOUNT_DELETION_PUBLIC_CODE_INVALID",
        message: "El código es inválido o venció.",
        statusCode: 400,
      };
    }

    const verifiedUserId =
      await repository.verifyAndConsumePublicCode(
        emailHash,
        codeHash,
      );

    if (verifiedUserId !== user.id) {
      return {
        ok: false,
        code: "ACCOUNT_DELETION_PUBLIC_CODE_INVALID",
        message: "El código es inválido o venció.",
        statusCode: 400,
      };
    }

    const existing = await repository.findPendingByUserId(user.id);

    if (existing) {
      const request = await repository.attachPublicContact(
        existing.id,
        emailHash,
      );

      return { ok: true, request };
    }

    const requestInput: CreateAccountDeletionRequestInput = {
      reason: input.reason,
    };

    if (input.comment) {
      requestInput.comment = input.comment;
    }

    const request = await repository.createPublicRequest(
      user.id,
      user.role,
      emailHash,
      requestInput,
    );

    await repository.notifyAdminsOfNewRequest(
      request.id,
      user.name,
      user.role,
    );

    auditService.recordSafe({
      actorUserId: user.id,
      eventType: "account_deletion.public_requested",
      entityType: "account_deletion_request",
      entityId: request.id,
      metadata: {
        requesterRole: user.role,
        channel: "web",
        trackingCode: request.trackingCode,
      },
    });

    void mailService
      .sendAccountDeletionRequestReceived(
        user.email,
        request.trackingCode,
      )
      .catch(() => {});

    return { ok: true, request };
  }

  async getPublicStatus(
    query: PublicAccountDeletionStatusQuery,
  ): Promise<PublicStatusResult> {
    const emailHash = sha256(query.email.trim().toLowerCase());
    const request = await repository.findPublicStatus(
      query.trackingCode,
      emailHash,
    );

    if (!request) {
      return {
        ok: false,
        code: "ACCOUNT_DELETION_TRACKING_NOT_FOUND",
        message:
          "No encontramos una solicitud con esos datos.",
        statusCode: 404,
      };
    }

    return { ok: true, request };
  }

  async listForAdmin(
    accessToken: string,
    query: ListAccountDeletionRequestsQuery,
  ): Promise<AdminListResult> {
    const auth = await authenticate(accessToken);
    if (isFailure(auth)) return auth;

    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "Solo un administrador puede revisar estas solicitudes.",
        statusCode: 403,
      };
    }

    const requests = await repository.list(query);
    return { ok: true, requests };
  }

  async reject(
    accessToken: string,
    requestId: string,
    input: ReviewAccountDeletionRequestInput,
  ): Promise<AdminRequestResult> {
    const auth = await authenticate(accessToken);
    if (isFailure(auth)) return auth;

    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "Solo un administrador puede rechazar la solicitud.",
        statusCode: 403,
      };
    }

    const detail = await repository.findAdminById(requestId);

    if (!detail) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "No se encontró la solicitud.",
        statusCode: 404,
      };
    }

    try {
      const request = await repository.reject(
        requestId,
        auth.id,
        input.note,
      );

      if (detail.userId) {
        await repository.notifyUserOfRejection(
          detail.userId,
          request.id,
          input.note,
          request.requesterRole,
        );
      }

      auditService.recordSafe({
        actorUserId: auth.id,
        eventType: "account_deletion.rejected",
        entityType: "account_deletion_request",
        entityId: request.id,
        metadata: {
          requesterRole: request.requesterRole,
        },
      });

      if (detail.requester?.email) {
        void mailService
          .sendAccountDeletionRejected(
            detail.requester.email,
            input.note,
          )
          .catch(() => {});
      }

      return { ok: true, request };
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

  async approve(
    accessToken: string,
    requestId: string,
    input: ReviewAccountDeletionRequestInput,
  ): Promise<AdminRequestResult> {
    const auth = await authenticate(accessToken);
    if (isFailure(auth)) return auth;

    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "Solo un administrador puede aprobar la solicitud.",
        statusCode: 403,
      };
    }

    const detail = await repository.findAdminById(requestId);

    if (!detail) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "No se encontró la solicitud.",
        statusCode: 404,
      };
    }

    if (detail.status !== "pending") {
      return {
        ok: false,
        code: "ACCOUNT_DELETION_NOT_PENDING",
        message: "La solicitud ya fue revisada.",
        statusCode: 409,
      };
    }

    if (!detail.userId || !detail.requester) {
      return {
        ok: false,
        code: "ACCOUNT_DELETION_USER_NOT_FOUND",
        message: "La cuenta asociada ya no existe.",
        statusCode: 409,
      };
    }

    if (!detail.canApprove) {
      return {
        ok: false,
        code: "ACCOUNT_DELETION_HAS_BLOCKERS",
        message:
          detail.blockers.join(" ") ||
          "La cuenta tiene operaciones pendientes que deben resolverse.",
        statusCode: 409,
      };
    }

    const originalEmail = detail.requester.email;

    try {
      const request = await repository.approveAndAnonymize(
        requestId,
        auth.id,
        input.note,
        detail.userId,
      );

      auditService.recordSafe({
        actorUserId: auth.id,
        eventType: "account_deletion.completed",
        entityType: "account_deletion_request",
        entityId: request.id,
        metadata: {
          deletedUserId: detail.userId,
          requesterRole: request.requesterRole,
          retainedOperationalRecords: true,
        },
      });

      void mailService
        .sendAccountDeletionCompleted(originalEmail)
        .catch(() => {});

      return { ok: true, request };
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
}
