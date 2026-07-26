import { AppError } from "../../shared/errors/AppError.js";
import { decryptSensitiveValue } from "../../shared/security/fieldEncryption.js";
import type { CashOverpaymentRefundRequest } from "../../db/schema/index.js";
import { AuditService } from "../audit/audit.service.js";
import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { BankAccountsRepository } from "../bankAccounts/bankAccounts.repository.js";
import { RidesRepository } from "../rides/rides.repository.js";
import { UsersRepository } from "../users/users.repository.js";
import { CashRefundsRepository } from "./cashRefunds.repository.js";
import { CashPaymentsRepository } from "../cashPayments/cashPayments.repository.js";
import type {
  ApproveCashOverpaymentRefundInput,
  CompleteCashOverpaymentRefundInput,
  RejectCashOverpaymentRefundInput,
  RequestCashOverpaymentRefundInput,
} from "./cashRefunds.schemas.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepository = new UsersRepository();
const ridesRepository = new RidesRepository();
const bankAccountsRepository = new BankAccountsRepository();
const refundsRepository = new CashRefundsRepository();
const cashPaymentsRepository = new CashPaymentsRepository();
const auditService = new AuditService();

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload;
  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (error) {
    if (error instanceof AppError) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
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

  const user = await usersRepository.findById(payload.sub);
  if (!user) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "User not found.",
      statusCode: 404,
    };
  }

  return { ok: true, userId: user.id, role: user.role };
}

