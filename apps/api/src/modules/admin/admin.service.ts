import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { AdminRepository } from "./admin.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { ListUsersQuery } from "./admin.schemas.js";
import type { AdminUsersListResult, AdminUserResponse } from "./admin.types.js";
import type { User } from "../users/users.types.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const adminRepo      = new AdminRepository();

function toResponse(u: User): AdminUserResponse {
  return {
    id:         u.id,
    email:      u.email,
    name:       u.name,
    role:       u.role,
    status:     u.status,
    isVerified: u.isVerified,
    createdAt:  u.createdAt.toISOString(),
  };
}

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

export class AdminService {
  async listUsers(accessToken: string, query: ListUsersQuery): Promise<AdminUsersListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin access required.", statusCode: 403 };
    }

    const rows = await adminRepo.listUsers({
      role:   query.role,
      status: query.status,
      search: query.search,
    });

    return { ok: true, users: rows.map(toResponse) };
  }
}
