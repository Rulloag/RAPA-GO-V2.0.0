import type { FastifyRequest, FastifyReply } from "fastify";
import { RentalService } from "./rental.service.js";
import {
  createVehicleSchema, updateVehicleSchema, updateVehicleStatusSchema,
  createRentalBookingSchema, cancelRentalSchema,
} from "./rental.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const rentalService = new RentalService();

function extractBearer(request: FastifyRequest): string | null {
  const auth = request.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export const rentalController = {
  async getMyVehicles(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await rentalService.getMyVehicles(token);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result);
  },

  async createVehicle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = createVehicleSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body.", statusCode: 400 });
      return;
    }
    const result = await rentalService.createVehicle(token, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.vehicle);
  },

  async updateVehicle(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = updateVehicleSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body.", statusCode: 400 });
      return;
    }
    const result = await rentalService.updateVehicle(token, request.params.id, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.vehicle);
  },

  async updateVehicleStatus(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = updateVehicleStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body.", statusCode: 400 });
      return;
    }
    const result = await rentalService.updateVehicleStatus(token, request.params.id, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.vehicle);
  },

  async getMyOperatorBookings(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const q = request.query as Record<string, string>;
    const page  = Math.max(1, parseInt(q["page"]  ?? "1", 10));
    const limit = Math.max(1, parseInt(q["limit"] ?? "20", 10));
    const result = await rentalService.getMyOperatorBookings(token, page, limit);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result);
  },

  async confirmBooking(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await rentalService.confirmBooking(token, request.params.id);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.booking);
  },

  async completeBooking(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await rentalService.completeBooking(token, request.params.id);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.booking);
  },

  async cancelOperatorBooking(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = cancelRentalSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body.", statusCode: 400 });
      return;
    }
    const result = await rentalService.cancelOperatorBooking(token, request.params.id, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.booking);
  },

  async listAvailableVehicles(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const q = request.query as Record<string, string>;
    const page     = Math.max(1, parseInt(q["page"]     ?? "1",  10));
    const limit    = Math.max(1, parseInt(q["limit"]    ?? "20", 10));
    const filters = {
      page,
      limit,
      ...(q["type"]     ? { type:     q["type"]     } : {}),
      ...(q["dateFrom"] ? { dateFrom: q["dateFrom"] } : {}),
      ...(q["dateTo"]   ? { dateTo:   q["dateTo"]   } : {}),
    };
    const result = await rentalService.listAvailableVehicles(token, filters);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result);
  },

  async getVehicle(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await rentalService.getVehicle(token, request.params.id);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.vehicle);
  },

  async createRentalBooking(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = createRentalBookingSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body.", statusCode: 400 });
      return;
    }
    const result = await rentalService.createRentalBooking(token, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.booking);
  },

  async getMyRentalBookings(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const q = request.query as Record<string, string>;
    const page  = Math.max(1, parseInt(q["page"]  ?? "1",  10));
    const limit = Math.max(1, parseInt(q["limit"] ?? "20", 10));
    const result = await rentalService.getMyRentalBookings(token, page, limit);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result);
  },

  async cancelRentalBooking(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = cancelRentalSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body.", statusCode: 400 });
      return;
    }
    const result = await rentalService.cancelRentalBooking(token, request.params.id, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.booking);
  },
};
