import { eq, and } from "drizzle-orm";
import { db } from "../../db/client.js";
import { oauthIdentities, users } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { OAuthIdentity } from "../../db/schema/index.js";
import type { User, NewUser } from "../../db/schema/index.js";

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === UNIQUE_VIOLATION;
}

export class OAuthIdentitiesRepository {
  async findByProviderAndSub(provider: string, providerUserId: string): Promise<OAuthIdentity | null> {
    try {
      const rows = await db
        .select()
        .from(oauthIdentities)
        .where(and(eq(oauthIdentities.provider, provider), eq(oauthIdentities.providerUserId, providerUserId)))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query oauth identity: ${String(err)}`);
    }
  }

  async updateEncryptedRefreshToken(id: string, encryptedRefreshToken: string): Promise<void> {
    try {
      await db
        .update(oauthIdentities)
        .set({ encryptedRefreshToken, updatedAt: new Date() })
        .where(eq(oauthIdentities.id, id));
    } catch (err) {
      throw AppError.internal(`Failed to update oauth identity refresh token: ${String(err)}`);
    }
  }

  /**
   * Attaches a new oauth_identity to an *existing* user. Returns `null`
   * instead of throwing on a unique(provider, provider_user_id) violation —
   * the caller is expected to re-query and treat it as "someone else just
   * linked this identity concurrently", not as an internal error.
   */
  async attachToExistingUser(input: {
    userId: string;
    provider: string;
    providerUserId: string;
    providerEmail: string | undefined;
    providerEmailVerified: boolean;
    providerIsPrivateEmail: boolean;
    encryptedRefreshToken: string | undefined;
  }): Promise<OAuthIdentity | null> {
    try {
      const rows = await db
        .insert(oauthIdentities)
        .values({
          userId:                 input.userId,
          provider:               input.provider,
          providerUserId:         input.providerUserId,
          providerEmail:          input.providerEmail ?? null,
          providerEmailVerified:  input.providerEmailVerified,
          providerIsPrivateEmail: input.providerIsPrivateEmail,
          encryptedRefreshToken:  input.encryptedRefreshToken ?? null,
        })
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw AppError.internal(`Failed to attach oauth identity: ${String(err)}`);
    }
  }

  /**
   * Creates a brand-new user and its oauth_identity together, atomically.
   * Returns `null` (instead of throwing) on a unique(provider,
   * provider_user_id) violation, so the caller can re-query and fall back to
   * the "identity already exists" path — this is the concurrency guard for
   * two simultaneous first-time sign-ins with the same Apple account.
   */
  async createUserWithIdentity(input: {
    email: string;
    name: string;
    role: string;
    status: string;
    isVerified: boolean;
    provider: string;
    providerUserId: string;
    providerEmail: string | undefined;
    providerEmailVerified: boolean;
    providerIsPrivateEmail: boolean;
    encryptedRefreshToken: string | undefined;
  }): Promise<{ user: User; identity: OAuthIdentity } | null> {
    try {
      return await db.transaction(async (tx) => {
        const newUser: NewUser = {
          email:      input.email,
          name:       input.name,
          role:       input.role,
          status:     input.status,
          isVerified: input.isVerified,
        };
        const userRows = await tx.insert(users).values(newUser).returning();
        const user = userRows[0];
        if (!user) throw AppError.internal("User insert returned no rows.");

        const identityRows = await tx
          .insert(oauthIdentities)
          .values({
            userId:                 user.id,
            provider:               input.provider,
            providerUserId:         input.providerUserId,
            providerEmail:          input.providerEmail ?? null,
            providerEmailVerified:  input.providerEmailVerified,
            providerIsPrivateEmail: input.providerIsPrivateEmail,
            encryptedRefreshToken:  input.encryptedRefreshToken ?? null,
          })
          .returning();
        const identity = identityRows[0];
        if (!identity) throw AppError.internal("OAuth identity insert returned no rows.");

        return { user, identity };
      });
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create user with oauth identity: ${String(err)}`);
    }
  }
}
