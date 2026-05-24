import type { FastifyRequest, FastifyReply } from "fastify";
import { TokenService } from "../../modules/auth/token.service.js";
import { SessionService } from "../../modules/auth/session.service.js";
import { LegalRepository } from "../../modules/legal/legal.repository.js";
import { AppError } from "../errors/AppError.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const legalRepo      = new LegalRepository();

export function requireLegalAcceptance(documentTypes: string[]) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      reply.status(401).send({ ok: false, code: "UNAUTHORIZED", message: "Missing token." });
      return;
    }

    let payload;
    try {
      payload = tokenService.verifyAccessToken(token);
    } catch (err) {
      const msg = err instanceof AppError ? err.message : "Invalid token.";
      reply.status(401).send({ ok: false, code: "UNAUTHORIZED", message: msg });
      return;
    }

    const valid = await sessionService.isSessionValid(tokenService.hashToken(token));
    if (!valid) {
      reply.status(401).send({ ok: false, code: "AUTH_SESSION_REVOKED", message: "Session revoked." });
      return;
    }

    const missing = await legalRepo.checkMissingAcceptances(payload.sub, documentTypes);
    if (missing.length > 0) {
      reply.status(403).send({
        ok: false,
        code: "LEGAL_ACCEPTANCE_REQUIRED",
        message: "Debes aceptar los documentos legales requeridos antes de continuar.",
        missing,
      });
      return;
    }
  };
}
