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
import { authService } from "./auth.service.js";
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
  /**
   * Solo para mostrar en el formulario de pasajero (campo de solo lectura).
   * Nunca se reenvía al backend: la identidad se valida exclusivamente vía
   * identityToken, ver SECURITY note en auth.types.ts.
   */
  displayEmail?: string;
}

export type AppleSignInOutcome =
  | { kind: "success"; role: UserRole }
  | { kind: "cancelled" }
  | { kind: "redirecting" }
  | { kind: "role_required" }
  /**
   * `message` is only present when the backend rejected a resubmission
   * (e.g. invalid RUT/passport/contactEmail) — absent on the very first
   * transition into the form, which has nothing to show yet.
   */
  | { kind: "setup_required"; message?: string }
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
  "AUTH_APPLE_WEB_FLOW_INVALID",
  "AUTH_APPLE_WEB_STATE_INVALID",
  "AUTH_FORBIDDEN",
]);
const NETWORK_CODES = new Set(["NETWORK_ERROR", "TIMEOUT"]);

/**
 * Fixed Spanish messages for codes whose backend `message` text is either
 * in English or gets replaced with the generic "An unexpected error
 * occurred." (any AppError with statusCode >= 500 loses its own message —
 * see apps/api/src/shared/errors/errorHandler.ts). We key off the `code`
 * (never rewritten) instead of trusting whatever text arrives.
 */
const FIXED_SPANISH_MESSAGES: Record<string, string> = {
  AUTH_APPLE_TOKEN_EXCHANGE_FAILED:
    "El código de registro con Apple venció o no se pudo validar. Vuelve a presionar “Continuar con Apple” para intentarlo de nuevo.",
  AUTH_APPLE_TOKEN_INCOHERENT:
    "La respuesta de Apple no coincide con tu identidad. Vuelve a intentar el ingreso con Apple.",
  AUTH_APPLE_NONCE_MISMATCH:
    "No pudimos validar tu ingreso con Apple. Vuelve a intentarlo.",
  AUTH_APPLE_EMAIL_MISSING: "Correo obligatorio.",
  AUTH_CONFIGURATION_ERROR:
    "Continuar con Apple no está disponible en este momento. Inténtalo más tarde.",
  AUTH_APPLE_WEB_FLOW_INVALID:
    "El ingreso web con Apple venció. Vuelve a presionar “Sign in with Apple”.",
  AUTH_APPLE_WEB_STATE_INVALID:
    "No pudimos validar el inicio web con Apple. Inténtalo nuevamente.",
};

function mapBackendError(code: string, message: string): AppleSignInOutcome {
  const fixedMessage = FIXED_SPANISH_MESSAGES[code];

  if (ROLE_REQUIRED_CODES.has(code)) return { kind: "role_required" };
  if (SETUP_REQUIRED_CODES.has(code)) {
    return { kind: "setup_required", message: fixedMessage ?? message };
  }
  if (LINKING_REQUIRED_CODES.has(code)) {
    return { kind: "linking_required", message: fixedMessage ?? message };
  }
  if (SUSPENDED_CODES.has(code)) {
    return { kind: "suspended", message: fixedMessage ?? message };
  }
  if (INVALID_CREDENTIAL_CODES.has(code)) {
    return { kind: "invalid_credential", message: fixedMessage ?? message };
  }
  if (NETWORK_CODES.has(code)) {
    return { kind: "network_error", message: fixedMessage ?? message };
  }
  if (fixedMessage) {
    return { kind: "invalid_credential", message: fixedMessage };
  }
  return {
    kind: "internal_error",
    message: "No fue posible completar el registro. Inténtalo nuevamente.",
  };
}

