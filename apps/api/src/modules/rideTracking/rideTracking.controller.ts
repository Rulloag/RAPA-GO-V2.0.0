import type { FastifyReply, FastifyRequest } from "fastify";
import { sendError, sendOk } from "../../shared/http/apiResponse.js";
import {
  rideLocationBatchSchema,
  rideLocationRouteQuerySchema,
  rideLocationUpdateSchema,
} from "./rideTracking.schemas.js";
import { RideTrackingService } from "./rideTracking.service.js";

const service = new RideTrackingService();

function tokenFrom(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

function requireToken(request: FastifyRequest, reply: FastifyReply): string | null {
  const token = tokenFrom(request);
  if (!token) {
    sendError(reply, {
      code: "UNAUTHORIZED",
      message: "Missing Bearer token.",
      statusCode: 401,
    });
  }
  return token;
}

function serviceError(
  reply: FastifyReply,
  result: { code: string; message: string; statusCode: number },
): void {
  sendError(reply, result);
}

export const rideTrackingController = {
  async publish(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = rideLocationUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message ?? "Invalid location payload.",
        statusCode: 400,
      });
      return;
    }

    const result = await service.publish(token, request.params.id, parsed.data);
    if (!result.ok) {
      serviceError(reply, result);
      return;
    }

    sendOk(reply, result.data, 201);
  },

  /**
   * Responde 200 incluso con puntos rechazados: el éxito parcial es normal en
   * un lote y el cliente debe poder vaciar su cola con cualquier 2xx. Si esto
   * devolviera un error por un solo punto malo, ese punto bloquearía la cabeza
   * de la cola para siempre.
   */
  async publishBatch(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = rideLocationBatchSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.errors[0]?.message ?? "Invalid location batch payload.",
        statusCode: 400,
      });
      return;
    }

    const result = await service.publishBatch(
      token,
      request.params.id,
      parsed.data.points,
    );
    if (!result.ok) {
      serviceError(reply, result);
      return;
    }

    sendOk(reply, result.data);
  },

  async latest(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const result = await service.latest(token, request.params.id);
    if (!result.ok) {
      serviceError(reply, result);
      return;
    }

    sendOk(reply, result.data);
  },

  async route(
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: { limit?: string | number };
    }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = rideLocationRouteQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message ?? "Invalid route query.",
        statusCode: 400,
      });
      return;
    }

    const result = await service.route(token, request.params.id, parsed.data.limit);
    if (!result.ok) {
      serviceError(reply, result);
      return;
    }

    sendOk(reply, result.data);
  },
};
