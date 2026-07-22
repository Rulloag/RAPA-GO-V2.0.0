import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { userBankAccounts } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { UserBankAccount } from "../../db/schema/index.js";

export interface UpsertBankAccountData {
  accountHolderName:  string;
  bankName:           string;
  accountType:        string;
  accountNumberLast4: string;
  accountNumberEncrypted: string;
}

export class BankAccountsRepository {
  async findByUserId(userId: string): Promise<UserBankAccount | null> {
    try {
      const rows = await db
        .select()
        .from(userBankAccounts)
        .where(eq(userBankAccounts.userId, userId))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query bank account: ${String(err)}`);
    }
  }

  async upsert(userId: string, data: UpsertBankAccountData): Promise<UserBankAccount> {
    try {
      const rows = await db
        .insert(userBankAccounts)
        .values({
          userId,
          accountHolderName:  data.accountHolderName,
          bankName:           data.bankName,
          accountType:        data.accountType,
          accountNumberLast4: data.accountNumberLast4,
          accountNumberEncrypted: data.accountNumberEncrypted,
          status:             "active",
        })
        .onConflictDoUpdate({
          target: userBankAccounts.userId,
          set: {
            accountHolderName:  data.accountHolderName,
            bankName:           data.bankName,
            accountType:        data.accountType,
            accountNumberLast4: data.accountNumberLast4,
            accountNumberEncrypted: data.accountNumberEncrypted,
            status:             "active",
            updatedAt:          new Date(),
          },
        })
        .returning();
      const row = rows[0];
      if (!row) throw AppError.internal("Upsert returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to upsert bank account: ${String(err)}`);
    }
  }
}
