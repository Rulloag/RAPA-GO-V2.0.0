import { useCallback, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  AppleSignIn,
  ErrorCode,
  SignInScope,
} from "@capawesome/capacitor-apple-sign-in";
import type { UserRole } from "@rapa-go/shared";

import { legalService, type LegalDocumentData } from "../legal/legal.service.js";
import { generateAppleNoncePair } from "./appleNonce.js";
import type {
  ApplePassengerFareType,
  AppleSignInRequest,
} from "./auth.types.js";
import type { PublicRole } from "./roles.js";
import { useAuth } from "./useAuth.js";

const REQUIRED_LEGAL_TYPES = new Set([
  "terms_and_conditions",
  "privacy_policy",
  "user_conditions",
]);

interface PendingCredentials {
  identityToken: string;
  authorizationCode: string;
  nonce: string;
  name?: AppleSignInRequest["name"];
}

export type AppleSignInOutcome =
  | { kind: "success"; role: UserRole }
  | { kind: "cancelled" }
  | { kind: "role_required" }
  | { kind: "setup_required" }
  | { kind: "linking_required"; message: string }
  | { kind: "invalid_credential"; message: string }
  | { kind: "suspended"; message: string }
  | { kind: "network_error"; message: string }
  | { kind: "unavailable" }
  | { kind: "internal_error"; message: string }
  | { kind: "error"; message: string };

const ROLE_REQUIRED_CODES = new Set(["VALIDATION_ERROR"]);
const SETUP_REQUIRED_CODES = new Set([
  "AUTH_APPLE_SETUP_REQUIRED",
  "AUTH_APPLE_PHONE_REQUIRED",
  "LEGAL_ACCEPTANCE_REQUIRED",
  "AUTH_RESIDENCE_ACCREDITATION_REQUIRED",
]);
const LINKING_REQUIRED_CODES = new Set([
  "AUTH_APPLE_ACCOUNT_LINKING_REQUIRED",
]);
const SUSPENDED_CODES = new Set([
  "AUTH_ACCOUNT_SUSPENDED",
  "AUTH_ACCOUNT_PENDING",
  "AUTH_ACCOUNT_DELETED",
]);
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
  if (ROLE_REQUIRED_CODES.has(code)) return { kind: "role_required" };
  if (SETUP_REQUIRED_CODES.has(code)) return { kind: "setup_required" };
  if (LINKING_REQUIRED_CODES.has(code)) {
    return { kind: "linking_required", message };
  }
  if (SUSPENDED_CODES.has(code)) return { kind: "suspended", message };
  if (INVALID_CREDENTIAL_CODES.has(code)) {
    return { kind: "invalid_credential", message };
  }
  if (NETWORK_CODES.has(code)) return { kind: "network_error", message };
  return { kind: "internal_error", message };
}

export interface UseAppleSignInResult {
  isAvailable: boolean;
  loading: boolean;
  signIn: () => Promise<AppleSignInOutcome>;
  awaitingRole: boolean;
  submitRole: (role: PublicRole) => Promise<AppleSignInOutcome>;
  cancelRoleSelection: () => void;
  setupOpen: boolean;
  documents: LegalDocumentData[];
  completeSetup: (input: {
    passengerFareType: ApplePassengerFareType;
    acceptedDocumentIds: string[];
    phone: string;
    residenceAccreditation?: AppleSignInRequest["residenceAccreditation"];
  }) => Promise<AppleSignInOutcome>;
  cancelSetup: () => void;
}

