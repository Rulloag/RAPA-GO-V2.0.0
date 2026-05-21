import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { WalletRepository } from "./wallet.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { db } from "../../db/client.js";
import { rideRequests } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";
import type { CreatePaymentOrderInput, WebhookPayload } from "./wallet.schemas.js";
import type { Wallet, Transaction, PaymentOrder } from "../../db/schema/index.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const walletRepo     = new WalletRepository();

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload;
  try { payload = tokenService.verifyAccessToken(accessToken); }
  catch (err) {
    if (err instanceof AppError) return { ok: false, code: err.code, message: err.message, statusCode: err.statusCode };
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 };
  }
  const hash  = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);
  if (!valid) return { ok: false, code: "AUTH_SESSION_REVOKED", message: "Session has been revoked.", statusCode: 401 };
  const user = await usersRepo.findById(payload.sub);
  if (!user) return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
  return { ok: true, userId: user.id, role: user.role };
}

function serializeWallet(w: Wallet) {
  return {
    id:        w.id,
    userId:    w.userId,
    balance:   w.balance,
    currency:  w.currency,
    status:    w.status,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

function serializeTransaction(t: Transaction) {
  return {
    id:                    t.id,
    walletId:              t.walletId,
    userId:                t.userId,
    rideId:                t.rideId ?? null,
    type:                  t.type,
    amount:                t.amount,
    currency:              t.currency,
    status:                t.status,
    provider:              t.provider ?? null,
    providerTransactionId: t.providerTransactionId ?? null,
    description:           t.description ?? null,
    createdAt:             t.createdAt.toISOString(),
    updatedAt:             t.updatedAt.toISOString(),
  };
}

function serializePaymentOrder(o: PaymentOrder) {
  return {
    id:              o.id,
    userId:          o.userId,
    rideId:          o.rideId ?? null,
    amount:          o.amount,
    currency:        o.currency,
    status:          o.status,
    provider:        o.provider ?? null,
    providerOrderId: o.providerOrderId ?? null,
    paymentUrl:      o.paymentUrl ?? null,
    expiresAt:       o.expiresAt ? o.expiresAt.toISOString() : null,
    completedAt:     o.completedAt ? o.completedAt.toISOString() : null,
    createdAt:       o.createdAt.toISOString(),
  };
}

export class WalletService {
  async getMyWallet(accessToken: string) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    const wallet = await walletRepo.getOrCreate(auth.userId);
    return { ok: true as const, wallet: serializeWallet(wallet) };
  }

  async getMyTransactions(accessToken: string, page: number, limit: number) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    const offset = (page - 1) * limit;
    const { items, total } = await walletRepo.listTransactions(auth.userId, offset, limit);
    return {
      ok:    true as const,
      items: items.map(serializeTransaction),
      total,
      page,
      limit,
    };
  }

  async createPaymentOrder(accessToken: string, input: CreatePaymentOrderInput) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    // Validate ride belongs to user
    const rideRows = await db.select().from(rideRequests).where(eq(rideRequests.id, input.rideId)).limit(1);
    const ride = rideRows[0];
    if (!ride) {
      return { ok: false as const, code: "NOT_FOUND", message: "Ride not found.", statusCode: 404 };
    }
    if (ride.passengerUserId !== auth.userId) {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Ride does not belong to you.", statusCode: 403 };
    }

    const order = await walletRepo.createPaymentOrder({
      userId:   auth.userId,
      rideId:   input.rideId,
      amount:   input.amount,
      currency: "CLP",
      status:   "pending",
    });
    return { ok: true as const, order: serializePaymentOrder(order) };
  }

  async handleWebhook(body: WebhookPayload) {
    const order = await walletRepo.findPaymentOrderByProviderOrderId(body.orderId);
    if (!order) {
      return { ok: false as const, code: "NOT_FOUND", message: "Payment order not found.", statusCode: 404 };
    }

    const completedAt = body.status === "success" ? new Date() : undefined;
    const updated = await walletRepo.updatePaymentOrderStatus(order.id, body.status, completedAt);
    if (!updated) {
      return { ok: false as const, code: "INTERNAL_ERROR", message: "Failed to update payment order.", statusCode: 500 };
    }

    if (body.status === "success") {
      const wallet = await walletRepo.getOrCreate(order.userId);
      await walletRepo.createTransaction({
        walletId:              wallet.id,
        userId:                order.userId,
        ...(order.rideId !== null ? { rideId: order.rideId } : {}),
        type:                  "payment",
        amount:                order.amount,
        currency:              order.currency,
        status:                "completed",
        provider:              body.provider,
        ...(body.transactionId !== undefined ? { providerTransactionId: body.transactionId } : {}),
        description:           `Pago por orden ${order.id}`,
      });
    }

    return { ok: true as const, order: serializePaymentOrder(updated) };
  }
}
