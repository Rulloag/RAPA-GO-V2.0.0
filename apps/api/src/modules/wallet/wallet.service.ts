import { AppError } from "../../shared/errors/AppError.js";
import type {
  CashOverpaymentBenefit,
  PaymentOrder,
  Transaction,
  Wallet,
} from "../../db/schema/index.js";
import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { RidesRepository } from "../rides/rides.repository.js";
import { UsersRepository } from "../users/users.repository.js";
import { WalletRepository } from "./wallet.repository.js";
import type {
  AdminCreateWalletCreditInput,
  AdminReviewCashOverpaymentBenefitInput,
  CreatePaymentOrderInput,
  RequestCashOverpaymentBenefitInput,
  WebhookPayload,
} from "./wallet.schemas.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepo = new UsersRepository();
const ridesRepo = new RidesRepository();
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

function roleCanUseBenefits(role: unknown): boolean {
  return ["passenger", "pasajero", "driver", "conductor"].includes(
    normalizeRole(role),
  );
}

function inferRidePaymentMethod(
  notes: string | null | undefined,
): "cash" | "card" | null {
  const text = String(notes ?? "").toLowerCase();

  if (
    text.includes("paymentmethod: card") ||
    text.includes("mercadopago") ||
    text.includes("mercado pago") ||
    text.includes("tarjeta")
  ) {
    return "card";
  }

  if (
    text.includes("paymentmethod: cash") ||
    text.includes("efectivo") ||
    text.includes("pago en efectivo")
  ) {
    return "cash";
  }

  return null;
}

