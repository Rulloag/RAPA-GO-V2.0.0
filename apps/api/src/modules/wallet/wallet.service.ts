import { createHash } from "node:crypto";
import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { WalletRepository } from "./wallet.repository.js";
import { WalletTransactionsRepository } from "./walletTransactions.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { db } from "../../db/client.js";
import { rideRequests } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";
import { CURRENT_LEDGER_POLICY_VERSION, decideAdminCreditApproval } from "./walletPolicy.constants.js";
import type { CreatePaymentOrderInput, WebhookPayload, AdminCreateWalletCreditInput } from "./wallet.schemas.js";
import type { Wallet, Transaction, PaymentOrder, WalletTransactionLedgerRow } from "../../db/schema/index.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const walletRepo     = new WalletRepository();
const ledgerRepo     = new WalletTransactionsRepository();

// Mismo conjunto que PAYMENT_ALLOWED_RIDE_STATUSES en payments.service.ts.
const PAYMENT_ORDER_ALLOWED_RIDE_STATUSES = new Set([
  "requested",
  "scheduled",
  "driver_scheduled",
  "accepted",
  "driver_en_route",
  "driver_arrived",
  "in_progress",
  "completed",
]);

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

/**
 * Adapta una fila del ledger autoritativo (wallet_transactions_ledger) al contrato legacy
 * `TransactionData` que ya consume el frontend (Fase de unificación de sistemas de Wallet —
 * el frontend no debe poder distinguir que ahora hay una sola fuente de verdad).
 */
