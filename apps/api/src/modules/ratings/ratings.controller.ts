import type { FastifyRequest, FastifyReply } from "fastify";
import { RatingsService } from "./ratings.service.js";
import { rateRideSchema } from "./ratings.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const ratingsService = new RatingsService();

export const ratingsController = {
  async rateRide(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const parsed = rateRideSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, { statusCode: 400, code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid input." });
    }

    const result = await ratingsService.rateRide(token, req.params.id, parsed.data);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.rating, 201);
  },

  async getRideRatings(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const result = await ratingsService.getRideRatings(token, req.params.id);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.ratings);
  },
};
