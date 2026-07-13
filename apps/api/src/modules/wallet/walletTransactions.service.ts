import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { WalletRepository } from "./wallet.repository.js";
import { WalletTransactionsRepository } from "./walletTransactions.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type {
  AdminCreateCreditInput,
  AdminModerateCreditInput,
  ApplyCreditInput,
} from "./walletTransactions.schemas.js";
import type { WalletTransactionLedgerRow } from "../../db/schema/index.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const walletRepo     = new WalletRepository();
const ledgerRepo     = new WalletTransactionsRepository();

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload;
  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, code: err.code, message: err.message, statusCode: err.statusCode };
    }
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 };
  }

  const hash = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);
  if (!valid) {
    return { ok: false, code: "AUTH_SESSION_REVOKED", message: "Session has been revoked.", statusCode: 401 };
  }

  const user = await usersRepo.findById(payload.sub);
  if (!user) {
    return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
  }

  return { ok: true, userId: user.id, role: user.role };
}

function isFinancialAdmin(role: string): boolean {
  const normalized = String(role ?? "").trim().toLowerCase();
  return normalized === "admin" || normalized === "administrator";
}

function serialize(row: WalletTransactionLedgerRow) {
  return {
    id:              row.id,
    walletId:        row.walletId,
    userId:          row.userId,
    rideId:          row.rideId ?? null,
    paymentId:       row.paymentId ?? null,
    appliedToRideId: row.appliedToRideId ?? null,
    type:            row.type,
    source:          row.source,
    amountClp:       row.amountClp,
    currency:        row.currency,
    status:          row.status,
    approvalStatus:  row.approvalStatus,
    createdAt:       row.createdAt.toISOString(),
    approvedAt:      row.approvedAt ? row.approvedAt.toISOString() : null,
    appliedAt:       row.appliedAt ? row.appliedAt.toISOString() : null,
    expiresAt:       row.expiresAt ? row.expiresAt.toISOString() : null,
    reversedAt:      row.reversedAt ? row.reversedAt.toISOString() : null,
  };
}

export class WalletTransactionsService {
  /** GET /wallets/me/credits — el pasajero solo puede consultar su propio ledger. */
  async listMyCredits(accessToken: string, status?: string) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const rows = await ledgerRepo.listByUser(auth.userId, status);
    const availableBalanceClp = await ledgerRepo.getAvailableBalance(auth.userId);

