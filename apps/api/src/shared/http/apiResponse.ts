import type { FastifyReply } from "fastify";

/**
 * Helpers to send consistent JSON envelopes from any route handler.
 *
 * Success shape:  { ok: true,  data: T,        statusCode: number }
 * Error shape:    { ok: false, code: string, message: string, statusCode: number }
 */

export function sendOk<T>(reply: FastifyReply, data: T, statusCode = 200): FastifyReply {
  return reply.status(statusCode).send({ ok: true, data, statusCode });
}

export function sendError(
  reply: FastifyReply,
  opts: { code: string; message: string; statusCode: number },
): FastifyReply {
  return reply.status(opts.statusCode).send({
    ok: false,
    code: opts.code,
    message: opts.message,
    statusCode: opts.statusCode,
  });
}

export function sendNotImplemented(reply: FastifyReply): FastifyReply {
  return sendError(reply, {
    code: "NOT_IMPLEMENTED",
    message: "This endpoint is not yet implemented.",
    statusCode: 501,
  });
}
