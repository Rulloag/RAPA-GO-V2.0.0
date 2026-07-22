import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import { db } from "../../db/client.js";
import { facebookLoginExchanges } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";

const EXCHANGE_CODE_BYTES = 32;
const EXCHANGE_TTL_MS = 3 * 60 * 1000;
const CLEANUP_RETENTION_MS = 24 * 60 * 60 * 1000;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export class FacebookLoginExchangeRepository {
  async create(userId: string): Promise<string> {
    const code = randomBytes(EXCHANGE_CODE_BYTES).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + EXCHANGE_TTL_MS);

    try {
      await db.delete(facebookLoginExchanges).where(
        or(
          lt(
            facebookLoginExchanges.expiresAt,
            new Date(now.getTime() - CLEANUP_RETENTION_MS),
          ),
          lt(
            facebookLoginExchanges.usedAt,
            new Date(now.getTime() - CLEANUP_RETENTION_MS),
          ),
        ),
      );

      await db.insert(facebookLoginExchanges).values({
        userId,
        codeHash: hashCode(code),
        expiresAt,
      });

      return code;
    } catch (error) {
      throw AppError.internal(
        `Failed to create Facebook login exchange: ${String(error)}`,
      );
    }
  }

  async consume(code: string): Promise<string | null> {
    const cleanCode = code.trim();
    if (!cleanCode) return null;

    const now = new Date();

    try {
      const rows = await db
        .update(facebookLoginExchanges)
        .set({ usedAt: now })
        .where(
          and(
            eq(facebookLoginExchanges.codeHash, hashCode(cleanCode)),
            isNull(facebookLoginExchanges.usedAt),
            gt(facebookLoginExchanges.expiresAt, now),
          ),
        )
        .returning({ userId: facebookLoginExchanges.userId });

      return rows[0]?.userId ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to consume Facebook login exchange: ${String(error)}`,
      );
    }
  }
}
