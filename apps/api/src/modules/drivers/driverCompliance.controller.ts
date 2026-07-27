import type { FastifyReply, FastifyRequest } from "fastify";

import { sendError, sendOk } from "../../shared/http/apiResponse.js";
import { DriverComplianceService } from "./driverCompliance.service.js";
import { upsertDriverRestScheduleSchema } from "./driverCompliance.schemas.js";

const complianceService = new DriverComplianceService();

function getToken(request: FastifyRequest): string {
  const authorization = request.headers.authorization ?? "";
  return authorization.replace(/^Bearer\s+/i, "");
}

function sendResultError(
  reply: FastifyReply,
  result: { code: string; message: string; statusCode: number },
) {
  return sendError(reply, {
    code: result.code,
    message: result.message,
    statusCode: result.statusCode,
  });
}

export const driverComplianceController = {
  async getMyRestSchedule(request: FastifyRequest, reply: FastifyReply) {
    const result = await complianceService.getMyRestSchedule(getToken(request));
    if (result.ok === false) return sendResultError(reply, result);
    return sendOk(reply, result.compliance);
  },

  async upsertMyRestSchedule(request: FastifyRequest, reply: FastifyReply) {
    const parsed = upsertDriverRestScheduleSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.errors.map((item) => item.message).join("; ") ||
          "Invalid rest schedule.",
        statusCode: 400,
      });
    }

    const result = await complianceService.upsertMyRestSchedule(
      getToken(request),
      parsed.data,
    );
    if (result.ok === false) return sendResultError(reply, result);
    return sendOk(reply, result.compliance);
  },

  async startMyRest(request: FastifyRequest, reply: FastifyReply) {
    const result = await complianceService.startMyRest(getToken(request));
    if (result.ok === false) return sendResultError(reply, result);
    return sendOk(reply, result.compliance);
  },

  async continueWorking(request: FastifyRequest, reply: FastifyReply) {
    const result = await complianceService.continueWorking(getToken(request));
    if (result.ok === false) return sendResultError(reply, result);
    return sendOk(reply, result.compliance);
  },

  async adminListServiceSchedules(
    request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
    reply: FastifyReply,
  ) {
    const result = await complianceService.adminListServiceScheduleReport(
      getToken(request),
      request.query ?? {},
    );
    if (result.ok === false) return sendResultError(reply, result);
    return sendOk(reply, result.schedules);
  },

  async adminListAssignmentReport(
    request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
    reply: FastifyReply,
  ) {
    const result = await complianceService.adminListAssignmentReport(
      getToken(request),
      request.query ?? {},
    );
    if (result.ok === false) return sendResultError(reply, result);
    return sendOk(reply, result.assignments);
  },

  async adminListRestPeriodReport(
    request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
    reply: FastifyReply,
  ) {
    const result = await complianceService.adminListRestPeriodReport(
      getToken(request),
      request.query ?? {},
    );
    if (result.ok === false) return sendResultError(reply, result);
    return sendOk(reply, result.periods);
  },
};
