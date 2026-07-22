import { useCallback, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { AppleSignIn, SignInScope, ErrorCode } from "@capawesome/capacitor-apple-sign-in";
import { generateAppleNoncePair } from "./appleNonce.js";
import { useAuth } from "./useAuth.js";
import type { AppleSignInRequest } from "./auth.types.js";
import type { PublicRole } from "./roles.js";
import type { UserRole } from "@rapa-go/shared";

/**
 * Discriminated outcome of an Apple sign-in attempt — the UI branches on
 * `kind`, never on raw backend error codes directly, so error-code mapping
 * lives in exactly one place (mapBackendError below).
 *
 * `success` carries the signed-in user's role directly, rather than making
 * the caller read it back out of AuthProvider's context state — reading
 * context after an `await` risks a stale-closure read of the pre-update
 * value, since the state setter's effect isn't visible until the next
 * render.
 */
export type AppleSignInOutcome =
  | { kind: "success"; role: UserRole }
  | { kind: "cancelled" }
  | { kind: "role_required" }
  | { kind: "linking_required" }
  | { kind: "invalid_credential"; message: string }
  | { kind: "suspended"; message: string }
  | { kind: "network_error"; message: string }
  | { kind: "unavailable" }
  | { kind: "internal_error"; message: string };

/** Credentials held only in memory between the initial attempt and a role-required retry. */
interface PendingCredentials {
  identityToken: string;
  authorizationCode: string;
  nonce: string;
  name?: AppleSignInRequest["name"];
}

const SUSPENDED_CODES = new Set(["AUTH_ACCOUNT_SUSPENDED"]);
const LINKING_REQUIRED_CODES = new Set(["AUTH_APPLE_ACCOUNT_LINKING_REQUIRED"]);
const ROLE_REQUIRED_CODES = new Set(["VALIDATION_ERROR"]);
const INVALID_CREDENTIAL_CODES = new Set([
  "UNAUTHORIZED",
  "AUTH_APPLE_TOKEN_INVALID",
  "AUTH_APPLE_TOKEN_INCOHERENT",
  "AUTH_APPLE_NONCE_MISMATCH",
  "AUTH_APPLE_EMAIL_MISSING",
  "AUTH_FORBIDDEN",
]);
const NETWORK_CODES = new Set(["NETWORK_ERROR", "TIMEOUT"]);

function mapBackendError(code: string, message: string): AppleSignInOutcome {
  if (ROLE_REQUIRED_CODES.has(code))     return { kind: "role_required" };
  if (LINKING_REQUIRED_CODES.has(code))  return { kind: "linking_required" };
  if (SUSPENDED_CODES.has(code))         return { kind: "suspended", message };
  if (INVALID_CREDENTIAL_CODES.has(code)) return { kind: "invalid_credential", message };
  if (NETWORK_CODES.has(code))           return { kind: "network_error", message };
  return { kind: "internal_error", message };
}

export interface UseAppleSignInResult {
  /** True only on iOS running as a native Capacitor app — the only platform this PR implements. */
  isAvailable: boolean;
  loading: boolean;
  /** Starts the native Apple flow. No-op (returns immediately) if already loading. */
  signIn: () => Promise<AppleSignInOutcome>;
  /** True while signIn() is waiting for a role to complete a new-account sign-in. */
  awaitingRole: boolean;
  /** Retries with the credentials from the last attempt plus a role. Only valid while awaitingRole is true. */
  submitRole: (role: PublicRole) => Promise<AppleSignInOutcome>;
  /** Discards any credentials held in memory without retrying — e.g. user backs out of role selection. */
  cancelRoleSelection: () => void;
}

export function useAppleSignIn(): UseAppleSignInResult {
  const { signInWithApple } = useAuth();
  const [loading, setLoading] = useState(false);
  const [awaitingRole, setAwaitingRole] = useState(false);
  const pendingRef = useRef<PendingCredentials | null>(null);

  const isAvailable = Capacitor.getPlatform() === "ios";

  const clearPending = useCallback(() => {
    pendingRef.current = null;
    setAwaitingRole(false);
  }, []);

  const submitToBackend = useCallback(
    async (credentials: PendingCredentials, role?: PublicRole): Promise<AppleSignInOutcome> => {
      const payload: AppleSignInRequest = {
        identityToken: credentials.identityToken,
        authorizationCode: credentials.authorizationCode,
        nonce: credentials.nonce,
        ...(credentials.name ? { name: credentials.name } : {}),
        ...(role ? { role } : {}),
      };

      const response = await signInWithApple(payload);

      if (response.ok) {
        clearPending();
        return { kind: "success", role: response.session.user.role };
      }

      const outcome = mapBackendError(response.code, response.message ?? "");
      if (outcome.kind === "role_required") {
        // The only case where we deliberately keep credentials in memory —
        // everything else clears them, per the flow's cleanup contract.
        pendingRef.current = credentials;
        setAwaitingRole(true);
      } else {
        clearPending();
      }
      return outcome;
    },
    [signInWithApple, clearPending],
  );

  const signIn = useCallback(async (): Promise<AppleSignInOutcome> => {
    if (loading) return { kind: "internal_error", message: "A sign-in attempt is already in progress." };
    if (!isAvailable) return { kind: "unavailable" };

    setLoading(true);
    const { raw: rawNonce, hashed: hashedNonce } = await generateAppleNoncePair();

    try {
      const result = await AppleSignIn.signIn({
        scopes: [SignInScope.Email, SignInScope.FullName],
        nonce: hashedNonce,
      });

      // Defensive: never call the backend with incomplete credentials.
      if (!result.authorizationCode || !result.idToken) {
        return { kind: "internal_error", message: "Apple did not return complete credentials." };
      }

      const credentials: PendingCredentials = {
        identityToken: result.idToken,
        authorizationCode: result.authorizationCode,
        nonce: rawNonce,
        ...((result.givenName ?? result.familyName)
          ? { name: { ...(result.givenName ? { givenName: result.givenName } : {}), ...(result.familyName ? { familyName: result.familyName } : {}) } }
          : {}),
      };

      return await submitToBackend(credentials);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === ErrorCode.SignInCanceled) {
        return { kind: "cancelled" };
      }
      const message = err instanceof Error ? err.message : "Apple sign-in failed.";
      return { kind: "internal_error", message };
    } finally {
      setLoading(false);
    }
  }, [loading, isAvailable, submitToBackend]);

  const submitRole = useCallback(
    async (role: PublicRole): Promise<AppleSignInOutcome> => {
      // Runtime guard, not just a TypeScript type: PublicRole is erased at
      // runtime, so a manipulated/compromised UI could still call this with
      // "admin" as a plain string. This is the actual enforcement point.
      const ALLOWED_ROLES: readonly string[] = ["passenger", "driver", "guide", "rental_operator"];
      if (!ALLOWED_ROLES.includes(role)) {
        return { kind: "internal_error", message: "Invalid role." };
      }

      const pending = pendingRef.current;
      if (!pending) {
        return { kind: "internal_error", message: "No pending Apple credentials to retry." };
      }
      setLoading(true);
      try {
        return await submitToBackend(pending, role);
      } finally {
        setLoading(false);
      }
    },
    [submitToBackend],
  );

  return { isAvailable, loading, signIn, awaitingRole, submitRole, cancelRoleSelection: clearPending };
}
