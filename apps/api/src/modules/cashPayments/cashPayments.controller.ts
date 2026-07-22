import type { FastifyReply, FastifyRequest } from "fastify";
import { sendError, sendOk } from "../../shared/http/apiResponse.js";
import { CashPaymentsService } from "./cashPayments.service.js";
import { closeCashPaymentSchema, listCashClosuresQuerySchema } from "./cashPayments.schemas.js";

const service = new CashPaymentsService();
function tokenOf(request: FastifyRequest): string | null { const value=request.headers.authorization; return value?.startsWith("Bearer ") ? value.slice(7) : null; }
function fail(reply: FastifyReply, result: { code:string; message:string; statusCode:number }) { sendError(reply,result); }

export const cashPaymentsController = {
  async close(request: FastifyRequest<{ Params: { rideId: string } }>, reply: FastifyReply) {
    const token=tokenOf(request); if(!token){ fail(reply,{code:"UNAUTHORIZED",message:"Missing access token.",statusCode:401}); return; }
    const parsed=closeCashPaymentSchema.safeParse(request.body); if(!parsed.success){ fail(reply,{code:"VALIDATION_ERROR",message:parsed.error.errors[0]?.message ?? "Invalid cash closure.",statusCode:400}); return; }
    const result=await service.close(token,request.params.rideId,parsed.data); if(!result.ok){fail(reply,result);return;} sendOk(reply,result.closure,result.alreadyExisted?200:201);
  },
  async getByRide(request: FastifyRequest<{ Params: { rideId: string } }>, reply: FastifyReply) {
    const token=tokenOf(request); if(!token){fail(reply,{code:"UNAUTHORIZED",message:"Missing access token.",statusCode:401});return;} const result=await service.getByRide(token,request.params.rideId); if(!result.ok){fail(reply,result);return;} sendOk(reply,result.closure);
  },
  async listMine(request: FastifyRequest, reply: FastifyReply) {
    const token=tokenOf(request); if(!token){fail(reply,{code:"UNAUTHORIZED",message:"Missing access token.",statusCode:401});return;} const result=await service.listMine(token); if(!result.ok){fail(reply,result);return;} sendOk(reply,result.closures);
  },
  async listAdmin(request: FastifyRequest, reply: FastifyReply) {
    const token=tokenOf(request); if(!token){fail(reply,{code:"UNAUTHORIZED",message:"Missing access token.",statusCode:401});return;} const parsed=listCashClosuresQuerySchema.safeParse(request.query); if(!parsed.success){fail(reply,{code:"VALIDATION_ERROR",message:parsed.error.errors[0]?.message ?? "Invalid query.",statusCode:400});return;} const result=await service.listAdmin(token,parsed.data.status === "all" ? undefined : parsed.data.status); if(!result.ok){fail(reply,result);return;} sendOk(reply,result.closures);
  },
};
