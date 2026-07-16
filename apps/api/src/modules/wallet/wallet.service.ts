import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { WalletRepository } from "./wallet.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { db } from "../../db/client.js";
import { rideRequests } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";
import type {
  CreatePaymentOrderInput,
  WebhookPayload,
  AdminCreateWalletCreditInput,
} from "./wallet.schemas.js";
import type {
  Wallet,
  Transaction,
  PaymentOrder,
} from "../../db/schema/index.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepo = new UsersRepository();
const walletRepo = new WalletRepository();

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload;

  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (err) {
    if (err instanceof AppError) {
      return {
        ok: false,
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
      };
    }

    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Invalid access token.",
      statusCode: 401,
    };
  }

  const hash = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);

  if (!valid) {
    return {
      ok: false,
      code: "AUTH_SESSION_REVOKED",
      message: "Session has been revoked.",
      statusCode: 401,
    };
  }

  const user = await usersRepo.findById(payload.sub);

  if (!user) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "User not found.",
      statusCode: 404,
    };
  }

  return {
    ok: true,
    userId: user.id,
    role: user.role,
  };
}

function normalizeRole(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function serializeWallet(w: Wallet) {
  return {
    id: w.id,
    userId: w.userId,
    balance: w.balance,
    currency: w.currency,
    status: w.status,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

function serializeTransaction(t: Transaction) {
  return {
    id: t.id,
    walletId: t.walletId,
    userId: t.userId,
    rideId: t.rideId ?? null,
    type: t.type,
    amount: t.amount,
    currency: t.currency,
    status: t.status,
    provider: t.provider ?? null,
    providerTransactionId: t.providerTransactionId ?? null,
    description: t.description ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

function serializePaymentOrder(o: PaymentOrder) {
  return {
    id: o.id,
    userId: o.userId,
    rideId: o.rideId ?? null,
    amount: o.amount,
    currency: o.currency,
    status: o.status,
    provider: o.provider ?? null,
    providerOrderId: o.providerOrderId ?? null,
    paymentUrl: o.paymentUrl ?? null,
    expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null,
    completedAt: o.completedAt ? o.completedAt.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
  };
}

export class WalletService {
  async getMyWallet(accessToken: string) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const wallet = await walletRepo.getOrCreate(auth.userId);

    return {
      ok: true as const,
      wallet: serializeWallet(wallet),
    };
  }

  async getMyTransactions(accessToken: string, page: number, limit: number) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const offset = (page - 1) * limit;
    const { items, total } = await walletRepo.listTransactions(
      auth.userId,
      offset,
      limit,
    );

    return {
      ok: true as const,
      items: items.map(serializeTransaction),
      total,
      page,
      limit,
    };
  }

  async createPaymentOrder(
    accessToken: string,
    input: CreatePaymentOrderInput,
  ) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const rideRows = await db
      .select()
      .from(rideRequests)
      .where(eq(rideRequests.id, input.rideId))
      .limit(1);

    const ride = rideRows[0];

    if (!ride) {
      return {
        ok: false as const,
        code: "NOT_FOUND",
        message: "Ride not found.",
        statusCode: 404,
      };
    }

    /*
     * passengerUserId identifica a la cuenta que solicitó el viaje como usuario.
     * Puede ser una cuenta con rol passenger o una cuenta con rol driver usando
     * la vista de pasajero.
     */
    if (ride.passengerUserId !== auth.userId) {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Ride does not belong to you.",
        statusCode: 403,
      };
    }

    const amountFromRide = Math.round(Number(ride.estimatedFareClp ?? 0));

    if (!Number.isFinite(amountFromRide) || amountFromRide <= 0) {
      return {
        ok: false as const,
        code: "PAYMENT_INVALID_AMOUNT",
        message: "Ride has no valid fare amount.",
        statusCode: 422,
      };
    }

    const order = await walletRepo.createPaymentOrder({
      userId: auth.userId,
      rideId: input.rideId,
      amount: amountFromRide,
      currency: "CLP",
      status: "pending",
      metadata: {
        clientRequestedAmountClp: input.amount ?? null,
        amountSource: "ride_requests.estimated_fare_clp",
      },
    });

    return {
      ok: true as const,
      order: serializePaymentOrder(order),
    };
  }

  /**
   * Aprueba un beneficio originado por dinero pagado de más en efectivo.
   *
   * Reglas:
   * - Solo Admin puede aprobarlo.
   * - El beneficio puede pertenecer a una cuenta passenger o driver.
   * - El viaje es obligatorio.
   * - El beneficio queda ligado al users.id que solicitó ese viaje.
   * - Un mismo viaje no puede acreditarse dos veces.
   */
  async adminCreateWalletCredit(
    accessToken: string,
    input: AdminCreateWalletCreditInput,
  ) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (normalizeRole(auth.role) !== "admin") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can approve wallet benefits.",
        statusCode: 403,
      };
    }

    if (!input.rideId) {
      return {
        ok: false as const,
        code: "WALLET_BENEFIT_RIDE_REQUIRED",
        message:
          "El beneficio debe estar asociado al viaje en efectivo donde el usuario pagó de más.",
        statusCode: 422,
      };
    }

    const amountClp = Math.round(Number(input.amountClp));

    if (!Number.isFinite(amountClp) || amountClp <= 0) {
      return {
        ok: false as const,
        code: "WALLET_BENEFIT_INVALID_AMOUNT",
        message: "El monto del beneficio debe ser mayor que cero.",
        statusCode: 422,
      };
    }

    const targetUser = await usersRepo.findById(input.userId);

    if (!targetUser) {
      return {
        ok: false as const,
        code: "NOT_FOUND",
        message: "Target user not found.",
        statusCode: 404,
      };
    }

    const targetRole = normalizeRole(targetUser.role);
    const allowedTargetRoles = new Set([
      "passenger",
      "pasajero",
      "driver",
      "conductor",
    ]);

    if (!allowedTargetRoles.has(targetRole)) {
      return {
        ok: false as const,
        code: "WALLET_BENEFIT_TARGET_ROLE_NOT_ALLOWED",
        message:
          "El beneficio solo puede asignarse a una cuenta pasajero o a una cuenta conductor que realizó el viaje como usuario.",
        statusCode: 422,
      };
    }

    const rideRows = await db
      .select()
      .from(rideRequests)
      .where(eq(rideRequests.id, input.rideId))
      .limit(1);

    const ride = rideRows[0];

    if (!ride) {
      return {
        ok: false as const,
        code: "NOT_FOUND",
        message: "Ride not found.",
        statusCode: 404,
      };
    }

    /*
     * passengerUserId no significa necesariamente rol passenger.
     * Es el ID de la cuenta que tomó el viaje como usuario.
     */
    if (ride.passengerUserId !== input.userId) {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message:
          "El beneficio no pertenece a esa cuenta. El viaje fue solicitado por otro usuario.",
        statusCode: 403,
      };
    }

    if (ride.status !== "completed") {
      return {
        ok: false as const,
        code: "WALLET_BENEFIT_RIDE_NOT_COMPLETED",
        message:
          "El beneficio solo puede aprobarse después de completar el viaje en efectivo.",
        statusCode: 409,
      };
    }

    const stableReference = `cash-overpayment-benefit:${ride.id}`;
    const existingTransaction =
      await walletRepo.findTransactionByProviderTransactionId(stableReference);

    if (existingTransaction) {
      if (existingTransaction.userId !== input.userId) {
        return {
          ok: false as const,
          code: "WALLET_BENEFIT_OWNERSHIP_CONFLICT",
          message:
            "Este viaje ya tiene un beneficio asociado a otra cuenta. Requiere revisión administrativa.",
          statusCode: 409,
        };
      }

      const existingWallet = await walletRepo.getOrCreate(input.userId);

      return {
        ok: true as const,
        wallet: serializeWallet(existingWallet),
        transaction: serializeTransaction(existingTransaction),
      };
    }

    const reason = input.reason?.trim();
    const description =
      input.description?.trim() ||
      "Beneficio aprobado por dinero pagado de más en efectivo";

    const result = await walletRepo.creditUserWallet({
      userId: input.userId,
      amountClp,
      rideId: ride.id,
      description,
      metadata: {
        source: "cash_overpayment_benefit",
        approvedByUserId: auth.userId,
        ownerUserId: input.userId,
        sourceRideId: ride.id,
        targetRole,
        exclusiveToOwner: true,
        ...(reason ? { reason } : {}),
        ...(input.externalReference?.trim()
          ? { externalReference: input.externalReference.trim() }
          : {}),
      },
      providerTransactionId: stableReference,
    });

    return {
      ok: true as const,
      wallet: serializeWallet(result.wallet),
      transaction: serializeTransaction(result.transaction),
    };
  }

  async handleWebhook(body: WebhookPayload) {
    const order = await walletRepo.findPaymentOrderByProviderOrderId(
      body.orderId,
    );

    if (!order) {
      return {
        ok: false as const,
        code: "NOT_FOUND",
        message: "Payment order not found.",
        statusCode: 404,
      };
    }

    if (order.status === "success" && body.status !== "success") {
      return {
        ok: true as const,
        order: serializePaymentOrder(order),
      };
    }

    if (body.status === "success" && body.transactionId) {
      const existingTransaction =
        await walletRepo.findTransactionByProviderTransactionId(
          body.transactionId,
        );

      if (existingTransaction) {
        return {
          ok: true as const,
          order: serializePaymentOrder(order),
        };
      }
    }

    if (
      order.status === "success" &&
      body.status === "success" &&
      !body.transactionId
    ) {
      return {
        ok: true as const,
        order: serializePaymentOrder(order),
      };
    }

    const completedAt = body.status === "success" ? new Date() : undefined;
    const updated = await walletRepo.updatePaymentOrderStatus(
      order.id,
      body.status,
      completedAt,
    );

    if (!updated) {
      return {
        ok: false as const,
        code: "INTERNAL_ERROR",
        message: "Failed to update payment order.",
        statusCode: 500,
      };
    }

    if (body.status === "success") {
      const wallet = await walletRepo.getOrCreate(order.userId);

      await walletRepo.createTransaction({
        walletId: wallet.id,
        userId: order.userId,
        ...(order.rideId !== null ? { rideId: order.rideId } : {}),
        type: "payment",
        amount: order.amount,
        currency: order.currency,
        status: "completed",
        provider: body.provider,
        ...(body.transactionId !== undefined
          ? { providerTransactionId: body.transactionId }
          : {}),
        description: `Pago por orden ${order.id}`,
      });
    }

    return {
      ok: true as const,
      order: serializePaymentOrder(updated),
    };
  }
}