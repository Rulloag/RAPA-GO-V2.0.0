import type { FastifyRequest, FastifyReply } from "fastify";
import { AdminService } from "./admin.service.js";
import { listUsersQuerySchema, updateUserStatusSchema, listDocumentsQuerySchema, reviewDocumentSchema, adminListRidesQuerySchema, adminAssignDriverSchema, adminCancelRideSchema, adminSyncToRideSchema } from "./admin.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const adminService = new AdminService();

export const adminController = {
  async listUsers(req: FastifyRequest, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const parsed = listUsersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(reply, { statusCode: 400, code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid query params." });
    }

    const result = await adminService.listUsers(token, parsed.data);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.users);
  },

  async updateUserStatus(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const parsed = updateUserStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, { statusCode: 400, code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body." });
    }

    const result = await adminService.updateUserStatus(token, req.params.id, parsed.data);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.user);
  },

  async listDocuments(req: FastifyRequest, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const parsed = listDocumentsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(reply, { statusCode: 400, code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid query params." });
    }

    const result = await adminService.listDocuments(token, parsed.data);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.documents);
  },

  async reviewDocument(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const parsed = reviewDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, { statusCode: 400, code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body." });
    }

    const result = await adminService.reviewDocument(token, req.params.id, parsed.data);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.document);
  },

  async listRides(req: FastifyRequest, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const parsed = adminListRidesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(reply, { statusCode: 400, code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid query params." });
    }

    const result = await adminService.listRides(token, parsed.data);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.rides);
  },

  async listActiveDrivers(req: FastifyRequest, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const result = await adminService.listActiveDrivers(token);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.drivers);
  },

  async assignDriver(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const parsed = adminAssignDriverSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, { statusCode: 400, code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body." });
    }

    const result = await adminService.assignDriver(token, req.params.id, parsed.data);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.ride);
  },

  async adminCancelRide(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const parsed = adminCancelRideSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, { statusCode: 400, code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body." });
    }

    const result = await adminService.adminCancelRide(token, req.params.id, parsed.data);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.ride);
  },

  async syncToRide(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const parsed = adminSyncToRideSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, { statusCode: 400, code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body." });
    }

    const result = await adminService.syncToRide(token, req.params.id, parsed.data);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.ride, 201);
  },

  async setDriverVehicleCategory(
    req: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply,
  ) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return sendError(reply, {
        statusCode: 401,
        code: "UNAUTHORIZED",
        message: "Missing access token.",
      });
    }

    const { adminSetDriverVehicleCategorySchema } = await import(
      "../drivers/driverProfile.schemas.js"
    );
    const parsed = adminSetDriverVehicleCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message ?? "Invalid body.",
      });
    }

    const result = await adminService.setDriverVehicleCategory(
      token,
      req.params.userId,
      parsed.data.vehicleCategory,
    );
    if (!result.ok) {
      return sendError(reply, {
        statusCode: result.statusCode,
        code: result.code,
        message: result.message,
      });
    }
    return sendOk(reply, result.profile);
  },
};