    return { ok: true as const, items: rows.map(serialize), availableBalanceClp };
  }

  /**
   * POST /admin/wallet-transactions — un admin crea (propone) un crédito para un usuario.
   * Nace en estado 'pending': requiere una aprobación posterior de OTRO admin (regla:
   * imposibilidad de autoaprobar, ver approveCredit).
   */
  async createCredit(accessToken: string, input: AdminCreateCreditInput) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (!isFinancialAdmin(auth.role)) {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Solo administradores pueden crear créditos.", statusCode: 403 };
    }

    const existing = await ledgerRepo.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return { ok: true as const, transaction: serialize(existing), idempotentReplay: true };
    }

    const wallet = await walletRepo.getOrCreate(input.userId);

    const row = await ledgerRepo.create({
      walletId: wallet.id,
      userId: input.userId,
      rideId: input.rideId ?? null,
      type: "credit",
      source: input.source,
      amountClp: input.amountClp,
      currency: "CLP",
      status: "pending",
      approvalStatus: "pending_review",
      idempotencyKey: input.idempotencyKey,
      createdBy: auth.userId,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      metadata: { reason: input.reason },
    });

    return { ok: true as const, transaction: serialize(row), idempotentReplay: false };
  }

  /** POST /admin/wallet-transactions/:id/approve */
  async approveCredit(accessToken: string, id: string, _input: AdminModerateCreditInput) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (!isFinancialAdmin(auth.role)) {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Solo administradores pueden aprobar créditos.", statusCode: 403 };
    }

    const existing = await ledgerRepo.findById(id);
    if (!existing) {
      return { ok: false as const, code: "NOT_FOUND", message: "Wallet transaction not found.", statusCode: 404 };
    }

    // Regla: imposibilidad de autoaprobar — el admin que crea un crédito no puede aprobarlo.
    if (existing.createdBy === auth.userId) {
      return {
        ok: false as const,
        code: "AUTH_SELF_APPROVAL_FORBIDDEN",
        message: "Un administrador no puede aprobar un crédito que él mismo creó.",
        statusCode: 403,
      };
    }

    if (existing.status !== "pending") {
      return { ok: false as const, code: "WALLET_TX_INVALID_TRANSITION", message: `El crédito ya no está pendiente (estado actual: ${existing.status}).`, statusCode: 409 };
    }

    const updated = await ledgerRepo.approvePending(id, auth.userId);
    if (!updated) {
      return { ok: false as const, code: "WALLET_TX_INVALID_TRANSITION", message: "El crédito fue modificado por otra solicitud concurrente.", statusCode: 409 };
    }

    return { ok: true as const, transaction: serialize(updated) };
  }

  /** POST /admin/wallet-transactions/:id/reject */
  async rejectCredit(accessToken: string, id: string, input: AdminModerateCreditInput) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (!isFinancialAdmin(auth.role)) {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Solo administradores pueden rechazar créditos.", statusCode: 403 };
    }

    const existing = await ledgerRepo.findById(id);
    if (!existing) {
      return { ok: false as const, code: "NOT_FOUND", message: "Wallet transaction not found.", statusCode: 404 };
    }

    if (existing.status !== "pending") {
      return { ok: false as const, code: "WALLET_TX_INVALID_TRANSITION", message: `El crédito ya no está pendiente (estado actual: ${existing.status}).`, statusCode: 409 };
    }

    const updated = await ledgerRepo.rejectPending(id, auth.userId, input.reason ?? null);
    if (!updated) {
      return { ok: false as const, code: "WALLET_TX_INVALID_TRANSITION", message: "El crédito fue modificado por otra solicitud concurrente.", statusCode: 409 };
    }

    return { ok: true as const, transaction: serialize(updated) };
  }

  /**
   * POST /wallets/apply-credit — el pasajero aplica un crédito disponible propio a un viaje.
   * Idempotente: una segunda solicitud con la misma idempotencyKey retorna el mismo
   * resultado sin volver a debitar. Doble aplicación concurrente del mismo crédito es
   * imposible porque el UPDATE en el repositorio solo afecta filas con status='available'.
   */
  async applyCredit(accessToken: string, input: ApplyCreditInput) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const existingByKey = await ledgerRepo.findByIdempotencyKey(input.idempotencyKey);
    if (existingByKey) {
      return { ok: true as const, transaction: serialize(existingByKey), idempotentReplay: true };
    }

    const credit = await ledgerRepo.findById(input.walletTransactionId);
    if (!credit) {
      return { ok: false as const, code: "NOT_FOUND", message: "Wallet transaction not found.", statusCode: 404 };
    }

    if (credit.userId !== auth.userId) {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Este crédito no te pertenece.", statusCode: 403 };
    }

    if (credit.expiresAt && credit.expiresAt.getTime() < Date.now()) {
      return { ok: false as const, code: "WALLET_TX_EXPIRED", message: "El crédito expiró.", statusCode: 409 };
    }

    const result = await ledgerRepo.applyAvailableCredit({
      walletTransactionId: input.walletTransactionId,
      userId: auth.userId,
      rideId: input.rideId,
      debitIdempotencyKey: input.idempotencyKey,
    });

    if (!result) {
      return {
        ok: false as const,
        code: "WALLET_TX_NOT_AVAILABLE",
        message: "El crédito no está disponible (ya fue aplicado, rechazado o no existe).",
        statusCode: 409,
      };
    }

    return { ok: true as const, transaction: serialize(result.debit), idempotentReplay: false };
  }
}