export function useAppleSignIn(): UseAppleSignInResult {
  const { signInWithApple } = useAuth();
  const [loading, setLoading] = useState(false);
  const [awaitingRole, setAwaitingRole] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [documents, setDocuments] = useState<LegalDocumentData[]>([]);
  const pendingRef = useRef<PendingCredentials | null>(null);
  const selectedRoleRef = useRef<PublicRole | null>(null);

  const isAvailable =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

  const clearPending = useCallback(() => {
    pendingRef.current = null;
    selectedRoleRef.current = null;
    setAwaitingRole(false);
    setSetupOpen(false);
    setDocuments([]);
  }, []);

  const preparePassengerSetup = useCallback(async (): Promise<boolean> => {
    try {
      const active = await legalService.getActive();
      const required = active.filter(
        (document) =>
          document.isActive && REQUIRED_LEGAL_TYPES.has(document.type),
      );

      if (required.length !== REQUIRED_LEGAL_TYPES.size) {
        return false;
      }

      setDocuments(required);
      setAwaitingRole(false);
      setSetupOpen(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const submitToBackend = useCallback(
    async (
      credentials: PendingCredentials,
      extras: Partial<AppleSignInRequest> = {},
    ): Promise<AppleSignInOutcome> => {
      const payload: AppleSignInRequest = {
        identityToken: credentials.identityToken,
        authorizationCode: credentials.authorizationCode,
        nonce: credentials.nonce,
        ...(credentials.name ? { name: credentials.name } : {}),
        ...extras,
      };

      const response = await signInWithApple(payload);

      if (response.ok === true) {
        clearPending();
        return { kind: "success", role: response.session.user.role };
      }

      const outcome = mapBackendError(
        response.code,
        response.message ?? "No se pudo continuar con Apple.",
      );

      if (outcome.kind === "role_required") {
        pendingRef.current = credentials;
        setAwaitingRole(true);
        setSetupOpen(false);
        return outcome;
      }

      if (outcome.kind === "setup_required") {
        pendingRef.current = credentials;
        const prepared = await preparePassengerSetup();
        if (!prepared) {
          clearPending();
          return {
            kind: "internal_error",
            message:
              "No pudimos cargar todos los documentos legales obligatorios.",
          };
        }
        return outcome;
      }

      clearPending();
      return outcome;
    },
    [clearPending, preparePassengerSetup, signInWithApple],
  );

  const signIn = useCallback(async (): Promise<AppleSignInOutcome> => {
    if (loading) {
      return {
        kind: "internal_error",
        message: "Ya existe un ingreso con Apple en proceso.",
      };
    }
    if (!isAvailable) return { kind: "unavailable" };

    setLoading(true);

    try {
      const nonce = await generateAppleNoncePair();
      const result = await AppleSignIn.signIn({
        scopes: [SignInScope.Email, SignInScope.FullName],
        nonce: nonce.hashed,
      });

      if (!result.idToken || !result.authorizationCode) {
        return {
          kind: "internal_error",
          message: "Apple no entregó credenciales completas.",
        };
      }

      const credentials: PendingCredentials = {
        identityToken: result.idToken,
        authorizationCode: result.authorizationCode,
        nonce: nonce.raw,
        ...((result.givenName ?? result.familyName)
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

      pendingRef.current = credentials;
      return await submitToBackend(credentials);
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === ErrorCode.SignInCanceled) {
        clearPending();
        return { kind: "cancelled" };
      }

      clearPending();
      return {
        kind: "internal_error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo iniciar sesión con Apple.",
      };
    } finally {
      setLoading(false);
    }
  }, [clearPending, isAvailable, loading, submitToBackend]);

  const submitRole = useCallback(
    async (role: PublicRole): Promise<AppleSignInOutcome> => {
      const allowedRoles: readonly string[] = [
        "passenger",
        "driver",
        "guide",
        "rental_operator",
      ];

      if (!allowedRoles.includes(role)) {
        return { kind: "internal_error", message: "Rol no válido." };
      }

      const credentials = pendingRef.current;
      if (!credentials) {
        return {
          kind: "internal_error",
          message: "La autorización de Apple expiró. Iníciala nuevamente.",
        };
      }

      selectedRoleRef.current = role;
      setLoading(true);

      try {
        return await submitToBackend(credentials, { role });
      } finally {
        setLoading(false);
      }
    },
    [submitToBackend],
  );

  const completeSetup = useCallback(
    async (input: {
      passengerFareType: ApplePassengerFareType;
      acceptedDocumentIds: string[];
      phone: string;
      residenceAccreditation?: AppleSignInRequest["residenceAccreditation"];
    }): Promise<AppleSignInOutcome> => {
      const credentials = pendingRef.current;
      if (!credentials) {
        return {
          kind: "internal_error",
          message: "La autorización de Apple expiró. Iníciala nuevamente.",
        };
      }

      const role = selectedRoleRef.current ?? "passenger";

      setLoading(true);
      try {
        return await submitToBackend(credentials, {
          role,
          phone: input.phone,
          passengerFareType: input.passengerFareType,
          ...(input.residenceAccreditation
            ? { residenceAccreditation: input.residenceAccreditation }
            : {}),
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
    [documents, submitToBackend],
  );

  return {
    isAvailable,
    loading,
    signIn,
    awaitingRole,
    submitRole,
    cancelRoleSelection: clearPending,
    setupOpen,
    documents,
    completeSetup,
    cancelSetup: clearPending,
  };
}
