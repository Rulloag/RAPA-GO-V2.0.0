import { and, eq } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  authIdentities,
  oauthIdentities,
} from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import { OAuthTokenCrypto } from "../../shared/security/oauthTokenCrypto.js";
import { getAppleAuthConfig } from "./appleAuth.config.js";
import { AppleTokenRevocationClient } from "./appleTokenRevocation.client.js";

export interface AppleAccountRevocationResult {
  applicable: boolean;
  revokedTokens: number;
  alreadyInvalidTokens: number;
}

type StoredAppleToken = {
  encryptedRefreshToken: string | null;
  providerClientId: string | null;
};

function resolveLegacyClientId(storedClientId: string | null): string {
  if (storedClientId?.trim()) return storedClientId.trim();

  const explicitFallback = String(
    process.env["APPLE_REVOCATION_DEFAULT_CLIENT_ID"] ?? "",
  ).trim();
  if (explicitFallback) return explicitFallback;

  const { allowedClientIds } = getAppleAuthConfig();
  if (allowedClientIds.length === 1 && allowedClientIds[0]) {
    return allowedClientIds[0];
  }

  throw new AppError({
    code: "AUTH_APPLE_REVOCATION_CLIENT_ID_MISSING",
    message:
      "La identidad Apple no conserva el client_id original. Configura APPLE_REVOCATION_DEFAULT_CLIENT_ID para cuentas antiguas.",
    statusCode: 503,
  });
}

export class AppleAccountRevocationService {
  constructor(
    private readonly client = new AppleTokenRevocationClient(),
  ) {}

  async revokeForUser(
    userId: string,
  ): Promise<AppleAccountRevocationResult> {
    const [legacyRows, currentRows] = await Promise.all([
      db
        .select({
          encryptedRefreshToken: authIdentities.encryptedRefreshToken,
          providerClientId: authIdentities.providerClientId,
        })
        .from(authIdentities)
        .where(
          and(
            eq(authIdentities.userId, userId),
            eq(authIdentities.provider, "apple"),
          ),
        ),
      db
        .select({
          encryptedRefreshToken: oauthIdentities.encryptedRefreshToken,
          providerClientId: oauthIdentities.providerClientId,
        })
        .from(oauthIdentities)
        .where(
          and(
            eq(oauthIdentities.userId, userId),
            eq(oauthIdentities.provider, "apple"),
          ),
        ),
    ]);

    const identities: StoredAppleToken[] = [
      ...legacyRows,
      ...currentRows,
    ];

    if (identities.length === 0) {
      return {
        applicable: false,
        revokedTokens: 0,
        alreadyInvalidTokens: 0,
      };
    }

    const usable = identities.filter(
      (identity) => Boolean(identity.encryptedRefreshToken),
    );

    if (usable.length === 0) {
      throw new AppError({
        code: "AUTH_APPLE_REFRESH_TOKEN_MISSING",
        message:
          "La cuenta usa Apple, pero no existe un refresh token revocable. El usuario debe volver a autenticarse con Apple antes de completar la eliminación.",
        statusCode: 409,
      });
    }

    const seen = new Set<string>();
    let revokedTokens = 0;
    let alreadyInvalidTokens = 0;

    for (const identity of usable) {
      const encrypted = identity.encryptedRefreshToken;
      if (!encrypted || seen.has(encrypted)) continue;
      seen.add(encrypted);

      const refreshToken = OAuthTokenCrypto.decrypt(encrypted);
      const clientId = resolveLegacyClientId(
        identity.providerClientId,
      );
      const result = await this.client.revokeRefreshToken(
        refreshToken,
        clientId,
      );

      revokedTokens += 1;
      if (result.alreadyInvalid) alreadyInvalidTokens += 1;
    }

    return {
      applicable: true,
      revokedTokens,
      alreadyInvalidTokens,
    };
  }
}