function serializeWallet(w: Wallet) {
  return {
    id: w.id,
    userId: w.userId,
    balance: w.balance,
    availableBenefitClp: w.balance,
    currency: w.currency,
    status: w.status,
    benefitType: "cash_overpayment_only" as const,
    transferable: false,
    rechargeable: false,
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

function serializeCashOverpaymentBenefit(
  benefit: CashOverpaymentBenefit & {
    ownerName?: string | null;
    ownerEmail?: string | null;
  },
) {
  return {
    id: benefit.id,
    sourceRideId: benefit.sourceRideId,
    ownerUserId: benefit.ownerUserId,
    ownerName: benefit.ownerName ?? null,
    ownerEmail: benefit.ownerEmail ?? null,
    status: benefit.status,
    paymentMethod: "cash" as const,
    fareClp: benefit.fareClp,
    paidClp: benefit.paidClp,
    requestedAmountClp: benefit.requestedAmountClp,
    approvedAmountClp: benefit.approvedAmountClp ?? null,
    requestReason: benefit.requestReason ?? null,
    adminDecisionReason: benefit.adminDecisionReason ?? null,
    reviewedByUserId: benefit.reviewedByUserId ?? null,
    reviewedAt: benefit.reviewedAt?.toISOString() ?? null,
    walletTransactionId: benefit.walletTransactionId ?? null,
    requestedAt: benefit.requestedAt.toISOString(),
    createdAt: benefit.createdAt.toISOString(),
    updatedAt: benefit.updatedAt.toISOString(),
  };
}

export class WalletService {
  async getMyWallet(accessToken: string) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (!roleCanUseBenefits(auth.role)) {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "This account cannot use passenger benefits.",
        statusCode: 403,
      };
    }

    const wallet = await walletRepo.getOrCreate(auth.userId);

    return {
      ok: true as const,
      wallet: serializeWallet(wallet),
    };
  }

  async getMyTransactions(accessToken: string, page: number, limit: number) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (!roleCanUseBenefits(auth.role)) {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "This account cannot access passenger benefits.",
        statusCode: 403,
      };
    }

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

  async listMyCashOverpaymentBenefits(accessToken: string) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (!roleCanUseBenefits(auth.role)) {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "This account cannot access passenger benefits.",
        statusCode: 403,
      };
    }

    const benefits = await walletRepo.listCashOverpaymentBenefitsByOwner(
      auth.userId,
    );

    return {
      ok: true as const,
      benefits: benefits.map(serializeCashOverpaymentBenefit),
    };
  }

  async requestCashOverpaymentBenefit(
    accessToken: string,
    input: RequestCashOverpaymentBenefitInput,
  ) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (!roleCanUseBenefits(auth.role)) {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message:
          "Solo una cuenta pasajero o conductor viajando como usuario puede solicitar este beneficio.",
        statusCode: 403,
      };
    }

    const ride = await ridesRepo.findById(input.rideId);

    if (!ride) {
      return {
        ok: false as const,
        code: "NOT_FOUND",
        message: "Ride not found.",
        statusCode: 404,
      };
    }

    if (ride.passengerUserId !== auth.userId) {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "El viaje no pertenece a esta cuenta.",
        statusCode: 403,
      };
    }

    if (ride.status !== "completed") {
      return {
        ok: false as const,
        code: "WALLET_BENEFIT_RIDE_NOT_COMPLETED",
        message:
          "El beneficio solo puede solicitarse después de completar el viaje.",
        statusCode: 409,
      };
    }

    const ridePaymentMethod =
      ride.paymentMethod === "cash" || ride.paymentMethod === "card"
        ? ride.paymentMethod
        : inferRidePaymentMethod(ride.notes);

    if (ridePaymentMethod !== "cash") {
      return {
        ok: false as const,
        code: "WALLET_BENEFIT_CASH_ONLY",
        message:
          "Beneficios solo acepta dinero pagado de más en viajes en efectivo.",
        statusCode: 422,
      };
    }

    const fareClp = Math.max(
      0,
      Math.round(Number(ride.estimatedFareClp ?? 0)),
    );
    const paidClp = Math.max(0, Math.round(Number(input.paidClp)));
    const requestedAmountClp = paidClp - fareClp;

    if (fareClp <= 0) {
      return {
        ok: false as const,
        code: "WALLET_BENEFIT_INVALID_RIDE_FARE",
        message: "El viaje no tiene una tarifa válida para revisar.",
        statusCode: 422,
      };
    }

    if (requestedAmountClp <= 0) {
      return {
        ok: false as const,
        code: "WALLET_BENEFIT_NO_OVERPAYMENT",
        message:
          "El total pagado debe ser mayor que la tarifa final del viaje.",
        statusCode: 422,
      };
    }

    const existing =
      await walletRepo.findCashOverpaymentBenefitByRideId(ride.id);

    if (existing) {
      if (existing.ownerUserId !== auth.userId) {
        return {
          ok: false as const,
          code: "WALLET_BENEFIT_OWNERSHIP_CONFLICT",
          message:
            "Este viaje ya tiene una solicitud asociada a otra cuenta.",
          statusCode: 409,
        };
      }

      return {
        ok: true as const,
        benefit: serializeCashOverpaymentBenefit(existing),
        alreadyExisted: true,
      };
    }

    const created = await walletRepo.createCashOverpaymentBenefitRequest({
      sourceRideId: ride.id,
      ownerUserId: auth.userId,
      requestedByUserId: auth.userId,
      status: "pending_admin_review",
      fareClp,
      paidClp,
      requestedAmountClp,
      requestReason: input.reason?.trim() || null,
      updatedAt: new Date(),
    });

    return {
      ok: true as const,
      benefit: serializeCashOverpaymentBenefit(created),
      alreadyExisted: false,
    };
  }

  async adminListCashOverpaymentBenefits(
    accessToken: string,
    status?: string,
  ) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (normalizeRole(auth.role) !== "admin") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can review cash overpayment benefits.",
        statusCode: 403,
      };
    }

    const benefits = await walletRepo.adminListCashOverpaymentBenefits(
      status,
    );

    return {
      ok: true as const,
      benefits: benefits.map(serializeCashOverpaymentBenefit),
    };
  }

  private async approveBenefitById(
    auth: { userId: string; role: string },
    benefitId: string,
    input: AdminReviewCashOverpaymentBenefitInput,
  ) {
    if (normalizeRole(auth.role) !== "admin") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can approve cash overpayment benefits.",
        statusCode: 403,
      };
    }

    const existing = await walletRepo.findCashOverpaymentBenefitById(
      benefitId,
    );

    if (!existing) {
      return {
        ok: false as const,
        code: "NOT_FOUND",
        message: "Cash overpayment benefit request not found.",
        statusCode: 404,
      };
    }

    const requestedAmountClp = Math.max(0, existing.requestedAmountClp);
    const approvedAmountClp = Math.min(
      requestedAmountClp,
      Math.max(
        0,
        Math.round(input.approvedAmountClp ?? requestedAmountClp),
      ),
    );

    if (approvedAmountClp <= 0) {
      return {
        ok: false as const,
        code: "WALLET_BENEFIT_INVALID_AMOUNT",
        message: "El monto aprobado debe ser mayor que cero.",
        statusCode: 422,
      };
    }

    const result = await walletRepo.approveCashOverpaymentBenefit({
      id: benefitId,
      reviewedByUserId: auth.userId,
      approvedAmountClp,
      adminDecisionReason: input.adminDecisionReason ?? null,
    });

    if (result.outcome === "not_found") {
      return {
        ok: false as const,
        code: "NOT_FOUND",
        message: "Cash overpayment benefit request not found.",
        statusCode: 404,
      };
    }

    if (result.outcome === "not_pending") {
      return {
        ok: false as const,
        code: "WALLET_BENEFIT_NOT_PENDING",
        message: `La solicitud no puede aprobarse desde el estado '${result.benefit?.status ?? "unknown"}'.`,
        statusCode: 409,
      };
    }

    if (!("wallet" in result) || !("transaction" in result)) {
      return {
        ok: false as const,
        code: "WALLET_BENEFIT_APPROVAL_INCOMPLETE",
        message:
          "No fue posible completar la aprobación del Beneficio.",
        statusCode: 409,
      };
    }

    return {
      ok: true as const,
      benefit: serializeCashOverpaymentBenefit(result.benefit),
      wallet: serializeWallet(result.wallet),
      transaction: serializeTransaction(result.transaction),
      alreadyApproved: result.outcome === "already_approved",
    };
  }

  async adminApproveCashOverpaymentBenefit(
    accessToken: string,
    benefitId: string,
    input: AdminReviewCashOverpaymentBenefitInput,
  ) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    return this.approveBenefitById(auth, benefitId, input);
  }

  async adminApproveCashOverpaymentBenefitByRide(
    accessToken: string,
    rideId: string,
    input: AdminReviewCashOverpaymentBenefitInput,
  ) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (normalizeRole(auth.role) !== "admin") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can approve cash overpayment benefits.",
        statusCode: 403,
      };
    }

    const existing =
      await walletRepo.findCashOverpaymentBenefitByRideId(rideId);

    if (!existing) {
      return {
        ok: false as const,
        code: "WALLET_BENEFIT_REQUEST_REQUIRED",
        message:
          "El pasajero todavía no ha enviado una solicitud backend para este pago de más.",
        statusCode: 409,
      };
    }

    return this.approveBenefitById(auth, existing.id, input);
  }

  async adminRejectCashOverpaymentBenefit(
    accessToken: string,
    benefitId: string,
    input: AdminReviewCashOverpaymentBenefitInput,
  ) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (normalizeRole(auth.role) !== "admin") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can reject cash overpayment benefits.",
        statusCode: 403,
      };
    }

    const reason = input.adminDecisionReason?.trim();

    if (!reason) {
      return {
        ok: false as const,
        code: "WALLET_BENEFIT_REJECTION_REASON_REQUIRED",
        message: "Debes indicar el motivo del rechazo.",
        statusCode: 422,
      };
    }

    const rejected = await walletRepo.rejectCashOverpaymentBenefit({
      id: benefitId,
      reviewedByUserId: auth.userId,
      adminDecisionReason: reason,
    });

    if (!rejected) {
      const existing = await walletRepo.findCashOverpaymentBenefitById(
        benefitId,
      );

      return {
        ok: false as const,
        code: existing ? "WALLET_BENEFIT_NOT_PENDING" : "NOT_FOUND",
        message: existing
          ? `La solicitud no puede rechazarse desde el estado '${existing.status}'.`
          : "Cash overpayment benefit request not found.",
        statusCode: existing ? 409 : 404,
      };
    }

    return {
      ok: true as const,
      benefit: serializeCashOverpaymentBenefit(rejected),
    };
  }

  async adminRejectCashOverpaymentBenefitByRide(
    accessToken: string,
    rideId: string,
    input: AdminReviewCashOverpaymentBenefitInput,
  ) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (normalizeRole(auth.role) !== "admin") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can reject cash overpayment benefits.",
        statusCode: 403,
      };
    }

    const existing =
      await walletRepo.findCashOverpaymentBenefitByRideId(rideId);

    if (!existing) {
      return {
        ok: false as const,
        code: "WALLET_BENEFIT_REQUEST_REQUIRED",
        message:
          "El pasajero todavía no ha enviado una solicitud backend para este pago de más.",
        statusCode: 409,
      };
    }

    return this.adminRejectCashOverpaymentBenefit(
      accessToken,
      existing.id,
      input,
    );
  }

  /**
   * Compatibilidad con el botón antiguo del panel Admin. Ya no crea saldos
   * arbitrarios: exige que exista la solicitud backend del mismo viaje y cuenta.
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

    const existing =
      await walletRepo.findCashOverpaymentBenefitByRideId(input.rideId);

    if (!existing) {
      return {
        ok: false as const,
        code: "WALLET_BENEFIT_REQUEST_REQUIRED",
        message:
          "No existe una solicitud backend pendiente para este viaje. El usuario debe solicitar el beneficio desde Mis Viajes.",
        statusCode: 409,
      };
    }

    if (existing.ownerUserId !== input.userId) {
      return {
        ok: false as const,
        code: "WALLET_BENEFIT_OWNERSHIP_CONFLICT",
        message: "La solicitud pertenece a otra cuenta.",
        statusCode: 409,
      };
    }

    return this.approveBenefitById(auth, existing.id, {
      approvedAmountClp: input.amountClp,
      adminDecisionReason:
        input.reason?.trim() || input.description?.trim(),
    });
  }

  async createPaymentOrder(
    accessToken: string,
    input: CreatePaymentOrderInput,
  ) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const ride = await ridesRepo.findById(input.rideId);

    if (!ride) {
      return {
        ok: false as const,
        code: "NOT_FOUND",
        message: "Ride not found.",
        statusCode: 404,
      };
    }

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
