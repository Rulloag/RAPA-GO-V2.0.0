import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { WalletRepository } from "./wallet.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { Wallet, Transaction } from "../../db/schema/index.js";

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
}
