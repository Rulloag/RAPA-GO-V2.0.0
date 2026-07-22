import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { LegalRepository } from "./legal.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type {
  LegalDocumentsResult, LegalDocumentResult, UserAcceptanceResult,
  UserAcceptancesResult, LegalDocumentResponse, UserAcceptanceResponse,
} from "./legal.types.js";
import type { LegalDocument, UserAcceptance } from "../../db/schema/index.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const legalRepo      = new LegalRepository();

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

function toDocResponse(d: LegalDocument): LegalDocumentResponse {
  return {
    id: d.id, type: d.type, version: d.version, title: d.title,
    effectiveDate: d.effectiveDate, isActive: d.isActive,
    createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
    content: d.content,
  };
}

function toAcceptanceResponse(a: UserAcceptance): UserAcceptanceResponse {
  return {
    id: a.id, userId: a.userId, legalDocumentId: a.legalDocumentId,
    versionAccepted: a.versionAccepted, acceptedAt: a.acceptedAt.toISOString(),
  };
}

export class LegalService {
  async listDocuments(filters: { type?: string; isActive?: boolean }): Promise<LegalDocumentsResult> {
    const items = await legalRepo.findAll(filters);
    return { ok: true, items: items.map(toDocResponse) };
  }

  async getDocument(id: string): Promise<LegalDocumentResult> {
    const doc = await legalRepo.findById(id);
    if (!doc) return { ok: false, code: "NOT_FOUND", message: "Document not found.", statusCode: 404 };
    return { ok: true, document: toDocResponse(doc) };
  }

  async getActive(): Promise<LegalDocumentsResult> {
    const items = await legalRepo.findActive();
    return { ok: true, items: items.map(toDocResponse) };
  }

  async createDocument(accessToken: string, input: {
    type: string; version: string; title: string; content: string; effectiveDate: string;
  }): Promise<LegalDocumentResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") return { ok: false, code: "FORBIDDEN", message: "Admin only.", statusCode: 403 };
    const doc = await legalRepo.create({ ...input, createdBy: auth.userId });
    return { ok: true, document: toDocResponse(doc) };
  }

  async updateDocument(accessToken: string, id: string, input: {
    title?: string; content?: string; effectiveDate?: string; isActive?: boolean;
  }): Promise<LegalDocumentResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") return { ok: false, code: "FORBIDDEN", message: "Admin only.", statusCode: 403 };
    const doc = await legalRepo.update(id, input);
    if (!doc) return { ok: false, code: "NOT_FOUND", message: "Document not found.", statusCode: 404 };
    return { ok: true, document: toDocResponse(doc) };
  }

  async createAcceptance(accessToken: string, input: {
    legalDocumentId: string; version: string;
  }, ipAddress?: string, userAgent?: string): Promise<UserAcceptanceResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const document = await legalRepo.findById(input.legalDocumentId);

    if (!document || !document.isActive) {
      return {
        ok: false,
        code: "LEGAL_DOCUMENT_NOT_ACTIVE",
        message: "El documento legal ya no está activo.",
        statusCode: 409,
      };
    }

    if (document.version !== input.version) {
      return {
        ok: false,
        code: "LEGAL_VERSION_MISMATCH",
        message:
          "La versión legal cambió. Vuelve a abrir el documento y acepta la versión vigente.",
        statusCode: 409,
      };
    }

    const acceptance = await legalRepo.createAcceptance({
      userId: auth.userId, legalDocumentId: input.legalDocumentId,
      versionAccepted: document.version,
      ...(ipAddress ? { ipAddress } : {}),
      ...(userAgent ? { userAgent } : {}),
    });
    return { ok: true, acceptance: toAcceptanceResponse(acceptance) };
  }

  async getMyAcceptances(accessToken: string): Promise<UserAcceptancesResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    const items = await legalRepo.findAcceptancesByUser(auth.userId);
    return { ok: true, items: items.map(toAcceptanceResponse) };
  }

  async listAcceptances(accessToken: string, filters: { userId?: string; page: number; limit: number }): Promise<UserAcceptancesResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") return { ok: false, code: "FORBIDDEN", message: "Admin only.", statusCode: 403 };
    const { items } = await legalRepo.listAcceptances(filters);
    return { ok: true, items: items.map(toAcceptanceResponse) };
  }

  async checkMissingAcceptances(accessToken: string, documentTypes: string[]): Promise<{ ok: true; missing: string[] } | { ok: false; code: string; message: string; statusCode: number }> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    const missing = await legalRepo.checkMissingAcceptances(auth.userId, documentTypes);
    return { ok: true, missing };
  }
}
