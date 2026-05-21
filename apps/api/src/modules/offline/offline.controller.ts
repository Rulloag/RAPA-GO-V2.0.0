import type { FastifyRequest, FastifyReply } from "fastify";
import { OfflineService } from "./offline.service.js";
import {
  createOfflineBookingSchema,
  syncOfflineBookingSchema,
  listOfflineBookingsQuerySchema,
  connectivityCheckSchema,
} from "./offline.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const offlineService = new OfflineService();

export const offlineController = {
  async createOfflineBooking(req: FastifyRequest, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const parsed = createOfflineBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, { statusCode: 400, code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body." });
    }

    const result = await offlineService.createOfflineBooking(token, parsed.data);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.booking, 201);
  },

  async listOfflineBookings(req: FastifyRequest, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const parsed = listOfflineBookingsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(reply, { statusCode: 400, code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid query." });
    }

    const result = await offlineService.listOfflineBookings(token, parsed.data);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.items);
  },

  async syncOfflineBooking(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const parsed = syncOfflineBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, { statusCode: 400, code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body." });
    }

    const result = await offlineService.syncOfflineBooking(token, req.params.id, parsed.data);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.booking);
  },

  async cancelOfflineBooking(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const result = await offlineService.cancelOfflineBooking(token, req.params.id);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.booking);
  },

  async connectivityCheck(req: FastifyRequest, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const parsed = connectivityCheckSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, { statusCode: 400, code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body." });
    }

    const result = await offlineService.logConnectivity(token, parsed.data);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, { id: result.log.id, checkedAt: result.log.checkedAt }, 201);
  },

  async getSyncQueue(req: FastifyRequest, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const result = await offlineService.getSyncQueue(token);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.items);
  },

  async confirmSyncItem(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const result = await offlineService.confirmSyncItem(token, req.params.id);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.item);
  },
};
