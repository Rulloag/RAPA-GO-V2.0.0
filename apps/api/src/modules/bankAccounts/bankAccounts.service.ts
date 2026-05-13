import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { BankAccountsRepository } from "./bankAccounts.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { BankAccountResponse, BankAccountResult, BankAccountGetResult } from "./bankAccounts.types.js";
import type { UserBankAccount } from "../../db/schema/index.js";
import type { UpsertBankAccountInput } from "./bankAccounts.schemas.js";

const tokenService          = new TokenService();
const sessionService        = new SessionService();
const usersRepository       = new UsersRepository();
const bankAccountsRepository = new BankAccountsRepository();

function toResponse(row: UserBankAccount): BankAccountResponse {
  return {
    id:                 row.id,
    userId:             row.userId,
    accountHolderName:  row.accountHolderName,
    bankName:           row.bankName,
    accountType:        row.accountType,
    accountNumberLast4: row.accountNumberLast4,
    status:             row.status,
    createdAt:          row.createdAt.toISOString(),
    updatedAt:          row.updatedAt.toISOString(),
  };
}

async function authenticate(
  accessToken: string,
): Promise<{ ok: true; userId: string } | { ok: false; code: string; message: string; statusCode: number }> {
  let payload;
  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, code: err.code, message: err.message, statusCode: err.statusCode };
    }
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 };
  }

  const hash  = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);
  if (!valid) {
    return { ok: false, code: "AUTH_SESSION_REVOKED", message: "Session has been revoked.", statusCode: 401 };
  }

  const user = await usersRepository.findById(payload.sub);
  if (!user) {
    return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
  }

  return { ok: true, userId: user.id };
}

export class BankAccountsService {
  async getBankAccount(accessToken: string): Promise<BankAccountGetResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const row = await bankAccountsRepository.findByUserId(auth.userId);
    return { ok: true, account: row ? toResponse(row) : null };
  }

  async upsertBankAccount(accessToken: string, input: UpsertBankAccountInput): Promise<BankAccountResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const last4 = input.accountNumber.slice(-4);

    const row = await bankAccountsRepository.upsert(auth.userId, {
      accountHolderName:  input.accountHolderName,
      bankName:           input.bankName,
      accountType:        input.accountType,
      accountNumberLast4: last4,
    });

    return { ok: true, account: toResponse(row) };
  }
}
