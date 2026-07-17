import {
  createHash,
  randomBytes,
} from "node:crypto";
import { AuditService } from "../audit/audit.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { AuthCredentialsRepository } from "./authCredentials.repository.js";
import { MailService } from "./mail.service.js";
import { PasswordService } from "./password.service.js";
import { PasswordResetRepository } from "./passwordReset.repository.js";
import type {
  ForgotPasswordRequest,
  PasswordResetServiceResult,
  ResetPasswordRequest,
} from "./auth.types.js";

const GENERIC_FORGOT_MESSAGE =
  "Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.";

const INVALID_RESET_MESSAGE =
  "El enlace venció, ya fue utilizado o no es válido. Solicita uno nuevo.";

const usersRepository = new UsersRepository();
const credentialsRepository = new AuthCredentialsRepository();
const passwordResetRepository = new PasswordResetRepository();
const passwordService = new PasswordService();
const mailService = new MailService();
const auditService = new AuditService();

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getTokenTtlMinutes(): number {
  const raw =
    process.env["PASSWORD_RESET_TOKEN_TTL_MINUTES"]?.trim() ??
    "15";
  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    return 15;
  }

  return Math.min(60, Math.max(5, Math.round(parsed)));
}

function getRequestCooldownSeconds(): number {
  const raw =
    process.env["PASSWORD_RESET_COOLDOWN_SECONDS"]?.trim() ??
    "60";
  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    return 60;
  }

  return Math.min(900, Math.max(30, Math.round(parsed)));
}

function getPasswordResetFrontendUrl(token: string): string {
  const configured =
    process.env["PASSWORD_RESET_FRONTEND_URL"]?.trim();

  const base = configured
    ? configured.replace(/\/$/, "")
    : `${(
        process.env["FRONTEND_URL"] ||
        "http://localhost:5173"
      ).replace(/\/$/, "")}/auth/reset-password`;

  const separator = base.includes("?") ? "&" : "?";

  return `${base}${separator}token=${encodeURIComponent(token)}`;
}

function normalizeContextText(
  value: string | null | undefined,
  maximumLength: number,
): string | null {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maximumLength);
}

async function waitForMinimumDuration(
  startedAt: number,
  minimumMilliseconds = 450,
): Promise<void> {
  const remaining = minimumMilliseconds - (Date.now() - startedAt);

  if (remaining > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, remaining);
    });
  }
}

export class PasswordResetService {
  async requestPasswordReset(
    input: ForgotPasswordRequest,
    context: {
      requestIp?: string | null;
      requestUserAgent?: string | null;
    },
  ): Promise<PasswordResetServiceResult> {
    const startedAt = Date.now();
    const email = input.email.toLowerCase().trim();

    try {
      const user = await usersRepository.findByEmail(email);

      if (
        !user ||
        user.status === "suspended" ||
        user.status === "banned"
      ) {
        return {
          ok: true,
          message: GENERIC_FORGOT_MESSAGE,
        };
      }

      // Facebook-only accounts currently have no local password to reset.
      const credentials =
        await credentialsRepository.findByUserId(user.id);

      if (!credentials) {
        return {
          ok: true,
          message: GENERIC_FORGOT_MESSAGE,
        };
      }

      const cooldownSeconds = getRequestCooldownSeconds();
      const hasRecentRequest =
        await passwordResetRepository.hasRecentActiveRequest(
          user.id,
          new Date(Date.now() - cooldownSeconds * 1000),
        );

      if (hasRecentRequest) {
        return {
          ok: true,
          message: GENERIC_FORGOT_MESSAGE,
        };
      }

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = sha256(rawToken);
      const expiresMinutes = getTokenTtlMinutes();
      const expiresAt = new Date(
        Date.now() + expiresMinutes * 60_000,
      );

      await passwordResetRepository.create({
        userId: user.id,
        tokenHash,
        expiresAt,
        requestIp: normalizeContextText(
          context.requestIp,
          64,
        ),
        requestUserAgent: normalizeContextText(
          context.requestUserAgent,
          500,
        ),
      });

      try {
        await mailService.sendPasswordResetEmail({
          to: user.email,
          resetUrl: getPasswordResetFrontendUrl(rawToken),
          expiresMinutes,
        });

        auditService.recordSafe({
          eventType: "auth.password_reset.requested",
          entityType: "user",
          entityId: user.id,
          actorUserId: user.id,
          metadata: {
            delivery: "email",
          },
        });
      } catch {
        // An undelivered token must never remain usable.
        await passwordResetRepository
          .revokeByTokenHash(tokenHash)
          .catch(() => {});

        auditService.recordSafe({
          eventType: "auth.password_reset.delivery_failed",
          entityType: "user",
          entityId: user.id,
          actorUserId: user.id,
          metadata: {
            delivery: "email",
          },
        });
      }

      return {
        ok: true,
        message: GENERIC_FORGOT_MESSAGE,
      };
    } finally {
      // Reduces obvious timing differences for unknown emails.
      await waitForMinimumDuration(startedAt);
    }
  }

  async resetPassword(
    input: ResetPasswordRequest,
  ): Promise<PasswordResetServiceResult> {
    const tokenHash = sha256(input.token);
    const passwordHash =
      await passwordService.hashPassword(input.newPassword);

    const userId =
      await passwordResetRepository.consumeAndResetPassword({
        tokenHash,
        passwordHash,
      });

    if (!userId) {
      auditService.recordSafe({
        eventType: "auth.password_reset.failure",
        entityType: "password_reset_token",
        metadata: {
          reason: "invalid_expired_used_or_revoked",
        },
      });

      return {
        ok: false,
        code: "AUTH_PASSWORD_RESET_INVALID",
        message: INVALID_RESET_MESSAGE,
        statusCode: 400,
      };
    }

    auditService.recordSafe({
      eventType: "auth.password_reset.success",
      entityType: "user",
      entityId: userId,
      actorUserId: userId,
      metadata: {
        sessionsRevoked: true,
      },
    });

    const user = await usersRepository.findById(userId);

    if (user) {
      await mailService
        .sendPasswordChangedEmail(user.email)
        .catch(() => {
          auditService.recordSafe({
            eventType:
              "auth.password_reset.confirmation_delivery_failed",
            entityType: "user",
            entityId: user.id,
            actorUserId: user.id,
            metadata: {
              delivery: "email",
            },
          });
        });
    }

    return {
      ok: true,
      message:
        "Tu contraseña fue actualizada. Inicia sesión nuevamente.",
    };
  }
}
