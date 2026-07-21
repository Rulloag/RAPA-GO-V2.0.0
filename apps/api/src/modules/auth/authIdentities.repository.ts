import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../db/client.js";
import { authIdentities } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";

export type AuthIdentityProvider = "facebook" | "apple";

function providerLabel(provider: AuthIdentityProvider): string {
  return provider === "apple" ? "Apple" : "Facebook";
}

export class AuthIdentitiesRepository {
  async findActiveByProviderSubject(
    provider: AuthIdentityProvider,
    providerSubject: string,
  ): Promise<typeof authIdentities.$inferSelect | null> {
    try {
      const rows = await db
        .select()
        .from(authIdentities)
        .where(
          and(
            eq(authIdentities.provider, provider),
            eq(authIdentities.providerSubject, providerSubject),
            isNull(authIdentities.revokedAt),
          ),
        )
        .limit(1);

      return rows[0] ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to load auth identity: ${String(error)}`,
      );
    }
  }

  async findActiveByUserProvider(
    userId: string,
    provider: AuthIdentityProvider,
  ): Promise<typeof authIdentities.$inferSelect | null> {
    try {
      const rows = await db
        .select()
        .from(authIdentities)
        .where(
          and(
            eq(authIdentities.userId, userId),
            eq(authIdentities.provider, provider),
            isNull(authIdentities.revokedAt),
          ),
        )
        .limit(1);

      return rows[0] ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to load user auth identity: ${String(error)}`,
      );
    }
  }

  async listActiveProviders(userId: string): Promise<AuthIdentityProvider[]> {
    try {
      const rows = await db
        .select({ provider: authIdentities.provider })
        .from(authIdentities)
        .where(
          and(
            eq(authIdentities.userId, userId),
            isNull(authIdentities.revokedAt),
          ),
        );

      return rows
        .map((row) => row.provider)
        .filter(
          (provider): provider is AuthIdentityProvider =>
            provider === "facebook" || provider === "apple",
        );
    } catch (error) {
      throw AppError.internal(
        `Failed to list auth providers: ${String(error)}`,
      );
    }
  }

  async link(input: {
    userId: string;
    provider: AuthIdentityProvider;
    providerSubject: string;
    providerEmail?: string | null;
    emailVerified?: boolean;
    providerIsPrivateEmail?: boolean;
    encryptedRefreshToken?: string | null;
  }): Promise<typeof authIdentities.$inferSelect> {
    try {
      return await db.transaction(async (tx) => {
        const subjectRows = await tx
          .select()
          .from(authIdentities)
          .where(
            and(
              eq(authIdentities.provider, input.provider),
              eq(authIdentities.providerSubject, input.providerSubject),
            ),
          )
          .limit(1);

        const subjectIdentity = subjectRows[0];

        if (
          subjectIdentity &&
          subjectIdentity.userId !== input.userId &&
          !subjectIdentity.revokedAt
        ) {
          throw new AppError({
            code: "AUTH_IDENTITY_ALREADY_LINKED",
            message: `Esta cuenta de ${providerLabel(input.provider)} ya está vinculada a otra cuenta RAPA GO.`,
            statusCode: 409,
          });
        }

        const userRows = await tx
          .select()
          .from(authIdentities)
          .where(
            and(
              eq(authIdentities.userId, input.userId),
              eq(authIdentities.provider, input.provider),
            ),
          )
          .limit(1);

        const existingForUser = userRows[0];
        const now = new Date();
        const providerEmail =
          input.providerEmail?.trim().toLowerCase() || null;

        if (existingForUser) {
          const rows = await tx
            .update(authIdentities)
            .set({
              providerSubject: input.providerSubject,
              providerEmail,
              emailVerified: input.emailVerified ?? false,
              providerIsPrivateEmail:
                input.providerIsPrivateEmail ?? false,
              ...(input.encryptedRefreshToken !== undefined
                ? {
                    encryptedRefreshToken:
                      input.encryptedRefreshToken,
                  }
                : {}),
              linkedAt: existingForUser.linkedAt ?? now,
              lastLoginAt: now,
              revokedAt: null,
              updatedAt: now,
            })
            .where(eq(authIdentities.id, existingForUser.id))
            .returning();

          const updated = rows[0];
          if (!updated) {
            throw AppError.internal(
              "Auth identity update returned no rows.",
            );
          }
          return updated;
        }

        if (subjectIdentity?.revokedAt) {
          const rows = await tx
            .update(authIdentities)
            .set({
              userId: input.userId,
              providerEmail,
              emailVerified: input.emailVerified ?? false,
              providerIsPrivateEmail:
                input.providerIsPrivateEmail ?? false,
              encryptedRefreshToken:
                input.encryptedRefreshToken ?? null,
              linkedAt: now,
              lastLoginAt: now,
              revokedAt: null,
              updatedAt: now,
            })
            .where(eq(authIdentities.id, subjectIdentity.id))
            .returning();

          const restored = rows[0];
          if (!restored) {
            throw AppError.internal(
              "Auth identity restore returned no rows.",
            );
          }
          return restored;
        }

        const rows = await tx
          .insert(authIdentities)
          .values({
            userId: input.userId,
            provider: input.provider,
            providerSubject: input.providerSubject,
            providerEmail,
            emailVerified: input.emailVerified ?? false,
            providerIsPrivateEmail:
              input.providerIsPrivateEmail ?? false,
            encryptedRefreshToken:
              input.encryptedRefreshToken ?? null,
            linkedAt: now,
            lastLoginAt: now,
          })
          .returning();

        const created = rows[0];
        if (!created) {
          throw AppError.internal(
            "Auth identity insert returned no rows.",
          );
        }
        return created;
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(
        `Failed to link auth identity: ${String(error)}`,
      );
    }
  }

  async updateEncryptedRefreshToken(
    identityId: string,
    encryptedRefreshToken: string,
  ): Promise<void> {
    try {
      await db
        .update(authIdentities)
        .set({ encryptedRefreshToken, updatedAt: new Date() })
        .where(eq(authIdentities.id, identityId));
    } catch (error) {
      throw AppError.internal(
        `Failed to update OAuth refresh token: ${String(error)}`,
      );
    }
  }

  async touchLastLogin(identityId: string): Promise<void> {
    try {
      await db
        .update(authIdentities)
        .set({
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(authIdentities.id, identityId));
    } catch (error) {
      throw AppError.internal(
        `Failed to update auth identity login: ${String(error)}`,
      );
    }
  }
}