function normalizeRole(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function canRequestRefund(role: unknown): boolean {
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

function serializeRefund(
  refund: CashOverpaymentRefundRequest & {
    ownerName?: string | null;
    ownerEmail?: string | null;
  },
) {
  return {
    id: refund.id,
    sourceRideId: refund.sourceRideId,
    ownerUserId: refund.ownerUserId,
    ownerName: refund.ownerName ?? null,
    ownerEmail: refund.ownerEmail ?? null,
    status: refund.status,
    paymentMethod: "cash" as const,
    fareClp: refund.fareClp,
    paidClp: refund.paidClp,
    requestedAmountClp: refund.requestedAmountClp,
    approvedAmountClp: refund.approvedAmountClp ?? null,
    requestReason: refund.requestReason ?? null,
    adminDecisionReason: refund.adminDecisionReason ?? null,
    bankAccount: {
      holderName: refund.bankAccountHolderName,
      bankName: refund.bankName,
      accountType: refund.bankAccountType,
      accountNumberLast4: refund.bankAccountNumberLast4,
    },
    transferReference: refund.transferReference ?? null,
    transferProofUrl: refund.transferProofUrl ?? null,
    reviewedByUserId: refund.reviewedByUserId ?? null,
    reviewedAt: refund.reviewedAt?.toISOString() ?? null,
    completedAt: refund.completedAt?.toISOString() ?? null,
    requestedAt: refund.requestedAt.toISOString(),
    createdAt: refund.createdAt.toISOString(),
    updatedAt: refund.updatedAt.toISOString(),
  };
}

export class CashRefundsService {
  async listMine(accessToken: string) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (!canRequestRefund(auth.role)) {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "This account cannot request passenger refunds.",
        statusCode: 403,
      };
    }

    const refunds = await refundsRepository.listByOwner(auth.userId);
    return {
      ok: true as const,
      refunds: refunds.map(serializeRefund),
    };
  }

  async request(
    accessToken: string,
    input: RequestCashOverpaymentRefundInput,
  ) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (!canRequestRefund(auth.role)) {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message:
          "Solo una cuenta pasajero o conductor viajando como usuario puede solicitar esta devolución.",
        statusCode: 403,
      };
    }

    const ride = await ridesRepository.findById(input.rideId);
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
        code: "CASH_REFUND_RIDE_NOT_COMPLETED",
        message: "La devolución solo puede solicitarse después de completar el viaje.",
        statusCode: 409,
      };
    }

    const paymentMethod =
      ride.paymentMethod === "cash" || ride.paymentMethod === "card"
        ? ride.paymentMethod
        : inferRidePaymentMethod(ride.notes);

    if (paymentMethod !== "cash") {
      return {
        ok: false as const,
        code: "CASH_REFUND_CASH_ONLY",
        message:
          "Esta solicitud corresponde únicamente a dinero pagado de más en efectivo.",
        statusCode: 422,
      };
    }

    const closure = await refundsRepository.findCashClosureByRideId(ride.id);
    if (!closure) {
      return { ok: false as const, code: "CASH_CLOSURE_REQUIRED", message: "El conductor todavía no ha confirmado en el backend el efectivo recibido.", statusCode: 409 };
    }
    const fareClp = closure.fareClp;
    const paidClp = closure.paidClp;
    const requestedAmountClp = closure.overpaidClp;
    if (input.paidClp != null && Math.round(input.paidClp) !== paidClp) {
      return { ok: false as const, code: "CASH_AMOUNT_MISMATCH", message: "El monto informado no coincide con el cierre confirmado por el conductor.", statusCode: 409 };
    }

    if (fareClp <= 0) {
      return {
        ok: false as const,
        code: "CASH_REFUND_INVALID_RIDE_FARE",
        message: "El viaje no tiene una tarifa válida para revisar.",
        statusCode: 422,
      };
    }

    if (requestedAmountClp <= 0) {
      return {
        ok: false as const,
        code: "CASH_REFUND_NO_OVERPAYMENT",
        message: "El total pagado debe ser mayor que la tarifa final del viaje.",
        statusCode: 422,
      };
    }

    const existingRefund = await refundsRepository.findByRideId(ride.id);
    if (existingRefund) {
      if (existingRefund.ownerUserId !== auth.userId) {
        return {
          ok: false as const,
          code: "CASH_REFUND_OWNERSHIP_CONFLICT",
          message: "Este viaje ya tiene una devolución asociada a otra cuenta.",
          statusCode: 409,
        };
      }

      return {
        ok: true as const,
        refund: serializeRefund(existingRefund),
        alreadyExisted: true,
      };
    }

    const existingBenefit = await refundsRepository.findBenefitByRideId(ride.id);
    if (existingBenefit) {
      return {
        ok: false as const,
        code: "CASH_OVERPAYMENT_RESOLUTION_ALREADY_SELECTED",
        message:
          "Este viaje ya tiene una solicitud para conservar el dinero como Beneficio. No puede solicitarse también una devolución bancaria.",
        statusCode: 409,
      };
    }

    const bankAccount = await bankAccountsRepository.findByUserId(auth.userId);
    if (!bankAccount?.accountNumberEncrypted) {
      return {
        ok: false as const,
        code: "CASH_REFUND_BANK_ACCOUNT_REQUIRED",
        message:
          "Registra o actualiza tu cuenta bancaria en Perfil antes de solicitar la devolución.",
        statusCode: 422,
      };
    }

    const created = await refundsRepository.create({
      sourceRideId: ride.id,
      ownerUserId: auth.userId,
      requestedByUserId: auth.userId,
      bankAccountId: bankAccount.id,
      status: "pending_admin_review",
      fareClp,
      paidClp,
      requestedAmountClp,
      requestReason: input.reason?.trim() || null,
      bankAccountHolderName: bankAccount.accountHolderName,
      bankName: bankAccount.bankName,
      bankAccountType: bankAccount.accountType,
      bankAccountNumberLast4: bankAccount.accountNumberLast4,
      bankAccountNumberEncrypted: bankAccount.accountNumberEncrypted,
      updatedAt: new Date(),
    });

    await cashPaymentsRepository.markResolution({
      rideRequestId: ride.id,
      type: "bank_refund",
      referenceId: created.id,
    });

    return {
      ok: true as const,
      refund: serializeRefund(created),
      alreadyExisted: false,
    };
  }

  async listForAdmin(accessToken: string, status?: string) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (normalizeRole(auth.role) !== "admin") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can review cash refunds.",
        statusCode: 403,
      };
    }

    const refunds = await refundsRepository.listForAdmin(status);
    return {
      ok: true as const,
      refunds: refunds.map(serializeRefund),
    };
  }

  async getTransferDetails(accessToken: string, refundId: string) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (normalizeRole(auth.role) !== "admin") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can view bank transfer details.",
        statusCode: 403,
      };
    }

    const refund = await refundsRepository.findById(refundId);
    if (!refund) {
      return {
        ok: false as const,
        code: "NOT_FOUND",
        message: "Cash refund request not found.",
        statusCode: 404,
      };
    }

    if (!refund.bankAccountNumberEncrypted) {
      return {
        ok: false as const,
        code: "CASH_REFUND_BANK_DETAILS_PURGED",
        message:
          "Los datos bancarios completos ya fueron eliminados conforme al plazo de conservación.",
        statusCode: 410,
      };
    }

    let accountNumber: string;
    try {
      accountNumber = decryptSensitiveValue(
        refund.bankAccountNumberEncrypted,
      );
    } catch {
      return {
        ok: false as const,
        code: "CASH_REFUND_BANK_DETAILS_UNAVAILABLE",
        message:
          "No fue posible descifrar la cuenta bancaria. Revisa BANK_ACCOUNT_ENCRYPTION_KEY y solicita al usuario actualizar sus datos.",
        statusCode: 503,
      };
    }

    auditService.recordSafe({
      actorUserId: auth.userId,
      eventType: "cash_refund.bank_details.viewed",
      entityType: "cash_overpayment_refund_request",
      entityId: refund.id,
      metadata: {
        ownerUserId: refund.ownerUserId,
        accountNumberLast4: refund.bankAccountNumberLast4,
      },
    });

    return {
      ok: true as const,
      transfer: {
        refundId: refund.id,
        ownerUserId: refund.ownerUserId,
        amountClp:
          refund.approvedAmountClp ?? refund.requestedAmountClp,
        holderName: refund.bankAccountHolderName,
        bankName: refund.bankName,
        accountType: refund.bankAccountType,
        accountNumber,
        accountNumberLast4: refund.bankAccountNumberLast4,
      },
    };
  }

  async approve(
    accessToken: string,
    refundId: string,
    input: ApproveCashOverpaymentRefundInput,
  ) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (normalizeRole(auth.role) !== "admin") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can approve cash refunds.",
        statusCode: 403,
      };
    }

    const existing = await refundsRepository.findById(refundId);
    if (!existing) {
      return {
        ok: false as const,
        code: "NOT_FOUND",
        message: "Cash refund request not found.",
        statusCode: 404,
      };
    }

    if (existing.status !== "pending_admin_review") {
      return {
        ok: false as const,
        code: "CASH_REFUND_NOT_PENDING",
        message: `La solicitud no puede aprobarse desde el estado '${existing.status}'.`,
        statusCode: 409,
      };
    }

    const approvedAmountClp = Math.min(
      existing.requestedAmountClp,
      Math.max(
        1,
        Math.round(input.approvedAmountClp ?? existing.requestedAmountClp),
      ),
    );

    const approved = await refundsRepository.approve({
      id: refundId,
      reviewedByUserId: auth.userId,
      approvedAmountClp,
      adminDecisionReason: input.adminDecisionReason?.trim() || null,
    });

    if (!approved) {
      return {
        ok: false as const,
        code: "CASH_REFUND_NOT_PENDING",
        message: "La solicitud cambió de estado antes de ser aprobada.",
        statusCode: 409,
      };
    }

    return { ok: true as const, refund: serializeRefund(approved) };
  }

  async reject(
    accessToken: string,
    refundId: string,
    input: RejectCashOverpaymentRefundInput,
  ) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (normalizeRole(auth.role) !== "admin") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can reject cash refunds.",
        statusCode: 403,
      };
    }

    const rejected = await refundsRepository.reject({
      id: refundId,
      reviewedByUserId: auth.userId,
      adminDecisionReason: input.adminDecisionReason.trim(),
    });

    if (!rejected) {
      const existing = await refundsRepository.findById(refundId);
      return {
        ok: false as const,
        code: existing ? "CASH_REFUND_NOT_PENDING" : "NOT_FOUND",
        message: existing
          ? `La solicitud no puede rechazarse desde el estado '${existing.status}'.`
          : "Cash refund request not found.",
        statusCode: existing ? 409 : 404,
      };
    }

    return { ok: true as const, refund: serializeRefund(rejected) };
  }

  async complete(
    accessToken: string,
    refundId: string,
    input: CompleteCashOverpaymentRefundInput,
  ) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (normalizeRole(auth.role) !== "admin") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can complete cash refunds.",
        statusCode: 403,
      };
    }

    const completed = await refundsRepository.complete({
      id: refundId,
      reviewedByUserId: auth.userId,
      transferReference: input.transferReference.trim(),
      transferProofUrl: input.transferProofUrl?.trim() || null,
      adminDecisionReason: input.adminDecisionReason?.trim() || null,
    });

    if (!completed) {
      const existing = await refundsRepository.findById(refundId);
      return {
        ok: false as const,
        code: existing ? "CASH_REFUND_NOT_APPROVED" : "NOT_FOUND",
        message: existing
          ? `La solicitud no puede completarse desde el estado '${existing.status}'.`
          : "Cash refund request not found.",
        statusCode: existing ? 409 : 404,
      };
    }

    await cashPaymentsRepository.markResolved({
      rideRequestId: completed.sourceRideId,
      type: "bank_refund",
      referenceId: completed.id,
    });

    return { ok: true as const, refund: serializeRefund(completed) };
  }
}
