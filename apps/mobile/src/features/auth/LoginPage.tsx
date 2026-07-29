import { useEffect, useState, type ChangeEvent, type FormEvent, type CSSProperties } from "react";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonPage,
  IonSpinner,
  IonText,
} from "@ionic/react";
import { arrowBackOutline, mailOutline, lockClosedOutline, logoFacebook, eyeOutline, eyeOffOutline, moonOutline, sunnyOutline } from "ionicons/icons";
import { useRapagoSectionTheme } from "../../theme/rapagoTheme.js";
import { useHistory } from "react-router-dom";
import { loginRequestSchema, type UserRole } from "@rapa-go/shared";
import { useAuth } from "./useAuth.js";
import { authService } from "./auth.service.js";
import { legalService, type LegalDocumentData } from "../legal/legal.service.js";
import { ROUTES } from "../../navigation/routes.js";
import logoRapago from "../../theme/img/logo-rapago.jpeg";
import { AppleAccountSetupModal } from "./AppleAccountSetupModal.js";
import { AppleRoleSelectionModal } from "./AppleRoleSelectionModal.js";
import { AppleSignInButton } from "./AppleSignInButton.js";
import { useAppleSignIn, type AppleSignInOutcome } from "./useAppleSignIn.js";
import type { PublicRole } from "./roles.js";
import {
  PassengerSocialSetupForm,
  formatRut,
  getPassengerFareType,
  isValidPassportForAuth,
  isValidRut,
  normalizePassportForAuth,
  requiresPassportForPassengerCondition,
  requiresRutForPassengerCondition,
  type PassengerCondition,
  type PassengerFareType,
} from "./PassengerSocialSetupForm.js";

const ROLE_HOME: Record<UserRole, string> = {
  passenger: ROUTES.PASSENGER.HOME,
  driver: ROUTES.DRIVER.HOME,
  guide: ROUTES.GUIDE.HOME,
  rental_operator: ROUTES.RENTAL.HOME,
  admin: ROUTES.ADMIN.HOME,
};

const API_URL = (
  import.meta.env.VITE_API_URL ??
  "https://api.rapago.cl"
).replace(/\/$/, "");

/**
 * IMPORTANTE:
 * No guardamos documentos grandes en localStorage porque eso vuelve lenta la app
 * y puede tirar error de cuota en móvil.
 */
const MAX_RESIDENCE_DOCUMENT_SIZE_BYTES = 1.5 * 1024 * 1024;
const RESIDENT_VERIFICATION_REQUESTS_KEY = "rapago_resident_verification_requests_v1";

const RAPAGO_FACEBOOK_LEGAL_ACCEPTANCES_KEY =
  "rapago_pending_facebook_legal_acceptances_v1";

const RAPAGO_FACEBOOK_REQUIRED_LEGAL_TYPES = [
  "terms_and_conditions",
  "privacy_policy",
  "user_conditions",
] as const;

type FacebookRequiredLegalType =
  (typeof RAPAGO_FACEBOOK_REQUIRED_LEGAL_TYPES)[number];

type PendingFacebookLegalAcceptance = {
  legalDocumentId: string;
  type: FacebookRequiredLegalType;
  version: string;
  title: string;
};

function isFacebookRequiredLegalType(
  value: string,
): value is FacebookRequiredLegalType {
  return RAPAGO_FACEBOOK_REQUIRED_LEGAL_TYPES.includes(
    value as FacebookRequiredLegalType,
  );
}

function persistPendingFacebookLegalAcceptances(
  documents: LegalDocumentData[],
): PendingFacebookLegalAcceptance[] {
  const selected = documents
    .filter(
      (document) =>
        document.isActive &&
        isFacebookRequiredLegalType(document.type),
    )
    .map((document) => ({
      legalDocumentId: document.id,
      type: document.type as FacebookRequiredLegalType,
      version: document.version,
      title: document.title,
    }));

  const foundTypes = new Set(selected.map((item) => item.type));
  const missingTypes = RAPAGO_FACEBOOK_REQUIRED_LEGAL_TYPES.filter(
    (type) => !foundTypes.has(type),
  );

  if (missingTypes.length > 0) {
    throw new Error(
      "No pudimos cargar todos los documentos legales obligatorios. Intenta nuevamente.",
    );
  }

  sessionStorage.setItem(
    RAPAGO_FACEBOOK_LEGAL_ACCEPTANCES_KEY,
    JSON.stringify(selected),
  );

  return selected;
}

type ResidenceVerificationStatus = "pending" | "approved" | "rejected" | "not_required";

type ResidenceDocumentMeta = {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  uploadedAt: string;
};

type ResidentVerificationDocumentData = ResidenceDocumentMeta & {
  dataUrl: string;
};

type PassengerRegistrationProfile = {
  email?: string;
  phone?: string;
  rut?: string;
  passport?: string;
  nationality?: string;
  passengerFareLabel?: string;
  requestedPassengerFareType?: PassengerFareType;
  effectivePassengerFareType?: PassengerFareType;
  passengerFareType?: PassengerFareType;
  farePassengerType?: PassengerFareType;
  passengerType?: PassengerFareType;
  passengerCondition?: PassengerCondition;
  passengerConditionLegacy?: string;
  belongsToRapaNuiEthnicity?: boolean;
  residenceDocumentRequired?: boolean;
  residenceDocumentUploaded?: boolean;
  residenceDocumentMeta?: ResidenceDocumentMeta | null;
  residenceVerificationStatus?: ResidenceVerificationStatus;
  residenceVerificationMessage?: string;
  facebookLoginPrecheck?: boolean;
};

