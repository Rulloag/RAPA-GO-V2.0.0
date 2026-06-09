import type { FastifyRequest, FastifyReply } from "fastify";
import { DriverOffersService } from "./driverOffers.service.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const svc = new DriverOffersService();

function getToken(req: FastifyRequest): string {
  return (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
}

export const driverOffersController = {
  async getActiveOffer(req: FastifyRequest, reply: FastifyReply) {
    const result = await svc.getActiveOffer(getToken(req));
    if (!result.ok) {
      return sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
    }
    return sendOk(reply, result.offer);
  },

  async acceptOffer(req: FastifyRequest<{ Params: { offerId: string } }>, reply: FastifyReply) {
    const result = await svc.acceptOffer(getToken(req), req.params.offerId);
    if (!result.ok) {
      return sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
    }
    return sendOk(reply, result.ride);
  },

  async rejectOffer(req: FastifyRequest<{ Params: { offerId: string } }>, reply: FastifyReply) {
    const result = await svc.rejectOffer(getToken(req), req.params.offerId);
    if (!result.ok) {
      return sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
    }
    return sendOk(reply, { rejected: true });
  },
};
