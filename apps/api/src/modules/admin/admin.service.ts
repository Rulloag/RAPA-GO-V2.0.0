import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { AdminRepository } from "./admin.repository.js";
import { AuditService } from "../audit/audit.service.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { ListUsersQuery, UpdateUserStatusInput, ListDocumentsQuery, ReviewDocumentInput } from "./admin.schemas.js";
import type { AdminUsersListResult, AdminUserResult, AdminUserResponse, AdminDocumentResponse, AdminDocumentsListResult, AdminDocumentResult } from "./admin.types.js";
import type { AdminDocumentRow } from "./admin.repository.js";
import type { User } from "../users/users.types.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const adminRepo      = new AdminRepository();
const auditService   = new AuditService();

function toDocResponse(d: AdminDocumentRow): AdminDocumentResponse {
  return {
    id:              d.id,
    userId:          d.userId,
    userName:        d.userName,
    userEmail:       d.userEmail,
    userRole:        d.userRole,
    documentType:    d.documentType,
    status:          d.status,
    fileUrl:         d.fileUrl,
    rejectionReason: d.rejectionReason,
    uploadedAt:      d.uploadedAt?.toISOString() ?? null,
    reviewedAt:      d.reviewedAt?.toISOString() ?? null,
    createdAt:       d.createdAt.toISOString(),
  };
}

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

  async updateUserStatus(
    accessToken: string,
    targetUserId: string,
    input: UpdateUserStatusInput,
  ): Promise<AdminUserResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin access required.", statusCode: 403 };
    }

    if (auth.userId === targetUserId) {
      return { ok: false, code: "ADMIN_CANNOT_CHANGE_OWN_STATUS", message: "Admins cannot change their own status.", statusCode: 403 };
    }

    const existing = await adminRepo.findById(targetUserId);
    if (!existing) {
      return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
    }

    const updated = await adminRepo.updateStatus(targetUserId, input.status);
    if (!updated) {
      return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
    }

    auditService.recordSafe({
      eventType: "admin.user_status_changed",
      metadata:  { adminUserId: auth.userId, targetUserId, previousStatus: existing.status, newStatus: input.status },
    });

    return { ok: true, user: toResponse(updated) };
  }

  async listDocuments(accessToken: string, query: ListDocumentsQuery): Promise<AdminDocumentsListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin access required.", statusCode: 403 };
    }

    const rows = await adminRepo.listDocuments({
      status:       query.status,
      documentType: query.documentType,
      userId:       query.userId,
    });

    return { ok: true, documents: rows.map(toDocResponse) };
  }

  async reviewDocument(
    accessToken: string,
    documentId: string,
    input: ReviewDocumentInput,
  ): Promise<AdminDocumentResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin access required.", statusCode: 403 };
    }

    const existing = await adminRepo.findDocumentById(documentId);
    if (!existing) {
      return { ok: false, code: "NOT_FOUND", message: "Document not found.", statusCode: 404 };
    }

    const rejectionReason = input.status === "approved" ? null : (input.rejectionReason ?? null);
    const updated = await adminRepo.reviewDocument(documentId, input.status, rejectionReason);
    if (!updated) {
      return { ok: false, code: "NOT_FOUND", message: "Document not found.", statusCode: 404 };
    }

    auditService.recordSafe({
      eventType: "admin.document_reviewed",
      metadata:  { adminUserId: auth.userId, documentId, previousStatus: existing.status, newStatus: input.status },
    });

    return { ok: true, document: toDocResponse(updated) };
  }
}