function getConditionLabel(value: PassengerCondition): string {
  if (value === "residente_rapa_nui") return "RAPA NUI / RESIDENTE RAPA NUI";
  if (value === "turista_chileno") return "Turista chileno";
  if (value === "turista_extranjero") return "Turista extranjero";
  return "";
}

function getPassengerFareLabel(value: PassengerFareType): string {
  if (value === "resident") return "RAPA NUI / RESIDENTE RAPA NUI";
  if (value === "chilean") return "Turista chileno";
  return "Turista extranjero";
}

function getLegacyPassengerCondition(value: PassengerCondition): string {
  if (value === "residente_rapa_nui") return "residente";
  if (value === "turista_chileno") return "chileno_no_residente";
  if (value === "turista_extranjero") return "extranjero";
  return "";
}

function hasValidRutLengthForAuth(value: unknown): boolean {
  const clean = String(value ?? "").replace(/[^0-9kK]/g, "");
  return clean.length >= 8 && clean.length <= 10;
}



const RAPAGO_AUTH_PII_LOCAL_STORAGE_KEYS = [
  "rapago_passenger_email",
  "rapago_profile_email",
  "rapago_passenger_phone",
  "rapago_profile_phone",
  "rapago_passenger_rut",
  "rapago_profile_rut",
  "rapago_passenger_passport",
  "rapago_profile_passport",
  "rapago_resident_document_name",
  "rapago_resident_document_uploaded_at",
  "rapago_passenger_residence_document_meta",
] as const;

const RAPAGO_AUTH_SESSION_PROFILE_KEY = "rapago_registration_profile_session";
const RAPAGO_RESIDENT_VERIFICATION_SESSION_KEY = "rapago_resident_verification_requests_session_v1";

function clearLegacyAuthPiiLocalStorage(): void {
  try {
    for (const key of RAPAGO_AUTH_PII_LOCAL_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // No bloquea auth.
  }
}

function getStoredValue(key: string): string {
  try {
    clearLegacyAuthPiiLocalStorage();

    if (RAPAGO_AUTH_PII_LOCAL_STORAGE_KEYS.includes(key as typeof RAPAGO_AUTH_PII_LOCAL_STORAGE_KEYS[number])) {
      return sessionStorage.getItem(key) ?? "";
    }

    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function getStoredPassengerCondition(): PassengerCondition {
  const value = getStoredValue("rapago_passenger_condition");

  if (
    value === "turista_chileno" ||
    value === "turista_extranjero" ||
    value === "residente_rapa_nui"
  ) {
    return value;
  }

  /**
   * Compatibilidad con datos antiguos que ya tenías guardados.
   */
  if (value === "chileno_no_residente") return "turista_chileno";
  if (value === "extranjero") return "turista_extranjero";
  if (value === "rapanui" || value === "rapanui_normal") return "residente_rapa_nui";
  if (value === "residente") return "residente_rapa_nui";

  return "";
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "").trim();
}

function isValidPhone(value: string): boolean {
  const normalized = normalizePhone(value);
  return normalized.length >= 8 && normalized.length <= 15;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(String(reader.result ?? ""));
    };

    reader.onerror = () => {
      reject(new Error("No se pudo leer el documento."));
    };

    reader.readAsDataURL(file);
  });
}


function persistResidentVerificationRequest(input: {
  userId: string;
  name: string;
  firstName: string;
  lastName: string;
  rut: string;
  phone: string;
  email: string;
  document: ResidentVerificationDocumentData;
  authProvider: "facebook" | "email";
}): void {
  try {
    clearLegacyAuthPiiLocalStorage();

    const now = new Date().toISOString();
    const requestId = "resident-validation-" + Date.now();

    const fullSessionRequest = {
      id: requestId,
      userId: input.userId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      name: input.name,
      firstName: input.firstName,
      lastName: input.lastName,
      rut: input.rut,
      phone: input.phone,
      email: input.email,
      passengerFareType: "resident",
      passengerFareLabel: "RAPA NUI / RESIDENTE RAPA NUI",
      nationality: "RAPA NUI / RESIDENTE RAPA NUI",
      registrationProvider: input.authProvider,
      authProvider: input.authProvider,
      documentName: input.document.name,
      documentType: input.document.type,
      documentSizeBytes: Number((input.document as ResidentVerificationDocumentData & Record<string, unknown>).size ?? 0),
      documentUploadedAt: input.document.uploadedAt,
      documentDataUrl: null,
      documentStorage: "backend",
      reason: "Validacion de residencia Rapa Nui",
      userMessage: "Tu acreditación RAPA NUI / RESIDENTE RAPA NUI está pendiente de revisión administrativa.",
      storageScope: "backend",
    };

    const safeLocalRequest = {
      id: requestId,
      userId: input.userId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      passengerFareType: "resident",
      passengerFareLabel: "RAPA NUI / RESIDENTE RAPA NUI",
      nationality: "RAPA NUI / RESIDENTE RAPA NUI",
      registrationProvider: input.authProvider,
      authProvider: input.authProvider,
      documentType: input.document.type,
      documentSizeBytes: Number((input.document as ResidentVerificationDocumentData & Record<string, unknown>).size ?? 0),
      documentUploadedAt: input.document.uploadedAt,
      documentDataUrl: null,
      documentStorage: "session_only_pending_backend_upload",
      piiStorage: "session_only",
      reason: "Validacion de residencia Rapa Nui",
      userMessage: "Tu acreditación RAPA NUI / RESIDENTE RAPA NUI está pendiente de revisión administrativa.",
    };

    const sessionRaw = sessionStorage.getItem(RAPAGO_RESIDENT_VERIFICATION_SESSION_KEY);
    const sessionParsed = sessionRaw ? (JSON.parse(sessionRaw) as Array<Record<string, unknown>>) : [];
    const currentSession = Array.isArray(sessionParsed) ? sessionParsed : [];
    const nextSession = currentSession.filter((item) => String(item.userId ?? "") !== input.userId);
    sessionStorage.setItem(
      RAPAGO_RESIDENT_VERIFICATION_SESSION_KEY,
      JSON.stringify([fullSessionRequest, ...nextSession].slice(0, 20)),
    );

    const localRaw = localStorage.getItem(RESIDENT_VERIFICATION_REQUESTS_KEY);
    const localParsed = localRaw ? (JSON.parse(localRaw) as Array<Record<string, unknown>>) : [];
    const currentLocal = Array.isArray(localParsed) ? localParsed : [];
    const nextLocal = currentLocal.filter((item) => String(item.userId ?? "") !== input.userId);
    localStorage.setItem(
      RESIDENT_VERIFICATION_REQUESTS_KEY,
      JSON.stringify([safeLocalRequest, ...nextLocal].slice(0, 100)),
    );

    window.dispatchEvent(new CustomEvent("rapago:resident-verification-updated"));
  } catch {
    // No bloquea auth si storage no esta disponible.
  }
}


