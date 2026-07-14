import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { WalletRepository } from "./wallet.repository.js";
import { WalletTransactionsRepository } from "./walletTransactions.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { CURRENT_LEDGER_POLICY_VERSION, decideAdminCreditApproval, buildWalletCreditOperationKey } from "./walletPolicy.constants.js";
import type {
  AdminCreateCreditInput,
  AdminModerateCreditInput,
  ApplyCreditInput,
  MarkDebitPaidInput,
  CancelDebitInput,
  ReverseTransactionInput,
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
  /**
   * Unificación de sistemas de Wallet: wallets.balance se mantiene únicamente como CACHÉ de
   * lectura rápida para GET /wallets/me — nunca se incrementa/decrementa directamente, siempre
   * se recalcula desde la fuente única de verdad (SUM de movimientos 'available' del ledger).
   * Se invoca después de cualquier operación que cambie el saldo disponible de un usuario.
   */
  private async syncWalletBalanceCache(userId: string): Promise<void> {
    try {
      const wallet = await walletRepo.getOrCreate(userId);
      const availableClp = await ledgerRepo.getAvailableBalance(userId);
      await walletRepo.updateBalance(wallet.id, availableClp);
    } catch {
      // La caché de saldo es informativa (GET /wallets/me); si falla, el ledger sigue
      // siendo la fuente de verdad y no se bloquea la operación principal.
    }
  }

  /** GET /wallets/me/credits — el pasajero solo puede consultar su propio ledger. */
  async listMyCredits(accessToken: string, status?: string, type?: string) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const rows = await ledgerRepo.listByUser(auth.userId, status, type);
    const balance = await ledgerRepo.getWalletBalanceSummary(auth.userId);

    return { ok: true as const, items: rows.map(serialize), ...balance, availableBalanceClp: balance.availableCreditClp };
  }

  /** POST /admin/wallet-transactions/:id/mark-paid — cobro de un débito, solo admin_review hoy. */
  async markDebitPaid(accessToken: string, id: string, input: MarkDebitPaidInput) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (!isFinancialAdmin(auth.role)) {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Solo administradores pueden marcar un débito como pagado.", statusCode: 403 };
    }

    const existing = await ledgerRepo.findById(id);
    if (!existing) {
      return { ok: false as const, code: "NOT_FOUND", message: "Wallet transaction not found.", statusCode: 404 };
    }

    if (existing.type !== "debit") {
      return { ok: false as const, code: "WALLET_TX_WRONG_TYPE", message: "Solo se puede marcar como pagado un movimiento type=debit.", statusCode: 409 };
    }

    if (existing.status !== "pending") {
      return { ok: false as const, code: "WALLET_TX_INVALID_TRANSITION", message: `El débito ya no está pendiente (estado actual: ${existing.status}).`, statusCode: 409 };
    }

    const updated = await ledgerRepo.markDebitPaid(id, auth.userId, input.collectionMethod);
    if (!updated) {
      return { ok: false as const, code: "WALLET_TX_INVALID_TRANSITION", message: "El débito fue modificado por otra solicitud concurrente.", statusCode: 409 };
    }

    return { ok: true as const, transaction: serialize(updated) };
  }

  /** POST /admin/wallet-transactions/:id/cancel — condona un débito pendiente. */
  async cancelDebit(accessToken: string, id: string, input: CancelDebitInput) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (!isFinancialAdmin(auth.role)) {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Solo administradores pueden condonar un débito.", statusCode: 403 };
    }

    const existing = await ledgerRepo.findById(id);
    if (!existing) {
      return { ok: false as const, code: "NOT_FOUND", message: "Wallet transaction not found.", statusCode: 404 };
    }

    if (existing.type !== "debit") {
      return { ok: false as const, code: "WALLET_TX_WRONG_TYPE", message: "Solo se puede condonar un movimiento type=debit.", statusCode: 409 };
    }

    if (existing.status !== "pending") {
      return { ok: false as const, code: "WALLET_TX_INVALID_TRANSITION", message: `El débito ya no está pendiente (estado actual: ${existing.status}).`, statusCode: 409 };
    }

    const updated = await ledgerRepo.cancelDebit(id, auth.userId, input.reason);
    if (!updated) {
      return { ok: false as const, code: "WALLET_TX_INVALID_TRANSITION", message: "El débito fue modificado por otra solicitud concurrente.", statusCode: 409 };
    }

    return { ok: true as const, transaction: serialize(updated) };
  }

  /**
   * POST /admin/wallet-transactions/:id/reverse — anula un movimiento ya resuelto (paid,
   * applied, etc.) mediante un nuevo movimiento type=reversal. Nunca edita el original.
   * Imposibilidad de autoaprobar: el admin que creó O resolvió (aprobó/pagó/canceló) el
   * movimiento original no puede ser quien lo revierta.
   */
  async reverseTransaction(accessToken: string, id: string, input: ReverseTransactionInput) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (!isFinancialAdmin(auth.role)) {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Solo administradores pueden revertir un movimiento.", statusCode: 403 };
    }

    const existing = await ledgerRepo.findById(id);
    if (!existing) {
      return { ok: false as const, code: "NOT_FOUND", message: "Wallet transaction not found.", statusCode: 404 };
    }

    if (existing.status === "reversed") {
      return { ok: false as const, code: "WALLET_TX_INVALID_TRANSITION", message: "El movimiento ya fue revertido.", statusCode: 409 };
    }

    if (existing.createdBy === auth.userId || existing.approvedBy === auth.userId) {
      return {
        ok: false as const,
        code: "AUTH_SELF_APPROVAL_FORBIDDEN",
        message: "Un administrador no puede revertir un movimiento que él mismo creó o resolvió.",
        statusCode: 403,
      };
    }

    const result = await ledgerRepo.reverseTransaction({
      originalTransactionId: id,
      resolvedBy: auth.userId,
      reason: input.reason,
    });

    if (!result) {
      return { ok: false as const, code: "WALLET_TX_INVALID_TRANSITION", message: "El movimiento no se pudo revertir (ya revertido o modificado concurrentemente).", statusCode: 409 };
    }

    await this.syncWalletBalanceCache(result.original.userId);

    return { ok: true as const, original: serialize(result.original), reversal: serialize(result.reversal) };
  }

  /**
   * POST /admin/wallet-transactions — un admin crea (propone) un crédito para un usuario.
   * Créditos <= ADMIN_WALLET_CREDIT_SINGLE_APPROVAL_MAX_CLP se auto-aprueban (un solo admin);
   * montos mayores nacen en 'pending' y requieren aprobación de OTRO admin (imposibilidad de
   * autoaprobar, ver approveCredit) — política compartida con WalletService.adminCreateWalletCredit.
   */
  async createCredit(accessToken: string, input: AdminCreateCreditInput) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (!isFinancialAdmin(auth.role)) {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Solo administradores pueden crear créditos.", statusCode: 403 };
    }

    // UNIFICACIÓN DE IDEMPOTENCIA: la misma clave canónica que usa el endpoint legacy
    // /admin/wallet/credits — dos solicitudes equivalentes (mismos campos de dominio) desde
    // cualquiera de los dos endpoints colisionan en el mismo movimiento del ledger.
    const operationKey = buildWalletCreditOperationKey({
      operationType: "admin_wallet_credit",
      userId: input.userId,
      rideId: input.rideId ?? null,
      paymentId: input.paymentId ?? null,
      source: input.source,
      amountClp: input.amountClp,
      policyVersion: CURRENT_LEDGER_POLICY_VERSION,
      externalReference: input.externalReference ?? input.idempotencyKey ?? null,
    });

    const existing = await ledgerRepo.findByIdempotencyKey(operationKey);
    if (existing) {
      return { ok: true as const, transaction: serialize(existing), idempotentReplay: true };
    }

    const wallet = await walletRepo.getOrCreate(input.userId);
    const decision = decideAdminCreditApproval(input.amountClp);
    const now = new Date();

    const row = await ledgerRepo.create({
      walletId: wallet.id,
      userId: input.userId,
      rideId: input.rideId ?? null,
      type: "credit",
      source: input.source,
      amountClp: input.amountClp,
      currency: "CLP",
      status: decision.status,
      approvalStatus: decision.approvalStatus,
      policyVersion: CURRENT_LEDGER_POLICY_VERSION,
      actorRole: "admin",
      idempotencyKey: operationKey,
      createdBy: auth.userId,
      ...(decision.status === "available" ? { approvedBy: auth.userId, approvedAt: now } : {}),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      metadata: { reason: input.reason },
    });

    if (decision.status === "available") {
      await this.syncWalletBalanceCache(input.userId);
    }

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

    await this.syncWalletBalanceCache(updated.userId);

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

    await this.syncWalletBalanceCache(auth.userId);

    return { ok: true as const, transaction: serialize(result.consumptionRecord), idempotentReplay: false };
  }
}
