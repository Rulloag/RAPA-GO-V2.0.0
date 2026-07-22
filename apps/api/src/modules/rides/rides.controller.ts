import type { FastifyRequest, FastifyReply } from "fastify";

import { RidesService } from "./rides.service.js";
import {
  createRideRequestSchema,
  cancelAcceptedSchema,
  adminPolicyChargeReviewSchema,
  adminUpsertApprovePolicyChargeSchema,
} from "./rides.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const ridesService = new RidesService();

function extractBearer(request: FastifyRequest): string | null {
  const auth = request.headers["authorization"];

  if (!auth || !auth.startsWith("Bearer ")) return null;

  return auth.slice(7);
}

function requireToken(
  request: FastifyRequest,
  reply: FastifyReply,
): string | null {
  const token = extractBearer(request);

  if (!token) {
    sendError(reply, {
      code: "UNAUTHORIZED",
      message: "Missing Bearer token.",
      statusCode: 401,
    });

    return null;
  }

  return token;
}

function sendServiceError(
  reply: FastifyReply,
  result: {
    code: string;
    message: string;
    statusCode: number;
  },
): void {
  sendError(reply, {
    code: result.code,
    message: result.message,
    statusCode: result.statusCode,
  });
}

export const ridesController = {
  async listMyRides(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const result = await ridesService.listMyRides(token);

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.rides);
  },

  async createRideRequest(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = createRideRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.errors[0]?.message ??
          "Invalid request body.",
        statusCode: 400,
      });
      return;
    }

    const result = await ridesService.createRideRequest(
      token,
      parsed.data,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.ride, 201);
  },

  async listAvailableRides(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const result = await ridesService.listAvailableRides(token);

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.rides);
  },

  async acceptRideRequest(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const result = await ridesService.acceptRideRequest(
      token,
      request.params.id,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.ride);
  },

  async markEnRoute(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const result = await ridesService.markEnRoute(
      token,
      request.params.id,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.ride);
  },

  async markArrived(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const result = await ridesService.markArrived(
      token,
      request.params.id,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.ride);
  },

  async startRide(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const result = await ridesService.startRide(
      token,
      request.params.id,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.ride);
  },

  async completeRide(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const result = await ridesService.completeRide(
      token,
      request.params.id,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.ride);
  },

  async listDriverRides(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const result = await ridesService.listDriverRides(token);

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.rides);
  },

  async cancelRideRequest(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = cancelAcceptedSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.errors[0]?.message ??
          "Invalid request body.",
        statusCode: 400,
      });
      return;
    }

    const result = await ridesService.cancelRideRequest(
      token,
      request.params.id,
      parsed.data,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
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

  async acceptAnyDriver(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const { id } = request.params;
    const result = await ridesService.acceptAnyDriver(token, id);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result.ride);
  },

  async cancelAcceptedRide(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = cancelAcceptedSchema.safeParse(request.body);

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.errors[0]?.message ??
          "Invalid request body.",
        statusCode: 400,
      });
      return;
    }

    const result = await ridesService.cancelAcceptedRide(
      token,
      request.params.id,
      parsed.data,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.ride);
  },

  async declareNoShow(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const result = await ridesService.declareNoShow(
      token,
      request.params.id,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.ride);
  },

  async listMyApprovedPolicyCharges(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const result =
      await ridesService.listMyApprovedPolicyCharges(token);

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.charges);
  },

  async adminListPolicyCharges(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const result =
      await ridesService.adminListPolicyCharges(token);

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.charges);
  },

  async adminApprovePolicyCharge(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = adminPolicyChargeReviewSchema.safeParse(
      request.body,
    );

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.errors[0]?.message ??
          "Invalid request body.",
        statusCode: 400,
      });
      return;
    }

    const result =
      await ridesService.adminApprovePolicyCharge(
        token,
        request.params.id,
        parsed.data,
      );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.charge);
  },

  async adminUpsertAndApprovePolicyCharge(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed =
      adminUpsertApprovePolicyChargeSchema.safeParse(
        request.body,
      );

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.errors[0]?.message ??
          "Invalid request body.",
        statusCode: 400,
      });
      return;
    }

    const result =
      await ridesService.adminUpsertAndApprovePolicyCharge(
        token,
        parsed.data,
      );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.charge, 201);
  },

  async adminWaivePolicyCharge(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = adminPolicyChargeReviewSchema.safeParse(
      request.body,
    );

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.errors[0]?.message ??
          "Invalid request body.",
        statusCode: 400,
      });
      return;
    }

    const result = await ridesService.adminWaivePolicyCharge(
      token,
      request.params.id,
      parsed.data,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.charge);
  },
};