function serializeLedgerRowAsLegacyTransaction(row: WalletTransactionLedgerRow) {
  return {
    id:                    row.id,
    walletId:              row.walletId,
    userId:                row.userId,
    rideId:                row.rideId ?? null,
    type:                  row.type,
    amount:                row.amountClp,
    currency:              row.currency,
    status:                row.status === "available" ? "completed" : row.status,
    provider:              "admin",
    providerTransactionId: row.idempotencyKey,
    description:           typeof row.metadata === "object" && row.metadata !== null && "reason" in row.metadata
                              ? String((row.metadata as Record<string, unknown>)["reason"] ?? "")
                              : null,
    createdAt:             row.createdAt.toISOString(),
    updatedAt:             row.createdAt.toISOString(),
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

    if (!PAYMENT_ORDER_ALLOWED_RIDE_STATUSES.has(String(ride.status ?? ""))) {
      return {
        ok: false as const,
        code: "PAYMENT_RIDE_STATUS_NOT_ALLOWED",
        message: "Payment order can only be created for an active, scheduled, in-progress or completed ride.",
        statusCode: 409,
      };
    }

    // SEGURIDAD: el monto autoritativo siempre es la tarifa calculada en el servidor para
    // el viaje (ride.estimatedFareClp). input.amount NUNCA se usa como precio — solo se
    // registra como discrepancia de auditoría si difiere, sin bloquear la orden.
    const authoritativeAmount = ride.estimatedFareClp;
    if (!Number.isFinite(authoritativeAmount) || authoritativeAmount === null || authoritativeAmount <= 0) {
      return { ok: false as const, code: "INVALID_RIDE_FARE", message: "Ride has no valid fare.", statusCode: 409 };
    }

    const clientAmount = Number(input.amount);
    if (Number.isFinite(clientAmount) && clientAmount > 0 && clientAmount !== authoritativeAmount) {
      try {
        const auditService = new (
          await import("../audit/audit.service.js")
        ).AuditService();

        auditService.recordSafe({
          actorUserId: auth.userId,
          eventType: "wallet.payment_order_amount_mismatch",
          metadata: {
            clientAmountClp: clientAmount,
            serverAmountClp: authoritativeAmount,
            rideId: input.rideId,
          },
        });
      } catch {
        // No bloquea la creación de la orden si el audit log falla.
      }
    }

    const order = await walletRepo.createPaymentOrder({
      userId:   auth.userId,
      rideId:   input.rideId,
      amount:   authoritativeAmount,
      currency: "CLP",
      status:   "pending",
      metadata: {
        clientRequestedAmountClp: input.amount ?? null,
        amountSource: "ride_requests.estimated_fare_clp",
      },
    });
    return { ok: true as const, order: serializePaymentOrder(order) };
  }

  async adminCreateWalletCredit(accessToken: string, input: AdminCreateWalletCreditInput) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "admin") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can approve wallet credits.",
        statusCode: 403,
      };
    }

    const targetUser = await usersRepo.findById(input.userId);
    if (!targetUser) {
      return { ok: false as const, code: "NOT_FOUND", message: "Target user not found.", statusCode: 404 };
    }

    if (targetUser.role !== "passenger") {
      return {
        ok: false as const,
        code: "WALLET_CREDIT_TARGET_NOT_PASSENGER",
        message: "Wallet credits can only be approved for passenger accounts.",
        statusCode: 422,
      };
    }

    if (input.rideId) {
      const rideRows = await db.select().from(rideRequests).where(eq(rideRequests.id, input.rideId)).limit(1);
      const ride = rideRows[0];

      if (!ride) {
        return { ok: false as const, code: "NOT_FOUND", message: "Ride not found.", statusCode: 404 };
      }

      if (ride.passengerUserId !== input.userId) {
        return {
          ok: false as const,
          code: "AUTH_FORBIDDEN",
          message: "Ride does not belong to the target passenger.",
          statusCode: 403,
        };
      }
    }

    const description = input.description?.trim() || "Credito wallet aprobado por admin";
    const reason = input.reason?.trim();
    const externalReference = input.externalReference?.trim();

    // UNIFICACIÓN DE SISTEMAS DE WALLET: este endpoint legacy ya NO escribe en wallets.balance
    // ni en la tabla `transactions` (fachada de compatibilidad) — crea el movimiento en el
    // ledger autoritativo (wallet_transactions_ledger), la única fuente de verdad financiera.
    //
    // Idempotencia: si el admin no envía externalReference, se deriva una clave determinista
    // a partir de los campos de negocio de la solicitud (mismos campos → misma clave), para
    // que un doble clic o un retry de red no generen un segundo crédito.
    const idempotencySeed = externalReference
      ? `ext:${externalReference}`
      : `req:${input.userId}:${input.rideId ?? "none"}:${input.amountClp}:${reason ?? ""}`;
    const idempotencyKey = `admin-credit:${createHash("sha256").update(idempotencySeed).digest("hex").slice(0, 40)}`;

    const existing = await ledgerRepo.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      const wallet = await walletRepo.getOrCreate(input.userId);
      return {
        ok: true as const,
        wallet: serializeWallet(wallet),
        transaction: serializeLedgerRowAsLegacyTransaction(existing),
      };
    }

    const wallet = await walletRepo.getOrCreate(input.userId);
    const decision = decideAdminCreditApproval(input.amountClp);
    const now = new Date();

    const row = await ledgerRepo.create({
      walletId: wallet.id,
      userId: input.userId,
      rideId: input.rideId ?? null,
      type: "credit",
      source: "admin",
      amountClp: input.amountClp,
      currency: "CLP",
      status: decision.status,
      approvalStatus: decision.approvalStatus,
      policyVersion: CURRENT_LEDGER_POLICY_VERSION,
      actorRole: "admin",
      idempotencyKey,
      createdBy: auth.userId,
      ...(decision.status === "available" ? { approvedBy: auth.userId, approvedAt: now } : {}),
      metadata: {
        source: "admin_wallet_credit",
        approvedByUserId: auth.userId,
        description,
        ...(reason ? { reason } : {}),
        ...(externalReference ? { externalReference } : {}),
      },
    });

    let updatedWallet = wallet;
    if (decision.status === "available") {
      const availableClp = await ledgerRepo.getAvailableBalance(input.userId);
      updatedWallet = await walletRepo.updateBalance(wallet.id, availableClp);
    }

    return {
      ok: true as const,
      wallet: serializeWallet(updatedWallet),
      transaction: serializeLedgerRowAsLegacyTransaction(row),
    };
  }

  async handleWebhook(body: WebhookPayload) {
    const order = await walletRepo.findPaymentOrderByProviderOrderId(body.orderId);
    if (!order) {
      return { ok: false as const, code: "NOT_FOUND", message: "Payment order not found.", statusCode: 404 };
    }

    if (order.status === "success" && body.status !== "success") {
      return { ok: true as const, order: serializePaymentOrder(order) };
    }

    if (body.status === "success" && body.transactionId) {
      const existingTransaction = await walletRepo.findTransactionByProviderTransactionId(body.transactionId);
      if (existingTransaction) {
        return { ok: true as const, order: serializePaymentOrder(order) };
      }
    }

    if (order.status === "success" && body.status === "success" && !body.transactionId) {
      return { ok: true as const, order: serializePaymentOrder(order) };
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