export interface UseAppleSignInResult {
  isAvailable: boolean;
  loading: boolean;
  signIn: () => Promise<AppleSignInOutcome>;
  resumeWebFlow: (flowToken: string) => Promise<AppleSignInOutcome>;
  awaitingRole: boolean;
  submitRole: (role: PublicRole) => Promise<AppleSignInOutcome>;
  cancelRoleSelection: () => void;
  setupOpen: boolean;
  documents: LegalDocumentData[];
  /** Correo verificado por Apple, solo para mostrar (nunca se reenvía al backend). */
  setupDisplayEmail: string;
  completeSetup: (input: {
    passengerFareType: ApplePassengerFareType;
    acceptedDocumentIds: string[];
    phone: string;
    rut?: string;
    passport?: string;
    /** Only when Apple didn't provide an email (setupDisplayEmail is empty). */
    contactEmail?: string;
    residenceAccreditation?: AppleSignInRequest["residenceAccreditation"];
  }) => Promise<AppleSignInOutcome>;
  cancelSetup: () => void;
}

export function useAppleSignIn(): UseAppleSignInResult {
  const { signInWithApple, signInWithAppleWeb } = useAuth();
  const [loading, setLoading] = useState(false);
  const [awaitingRole, setAwaitingRole] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [documents, setDocuments] = useState<LegalDocumentData[]>([]);
  const [setupDisplayEmail, setSetupDisplayEmail] = useState("");
  const pendingRef = useRef<PendingCredentials | null>(null);
  const pendingWebFlowTokenRef = useRef<string | null>(null);
  const selectedRoleRef = useRef<PublicRole | null>(null);
  /**
   * Ionic fires IonModal's onDidDismiss whenever `isOpen` transitions to
   * false for ANY reason, including us programmatically closing the role
   * modal to advance to the next step (setup_required). Without this guard,
   * that dismissal calls cancelRoleSelection (= clearPending) right after
   * preparePassengerSetup opens the passenger form, immediately wiping
   * setupOpen/pendingRef and bouncing the user back to the login screen.
   */
  const skipNextRoleDismissRef = useRef(false);

  const isNativeIos =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  const isWebBrowser =
    typeof window !== "undefined" && !Capacitor.isNativePlatform();
  const isAvailable = isNativeIos || isWebBrowser;

  const clearPending = useCallback(() => {
    skipNextRoleDismissRef.current = false;
    pendingRef.current = null;
    pendingWebFlowTokenRef.current = null;
    selectedRoleRef.current = null;
    setAwaitingRole(false);
    setSetupOpen(false);
    setDocuments([]);
    setSetupDisplayEmail("");
  }, []);

  const cancelRoleSelection = useCallback(() => {
    if (skipNextRoleDismissRef.current) {
      skipNextRoleDismissRef.current = false;
      return;
    }
    clearPending();
  }, [clearPending]);

  const preparePassengerSetup = useCallback(
    async (displayEmail?: string): Promise<boolean> => {
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
        skipNextRoleDismissRef.current = true;
        setAwaitingRole(false);
        setSetupDisplayEmail(displayEmail ?? "");
        setSetupOpen(true);
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

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
        skipNextRoleDismissRef.current = false;
        setAwaitingRole(true);
        setSetupOpen(false);
        return outcome;
      }

      if (outcome.kind === "setup_required") {
        pendingRef.current = credentials;
        const prepared = await preparePassengerSetup(credentials.displayEmail);
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

  const submitWebToBackend = useCallback(
    async (
      flowToken: string,
      extras: {
        phone?: string;
        contactEmail?: string;
        rut?: string;
        passport?: string;
        passengerFareType?: ApplePassengerFareType;
        legalAcceptances?: Array<{
          legalDocumentId: string;
          version: string;
        }>;
        residenceAccreditation?: AppleSignInRequest["residenceAccreditation"];
      } = {},
    ): Promise<AppleSignInOutcome> => {
      const response = await signInWithAppleWeb({
        flowToken,
        ...extras,
      });

      if (response.ok === true) {
        clearPending();
        return { kind: "success", role: response.session.user.role };
      }

      const outcome = mapBackendError(
        response.code,
        response.message ?? "No se pudo continuar con Apple.",
      );

      if (outcome.kind === "setup_required") {
        pendingWebFlowTokenRef.current = flowToken;
        selectedRoleRef.current = "passenger";
        const prepared = await preparePassengerSetup(
          response.displayEmail,
        );

        if (!prepared) {
          clearPending();
          return {
            kind: "internal_error",
            message:
              "No pudimos cargar todos los documentos legales obligatorios.",
          };
        }

        return { kind: "setup_required" };
      }

      clearPending();
      return outcome;
    },
    [clearPending, preparePassengerSetup, signInWithAppleWeb],
  );

  const resumeWebFlow = useCallback(
    async (flowToken: string): Promise<AppleSignInOutcome> => {
      const cleanToken = flowToken.trim();

      if (!cleanToken || loading) {
        return {
          kind: "internal_error",
          message: "El ingreso web con Apple no es válido.",
        };
      }

      setLoading(true);
      pendingWebFlowTokenRef.current = cleanToken;

      try {
        return await submitWebToBackend(cleanToken);
      } finally {
        setLoading(false);
      }
    },
    [loading, submitWebToBackend],
  );

  const signIn = useCallback(async (): Promise<AppleSignInOutcome> => {
    if (loading) {
      return {
        kind: "internal_error",
        message: "Ya existe un ingreso con Apple en proceso.",
      };
    }
    if (!isAvailable) return { kind: "unavailable" };

    if (isWebBrowser) {
      window.location.assign(authService.getAppleWebStartUrl());
      return { kind: "redirecting" };
    }

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
        ...(result.email ? { displayEmail: result.email } : {}),
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
  }, [
    clearPending,
    isAvailable,
    isWebBrowser,
    loading,
    submitToBackend,
  ]);

  const submitRole = useCallback(
    async (role: PublicRole): Promise<AppleSignInOutcome> => {
      if (role !== "passenger") {
        return {
          kind: "internal_error",
          message:
            "El registro con Apple está disponible solamente para pasajeros.",
        };
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
        const outcome = await submitToBackend(credentials, { role });
        // This first transition into the passenger form only ever fails
        // because phone/fareType/legal docs weren't sent yet (nothing was
        // submitted by the user) — that's not an error to show, unlike a
        // real validation failure from a later resubmission via
        // completeSetup, which does carry a message worth surfacing.
        if (outcome.kind === "setup_required") return { kind: "setup_required" };
        return outcome;
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
      rut?: string;
      passport?: string;
      contactEmail?: string;
      residenceAccreditation?: AppleSignInRequest["residenceAccreditation"];
    }): Promise<AppleSignInOutcome> => {
      const legalAcceptances = documents
        .filter((document) =>
          input.acceptedDocumentIds.includes(document.id),
        )
        .map((document) => ({
          legalDocumentId: document.id,
          version: document.version,
        }));

      const webFlowToken = pendingWebFlowTokenRef.current;

      if (webFlowToken) {
        setLoading(true);
        try {
          return await submitWebToBackend(webFlowToken, {
            phone: input.phone,
            passengerFareType: input.passengerFareType,
            ...(input.rut ? { rut: input.rut } : {}),
            ...(input.passport ? { passport: input.passport } : {}),
            ...(input.contactEmail
              ? { contactEmail: input.contactEmail }
              : {}),
            ...(input.residenceAccreditation
              ? { residenceAccreditation: input.residenceAccreditation }
              : {}),
            legalAcceptances,
          });
        } finally {
          setLoading(false);
        }
      }

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
          ...(input.rut ? { rut: input.rut } : {}),
          ...(input.passport ? { passport: input.passport } : {}),
          ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
          ...(input.residenceAccreditation
            ? { residenceAccreditation: input.residenceAccreditation }
            : {}),
          legalAcceptances,
        });
      } finally {
        setLoading(false);
      }
    },
    [documents, submitToBackend, submitWebToBackend],
  );

  return {
    isAvailable,
    loading,
    signIn,
    resumeWebFlow,
    awaitingRole,
    submitRole,
    cancelRoleSelection,
    setupOpen,
    documents,
    setupDisplayEmail,
    completeSetup,
    cancelSetup: clearPending,
  };
}
