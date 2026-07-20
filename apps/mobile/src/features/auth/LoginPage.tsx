import { useState, type ChangeEvent, type FormEvent, type CSSProperties } from "react";
import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import { loginRequestSchema, type UserRole } from "@rapa-go/shared";
import { useAuth } from "./useAuth.js";
import { authService } from "./auth.service.js";
import { legalService, type LegalDocumentData } from "../legal/legal.service.js";
import { ROUTES } from "../../navigation/routes.js";

const ROLE_HOME: Record<UserRole, string> = {
  passenger: ROUTES.PASSENGER.HOME,
  driver: ROUTES.DRIVER.HOME,
  guide: ROUTES.GUIDE.HOME,
  rental_operator: ROUTES.RENTAL.HOME,
  admin: ROUTES.ADMIN.HOME,
};

const API_URL = (
  import.meta.env.VITE_API_URL ??
  "https://backend.rapago.cl"
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

type PassengerCondition =
  | "turista_chileno"
  | "turista_extranjero"
  | "residente_rapa_nui"
  | "";

type PassengerFareType = "resident" | "chilean" | "foreigner";

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

function getPassengerFareType(condition: PassengerCondition): PassengerFareType {
  if (condition === "residente_rapa_nui") return "resident";
  if (condition === "turista_chileno") return "chilean";
  return "foreigner";
}

function getConditionLabel(value: PassengerCondition): string {
  if (value === "residente_rapa_nui") return "Residente Rapa Nui";
  if (value === "turista_chileno") return "Turista chileno";
  if (value === "turista_extranjero") return "Turista extranjero";
  return "";
}

function getPassengerFareLabel(value: PassengerFareType): string {
  if (value === "resident") return "Residente Rapa Nui";
  if (value === "chilean") return "Turista chileno";
  return "Turista extranjero";
}

function getLegacyPassengerCondition(value: PassengerCondition): string {
  if (value === "residente_rapa_nui") return "residente";
  if (value === "turista_chileno") return "chileno_no_residente";
  if (value === "turista_extranjero") return "extranjero";
  return "";
}

function normalizePassportForAuth(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function isValidPassportForAuth(value: unknown): boolean {
  const clean = normalizePassportForAuth(value).replace(/-/g, "");
  return clean.length >= 5 && clean.length <= 15;
}

function requiresPassportForPassengerCondition(value: PassengerCondition): boolean {
  return value === "turista_extranjero";
}

function requiresRutForPassengerCondition(value: PassengerCondition): boolean {
  return value === "turista_chileno" || value === "residente_rapa_nui";
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
  if (value === "rapanui" || value === "rapanui_normal") return "turista_chileno";
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

function cleanRut(value: string): string {
  return value.replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();
}

function formatRut(value: string): string {
  const cleaned = cleanRut(value);

  if (cleaned.length <= 1) return cleaned;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  return `${body}-${dv}`;
}

function isValidRut(value: string): boolean {
  const cleaned = cleanRut(value);

  if (!/^\d{7,8}[0-9K]$/.test(cleaned)) return false;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const expectedNumber = 11 - (sum % 11);
  const expectedDv =
    expectedNumber === 11 ? "0" : expectedNumber === 10 ? "K" : String(expectedNumber);

  return dv === expectedDv;
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
      passengerFareLabel: "Residente Rapa Nui",
      nationality: "Residente Rapa Nui",
      registrationProvider: input.authProvider,
      authProvider: input.authProvider,
      documentName: input.document.name,
      documentType: input.document.type,
      documentSizeBytes: Number((input.document as ResidentVerificationDocumentData & Record<string, unknown>).size ?? 0),
      documentUploadedAt: input.document.uploadedAt,
      documentDataUrl: null,
      documentStorage: "backend",
      reason: "Validacion de residencia Rapa Nui",
      userMessage: "Tu documento de Residente Rapa Nui esta pendiente de revision por el administrador.",
      storageScope: "backend",
    };

    const safeLocalRequest = {
      id: requestId,
      userId: input.userId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      passengerFareType: "resident",
      passengerFareLabel: "Residente Rapa Nui",
      nationality: "Residente Rapa Nui",
      registrationProvider: input.authProvider,
      authProvider: input.authProvider,
      documentType: input.document.type,
      documentSizeBytes: Number((input.document as ResidentVerificationDocumentData & Record<string, unknown>).size ?? 0),
      documentUploadedAt: input.document.uploadedAt,
      documentDataUrl: null,
      documentStorage: "session_only_pending_backend_upload",
      piiStorage: "session_only",
      reason: "Validacion de residencia Rapa Nui",
      userMessage: "Tu documento de Residente Rapa Nui esta pendiente de revision por el administrador.",
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


function persistPassengerProfile(
  profile: PassengerRegistrationProfile,
): void {
  try {
    clearLegacyAuthPiiLocalStorage();

    const requestedPassengerFareType =
      profile.requestedPassengerFareType ??
      profile.passengerFareType ??
      "chilean";
    const effectivePassengerFareType =
      profile.effectivePassengerFareType ??
      profile.passengerFareType ??
      "chilean";
    const effectivePassengerFareLabel =
      getPassengerFareLabel(effectivePassengerFareType);

    const fullProfile: PassengerRegistrationProfile = {
      ...profile,
      requestedPassengerFareType,
      effectivePassengerFareType,
      passengerFareType: effectivePassengerFareType,
      farePassengerType: effectivePassengerFareType,
      passengerType: effectivePassengerFareType,
      passengerFareLabel: effectivePassengerFareLabel,
      nationality: effectivePassengerFareLabel,
    };

    const safeProfile: PassengerRegistrationProfile = {
      nationality: effectivePassengerFareLabel,
      passengerFareLabel: effectivePassengerFareLabel,
      requestedPassengerFareType,
      effectivePassengerFareType,
      passengerFareType: effectivePassengerFareType,
      farePassengerType: effectivePassengerFareType,
      passengerType: effectivePassengerFareType,
      passengerCondition: profile.passengerCondition,
      passengerConditionLegacy:
        profile.passengerConditionLegacy,
      belongsToRapaNuiEthnicity:
        profile.belongsToRapaNuiEthnicity,
      residenceDocumentRequired:
        profile.residenceDocumentRequired,
      residenceDocumentUploaded:
        profile.residenceDocumentUploaded,
      residenceVerificationStatus:
        profile.residenceVerificationStatus,
      residenceVerificationMessage:
        profile.residenceVerificationMessage,
      facebookLoginPrecheck: profile.facebookLoginPrecheck,
    };

    sessionStorage.setItem(
      RAPAGO_AUTH_SESSION_PROFILE_KEY,
      JSON.stringify(fullProfile),
    );
    localStorage.setItem(
      "rapago_registration_profile",
      JSON.stringify(safeProfile),
    );

    if (profile.email) {
      sessionStorage.setItem(
        "rapago_passenger_email",
        profile.email,
      );
      sessionStorage.setItem(
        "rapago_profile_email",
        profile.email,
      );
    }

    if (profile.phone) {
      sessionStorage.setItem(
        "rapago_passenger_phone",
        profile.phone,
      );
      sessionStorage.setItem(
        "rapago_profile_phone",
        profile.phone,
      );
    }

    if (profile.rut) {
      sessionStorage.setItem("rapago_passenger_rut", profile.rut);
      sessionStorage.setItem("rapago_profile_rut", profile.rut);
    } else {
      sessionStorage.removeItem("rapago_passenger_rut");
      sessionStorage.removeItem("rapago_profile_rut");
    }

    if (profile.passport) {
      sessionStorage.setItem(
        "rapago_passenger_passport",
        profile.passport,
      );
      sessionStorage.setItem(
        "rapago_profile_passport",
        profile.passport,
      );
    } else {
      sessionStorage.removeItem("rapago_passenger_passport");
      sessionStorage.removeItem("rapago_profile_passport");
    }

    localStorage.setItem(
      "rapago_profile_nationality",
      effectivePassengerFareLabel,
    );
    localStorage.setItem(
      "rapago_nationality",
      effectivePassengerFareLabel,
    );
    localStorage.setItem(
      "rapago_requested_passenger_fare_type",
      requestedPassengerFareType,
    );
    localStorage.setItem(
      "rapago_passenger_fare_type",
      effectivePassengerFareType,
    );
    localStorage.setItem(
      "rapago_fare_passenger_type",
      effectivePassengerFareType,
    );
    localStorage.setItem(
      "rapago_passenger_type",
      effectivePassengerFareType,
    );

    if (profile.passengerCondition) {
      localStorage.setItem(
        "rapago_passenger_condition",
        profile.passengerCondition,
      );
    }

    if (profile.passengerConditionLegacy) {
      localStorage.setItem(
        "rapago_passenger_condition_legacy",
        profile.passengerConditionLegacy,
      );
    }

    if (
      typeof profile.belongsToRapaNuiEthnicity === "boolean"
    ) {
      localStorage.setItem(
        "rapago_belongs_to_rapa_nui_ethnicity",
        profile.belongsToRapaNuiEthnicity ? "si" : "no",
      );
    }

    if (profile.residenceVerificationStatus) {
      localStorage.setItem(
        "rapago_residence_verification_status",
        profile.residenceVerificationStatus,
      );
    }

    if (profile.residenceVerificationMessage) {
      localStorage.setItem(
        "rapago_residence_verification_user_message",
        profile.residenceVerificationMessage,
      );
    } else if (
      profile.residenceVerificationStatus === "not_required"
    ) {
      localStorage.removeItem(
        "rapago_residence_verification_user_message",
      );
    }

    localStorage.setItem(
      "rapago_residence_document_required",
      profile.residenceDocumentRequired ? "true" : "false",
    );
    localStorage.setItem(
      "rapago_residence_document_uploaded",
      profile.residenceDocumentUploaded ? "true" : "false",
    );
    localStorage.removeItem(
      "rapago_passenger_residence_document_meta",
    );
    sessionStorage.removeItem(
      "rapago_passenger_residence_document_data_url",
    );
    localStorage.removeItem("rapago_driver_is_rapanui_normal");
  } catch {
    // No bloqueamos el login si storage falla.
  }
}

function getFacebookRedirectErrorMessage(): string {
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const registrationCode = searchParams.get("registration");

    if (registrationCode === "resident_pending") {
      return "Tu cuenta está activa con tarifa Turista chileno mientras revisamos tu documento de residencia.";
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

export function LoginPage(): JSX.Element {
  const history = useHistory();
  const { login } = useAuth();

  const [email, setEmail] = useState(getStoredValue("rapago_passenger_email"));
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState(
    getFacebookRedirectErrorMessage,
  );

  const [showFacebookStep, setShowFacebookStep] = useState(false);
  const [passengerCondition, setPassengerCondition] =
    useState<PassengerCondition>(getStoredPassengerCondition());

  const [passengerEmail, setPassengerEmail] = useState(
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
    setFacebookStepError("");
    setResidentSubmissionMessage("");

    if (!passengerEmail && email.trim()) {
      setPassengerEmail(normalizeEmail(email));
    }

    setShowFacebookStep(true);
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
        "Selecciona si eres turista chileno, turista extranjero o residente Rapa Nui.",
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

    setFacebookLegalLoading(true);

    try {
      const activeLegalDocuments = await legalService.getActive();
      persistPendingFacebookLegalAcceptances(
        activeLegalDocuments,
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

    const requestedPassengerFareType =
      getPassengerFareType(passengerCondition);
    const conditionLabel =
      getConditionLabel(passengerCondition);
    const legacyCondition =
      getLegacyPassengerCondition(passengerCondition);

    let effectivePassengerFareType: PassengerFareType =
      requestedPassengerFareType;
    let residenceVerificationStatus:
      ResidenceVerificationStatus =
      isResidentRapaNui ? "pending" : "not_required";
    let residenceVerificationMessage = "";
    let residenceDocumentMeta: ResidenceDocumentMeta | null =
      null;
    let isResidentApproved = false;

    if (isResidentRapaNui) {
      effectivePassengerFareType = "chilean";
      residenceVerificationMessage =
        "Tu cuenta quedará activa con tarifa Turista chileno mientras revisamos tu residencia.";
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
            "Tu residencia Rapa Nui fue aprobada.";
        } else if (backendStatus.status === "rejected") {
          residenceVerificationStatus = "rejected";
          residenceVerificationMessage =
            `${backendStatus.message} Puedes ingresar de inmediato con tarifa Turista chileno.`;
        } else {
          residenceVerificationStatus = "pending";
          residenceVerificationMessage =
            backendStatus.status === "pending"
              ? `${backendStatus.message} Puedes ingresar de inmediato con tarifa Turista chileno.`
              : "Tu cuenta quedará activa con tarifa Turista chileno. Puedes adjuntar tu documento ahora o regularizarlo después.";
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
          effectivePassengerFareType =
            isResidentApproved ? "resident" : "chilean";
          residenceVerificationStatus =
            isResidentApproved ? "approved" : "pending";
          residenceVerificationMessage =
            isResidentApproved
              ? "Tu residencia Rapa Nui fue aprobada."
              : `${submitted.message} Puedes ingresar de inmediato con tarifa Turista chileno.`;

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
        }
      } catch (error) {
        effectivePassengerFareType = "chilean";
        residenceVerificationStatus = "pending";
        residenceVerificationMessage =
          error instanceof Error
            ? `Tu cuenta seguirá activa como Turista chileno. No se pudo completar la validación de residencia: ${error.message}`
            : "Tu cuenta seguirá activa como Turista chileno. Podrás regularizar tu residencia más adelante.";
      } finally {
        setFacebookPrecheckLoading(false);
      }

      setResidentSubmissionMessage(
        residenceVerificationMessage,
      );
    }

    const effectivePassengerFareLabel =
      getPassengerFareLabel(effectivePassengerFareType);

    persistPassengerProfile({
      email: cleanEmail,
      phone: cleanPhone,
      rut: needsRut ? cleanPassengerRut : "",
      passport: needsPassport
        ? cleanPassengerPassport
        : "",
      nationality: effectivePassengerFareLabel,
      passengerFareLabel: effectivePassengerFareLabel,
      requestedPassengerFareType,
      effectivePassengerFareType,
      passengerFareType: effectivePassengerFareType,
      farePassengerType: effectivePassengerFareType,
      passengerType: effectivePassengerFareType,
      passengerCondition,
      passengerConditionLegacy: legacyCondition,
      belongsToRapaNuiEthnicity: isResidentRapaNui,
      residenceDocumentRequired: isResidentRapaNui,
      residenceDocumentUploaded: isResidentRapaNui
        ? Boolean(residenceDocumentMeta || isResidentApproved)
        : false,
      residenceDocumentMeta,
      residenceVerificationStatus,
      residenceVerificationMessage,
      facebookLoginPrecheck: true,
    });

    const params = new URLSearchParams({
      condition: legacyCondition,
      passengerCondition,
      requestedPassengerFareType,
      passengerFareType: effectivePassengerFareType,
      passengerFareLabel: effectivePassengerFareLabel,
      email: cleanEmail,
      phone: cleanPhone,
      rut: needsPassport
        ? cleanPassengerPassport
        : cleanPassengerRut,
      passport: needsPassport
        ? cleanPassengerPassport
        : "",
      residenceDocumentRequired: isResidentRapaNui
        ? "true"
        : "false",
      residenceDocumentUploaded:
        residenceDocumentMeta || isResidentApproved
          ? "true"
          : "false",
      residenceVerificationStatus,
      rapaNuiEthnicity: isResidentRapaNui
        ? "si"
        : "no",
    });

    window.location.href =
      `${API_URL}/api/auth/facebook?${params.toString()}`;
  }

  function goToRegister(): void {
    history.push(ROUTES.AUTH.REGISTER);
  }

  const pageStyle = {
    "--background": "linear-gradient(180deg, rgba(20,16,12,.72), rgba(20,16,12,.86)), url('/assets/rapa-go-bg.jpg') center / cover no-repeat fixed",
  } as CSSProperties;

  const formShellStyle: CSSProperties = {
    width: "min(92vw, 470px)",
    margin: "34px auto 22px",
    padding: "22px",
    borderRadius: "30px",
    background: "linear-gradient(180deg, rgba(26,26,25,.96), rgba(15,15,15,.98))",
    border: "1px solid rgba(214,166,64,.34)",
    boxShadow: "0 24px 70px rgba(0,0,0,.48), inset 0 1px 0 rgba(255,255,255,.08)",
    color: "#F6F2EC",
  };

  const brandBadgeStyle: CSSProperties = {
    width: 58,
    height: 58,
    borderRadius: 20,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg,#F8D879,#C89B3C 48%,#8F3C24)",
    boxShadow: "0 12px 28px rgba(200,155,60,.35)",
    color: "#111",
    fontSize: "1.7rem",
    fontWeight: 950,
    marginBottom: 14,
  };

  const authInputStyle = {
    "--background": "rgba(255,255,255,.065)",
    "--color": "#F6F2EC",
    "--border-color": "rgba(214,166,64,.30)",
    "--highlight-color-focused": "#D6A640",
    "--padding-start": "16px",
    "--inner-padding-end": "16px",
    border: "1px solid rgba(214,166,64,.30)",
    borderRadius: "18px",
    marginBottom: "12px",
    overflow: "hidden",
  } as CSSProperties;

  const inputTextStyle = {
    "--color": "#F6F2EC",
    "--placeholder-color": "rgba(246,242,236,.52)",
    "--placeholder-opacity": "1",
    fontWeight: 850,
  } as CSSProperties;

  const primaryButtonStyle = {
    "--border-radius": "18px",
    "--background": "linear-gradient(135deg,#F8D879 0%,#D6A640 48%,#B84F2E 100%)",
    "--background-activated": "linear-gradient(135deg,#C89B3C,#B84F2E)",
    "--box-shadow": "0 16px 32px rgba(214,166,64,.35)",
    color: "#111",
    height: "54px",
    fontWeight: 950,
    marginTop: "14px",
  } as CSSProperties;

  const outlineButtonStyle = {
    "--border-radius": "18px",
    "--border-color": "rgba(214,166,64,.72)",
    "--color": "#F8D879",
    height: "50px",
    fontWeight: 900,
    marginTop: "10px",
  } as CSSProperties;

  const modalCardStyle: CSSProperties = {
    width: "min(92vw, 560px)",
    margin: "18px auto 24px",
    borderRadius: "30px",
    overflow: "hidden",
    background: "linear-gradient(180deg, rgba(246,242,236,.98), rgba(232,221,202,.98))",
    border: "1px solid rgba(214,166,64,.38)",
    boxShadow: "0 30px 80px rgba(0,0,0,.48)",
    color: "#111",
  };

  const modalHeaderStyle: CSSProperties = {
    padding: "18px 20px",
    color: "#fff",
    background: "linear-gradient(135deg,#171717 0%,#5A241A 48%,#C89B3C 120%)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  };

  const modalBodyStyle: CSSProperties = {
    padding: "18px",
  };

  const modalItemStyle = {
    "--background": "rgba(17,17,17,.93)",
    "--color": "#F6F2EC",
    "--border-color": "transparent",
    "--highlight-color-focused": "#D6A640",
    "--padding-start": "16px",
    "--inner-padding-end": "16px",
    border: "1px solid rgba(200,155,60,.35)",
    borderRadius: "18px",
    marginBottom: "12px",
    overflow: "hidden",
  } as CSSProperties;

  const modalInputStyle = {
    "--color": "#F6F2EC",
    "--placeholder-color": "rgba(246,242,236,.55)",
    "--placeholder-opacity": "1",
    fontWeight: 850,
  } as CSSProperties;

  const conditionOptions: Array<{
    value: Exclude<PassengerCondition, "">;
    title: string;
    subtitle: string;
    icon: string;
  }> = [
    {
      value: "turista_chileno",
      title: "Turista chileno",
      subtitle: "Tarifa nacional para visitantes de Chile.",
      icon: "🇨🇱",
    },
    {
      value: "turista_extranjero",
      title: "Turista extranjero",
      subtitle: "Tarifa internacional para visitantes.",
      icon: "🌎",
    },
    {
      value: "residente_rapa_nui",
      title: "Residente Rapa Nui",
      subtitle: "Cuenta activa como Turista chileno hasta que el documento sea aprobado.",
      icon: "🗿",
    },
  ];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar
          style={
            {
              "--background": "linear-gradient(135deg,#111 0%,#5A241A 56%,#C89B3C 130%)",
              "--color": "#fff",
              "--min-height": "72px",
            } as CSSProperties
          }
        >
          <IonTitle style={{ fontWeight: 950, letterSpacing: ".01em" }}>
            Iniciar sesión
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={pageStyle}>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          noValidate
          style={formShellStyle}
        >
          <div style={brandBadgeStyle}>🗿</div>

          <IonText>
            <h2
              style={{
                margin: "0 0 6px",
                fontSize: "2rem",
                lineHeight: 1.05,
                fontWeight: 950,
                color: "#D6A640",
              }}
            >
              Bienvenido a Rapa Go
            </h2>
          </IonText>

          <p
            style={{
              margin: "0 0 18px",
              color: "rgba(246,242,236,.72)",
              fontWeight: 750,
              lineHeight: 1.35,
            }}
          >
            Movilidad local, turismo y viajes seguros en Rapa Nui.
          </p>

          {serverError && (
            <IonText color="danger">
              <p
                className="auth-error"
                style={{
                  background: "rgba(239,68,68,.14)",
                  border: "1px solid rgba(239,68,68,.28)",
                  padding: "10px 12px",
                  borderRadius: 14,
                  fontWeight: 900,
                }}
              >
                {serverError}
              </p>
            </IonText>
          )}

          <IonItem className={fieldErrors.email ? "ion-invalid" : ""} style={authInputStyle}>
            <IonLabel position="stacked" style={{ color: "#F8D879", fontWeight: 900 }}>
              Correo electrónico
            </IonLabel>
            <IonInput
              style={inputTextStyle}
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

          <IonItem className={fieldErrors.password ? "ion-invalid" : ""} style={authInputStyle}>
            <IonLabel position="stacked" style={{ color: "#F8D879", fontWeight: 900 }}>
              Contraseña
            </IonLabel>
            <IonInput
              style={inputTextStyle}
              type="password"
              value={password}
              onIonInput={(e) => {
                setPassword(String(e.detail.value ?? ""));
              }}
              placeholder="Mínimo 8 caracteres"
              autocomplete="current-password"
              disabled={loading}
              required
            />
            {fieldErrors.password && <IonNote slot="error">{fieldErrors.password}</IonNote>}
          </IonItem>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              margin: "-4px 0 2px",
            }}
          >
            <IonButton
              fill="clear"
              size="small"
              type="button"
              disabled={loading}
              onClick={() => history.push("/auth/forgot-password")}
              style={
                {
                  "--color": "#F8D879",
                  fontWeight: 900,
                  margin: 0,
                  textTransform: "none",
                } as CSSProperties
              }
            >
              ¿Olvidaste tu contraseña?
            </IonButton>
          </div>

          <IonButton expand="block" type="submit" disabled={loading} style={primaryButtonStyle}>
            {loading ? <IonSpinner name="crescent" /> : "Iniciar sesión"}
          </IonButton>

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
            style={outlineButtonStyle}
          >
            Continuar con Facebook
          </IonButton>

          <IonButton
            expand="block"
            fill="clear"
            disabled={loading}
            onClick={goToRegister}
            type="button"
            style={{ color: "#F8D879", fontWeight: 900, marginTop: 8 } as CSSProperties}
          >
            ¿No tienes cuenta? Crear cuenta
          </IonButton>

          <IonButton
            expand="block"
            fill="outline"
            disabled={loading}
            onClick={() => history.replace(ROUTES.WELCOME)}
            type="button"
            style={outlineButtonStyle}
          >
            Volver al inicio
          </IonButton>
        </form>

        <IonModal
          className="facebook-step-modal"
          isOpen={showFacebookStep}
          onDidDismiss={() => setShowFacebookStep(false)}
          style={
            {
              "--width": "min(94vw, 620px)",
              "--height": "92vh",
              "--max-height": "92vh",
              "--border-radius": "30px",
            } as CSSProperties
          }
        >
          <IonContent className="facebook-step-content" scrollY={true}>
              <div className="facebook-step-card" style={modalCardStyle}>
                <div className="facebook-step-header" style={modalHeaderStyle}>
                  <div>
                    <div
                      style={{
                        fontSize: ".72rem",
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                        color: "rgba(248,216,121,.95)",
                        fontWeight: 950,
                        marginBottom: 4,
                      }}
                    >
                      Antes de continuar
                    </div>
                    <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 950 }}>
                      Datos del pasajero
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowFacebookStep(false)}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,.26)",
                      background: "rgba(255,255,255,.10)",
                      color: "#fff",
                      fontWeight: 950,
                      fontSize: "1.25rem",
                    }}
                    aria-label="Cerrar"
                  >
                    ×
                  </button>
                </div>

                <div className="facebook-step-body" style={modalBodyStyle}>
                  <p
                    style={{
                      margin: "0 0 14px",
                      color: "#4A4237",
                      fontSize: ".92rem",
                      lineHeight: 1.38,
                      fontWeight: 760,
                    }}
                  >
                    Selecciona tu tipo de pasajero. Si eliges Residente Rapa Nui, podrás entrar inmediatamente con tarifa Turista chileno mientras revisamos el documento.
                  </p>

                  {facebookStepError && (
                    <IonText color="danger">
                      <p
                        className="auth-error"
                        style={{
                          background: "rgba(239,68,68,.12)",
                          border: "1px solid rgba(239,68,68,.30)",
                          padding: "10px 12px",
                          borderRadius: 14,
                          fontWeight: 950,
                          margin: "0 0 12px",
                        }}
                      >
                        {facebookStepError}
                      </p>
                    </IonText>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      marginBottom: 14,
                    }}
                  >
                    {conditionOptions.map((option) => {
                      const active = passengerCondition === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handlePassengerConditionChange(option.value)}
                          style={{
                            width: "100%",
                            display: "grid",
                            gridTemplateColumns: "46px 1fr 26px",
                            alignItems: "center",
                            gap: 12,
                            borderRadius: 20,
                            padding: "12px",
                            textAlign: "left",
                            border: active
                              ? "2px solid rgba(34,197,94,.72)"
                              : "1px solid rgba(200,155,60,.38)",
                            background: active
                              ? "linear-gradient(135deg,#ECFDF3,#FFFFFF)"
                              : "rgba(255,255,255,.74)",
                            boxShadow: active
                              ? "0 12px 28px rgba(34,197,94,.16)"
                              : "0 8px 20px rgba(0,0,0,.07)",
                            color: "#111",
                          }}
                        >
                          <span
                            style={{
                              width: 46,
                              height: 46,
                              borderRadius: 16,
                              display: "grid",
                              placeItems: "center",
                              background: active ? "#22C55E" : "#1D1D1B",
                              color: "#fff",
                              fontSize: "1.25rem",
                            }}
                          >
                            {option.icon}
                          </span>

                          <span style={{ minWidth: 0 }}>
                            <strong style={{ display: "block", fontSize: ".95rem", fontWeight: 950 }}>
                              {option.title}
                            </strong>
                            <span style={{ display: "block", color: "#675A4A", fontSize: ".76rem", fontWeight: 760, marginTop: 2 }}>
                              {option.subtitle}
                            </span>
                          </span>

                          <span
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 999,
                              display: "grid",
                              placeItems: "center",
                              background: active ? "#22C55E" : "rgba(17,17,17,.10)",
                              color: active ? "#fff" : "#777",
                              fontWeight: 950,
                            }}
                          >
                            {active ? "✓" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      margin: "2px 0 12px",
                      padding: "12px",
                      borderRadius: 18,
                      background: "rgba(17,17,17,.08)",
                      border: "1px solid rgba(200,155,60,.30)",
                      color: "#372F28",
                      fontWeight: 850,
                      fontSize: ".82rem",
                      lineHeight: 1.35,
                    }}
                  >

                  </div>

                  <IonItem style={modalItemStyle}>
                    <IonLabel position="stacked" style={{ color: "#F8D879", fontWeight: 950 }}>
                      Correo electrónico *
                    </IonLabel>
                    <IonInput
                      style={modalInputStyle}
                      type="email"
                      value={passengerEmail}
                      onIonInput={(e) => {
                        setPassengerEmail(String(e.detail.value ?? ""));
                      }}
                      placeholder="tu@correo.com"
                      autocomplete="email"
                      inputmode="email"
                      required
                    />
                  </IonItem>

                  <IonItem style={modalItemStyle}>
                    <IonLabel position="stacked" style={{ color: "#F8D879", fontWeight: 950 }}>
                      Celular *
                    </IonLabel>
                    <IonInput
                      style={modalInputStyle}
                      type="tel"
                      value={passengerPhone}
                      onIonInput={(e) => {
                        setPassengerPhone(String(e.detail.value ?? ""));
                      }}
                      placeholder="+56 9 1234 5678"
                      autocomplete="tel"
                      inputmode="tel"
                      required
                    />
                  </IonItem>

                  {passengerCondition !== "turista_extranjero" && (
                    <IonItem style={modalItemStyle}>
                    <IonLabel position="stacked" style={{ color: "#F8D879", fontWeight: 950 }}>
                      RUT *
                    </IonLabel>
                    <IonInput
                      style={modalInputStyle}
                      type="text"
                      value={passengerRut}
                      onIonInput={(e) => {
                        setPassengerRut(String(e.detail.value ?? ""));
                      }}
                      onIonBlur={() => {
                        setPassengerRut(formatRut(passengerRut));
                      }}
                      placeholder="12345678-9"
                      autocomplete="off"
                      inputmode="text"
                      required
                    />
                  </IonItem>
                  )}

                  {passengerCondition === "turista_extranjero" && (
                    <IonItem style={modalItemStyle}>
                      <IonLabel position="stacked" style={{ color: "#F8D879", fontWeight: 950 }}>
                        Pasaporte *
                      </IonLabel>
                      <IonInput
                        style={modalInputStyle}
                        type="text"
                        value={passengerPassport}
                        placeholder="Ej: A1234567"
                        autocomplete="off"
                        inputmode="text"
                        maxlength={20}
                        required
                        onIonInput={(event) => {
                          setPassengerPassport(normalizePassportForAuth(event.detail.value ?? ""));
                          setFacebookStepError("");
                        }}
                      />
                    </IonItem>
                  )}

                  {isResidentRapaNui && (
                    <div
                      style={{
                        borderRadius: 20,
                        padding: 14,
                        background: "linear-gradient(135deg,#FFF8E6,#FFFFFF)",
                        border: residenceDocumentName
                          ? "2px solid rgba(34,197,94,.62)"
                          : "2px dashed rgba(200,155,60,.72)",
                        marginBottom: 12,
                      }}
                    >
                      <strong style={{ display: "block", fontSize: ".9rem", color: "#111", fontWeight: 950 }}>
                        Documento de residencia *
                      </strong>
                      <p style={{ margin: "4px 0 10px", color: "#675A4A", fontSize: ".78rem", fontWeight: 760 }}>
                        PDF, JPG, PNG o WEBP. Máximo 1.5 MB para que funcione rápido en celular.
                      </p>

                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        onChange={handleResidenceDocumentChange}
                        style={{ width: "100%", fontWeight: 850, color: "#111" }}
                      />

                      {residenceDocumentName && (
                        <IonText color="success">
                          <p style={{ fontSize: "0.84rem", margin: "8px 0 0", fontWeight: 950 }}>
                            ✓ Documento cargado: {residenceDocumentName}
                          </p>
                        </IonText>
                      )}
                    </div>
                  )}

                  <div
                    style={{
                      margin: "4px 0 14px",
                      padding: "14px",
                      borderRadius: 20,
                      background:
                        "linear-gradient(135deg,#FFF8E6,#FFFFFF)",
                      border:
                        "1px solid rgba(200,155,60,.42)",
                    }}
                  >
                    <div
                      style={{
                        marginBottom: 10,
                        color: "#111",
                        fontSize: ".9rem",
                        fontWeight: 950,
                      }}
                    >
                      Documentos legales obligatorios
                    </div>

                    <IonItem
                      lines="none"
                      style={{
                        "--background": "transparent",
                        "--padding-start": "0",
                        "--inner-padding-end": "0",
                        alignItems: "flex-start",
                      } as CSSProperties}
                    >
                      <IonCheckbox
                        slot="start"
                        checked={acceptFacebookTerms}
                        onIonChange={(event) => {
                          setAcceptFacebookTerms(
                            event.detail.checked,
                          );
                          setFacebookStepError("");
                        }}
                      />
                      <IonLabel
                        style={{
                          color: "#30271F",
                          whiteSpace: "normal",
                          lineHeight: 1.35,
                          fontWeight: 800,
                        }}
                      >
                        Acepto los Términos y Condiciones.
                        <button
                          type="button"
                          onClick={() =>
                            history.push(ROUTES.PUBLIC.TERMS)
                          }
                          style={{
                            border: 0,
                            background: "transparent",
                            color: "#8A5A00",
                            fontWeight: 950,
                            textDecoration: "underline",
                            cursor: "pointer",
                          }}
                        >
                          Ver documento
                        </button>
                      </IonLabel>
                    </IonItem>

                    <IonItem
                      lines="none"
                      style={{
                        "--background": "transparent",
                        "--padding-start": "0",
                        "--inner-padding-end": "0",
                        alignItems: "flex-start",
                      } as CSSProperties}
                    >
                      <IonCheckbox
                        slot="start"
                        checked={acceptFacebookPrivacy}
                        onIonChange={(event) => {
                          setAcceptFacebookPrivacy(
                            event.detail.checked,
                          );
                          setFacebookStepError("");
                        }}
                      />
                      <IonLabel
                        style={{
                          color: "#30271F",
                          whiteSpace: "normal",
                          lineHeight: 1.35,
                          fontWeight: 800,
                        }}
                      >
                        Acepto la Política de Privacidad.
                        <button
                          type="button"
                          onClick={() =>
                            history.push(
                              ROUTES.PUBLIC.PRIVACY,
                            )
                          }
                          style={{
                            border: 0,
                            background: "transparent",
                            color: "#8A5A00",
                            fontWeight: 950,
                            textDecoration: "underline",
                            cursor: "pointer",
                          }}
                        >
                          Ver documento
                        </button>
                      </IonLabel>
                    </IonItem>

                    <IonItem
                      lines="none"
                      style={{
                        "--background": "transparent",
                        "--padding-start": "0",
                        "--inner-padding-end": "0",
                        alignItems: "flex-start",
                      } as CSSProperties}
                    >
                      <IonCheckbox
                        slot="start"
                        checked={
                          acceptFacebookUserConditions
                        }
                        onIonChange={(event) => {
                          setAcceptFacebookUserConditions(
                            event.detail.checked,
                          );
                          setFacebookStepError("");
                        }}
                      />
                      <IonLabel
                        style={{
                          color: "#30271F",
                          whiteSpace: "normal",
                          lineHeight: 1.35,
                          fontWeight: 800,
                        }}
                      >
                        Acepto las Condiciones para Usuarios.
                      </IonLabel>
                    </IonItem>

                    <p
                      style={{
                        margin: "8px 0 0",
                        color: "#675A4A",
                        fontSize: ".76rem",
                        fontWeight: 760,
                        lineHeight: 1.4,
                      }}
                    >
                      Las Condiciones para Conductores no se
                      solicitan a pasajeros. Solo corresponden
                      al proceso de postulación de conductor.
                    </p>
                  </div>

                  {residentSubmissionMessage && (
                    <div
                      role="status"
                      style={{
                        margin: "4px 0 12px",
                        padding: "12px 14px",
                        borderRadius: 16,
                        background: "rgba(34,197,94,.12)",
                        border: "1px solid rgba(34,197,94,.38)",
                        color: "#14532D",
                        fontSize: ".84rem",
                        fontWeight: 850,
                        lineHeight: 1.4,
                      }}
                    >
                      {residentSubmissionMessage}
                    </div>
                  )}

                  <IonButton
                    expand="block"
                    style={primaryButtonStyle}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void continueWithFacebook();
                    }}
                    type="button"
                    disabled={
                      facebookPrecheckLoading ||
                      facebookLegalLoading ||
                      !acceptFacebookTerms ||
                      !acceptFacebookPrivacy ||
                      !acceptFacebookUserConditions
                    }
                  >
                    {facebookPrecheckLoading ||
                    facebookLegalLoading ? (
                      <>
                        <IonSpinner
                          name="crescent"
                          style={{ marginRight: 8 }}
                        />
                        Validando datos...
                      </>
                    ) : (
                      "Continuar con Facebook"
                    )}
                  </IonButton>

                  <IonButton
                    expand="block"
                    fill="outline"
                    onClick={() => setShowFacebookStep(false)}
                    type="button"
                    style={{
                      ...outlineButtonStyle,
                      "--color": "#1D1D1B",
                      "--border-color": "rgba(29,29,27,.42)",
                    } as CSSProperties}
                  >
                    Volver
                  </IonButton>
                </div>
              </div>
            </IonContent>
        </IonModal>

      </IonContent>
    </IonPage>
  );
}
