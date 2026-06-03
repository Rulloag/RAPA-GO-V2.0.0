import type { FastifyRequest, FastifyReply } from "fastify";
import { RidesService } from "./rides.service.js";
import { createRideRequestSchema, cancelAcceptedSchema } from "./rides.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const ridesService = new RidesService();

function extractBearer(request: FastifyRequest): string | null {
  const auth = request.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export const ridesController = {
  async listMyRides(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const result = await ridesService.listMyRides(token);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result.rides);
  },

  async createRideRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const parsed = createRideRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, {
        code:       "VALIDATION_ERROR",
        message:    parsed.error.errors[0]?.message ?? "Invalid request body.",
        statusCode: 400,
      });
      return;
    }
    const result = await ridesService.createRideRequest(token, parsed.data);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result.ride, 201);
  },

  async listAvailableRides(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const result = await ridesService.listAvailableRides(token);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result.rides);
  },

  async acceptRideRequest(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const { id } = request.params;
    const result = await ridesService.acceptRideRequest(token, id);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result.ride);
  },

  async markEnRoute(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const { id } = request.params;
    const result = await ridesService.markEnRoute(token, id);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result.ride);
  },

  async markArrived(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const { id } = request.params;
    const result = await ridesService.markArrived(token, id);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result.ride);
  },

  async listDriverRides(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const result = await ridesService.listDriverRides(token);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result.rides);
  },

  async cancelRideRequest(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const { id } = request.params;
    const result = await ridesService.cancelRideRequest(token, id);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result.ride);
  },

  async completeRide(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const { id } = request.params;
    const result = await ridesService.completeRide(token, id);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result.ride);
  },

  async startRide(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const { id } = request.params;
    const result = await ridesService.startRide(token, id);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result.ride);
  },

  async getDriverLocation(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const { id } = request.params;
    const result = await ridesService.getDriverLocation(token, id);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, { location: result.location });
  },

  async cancelAcceptedRide(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const parsed = cancelAcceptedSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, {
        code:       "VALIDATION_ERROR",
        message:    parsed.error.errors[0]?.message ?? "Invalid request body.",
        statusCode: 400,
      });
      return;
    }
    const { id } = request.params;
    const result = await ridesService.cancelAcceptedRide(token, id, parsed.data);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result.ride);
  },
};
