import type { FastifyRequest, FastifyReply } from "fastify";
import { TouristService } from "./tourist.service.js";
import {
  createServiceSchema, updateServiceSchema,
  createBookingSchema, cancelBookingSchema, setServiceStatusSchema,
} from "./tourist.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const touristService = new TouristService();

function extractBearer(request: FastifyRequest): string | null {
  const auth = request.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export const touristController = {
  async listGuides(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const q = request.query as Record<string, string>;
    const result = await touristService.listGuides(token, {
      ...(q["name"]     ? { name:     q["name"]     } : {}),
      ...(q["language"] ? { language: q["language"] } : {}),
    });
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result);
  },

  async getGuide(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await touristService.getGuide(token, request.params.id);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.guide);
  },

  async listGuideServices(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await touristService.listGuideServices(token, request.params.id);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result);
  },

  async getMyServices(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await touristService.getMyServices(token);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result);
  },

  async createService(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = createServiceSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body.", statusCode: 400 });
      return;
    }
    const result = await touristService.createService(token, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.service, 201);
  },

  async updateService(request: FastifyRequest<{ Params: { serviceId: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = updateServiceSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body.", statusCode: 400 });
      return;
    }
    const result = await touristService.updateService(token, request.params.serviceId, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.service);
  },

  async setServiceStatus(request: FastifyRequest<{ Params: { serviceId: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = setServiceStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body.", statusCode: 400 });
      return;
    }
    const result = await touristService.setServiceStatus(token, request.params.serviceId, parsed.data.status);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.service);
  },

  async createBooking(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = createBookingSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body.", statusCode: 400 });
      return;
    }
    const result = await touristService.createBooking(token, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.booking, 201);
  },

  async getMyBookings(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const q = request.query as Record<string, string>;
    const page  = Math.max(1, parseInt(q["page"]  ?? "1",  10));
    const limit = Math.min(50, parseInt(q["limit"] ?? "20", 10));
    const result = await touristService.getMyBookings(token, page, limit);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result);
  },

  async cancelBooking(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = cancelBookingSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body.", statusCode: 400 });
      return;
    }
    const result = await touristService.cancelBooking(token, request.params.id, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.booking);
  },

  async getGuideBookings(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const q = request.query as Record<string, string>;
    const page  = Math.max(1, parseInt(q["page"]  ?? "1",  10));
    const limit = Math.min(50, parseInt(q["limit"] ?? "20", 10));
    const result = await touristService.getMyGuideBookings(token, page, limit);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result);
  },

  async confirmBooking(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await touristService.confirmBooking(token, request.params.id);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.booking);
  },

  async completeBooking(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await touristService.completeBooking(token, request.params.id);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.booking);
  },

  async getServicePricing(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await touristService.getServicePricing(token, request.params.id);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.pricing);
  },
};
