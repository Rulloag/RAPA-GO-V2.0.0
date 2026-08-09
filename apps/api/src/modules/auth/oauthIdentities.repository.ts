import { and, eq } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  oauthIdentities,
  users,
  type NewUser,
  type OAuthIdentity,
  type User,
} from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";

const UNIQUE_VIOLATION = "23505";

export type OAuthIdentityProvider = "apple" | "facebook" | "google";

function isOAuthIdentityProvider(
  value: string,
): value is OAuthIdentityProvider {
  return (
    value === "apple" ||
    value === "facebook" ||
    value === "google"
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === UNIQUE_VIOLATION
  );
}

export class OAuthIdentitiesRepository {
  async listProviders(
    userId: string,
  ): Promise<OAuthIdentityProvider[]> {
    try {
      const rows = await db
        .select({ provider: oauthIdentities.provider })
        .from(oauthIdentities)
        .where(eq(oauthIdentities.userId, userId));

      return Array.from(
        new Set(
          rows
            .map((row) => String(row.provider))
            .filter(isOAuthIdentityProvider),
        ),
      );
    } catch (error) {
      throw AppError.internal(
        `Failed to list oauth identity providers: ${String(error)}`,
      );
    }
  }

  async findByProviderAndSub(
    provider: string,
    providerUserId: string,
  ): Promise<OAuthIdentity | null> {
    try {
      const rows = await db
        .select()
        .from(oauthIdentities)
        .where(
          and(
            eq(oauthIdentities.provider, provider),
            eq(oauthIdentities.providerUserId, providerUserId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to query oauth identity: ${String(error)}`,
      );
    }
  }

  async findByUserAndProvider(
    userId: string,
    provider: string,
  ): Promise<OAuthIdentity | null> {
    try {
      const rows = await db
        .select()
        .from(oauthIdentities)
        .where(
          and(
            eq(oauthIdentities.userId, userId),
            eq(oauthIdentities.provider, provider),
          ),
        )
        .limit(1);

      return rows[0] ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to query oauth identity by user/provider: ${String(error)}`,
      );
    }
  }

  async updateProviderCredentials(
    id: string,
    providerClientId: string,
    encryptedRefreshToken?: string,
  ): Promise<void> {
    try {
      await db
        .update(oauthIdentities)
        .set({
          providerClientId,
          ...(encryptedRefreshToken !== undefined
            ? { encryptedRefreshToken }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(oauthIdentities.id, id));
    } catch (error) {
      throw AppError.internal(
        `Failed to update oauth identity credentials: ${String(error)}`,
      );
    }
  }

  async attachToExistingUser(input: {
    userId: string;
    provider: string;
    providerUserId: string;
    providerClientId: string;
    providerEmail: string | undefined;
    providerEmailVerified: boolean;
    providerIsPrivateEmail: boolean;
    encryptedRefreshToken: string | undefined;
  }): Promise<OAuthIdentity | null> {
    try {
      const rows = await db
        .insert(oauthIdentities)
        .values({
          userId: input.userId,
          provider: input.provider,
          providerUserId: input.providerUserId,
          providerClientId: input.providerClientId,
          providerEmail: input.providerEmail ?? null,
          providerEmailVerified: input.providerEmailVerified,
          providerIsPrivateEmail: input.providerIsPrivateEmail,
          encryptedRefreshToken: input.encryptedRefreshToken ?? null,
        })
        .returning();
      return rows[0] ?? null;
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw AppError.internal(
        `Failed to attach oauth identity: ${String(error)}`,
      );
    }
  }

  async createUserWithIdentity(input: {
    email: string;
    name: string;
    role: string;
    status: string;
    isVerified: boolean;
    provider: string;
    providerUserId: string;
    providerClientId: string;
    providerEmail: string | undefined;
    providerEmailVerified: boolean;
    providerIsPrivateEmail: boolean;
    encryptedRefreshToken: string | undefined;
  }): Promise<{ user: User; identity: OAuthIdentity } | null> {
    try {
      return await db.transaction(async (tx) => {
        const newUser: NewUser = {
          email: input.email,
          name: input.name,
          role: input.role,
          status: input.status,
          isVerified: input.isVerified,
        };
        const userRows = await tx.insert(users).values(newUser).returning();
        const user = userRows[0];
        if (!user) {
          throw AppError.internal("User insert returned no rows.");
        }

        const identityRows = await tx
          .insert(oauthIdentities)
          .values({
            userId: user.id,
            provider: input.provider,
            providerUserId: input.providerUserId,
            providerClientId: input.providerClientId,
            providerEmail: input.providerEmail ?? null,
            providerEmailVerified: input.providerEmailVerified,
            providerIsPrivateEmail: input.providerIsPrivateEmail,
            encryptedRefreshToken: input.encryptedRefreshToken ?? null,
          })
          .returning();
        const identity = identityRows[0];
        if (!identity) {
          throw AppError.internal(
            "OAuth identity insert returned no rows.",
          );
        }

        return { user, identity };
      });
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      if (error instanceof AppError) throw error;
      throw AppError.internal(
        `Failed to create user with oauth identity: ${String(error)}`,
      );
    }
  }
}
