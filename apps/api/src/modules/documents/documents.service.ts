import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { DocumentsRepository } from "./documents.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { ROLE_DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL } from "./documents.constants.js";
import type { DocumentsServiceResult, DocumentCreateResult, DocumentUploadMetadataResult, DocumentResponse } from "./documents.types.js";
import type { UploadMetadataBody } from "./documents.schemas.js";
import type { UserDocument } from "../../db/schema/index.js";

const tokenService       = new TokenService();
const sessionService     = new SessionService();
const usersRepository    = new UsersRepository();
const documentsRepository = new DocumentsRepository();

function toResponse(doc: UserDocument): DocumentResponse {
  return {
    id:              doc.id,
    userId:          doc.userId,
    documentType:    doc.documentType,
    documentLabel:   DOCUMENT_TYPE_LABEL[doc.documentType] ?? doc.documentType,
    status:          doc.status,
    fileUrl:         doc.fileUrl,
    rejectionReason: doc.rejectionReason,
    uploadedAt:      doc.uploadedAt?.toISOString() ?? null,
    reviewedAt:      doc.reviewedAt?.toISOString() ?? null,
    createdAt:       doc.createdAt.toISOString(),
  };
}

/** Verify token and session; return user id + role or an error result. */
async function authenticate(
  accessToken: string,
): Promise<{ ok: true; userId: string; role: string } | { ok: false; code: string; message: string; statusCode: number }> {
  let payload;
  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, code: err.code, message: err.message, statusCode: err.statusCode };
    }
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 };
  }

  const hash = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);
  if (!valid) {
    return { ok: false, code: "AUTH_SESSION_REVOKED", message: "Session has been revoked.", statusCode: 401 };
  }

  const user = await usersRepository.findById(payload.sub);
  if (!user) {
    return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
  }

  return { ok: true, userId: user.id, role: user.role };
}

export class DocumentsService {
  async listDocuments(accessToken: string): Promise<DocumentsServiceResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const docs = await documentsRepository.findByUserId(auth.userId);
    return { ok: true, documents: docs.map(toResponse) };
  }

  async createDocument(accessToken: string, documentType: string): Promise<DocumentCreateResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    // Validate that the document type is allowed for this role
    const allowed = ROLE_DOCUMENT_TYPES[auth.role] ?? [];
    if (!allowed.includes(documentType)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: `Document type '${documentType}' is not valid for role '${auth.role}'.`,
        statusCode: 400,
      };
    }

    // Prevent duplicate document records for the same type
    const existing = await documentsRepository.findByUserIdAndType(auth.userId, documentType);
    if (existing) {
      return {
        ok: false,
        code: "DOCUMENT_ALREADY_EXISTS",
        message: `A record for document type '${documentType}' already exists.`,
        statusCode: 409,
      };
    }

    const doc = await documentsRepository.create(auth.userId, documentType);
    return { ok: true, document: toResponse(doc) };
  }

  async uploadMetadata(
    accessToken: string,
    documentId: string,
    input: UploadMetadataBody,
  ): Promise<DocumentUploadMetadataResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const doc = await documentsRepository.findById(documentId);
    if (!doc) {
      return { ok: false, code: "NOT_FOUND", message: "Document not found.", statusCode: 404 };
    }

    if (doc.userId !== auth.userId) {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Access denied.", statusCode: 403 };
    }

    if (doc.status === "approved") {
      return { ok: false, code: "DOCUMENT_ALREADY_APPROVED", message: "An approved document cannot be replaced.", statusCode: 409 };
    }

    // Sanitize filename: replace unsafe chars, then collapse consecutive dots to prevent path traversal
    const sanitized = input.fileName
      .replace(/[^a-zA-Z0-9._\-]/g, "_")
      .replace(/\.{2,}/g, "_");
    const fileUrl = `pending-storage://${documentId}/${sanitized}`;

    const updated = await documentsRepository.setUploadMetadata(documentId, fileUrl);
    if (!updated) {
      return { ok: false, code: "NOT_FOUND", message: "Document not found.", statusCode: 404 };
    }

    return { ok: true, document: toResponse(updated) };
  }
}
