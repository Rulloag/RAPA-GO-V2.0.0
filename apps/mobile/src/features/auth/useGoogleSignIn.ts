import { useCallback, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { UserRole } from "@rapa-go/shared";
import { legalService, type LegalDocumentData } from "../legal/legal.service.js";
import { useAuth } from "./useAuth.js";
import { GoogleNativeAuth } from "./googleNative.js";
import { readDisplayEmailFromGoogleToken } from "./googleIdentityServices.js";
import type {
  GooglePassengerFareType,
  GoogleSignInRequest,
} from "./auth.types.js";

const GOOGLE_WEB_CLIENT_ID = String(
  import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ?? "",
).trim();
const REQUIRED_LEGAL_TYPES = new Set([
  "terms_and_conditions",
  "privacy_policy",
  "user_conditions",
]);

export type GoogleSignInOutcome =
  | { kind: "success"; role: UserRole }
  | { kind: "setup_required"; message?: string }
  | { kind: "linking_required"; message: string }
  | { kind: "link_unavailable"; message: string }
  | { kind: "suspended"; message: string }
  | { kind: "invalid_credential"; message: string }
  | { kind: "network_error"; message: string }
  | { kind: "cancelled" }
  | { kind: "unavailable" }
  | { kind: "internal_error"; message: string };

export interface UseGoogleSignInResult {
  isAvailable: boolean;
  isNative: boolean;
  loading: boolean;
  signInNative: () => Promise<GoogleSignInOutcome>;
  handleWebCredential: (idToken: string) => Promise<GoogleSignInOutcome>;
  setupOpen: boolean;
  documents: LegalDocumentData[];
  setupDisplayEmail: string;
  linkOpen: boolean;
  linkDisplayEmail: string;
  completeLink: (password: string) => Promise<GoogleSignInOutcome>;
  completeSetup: (input: {
    passengerFareType: GooglePassengerFareType;
    acceptedDocumentIds: string[];
    displayName: string;
    phone: string;
    rut?: string;
    passport?: string;
    residenceAccreditation?: GoogleSignInRequest["residenceAccreditation"];
  }) => Promise<GoogleSignInOutcome>;
  cancelSetup: () => void;
  cancelLink: () => void;
}

function mapGoogleError(code: string, message: string): GoogleSignInOutcome {
  if (
    code === "AUTH_GOOGLE_SETUP_REQUIRED" ||
    code === "LEGAL_ACCEPTANCE_REQUIRED" ||
    code === "AUTH_RESIDENCE_ACCREDITATION_REQUIRED" ||
    code === "AUTH_RESIDENCE_ACCREDITATION_INVALID"
  ) {
    const isInitialSetupPrompt =
      code === "AUTH_GOOGLE_SETUP_REQUIRED" &&
      message.startsWith(
        "Completa tu nombre, celular, categoría de pasajero y documentos legales",
      );

    return isInitialSetupPrompt
      ? { kind: "setup_required" }
      : { kind: "setup_required", message };
  }

  if (code === "AUTH_GOOGLE_ACCOUNT_LINKING_REQUIRED") {
    return { kind: "linking_required", message };
  }

  if (
    code === "AUTH_ACCOUNT_SUSPENDED" ||
    code === "AUTH_ACCOUNT_PENDING" ||
    code === "AUTH_ACCOUNT_DELETED"
  ) {
    return { kind: "suspended", message };
  }

  if (code === "NETWORK_ERROR" || code === "TIMEOUT") {
    return { kind: "network_error", message };
  }

  if (code === "AUTH_GOOGLE_LINK_PASSWORD_UNAVAILABLE") {
    return { kind: "link_unavailable", message };
  }

  if (
    code === "AUTH_GOOGLE_TOKEN_INVALID" ||
    code === "AUTH_GOOGLE_EMAIL_NOT_VERIFIED" ||
    code === "AUTH_GOOGLE_LINK_PASSWORD_INVALID" ||
    code === "AUTH_GOOGLE_LINK_ACCOUNT_NOT_FOUND" ||
    code === "AUTH_GOOGLE_ALREADY_LINKED" ||
    code === "AUTH_ACCOUNT_LOCKED" ||
    code === "UNAUTHORIZED" ||
    code === "VALIDATION_ERROR"
  ) {
    return { kind: "invalid_credential", message };
  }

  if (code === "AUTH_CONFIGURATION_ERROR") {
    return {
      kind: "unavailable",
    };
  }

  return {
    kind: "internal_error",
    message: message || "No fue posible continuar con Google.",
  };
}

export function useGoogleSignIn(): UseGoogleSignInResult {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [documents, setDocuments] = useState<LegalDocumentData[]>([]);
  const [setupDisplayEmail, setSetupDisplayEmail] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDisplayEmail, setLinkDisplayEmail] = useState("");
  const pendingTokenRef = useRef<string | null>(null);
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  const isAvailable =
    Boolean(GOOGLE_WEB_CLIENT_ID) &&
    (!isNative || platform === "android" || platform === "ios");

  const clearPending = useCallback(() => {
    pendingTokenRef.current = null;
    setSetupOpen(false);
    setDocuments([]);
    setSetupDisplayEmail("");
    setLinkOpen(false);
    setLinkDisplayEmail("");
  }, []);

  const prepareSetup = useCallback(async (idToken: string): Promise<boolean> => {
    try {
      const active = await legalService.getActive();
      const required = active.filter(
        (document) =>
          document.isActive && REQUIRED_LEGAL_TYPES.has(document.type),
      );

      if (required.length !== REQUIRED_LEGAL_TYPES.size) return false;

      pendingTokenRef.current = idToken;
      setLinkOpen(false);
      setLinkDisplayEmail("");
      setDocuments(required);
      setSetupDisplayEmail(readDisplayEmailFromGoogleToken(idToken));
      setSetupOpen(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const submitToken = useCallback(
    async (
      idToken: string,
      extras: Partial<GoogleSignInRequest> = {},
    ): Promise<GoogleSignInOutcome> => {
      const response = await signInWithGoogle({ idToken, ...extras });

      if ("session" in response) {
        clearPending();
        return { kind: "success", role: response.session.user.role };
      }

      const outcome = mapGoogleError(
        response.code,
        response.message ?? "No se pudo continuar con Google.",
      );

      if (outcome.kind === "setup_required") {
        const prepared = await prepareSetup(idToken);
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

      if (outcome.kind === "linking_required") {
        pendingTokenRef.current = idToken;
        setSetupOpen(false);
        setDocuments([]);
        setSetupDisplayEmail("");
        setLinkDisplayEmail(
          "displayEmail" in response && response.displayEmail
            ? response.displayEmail
            : readDisplayEmailFromGoogleToken(idToken),
        );
        setLinkOpen(true);
        return outcome;
      }

      clearPending();
      return outcome;
    },
    [clearPending, prepareSetup, signInWithGoogle],
  );

  const handleWebCredential = useCallback(
    async (idToken: string): Promise<GoogleSignInOutcome> => {
      if (!idToken.trim() || loading) {
        return {
          kind: "invalid_credential",
          message: "Google no entregó una credencial válida.",
        };
      }

      setLoading(true);
      try {
        return await submitToken(idToken.trim());
      } finally {
        setLoading(false);
      }
    },
    [loading, submitToken],
  );

  const signInNative = useCallback(async (): Promise<GoogleSignInOutcome> => {
    if (!isAvailable || !isNative || loading) return { kind: "unavailable" };

    setLoading(true);
    try {
      const result = await GoogleNativeAuth.signIn({
        serverClientId: GOOGLE_WEB_CLIENT_ID,
      });
      return await submitToken(result.idToken);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error ?? "");
      if (/cancel|canceled|cancelled|16|1001/i.test(text)) {
        return { kind: "cancelled" };
      }
      if (/unavailable|not implemented|plugin/i.test(text)) {
        return { kind: "unavailable" };
      }
      return {
        kind: "internal_error",
        message: "No pudimos abrir el ingreso con Google.",
      };
    } finally {
      setLoading(false);
    }
  }, [isAvailable, isNative, loading, submitToken]);

  const completeLink = useCallback(
    async (password: string): Promise<GoogleSignInOutcome> => {
      const idToken = pendingTokenRef.current;
      const cleanPassword = String(password ?? "");

      if (!idToken) {
        clearPending();
        return {
          kind: "invalid_credential",
          message:
            "El ingreso con Google venció. Vuelve a seleccionar tu cuenta.",
        };
      }

      if (cleanPassword.length < 8) {
        return {
          kind: "invalid_credential",
          message:
            "Ingresa la contraseña actual de tu cuenta RAPA GO.",
        };
      }

      setLoading(true);

      try {
        const response = await signInWithGoogle({
          idToken,
          linkPassword: cleanPassword,
        });

        if ("session" in response) {
          clearPending();
          return {
            kind: "success",
            role: response.session.user.role,
          };
        }

        const outcome = mapGoogleError(
          response.code,
          response.message ??
            "No pudimos vincular tu cuenta de Google.",
        );

        if (outcome.kind === "link_unavailable") {
          clearPending();
          return outcome;
        }

        if (
          outcome.kind === "invalid_credential" ||
          outcome.kind === "linking_required"
        ) {
          setLinkOpen(true);
          return outcome;
        }

        clearPending();
        return outcome;
      } finally {
        setLoading(false);
      }
    },
    [clearPending, signInWithGoogle],
  );

  const completeSetup = useCallback(
    async (input: {
      passengerFareType: GooglePassengerFareType;
      acceptedDocumentIds: string[];
      displayName: string;
      phone: string;
      rut?: string;
      passport?: string;
      residenceAccreditation?: GoogleSignInRequest["residenceAccreditation"];
    }): Promise<GoogleSignInOutcome> => {
      const idToken = pendingTokenRef.current;
      if (!idToken) {
        return {
          kind: "invalid_credential",
          message: "El ingreso con Google venció. Vuelve a intentarlo.",
        };
      }

      setLoading(true);
      try {
        const acceptedIds = new Set(input.acceptedDocumentIds);
        return await submitToken(idToken, {
          displayName: input.displayName,
          phone: input.phone,
          passengerFareType: input.passengerFareType,
          ...(input.rut ? { rut: input.rut } : {}),
          ...(input.passport ? { passport: input.passport } : {}),
          legalAcceptances: documents
            .filter((document) => acceptedIds.has(document.id))
            .map((document) => ({
              legalDocumentId: document.id,
              version: document.version,
            })),
          ...(input.residenceAccreditation
            ? { residenceAccreditation: input.residenceAccreditation }
            : {}),
        });
      } finally {
        setLoading(false);
      }
    },
    [documents, submitToken],
  );

  return {
    isAvailable,
    isNative,
    loading,
    signInNative,
    handleWebCredential,
    setupOpen,
    documents,
    setupDisplayEmail,
    linkOpen,
    linkDisplayEmail,
    completeLink,
    completeSetup,
    cancelSetup: clearPending,
    cancelLink: clearPending,
  };
}
