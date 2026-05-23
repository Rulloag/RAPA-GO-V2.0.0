import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { NotificationsRepository } from "./notifications.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { Notification } from "../../db/schema/index.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const repo           = new NotificationsRepository();

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

export type NotificationsResult =
  | { ok: true; items: Notification[]; unreadCount: number }
  | { ok: false; code: string; message: string; statusCode: number };

export type VoidResult =
  | { ok: true }
  | { ok: false; code: string; message: string; statusCode: number };

export class NotificationsService {
  async getMyNotifications(accessToken: string): Promise<NotificationsResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const items      = await repo.findByUser(auth.userId);
    const unreadCount = await repo.countUnread(auth.userId);
    return { ok: true, items, unreadCount };
  }

  async markRead(accessToken: string, notificationId: string): Promise<VoidResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    await repo.markRead(notificationId, auth.userId);
    return { ok: true };
  }

  async markAllRead(accessToken: string): Promise<VoidResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    await repo.markAllRead(auth.userId);
    return { ok: true };
  }

  async dismiss(accessToken: string, notificationId: string): Promise<VoidResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    await repo.dismiss(notificationId, auth.userId);
    return { ok: true };
  }
}
