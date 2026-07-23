import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import { db } from "../../db/client.js";
import { facebookLoginExchanges } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";

const EXCHANGE_CODE_BYTES = 32;
const EXCHANGE_TTL_MS = 3 * 60 * 1000;
const SETUP_EXCHANGE_TTL_MS = 30 * 60 * 1000;
const CLEANUP_RETENTION_MS = 24 * 60 * 60 * 1000;

type FacebookExchangePurpose = "login" | "link" | "setup";

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export class FacebookLoginExchangeRepository {
  async create(
    userId: string,
    purpose: FacebookExchangePurpose = "login",
  ): Promise<string> {
    const code = randomBytes(EXCHANGE_CODE_BYTES).toString("base64url");
    const now = new Date();
    const ttlMs =
      purpose === "setup" ? SETUP_EXCHANGE_TTL_MS : EXCHANGE_TTL_MS;
    const expiresAt = new Date(now.getTime() + ttlMs);

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
        purpose,
        expiresAt,
      });

      return code;
    } catch (error) {
      throw AppError.internal(
        `Failed to create Facebook login exchange: ${String(error)}`,
      );
    }
  }

  async peek(
    code: string,
    purpose: FacebookExchangePurpose = "login",
  ): Promise<string | null> {
    const cleanCode = code.trim();
    if (!cleanCode) return null;

    const now = new Date();

    try {
      const rows = await db
        .select({ userId: facebookLoginExchanges.userId })
        .from(facebookLoginExchanges)
        .where(
          and(
            eq(facebookLoginExchanges.codeHash, hashCode(cleanCode)),
            eq(facebookLoginExchanges.purpose, purpose),
            isNull(facebookLoginExchanges.usedAt),
            gt(facebookLoginExchanges.expiresAt, now),
          ),
        )
        .limit(1);

      return rows[0]?.userId ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to inspect Facebook login exchange: ${String(error)}`,
      );
    }
  }

  async consume(
    code: string,
    purpose: FacebookExchangePurpose = "login",
  ): Promise<string | null> {
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
            eq(facebookLoginExchanges.purpose, purpose),
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
