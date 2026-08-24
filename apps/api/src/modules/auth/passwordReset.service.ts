import { env } from "../../config/env.js";
import {
  createHash,
  randomBytes,
} from "node:crypto";
import { AuditService } from "../audit/audit.service.js";
import { UsersRepository } from "../users/users.repository.js";
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

export function getPasswordResetFrontendUrl(token: string): string {
  const configured =
    process.env["PASSWORD_RESET_FRONTEND_URL"]?.trim();

  let base: string;
  if (configured) {
    base = configured.replace(/\/$/, "");
  } else {
    try {
      base = `${env.frontendUrl}/auth/reset-password`;
    } catch {
      throw new Error("Missing environment variable: FRONTEND_URL");
    }
  }

  if (
    env.nodeEnv === "production" &&
    /localhost|127\.0\.0\.1/i.test(base)
  ) {
    throw new Error(
      "PASSWORD_RESET_FRONTEND_URL/FRONTEND_URL must not fall back to localhost in production.",
    );
  }

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
      } catch (deliveryError) {
        console.warn(
          JSON.stringify({
            scope: "AUTH",
            event: "password_reset.delivery_failed",
            userId: user.id,
            errorKind:
              deliveryError instanceof Error
                ? deliveryError.name
                : "unknown",
          }),
        );
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