function persistPassengerProfile(profile: PassengerRegistrationProfile): void {
  try {
    clearLegacyAuthPiiLocalStorage();

    const safeProfile: PassengerRegistrationProfile = {
      nationality: profile.nationality,
      passengerFareLabel: profile.passengerFareLabel,
      requestedPassengerFareType: profile.requestedPassengerFareType,
      effectivePassengerFareType: profile.effectivePassengerFareType,
      passengerFareType: profile.passengerFareType,
      farePassengerType: profile.farePassengerType,
      passengerType: profile.passengerType,
      passengerCondition: profile.passengerCondition,
      passengerConditionLegacy: profile.passengerConditionLegacy,
      belongsToRapaNuiEthnicity: profile.belongsToRapaNuiEthnicity,
      residenceDocumentRequired: profile.residenceDocumentRequired,
      residenceDocumentUploaded: profile.residenceDocumentUploaded,
      residenceVerificationStatus: profile.residenceVerificationStatus,
      residenceVerificationMessage: profile.residenceVerificationMessage,
      facebookLoginPrecheck: profile.facebookLoginPrecheck,
    };

    sessionStorage.setItem(RAPAGO_AUTH_SESSION_PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem("rapago_registration_profile", JSON.stringify(safeProfile));

    if (profile.email) {
      sessionStorage.setItem("rapago_passenger_email", profile.email);
      sessionStorage.setItem("rapago_profile_email", profile.email);
    }

    if (profile.phone) {
      sessionStorage.setItem("rapago_passenger_phone", profile.phone);
      sessionStorage.setItem("rapago_profile_phone", profile.phone);
    }

    if (profile.rut) {
      sessionStorage.setItem("rapago_passenger_rut", profile.rut);
      sessionStorage.setItem("rapago_profile_rut", profile.rut);
    } else {
      sessionStorage.removeItem("rapago_passenger_rut");
      sessionStorage.removeItem("rapago_profile_rut");
    }

    if (profile.passport) {
      sessionStorage.setItem("rapago_passenger_passport", profile.passport);
      sessionStorage.setItem("rapago_profile_passport", profile.passport);
    } else {
      sessionStorage.removeItem("rapago_passenger_passport");
      sessionStorage.removeItem("rapago_profile_passport");
    }

    if (profile.nationality) {
      localStorage.setItem("rapago_profile_nationality", profile.nationality);
      localStorage.setItem("rapago_nationality", profile.nationality);
    }

    if (profile.passengerCondition) {
      localStorage.setItem("rapago_passenger_condition", profile.passengerCondition);
    }

    if (profile.passengerConditionLegacy) {
      localStorage.setItem("rapago_passenger_condition_legacy", profile.passengerConditionLegacy);
    }

    if (profile.passengerFareType) {
      localStorage.setItem("rapago_passenger_fare_type", profile.passengerFareType);
      localStorage.setItem("rapago_fare_passenger_type", profile.passengerFareType);
      localStorage.setItem("rapago_passenger_type", profile.passengerFareType);
    }

    if (typeof profile.belongsToRapaNuiEthnicity === "boolean") {
      localStorage.setItem("rapago_belongs_to_rapa_nui_ethnicity", profile.belongsToRapaNuiEthnicity ? "si" : "no");
    }

    if (profile.residenceVerificationStatus) {
      localStorage.setItem("rapago_residence_verification_status", profile.residenceVerificationStatus);
    }

    if (profile.residenceVerificationMessage) {
      localStorage.setItem("rapago_residence_verification_user_message", profile.residenceVerificationMessage);
    } else if (profile.residenceVerificationStatus === "not_required") {
      localStorage.removeItem("rapago_residence_verification_user_message");
    }

    localStorage.setItem("rapago_residence_document_required", profile.residenceDocumentRequired ? "true" : "false");
    localStorage.setItem("rapago_residence_document_uploaded", profile.residenceDocumentUploaded ? "true" : "false");
    localStorage.removeItem("rapago_passenger_residence_document_meta");
    sessionStorage.removeItem("rapago_passenger_residence_document_data_url");
  } catch {
    // No bloqueamos el login si storage falla.
  }
}

function getFacebookRedirectErrorMessage(): string {
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const registrationCode = searchParams.get("registration");

    if (registrationCode === "resident_pending") {
      return "Tu categoría RAPA NUI / RESIDENTE RAPA NUI está activa mientras revisamos tu acreditación.";
    }

    if (registrationCode === "setup_error") {
      return "La cuenta fue creada, pero no se pudo completar de forma segura la aceptación legal o el documento. Inicia sesión para volver a intentarlo.";
    }

    const code = searchParams.get(
      "facebook",
    );

    if (code === "resident_pending") {
      return "Tu documento de residencia Rapa Nui sigue pendiente de revisión por el administrador.";
    }

    if (code === "resident_rejected") {
      return "Tu documento de residencia fue rechazado. Adjunta uno nuevo para solicitar otra revisión.";
    }

    if (code === "account_pending") {
      return "Tu cuenta todavía está pendiente de aprobación.";
    }

    if (code === "account_blocked") {
      return "Tu cuenta está bloqueada. Contacta a soporte.";
    }

    if (code === "email_required") {
      return "Facebook no entregó tu correo. Autoriza el correo o usa otro método de ingreso.";
    }

    if (code === "state_error") {
      return "La solicitud de Facebook expiró o no es válida. Intenta nuevamente.";
    }

    if (code === "error") {
      return "No se pudo completar el ingreso con Facebook.";
    }
  } catch {
    // No bloquea la pantalla de acceso.
  }

  return "";
}

