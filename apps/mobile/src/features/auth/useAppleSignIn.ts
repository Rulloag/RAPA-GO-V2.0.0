import { useCallback, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  AppleSignIn,
  ErrorCode,
  SignInScope,
} from "@capawesome/capacitor-apple-sign-in";
import { legalService, type LegalDocumentData } from "../legal/legal.service.js";
import { generateAppleNoncePair } from "./appleNonce.js";
import type {
  ApplePassengerFareType,
  AppleSignInRequest,
} from "./auth.types.js";
import { useAuth } from "./useAuth.js";
import type { UserRole } from "@rapa-go/shared";

const REQUIRED_TYPES = new Set([
  "terms_and_conditions",
  "privacy_policy",
  "user_conditions",
]);

type PendingAppleCredentials = Pick<
  AppleSignInRequest,
  "identityToken" | "authorizationCode" | "nonce" | "name"
>;

export type AppleSignInOutcome =
  | { kind: "success"; role: UserRole }
  | { kind: "cancelled" }
  | { kind: "setup_required" }
  | { kind: "linking_required"; message: string }
  | { kind: "error"; message: string }
  | { kind: "unavailable" };

export function useAppleSignIn() {
  const { signInWithApple } = useAuth();
  const [loading, setLoading] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [documents, setDocuments] = useState<LegalDocumentData[]>([]);
  const pending = useRef<PendingAppleCredentials | null>(null);

  const isAvailable =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

  const clearPending = useCallback(() => {
    pending.current = null;
    setSetupOpen(false);
    setDocuments([]);
  }, []);

  const submit = useCallback(
    async (payload: AppleSignInRequest): Promise<AppleSignInOutcome> => {
      const response = await signInWithApple(payload);
      if (response.ok === true) {
        clearPending();
        return { kind: "success", role: response.session.user.role };
      }

      if (response.code === "LEGAL_ACCEPTANCE_REQUIRED") {
        const active = await legalService.getActive();
        const required = active.filter(
          (document) => document.isActive && REQUIRED_TYPES.has(document.type),
        );
        if (required.length !== REQUIRED_TYPES.size) {
          clearPending();
          return {
            kind: "error",
            message:
              "No pudimos cargar todos los documentos legales obligatorios.",
          };
        }
        setDocuments(required);
        setSetupOpen(true);
        return { kind: "setup_required" };
      }

      clearPending();
      if (response.code === "AUTH_APPLE_ACCOUNT_LINKING_REQUIRED") {
        return { kind: "linking_required", message: response.message };
      }
      return { kind: "error", message: response.message };
    },
    [clearPending, signInWithApple],
  );

  const signIn = useCallback(async (): Promise<AppleSignInOutcome> => {
    if (!isAvailable) return { kind: "unavailable" };
    if (loading) return { kind: "error", message: "Apple ya está procesando el ingreso." };

    setLoading(true);
    try {
      const nonce = await generateAppleNoncePair();
      const result = await AppleSignIn.signIn({
        scopes: [SignInScope.Email, SignInScope.FullName],
        nonce: nonce.hashed,
      });

      if (!result.idToken || !result.authorizationCode) {
        return {
          kind: "error",
          message: "Apple no entregó credenciales completas.",
        };
      }

      const credentials: PendingAppleCredentials = {
        identityToken: result.idToken,
        authorizationCode: result.authorizationCode,
        nonce: nonce.raw,
        ...((result.givenName || result.familyName)
          ? {
              name: {
                ...(result.givenName
                  ? { givenName: result.givenName }
                  : {}),
                ...(result.familyName
                  ? { familyName: result.familyName }
                  : {}),
              },
            }
          : {}),
      };
      pending.current = credentials;
      return await submit(credentials);
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === ErrorCode.SignInCanceled) return { kind: "cancelled" };
      return {
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo iniciar sesión con Apple.",
      };
    } finally {
      setLoading(false);
    }
  }, [isAvailable, loading, submit]);

  const completeSetup = useCallback(
    async (input: {
      passengerFareType: ApplePassengerFareType;
      acceptedDocumentIds: string[];
    }): Promise<AppleSignInOutcome> => {
      const credentials = pending.current;
      if (!credentials) {
        return {
          kind: "error",
          message: "La autorización de Apple expiró. Iníciala nuevamente.",
        };
      }

      setLoading(true);
      try {
        return await submit({
          ...credentials,
          passengerFareType: input.passengerFareType,
          legalAcceptances: documents
            .filter((document) =>
              input.acceptedDocumentIds.includes(document.id),
            )
            .map((document) => ({
              legalDocumentId: document.id,
              version: document.version,
            })),
        });
      } finally {
        setLoading(false);
      }
    },
    [documents, submit],
  );

  return {
    isAvailable,
    loading,
    setupOpen,
    documents,
    signIn,
    completeSetup,
    cancelSetup: clearPending,
  };
}
