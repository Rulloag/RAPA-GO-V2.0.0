import type { FastifyRequest, FastifyReply } from "fastify";
import { NoShowService } from "./noShow.service.js";
import { confirmNoShowSchema } from "./noShow.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const svc = new NoShowService();

function getToken(req: FastifyRequest): string {
  const auth = req.headers.authorization ?? "";
  return auth.replace(/^Bearer\s+/i, "");
}

export const noShowController = {
  async confirmNoShow(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = confirmNoShowSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(reply, {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors.map((e) => e.message).join("; "),
        statusCode: 400,
      });
    }

    const result = await svc.confirmNoShow(getToken(req), req.params.id, parsed.data);
    if (!result.ok) {
      return sendError(reply, {
        code:       result.code       ?? "INTERNAL_ERROR",
        message:    result.message    ?? "Internal error.",
        statusCode: result.statusCode ?? 500,
      });
    }
    return sendOk(reply, result.transaction, result.idempotentReplay ? 200 : 201);
  },
};
