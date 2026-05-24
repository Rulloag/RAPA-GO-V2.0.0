import type { FastifyRequest, FastifyReply } from "fastify";
import { referralsService } from "./referrals.service.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

export const referralsController = {
  async getMyReferral(req: FastifyRequest, reply: FastifyReply) {
    const token = (req.headers.authorization ?? "").replace("Bearer ", "");
    const result = await referralsService.getMyReferral(token);
    if (!result.ok) return sendError(reply, result);
    return sendOk(reply, result.data);
  },

  async generateCode(req: FastifyRequest, reply: FastifyReply) {
    const token = (req.headers.authorization ?? "").replace("Bearer ", "");
    const body  = req.body as { code?: string } | undefined;
    const result = await referralsService.generateCode(token, body?.code);
    if (!result.ok) return sendError(reply, result);
    return sendOk(reply, result.data, 201);
  },

  async applyCode(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as { code?: string; userId?: string } | undefined;
    if (!body?.code) return sendError(reply, { code: "VALIDATION_ERROR", message: "code is required.", statusCode: 400 });
    const result = await referralsService.applyCode(body.code, body.userId);
    if (!result.ok) return sendError(reply, result);
    return sendOk(reply, result.data);
  },

  async convertReferral(req: FastifyRequest, reply: FastifyReply) {
    const token = (req.headers.authorization ?? "").replace("Bearer ", "");
    const body  = req.body as { referralUseId?: string; conversionValue?: number } | undefined;
    if (!body?.referralUseId || body.conversionValue === undefined) {
      return sendError(reply, { code: "VALIDATION_ERROR", message: "referralUseId and conversionValue are required.", statusCode: 400 });
    }
    const result = await referralsService.convertReferral(token, body.referralUseId, body.conversionValue);
    if (!result.ok) return sendError(reply, result);
    return sendOk(reply, result.data);
  },

  async adminListCodes(req: FastifyRequest, reply: FastifyReply) {
    const token = (req.headers.authorization ?? "").replace("Bearer ", "");
    const query = req.query as { page?: string; limit?: string };
    const page  = Number(query.page  ?? 1);
    const limit = Number(query.limit ?? 20);
    const result = await referralsService.adminListCodes(token, page, limit);
    if (!result.ok) return sendError(reply, result);
    return sendOk(reply, result.data);
  },

  async adminListUses(req: FastifyRequest, reply: FastifyReply) {
    const token  = (req.headers.authorization ?? "").replace("Bearer ", "");
    const params = req.params as { id: string };
    const result = await referralsService.adminListUses(token, params.id);
    if (!result.ok) return sendError(reply, result);
    return sendOk(reply, result.data);
  },

  async adminCreateCampaignCode(req: FastifyRequest, reply: FastifyReply) {
    const token = (req.headers.authorization ?? "").replace("Bearer ", "");
    const body  = req.body as {
      code?: string;
      type?: string;
      discountAmount?: number;
      discountType?: string;
      maxUses?: number | null;
      expiresAt?: string | null;
    } | undefined;
    if (!body?.code || !body.type || body.discountAmount === undefined || !body.discountType) {
      return sendError(reply, { code: "VALIDATION_ERROR", message: "code, type, discountAmount, discountType are required.", statusCode: 400 });
    }
    const type         = body.type === "partner" ? "partner" : "promo" as const;
    const discountType = body.discountType === "fixed_amount" ? "fixed_amount" : "percentage" as const;
    const result = await referralsService.adminCreateCampaignCode(token, {
      code:           body.code,
      type,
      discountAmount: body.discountAmount,
      discountType,
      maxUses:        body.maxUses ?? null,
      expiresAt:      body.expiresAt ?? null,
    });
    if (!result.ok) return sendError(reply, result);
    return sendOk(reply, result.data, 201);
  },
};