type FacebookSetupRequest = {
  setupCode: string;
  email: string;
};

function getFacebookSetupRequest(): FacebookSetupRequest | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const searchParams = new URLSearchParams(window.location.search);

    if (searchParams.get("facebook") !== "setup") {
      return null;
    }

    const setupCode = searchParams.get("setupCode")?.trim() ?? "";
    const email = normalizeEmail(searchParams.get("email") ?? "");

    if (!/^[A-Za-z0-9_-]{32,128}$/.test(setupCode)) {
      return null;
    }

    return {
      setupCode,
      email,
    };
  } catch {
    return null;
  }
}

export function LoginPage(): JSX.Element {
  const initialFacebookSetupRequest = getFacebookSetupRequest();
  const history = useHistory();
  const { login } = useAuth();
  const apple = useAppleSignIn();
  /* Tema propio del flujo de acceso (compartido con Registro). */
  const { theme, isDark, toggleTheme } = useRapagoSectionTheme("auth");

  function handleAppleOutcome(outcome: AppleSignInOutcome): void {
    if (outcome.kind === "success") {
      setAppleSetupError("");
      history.replace(ROLE_HOME[outcome.role] ?? ROUTES.PASSENGER.HOME);
      return;
    }

    if (outcome.kind === "role_required") {
      setAppleSetupError("");
      return;
    }

    if (outcome.kind === "setup_required") {
      // Solo hay mensaje cuando el backend rechazó un reenvío (RUT/correo/
      // pasaporte inválido, etc.) — la primera apertura del formulario no
      // trae mensaje y no debe mostrar nada.
      setAppleSetupError(outcome.message ?? "");
      return;
    }

    setAppleSetupError("");

    if (outcome.kind === "cancelled") {
      setServerError("Cancelaste el ingreso con Apple.");
      return;
    }

    if (outcome.kind === "unavailable") {
      setServerError(
        "Continuar con Apple está disponible dentro de la aplicación RAPA GO instalada en un iPhone.",
      );
      return;
    }

    if ("message" in outcome) {
      setServerError(outcome.message);
    }
  }

  async function startAppleSignIn(): Promise<void> {
    setServerError("");
    handleAppleOutcome(await apple.signIn());
  }

  async function handleAppleRoleSubmit(role: PublicRole): Promise<void> {
    setServerError("");
    handleAppleOutcome(await apple.submitRole(role));
  }

  async function completeAppleSetup(input: {
    passengerFareType: "resident" | "chilean" | "foreigner";
    acceptedDocumentIds: string[];
    phone: string;
    rut?: string;
    passport?: string;
    contactEmail?: string;
    residenceAccreditation?: import("@rapa-go/shared").ResidenceAccreditationInput;
  }): Promise<void> {
    setServerError("");
    setAppleSetupError("");
    const cleanPhone = normalizePhone(input.phone);
    const outcome = await apple.completeSetup({ ...input, phone: cleanPhone });

    if (outcome.kind === "success") {
      const passengerConditionByFare: Record<
        "resident" | "chilean" | "foreigner",
        PassengerCondition
      > = {
        resident: "residente_rapa_nui",
        chilean: "turista_chileno",
        foreigner: "turista_extranjero",
      };
      persistPassengerProfile({
        phone: cleanPhone,
        nationality: getPassengerFareLabel(input.passengerFareType),
        passengerFareLabel: getPassengerFareLabel(input.passengerFareType),
        passengerFareType: input.passengerFareType,
        farePassengerType: input.passengerFareType,
        passengerType: input.passengerFareType,
        passengerCondition: passengerConditionByFare[input.passengerFareType],
        residenceVerificationStatus:
          input.passengerFareType === "resident" ? "pending" : "not_required",
        residenceVerificationMessage:
          input.passengerFareType === "resident"
            ? "Tu categoría RAPA NUI / RESIDENTE RAPA NUI está activa y tu acreditación quedó pendiente de revisión administrativa."
            : "",
      });
    }

    handleAppleOutcome(outcome);
  }
  const [email, setEmail] = useState(getStoredValue("rapago_passenger_email"));
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState(
    getFacebookRedirectErrorMessage,
  );
  const [appleSetupError, setAppleSetupError] = useState("");

  const [facebookSetupRequest] =
    useState<FacebookSetupRequest | null>(
      initialFacebookSetupRequest,
    );
  const [showFacebookStep, setShowFacebookStep] = useState(
    Boolean(initialFacebookSetupRequest),
  );
  const [passengerCondition, setPassengerCondition] =
    useState<PassengerCondition>(getStoredPassengerCondition());

  const [passengerEmail, setPassengerEmail] = useState(
    initialFacebookSetupRequest?.email ||
      getStoredValue("rapago_passenger_email"),
  );

  const [passengerPhone, setPassengerPhone] = useState(
    getStoredValue("rapago_passenger_phone"),
  );

  const [passengerRut, setPassengerRut] = useState(
    getStoredValue("rapago_passenger_rut"),
  );
  const [passengerPassport, setPassengerPassport] = useState(
    getStoredValue("rapago_passenger_passport"),
  );

  const [residenceDocument, setResidenceDocument] = useState<File | null>(null);
  const [residenceDocumentName, setResidenceDocumentName] = useState("");
  const [facebookStepError, setFacebookStepError] = useState("");
  const [facebookPrecheckLoading, setFacebookPrecheckLoading] =
    useState(false);
  const [residentSubmissionMessage, setResidentSubmissionMessage] =
    useState("");

  const [acceptFacebookTerms, setAcceptFacebookTerms] =
    useState(false);
  const [acceptFacebookPrivacy, setAcceptFacebookPrivacy] =
    useState(false);
  const [
    acceptFacebookUserConditions,
    setAcceptFacebookUserConditions,
  ] = useState(false);
  const [facebookLegalLoading, setFacebookLegalLoading] =
    useState(false);
  const [facebookLegalDocuments, setFacebookLegalDocuments] =
    useState<PendingFacebookLegalAcceptance[]>([]);

  useEffect(() => {
    if (!showFacebookStep) return;

    let active = true;
    setFacebookLegalLoading(true);

    legalService
      .getActive()
      .then((documents) => {
        if (!active) return;

        setFacebookLegalDocuments(
          persistPendingFacebookLegalAcceptances(
            documents,
          ),
        );
      })
      .catch((loadError) => {
        if (!active) return;

        setFacebookLegalDocuments([]);
        setFacebookStepError(
          loadError instanceof Error
            ? loadError.message
            : "No pudimos cargar las versiones legales vigentes.",
        );
      })
      .finally(() => {
        if (active) setFacebookLegalLoading(false);
      });

    return () => {
      active = false;
    };
  }, [showFacebookStep]);

  function facebookLegalVersion(
    type: FacebookRequiredLegalType,
  ): string {
    return (
      facebookLegalDocuments.find(
        (document) => document.type === type,
      )?.version ?? "vigente"
    );
  }

  const isResidentRapaNui = passengerCondition === "residente_rapa_nui";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setFieldErrors({});
    setServerError("");

    const parsed = loginRequestSchema.safeParse({
      email: normalizeEmail(email),
      password,
    });

    if (!parsed.success) {
      const errors: Record<string, string> = {};

      for (const issue of parsed.error.issues) {
        const field = issue.path[0];

        if (typeof field === "string") {
          errors[field] = issue.message;
        }
      }

      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const result = await login(parsed.data);

      if (result.ok === false) {
        setServerError(result.message ?? "Correo o contraseña incorrectos.");
        return;
      }

      persistPassengerProfile({
        email: parsed.data.email,
      });

      const role = result.session.user.role;
      const home = ROLE_HOME[role] ?? ROUTES.WELCOME;

      history.replace(home);
    } catch {
      setServerError("Error de conexión. Verifica tu internet e inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  function openFacebookStep(): void {
    setServerError("");
    setFacebookStepError("");
    setResidentSubmissionMessage("");

    // El backend decide si la cuenta ya está completa.
    // Usuarios existentes ingresan directo; cuentas nuevas vuelven con
    // facebook=setup y un setupCode de un solo uso.
    window.location.href = `${API_URL}/api/auth/facebook`;
  }

  function closeFacebookStep(): void {
    setShowFacebookStep(false);

    if (facebookSetupRequest) {
      history.replace(ROUTES.AUTH.LOGIN);
    }
  }

  function handlePassengerConditionChange(value: PassengerCondition): void {
    setPassengerCondition(value);
    setFacebookStepError("");
    setResidentSubmissionMessage("");

    if (value === "turista_extranjero") {
      setPassengerRut("");
    } else {
      setPassengerPassport("");
    }

    if (value !== "residente_rapa_nui") {
      setResidenceDocument(null);
      setResidenceDocumentName("");

      try {
        localStorage.removeItem("rapago_passenger_residence_document_meta");
        sessionStorage.removeItem("rapago_passenger_residence_document_data_url");
      } catch {
        /**
         * No bloquea la app.
         */
      }
    }
  }

  function handleResidenceDocumentChange(e: ChangeEvent<HTMLInputElement>): void {
    setFacebookStepError("");
    setResidentSubmissionMessage("");

    const file = e.target.files?.[0] ?? null;

    if (!file) {
      setResidenceDocument(null);
      setResidenceDocumentName("");
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setResidenceDocument(null);
      setResidenceDocumentName("");
      setFacebookStepError("El documento debe ser PDF, JPG, PNG o WEBP.");
      return;
    }

    if (file.size > MAX_RESIDENCE_DOCUMENT_SIZE_BYTES) {
      setResidenceDocument(null);
      setResidenceDocumentName("");
      setFacebookStepError(
        "El documento pesa demasiado. Sube una imagen o PDF de máximo 1.5 MB para que funcione rápido en celular.",
      );
      return;
    }

    setResidenceDocument(file);
    setResidenceDocumentName(file.name);
  }

  async function continueWithFacebook(): Promise<void> {
    setFacebookStepError("");
    setResidentSubmissionMessage("");

    const cleanEmail = normalizeEmail(passengerEmail);
    const cleanPhone = normalizePhone(passengerPhone);
    const cleanPassengerRut = formatRut(passengerRut);
    const cleanPassengerPassport =
      normalizePassportForAuth(passengerPassport);
    const needsRut =
      requiresRutForPassengerCondition(passengerCondition);
    const needsPassport =
      requiresPassportForPassengerCondition(passengerCondition);

    if (
      !acceptFacebookTerms ||
      !acceptFacebookPrivacy ||
      !acceptFacebookUserConditions
    ) {
      setFacebookStepError(
        "Debes aceptar Términos y Condiciones, Política de Privacidad y Condiciones para Usuarios antes de continuar con Facebook.",
      );
      return;
    }

    if (!passengerCondition) {
      setFacebookStepError(
        "Selecciona Turista chileno, Turista extranjero o RAPA NUI / RESIDENTE RAPA NUI.",
      );
      return;
    }

    if (!cleanEmail) {
      setFacebookStepError("Ingresa tu correo electrónico.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setFacebookStepError(
        "Ingresa un correo electrónico válido.",
      );
      return;
    }

    if (!cleanPhone) {
      setFacebookStepError("Ingresa tu celular.");
      return;
    }

    if (!isValidPhone(cleanPhone)) {
      setFacebookStepError("Ingresa un celular válido.");
      return;
    }

    if (needsRut && !cleanPassengerRut) {
      setFacebookStepError("Ingresa tu RUT para continuar.");
      return;
    }

    if (needsRut && !isValidRut(cleanPassengerRut)) {
      setFacebookStepError("Ingresa un RUT válido.");
      return;
    }

    if (needsPassport && !cleanPassengerPassport) {
      setFacebookStepError(
        "Ingresa tu pasaporte para continuar con Facebook.",
      );
      return;
    }

    if (
      needsPassport &&
      !isValidPassportForAuth(cleanPassengerPassport)
    ) {
      setFacebookStepError(
        "Ingresa un pasaporte válido. Usa letras y números.",
      );
      return;
    }

    if (isResidentRapaNui && !residenceDocument) {
      setFacebookStepError(
        "Debes adjuntar tu acreditación de residencia para continuar.",
      );
      return;
    }
    let facebookLegalAcceptances:
      PendingFacebookLegalAcceptance[] = [];

    setFacebookLegalLoading(true);

    try {
      facebookLegalAcceptances =
        facebookLegalDocuments.length ===
        RAPAGO_FACEBOOK_REQUIRED_LEGAL_TYPES.length
          ? facebookLegalDocuments
          : persistPendingFacebookLegalAcceptances(
              await legalService.getActive(),
            );
    } catch (error) {
      setFacebookStepError(
        error instanceof Error
          ? error.message
          : "No pudimos preparar la aceptación legal para Facebook.",
      );
      return;
    } finally {
      setFacebookLegalLoading(false);
    }

    const passengerFareType =
      getPassengerFareType(passengerCondition);
    const conditionLabel =
      getConditionLabel(passengerCondition);
    const passengerFareLabel =
      getPassengerFareLabel(passengerFareType);
    const legacyCondition =
      getLegacyPassengerCondition(passengerCondition);

    let effectivePassengerFareType: PassengerFareType = passengerFareType;
    let residenceVerificationStatus: ResidenceVerificationStatus =
      isResidentRapaNui ? "pending" : "not_required";
    let residenceVerificationMessage =
      isResidentRapaNui
        ? "Tu categoría RAPA NUI / RESIDENTE RAPA NUI está activa mientras revisamos tu acreditación."
        : "";
    let isResidentApproved = false;
    let residenceDocumentMeta: ResidenceDocumentMeta | null =
      null;

    if (isResidentRapaNui) {
      effectivePassengerFareType = "resident";
      residenceVerificationMessage =
        "Tu categoría RAPA NUI / RESIDENTE RAPA NUI está activa mientras revisamos tu acreditación.";
      setFacebookPrecheckLoading(true);

      try {
        const backendStatus =
          await authService.getFacebookResidentStatus({
            email: cleanEmail,
            rut: cleanPassengerRut,
          });

        if (backendStatus.status === "approved") {
          isResidentApproved = true;
          effectivePassengerFareType = "resident";
          residenceVerificationStatus = "approved";
          residenceVerificationMessage =
            "Tu acreditación RAPA NUI / RESIDENTE RAPA NUI fue aprobada.";
        } else if (backendStatus.status === "rejected") {
          residenceVerificationStatus = "rejected";
          residenceVerificationMessage = backendStatus.message;
        } else {
          residenceVerificationStatus = "pending";
          residenceVerificationMessage =
            backendStatus.status === "pending"
              ? backendStatus.message
              : "Tu acreditación quedó pendiente de revisión administrativa.";
        }

        if (!isResidentApproved && residenceDocument) {
          residenceDocumentMeta = {
            name: residenceDocument.name,
            type: residenceDocument.type,
            size: residenceDocument.size,
            lastModified: residenceDocument.lastModified,
            uploadedAt: new Date().toISOString(),
          };

          const residenceDocumentDataUrl =
            await readFileAsDataUrl(residenceDocument);

          const submitted =
            await authService.submitFacebookResidentPrecheck({
              provider: "facebook",
              email: cleanEmail,
              phone: cleanPhone,
              rut: cleanPassengerRut,
              documentName: residenceDocument.name,
              documentType:
                residenceDocument.type as
                  | "application/pdf"
                  | "image/jpeg"
                  | "image/png"
                  | "image/webp",
              documentSize: residenceDocument.size,
              documentDataUrl: residenceDocumentDataUrl,
            });

          isResidentApproved =
            submitted.status === "approved";
          effectivePassengerFareType = "resident";
          residenceVerificationStatus =
            isResidentApproved ? "approved" : "pending";
          residenceVerificationMessage =
            isResidentApproved
              ? "Tu acreditación RAPA NUI / RESIDENTE RAPA NUI fue aprobada."
              : submitted.message;

          persistPassengerProfile({
            email: cleanEmail,
            phone: cleanPhone,
            rut: cleanPassengerRut,
            nationality: conditionLabel,
            passengerFareLabel,
            passengerFareType,
            farePassengerType: passengerFareType,
            passengerType: passengerFareType,
            passengerCondition,
            passengerConditionLegacy: legacyCondition,
            belongsToRapaNuiEthnicity: true,
            residenceDocumentRequired: true,
            residenceDocumentUploaded: true,
            residenceDocumentMeta,
            residenceVerificationStatus:
              isResidentApproved ? "approved" : "pending",
            residenceVerificationMessage:
              submitted.message,
            facebookLoginPrecheck: true,
          });

          // Copia local de respaldo para que la misma pantalla pueda
          // mostrar el estado aun si se pierde momentáneamente la red.
          persistResidentVerificationRequest({
            userId: submitted.userId,
            name: "Pasajero Facebook",
            firstName: "Pasajero",
            lastName: "Facebook",
            rut: cleanPassengerRut,
            phone: cleanPhone,
            email: cleanEmail,
            document: {
              ...residenceDocumentMeta,
              dataUrl: residenceDocumentDataUrl,
            },
            authProvider: "facebook",
          });

          if (!isResidentApproved) {
            setResidentSubmissionMessage(submitted.message);
          }
        }
      } catch (error) {
        residenceVerificationStatus = "pending";
        residenceVerificationMessage =
          error instanceof Error
            ? `No se pudo enviar la acreditación: ${error.message}`
            : "No se pudo enviar la acreditación.";
        setFacebookStepError(residenceVerificationMessage);
        return;
      } finally {
        setFacebookPrecheckLoading(false);
      }
    }

    persistPassengerProfile({
      email: cleanEmail,
      phone: cleanPhone,
      rut: needsRut ? cleanPassengerRut : "",
      passport: needsPassport
        ? cleanPassengerPassport
        : "",
      nationality: getPassengerFareLabel(effectivePassengerFareType),
      passengerFareLabel: getPassengerFareLabel(effectivePassengerFareType),
      passengerFareType: effectivePassengerFareType,
      farePassengerType: effectivePassengerFareType,
      passengerType: effectivePassengerFareType,
      passengerCondition,
      passengerConditionLegacy: legacyCondition,
      belongsToRapaNuiEthnicity: isResidentRapaNui,
      residenceDocumentRequired: isResidentRapaNui,
      residenceDocumentUploaded: isResidentRapaNui
        ? Boolean(
            residenceDocumentMeta ||
              isResidentApproved,
          )
        : false,
      residenceDocumentMeta,
      residenceVerificationStatus,
      residenceVerificationMessage,
      facebookLoginPrecheck: true,
    });

    if (!facebookSetupRequest?.setupCode) {
      setFacebookStepError(
        "La validación de Facebook expiró. Vuelve al login y presiona Continuar con Facebook.",
      );
      return;
    }

    setFacebookPrecheckLoading(true);

    try {
      const setupResult =
        await authService.completeFacebookSetup({
          setupCode: facebookSetupRequest.setupCode,
          passengerFareType,
          phone: cleanPhone,
          ...(needsRut
            ? { rut: cleanPassengerRut }
            : {}),
          ...(needsPassport
            ? { passport: cleanPassengerPassport }
            : {}),
          legalAcceptances:
            facebookLegalAcceptances.map((document) => ({
              legalDocumentId: document.legalDocumentId,
              version: document.version,
            })),
        });

      if (setupResult.ok === false) {
        setFacebookStepError(
          setupResult.message ||
            "No se pudo completar el perfil de Facebook.",
        );
        return;
      }

      const callbackParams = new URLSearchParams({
        exchangeCode: setupResult.exchangeCode,
      });

      window.location.replace(
        `${ROUTES.AUTH.FACEBOOK_CALLBACK}?${callbackParams.toString()}`,
      );
    } catch (error) {
      setFacebookStepError(
        error instanceof Error
          ? error.message
          : "No se pudo completar el perfil de Facebook.",
      );
    } finally {
      setFacebookPrecheckLoading(false);
    }
  }

  function goToRegister(): void {
    history.push(ROUTES.AUTH.REGISTER);
  }

  const pageStyle = {
    "--background": "linear-gradient(180deg, rgba(20,16,12,.72), rgba(20,16,12,.86)), url('/assets/rapa-go-bg.jpg') center / cover no-repeat fixed",
  } as CSSProperties;

  return (
    <IonPage className="rapago-auth-dark" data-rapago-theme={theme}>
      <IonContent className="ion-padding" style={pageStyle}>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          noValidate
          className="rapago-auth-card"
        >
          <div className="rapago-auth-brand-header">
            <button
              type="button"
              className="rapago-auth-back-button"
              onClick={() => history.replace(ROUTES.WELCOME)}
              aria-label="Volver a bienvenida"
            >
              <IonIcon icon={arrowBackOutline} />
            </button>

            <div className="rapago-auth-brand-logo-wrap">
              <img
                src={logoRapago}
                alt="Rapa Go"
                className="passenger-home-logo rapago-auth-brand-logo"
              />
            </div>

            {/* Ocupa la tercera columna de la grilla 42px/1fr/42px de la
                cabecera, que hasta ahora quedaba vacía. Permite elegir el tema
                antes de entrar. */}
            <button
              type="button"
              className="rapago-auth-theme-btn"
              onClick={toggleTheme}
              aria-label={isDark ? "Activar modo día" : "Activar modo nocturno"}
              title={isDark ? "Modo día" : "Modo nocturno"}
            >
              <IonIcon icon={isDark ? sunnyOutline : moonOutline} />
            </button>
          </div>

          <IonText>
            <h2 className="rapago-auth-title">Bienvenido a Rapa Go</h2>
          </IonText>

          <p className="rapago-auth-tagline">
            Movilidad, Tours, Rent a Car y Eventos en Rapa Nui
          </p>

          {serverError && (
            <IonText color="danger">
              <p className="auth-error rapago-auth-error">
                {serverError}
              </p>
            </IonText>
          )}

          <IonItem
            className={`rapago-auth-field ${fieldErrors.email ? "ion-invalid" : ""}`}
            lines="none"
          >
            <IonIcon slot="start" icon={mailOutline} className="rapago-auth-field-icon" />
            <IonLabel position="stacked">Correo electrónico</IonLabel>
            <IonInput
              type="email"
              value={email}
              onIonInput={(e) => {
                const nextEmail = String(e.detail.value ?? "");
                setEmail(nextEmail);

                if (!passengerEmail) {
                  setPassengerEmail(nextEmail);
                }
              }}
              placeholder="tu@correo.com"
              autocomplete="email"
              inputmode="email"
              disabled={loading}
              required
            />
            {fieldErrors.email && <IonNote slot="error">{fieldErrors.email}</IonNote>}
          </IonItem>

          <IonItem
            className={`rapago-auth-field ${fieldErrors.password ? "ion-invalid" : ""}`}
            lines="none"
          >
            <IonIcon slot="start" icon={lockClosedOutline} className="rapago-auth-field-icon" />
            <IonLabel position="stacked">Contraseña</IonLabel>
            <IonInput
              type={showPassword ? "text" : "password"}
              value={password}
              onIonInput={(e) => {
                setPassword(String(e.detail.value ?? ""));
              }}
              placeholder="Mínimo 8 caracteres"
              autocomplete="current-password"
              disabled={loading}
              required
            />
            {password.length > 0 && (
              <IonButton
                slot="end"
                fill="clear"
                type="button"
                className="rapago-auth-eye"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <IonIcon slot="icon-only" icon={showPassword ? eyeOffOutline : eyeOutline} />
              </IonButton>
            )}
            {fieldErrors.password && <IonNote slot="error">{fieldErrors.password}</IonNote>}
          </IonItem>

          <IonButton
            expand="block"
            type="submit"
            disabled={loading}
            className="rapago-auth-btn-primary"
          >
            {loading ? <IonSpinner name="crescent" /> : "Iniciar sesión"}
          </IonButton>

          <div className="rapago-auth-forgot">
            <IonButton
              fill="clear"
              size="small"
              type="button"
              disabled={loading}
              onClick={() => history.push("/auth/forgot-password")}
            >
              ¿Olvidaste tu contraseña?
            </IonButton>
          </div>

          <div className="rapago-auth-divider">o</div>

          <IonButton
            expand="block"
            fill="outline"
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openFacebookStep();
            }}
            type="button"
            className="rapago-auth-btn-outline"
          >
            <IonIcon slot="start" icon={logoFacebook} />
            Continuar con Facebook
          </IonButton>

          <AppleSignInButton
            isAvailable={true}
            loading={apple.loading}
            disabled={loading}
            onPress={() => void startAppleSignIn()}
          />

          <IonButton
            expand="block"
            fill="clear"
            disabled={loading}
            onClick={goToRegister}
            type="button"
            className="rapago-auth-btn-clear"
          >
            ¿No tienes cuenta? Crear cuenta
          </IonButton>

          <IonButton
            expand="block"
            fill="outline"
            disabled={loading}
            onClick={() => history.replace(ROUTES.WELCOME)}
            type="button"
            className="rapago-auth-btn-outline"
          >
            Volver al inicio
          </IonButton>
        </form>

        <PassengerSocialSetupForm
          provider="facebook"
          isOpen={showFacebookStep}
          onClose={closeFacebookStep}
          loading={facebookPrecheckLoading || facebookLegalLoading}
          error={facebookStepError}
          successMessage={residentSubmissionMessage}
          passengerCondition={passengerCondition}
          onPassengerConditionChange={handlePassengerConditionChange}
          email={passengerEmail}
          onEmailChange={setPassengerEmail}
          phone={passengerPhone}
          onPhoneChange={setPassengerPhone}
          rut={passengerRut}
          onRutChange={setPassengerRut}
          onRutBlur={() => setPassengerRut(formatRut(passengerRut))}
          passport={passengerPassport}
          onPassportChange={setPassengerPassport}
          residenceDocumentName={residenceDocumentName}
          onResidenceDocumentChange={handleResidenceDocumentChange}
          acceptTerms={acceptFacebookTerms}
          onAcceptTermsChange={setAcceptFacebookTerms}
          acceptPrivacy={acceptFacebookPrivacy}
          onAcceptPrivacyChange={setAcceptFacebookPrivacy}
          acceptUserConditions={acceptFacebookUserConditions}
          onAcceptUserConditionsChange={setAcceptFacebookUserConditions}
          onOpenTerms={() => history.push(ROUTES.PUBLIC.TERMS)}
          onOpenPrivacy={() => history.push(ROUTES.PUBLIC.PRIVACY)}
          onSubmit={() => void continueWithFacebook()}
        />


      </IonContent>

      <AppleRoleSelectionModal
        isOpen={apple.awaitingRole}
        loading={apple.loading}
        onCancel={apple.cancelRoleSelection}
        onConfirm={(role) => { void handleAppleRoleSubmit(role); }}
      />

      <AppleAccountSetupModal
        isOpen={apple.setupOpen}
        loading={apple.loading}
        documents={apple.documents}
        displayEmail={apple.setupDisplayEmail}
        serverError={appleSetupError}
        onCancel={() => {
          setAppleSetupError("");
          apple.cancelSetup();
        }}
        onConfirm={(input) => void completeAppleSetup(input)}
      />
    </IonPage>
  );
}
