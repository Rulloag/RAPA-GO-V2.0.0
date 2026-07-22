import type { FastifyReply, FastifyRequest } from "fastify";
import { RatingsService } from "./ratings.service.js";
import { rateRideSchema } from "./ratings.schemas.js";
import { sendError, sendOk } from "../../shared/http/apiResponse.js";

const ratingsService = new RatingsService();

function extractBearer(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7);
}

export const ratingsController = {
  async rateRide(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });
      return;
    }
    const parsed = rateRideSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message ?? "Invalid input.",
      });
      return;
    }
    const result = await ratingsService.rateRide(token, request.params.id, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.rating, 201);
  },

  async getRideRatings(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });
      return;
    }
    const result = await ratingsService.getRideRatings(token, request.params.id);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.ratings);
  },

  async getMySummary(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });
      return;
    }
    const result = await ratingsService.getMyReceivedSummary(token);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.summary);
  },
};
