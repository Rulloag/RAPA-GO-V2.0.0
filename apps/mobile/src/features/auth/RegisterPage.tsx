import { useRef, useState, type CSSProperties, type ChangeEvent, type FormEvent } from "react";
import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import { registerRequestSchema } from "@rapa-go/shared";
import { useAuth } from "./useAuth.js";
import { authService } from "./auth.service.js";
import { sessionStorageService } from "./sessionStorage.service.js";
import { ROUTES } from "../../navigation/routes.js";
import { getReleaseHome } from "../../config/releaseFeatures.js";
import { legalService } from "../../features/legal/legal.service.js";
import { referralsService } from "../../features/referrals/referrals.service.js";


type RegisterField =
  | "name"
  | "lastName"
  | "rut"
  | "passport"
  | "phone"
  | "email"
  | "passengerType"
  | "residentDocument"
  | "password"
  | "confirmPassword"
  | "terms";


type PassengerFareType = "resident" | "chilean" | "foreigner";
type ResidenceVerificationStatus = "pending" | "approved" | "rejected" | "not_required";

const PASSENGER_FARE_TYPES: Array<{
  value: PassengerFareType;
  label: string;
  helper: string;
  badge: string;
  multiplier: string;
}> = [
  {
    value: "resident",
    label: "Residente Rapa Nui",
    helper: "Tu cuenta queda activa como Turista chileno mientras revisamos tu documento.",
    badge: "Rapa Nui",
    multiplier: "1,00",
  },
  {
    value: "chilean",
    label: "Turista chileno",
    helper: "Persona chilena que visita la isla y no acredita residencia.",
    badge: "Chilena",
    multiplier: "1,13",
  },
  {
    value: "foreigner",
    label: "Turista extranjero",
    helper: "Persona extranjera visitante.",
    badge: "Turista",
    multiplier: "1,20",
  },
];

type ResidentDocumentData = {
  name: string;
  type: string;
  sizeBytes: number;
  dataUrl: string;
  uploadedAt: string;
};

const RESIDENT_DOCUMENT_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);
const RESIDENT_VERIFICATION_REQUESTS_KEY = "rapago_resident_verification_requests_v1";
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;
const LOCAL_PHONE_LENGTH = 9;
const EMAIL_MAX_LENGTH = 120;

const ALLOWED_RESIDENT_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function getPassengerFareTypeLabel(value: PassengerFareType): string {
  return PASSENGER_FARE_TYPES.find((item) => item.value === value)?.label ?? value;
}

function isPassengerFareType(value: string): value is PassengerFareType {
  return value === "resident" || value === "chilean" || value === "foreigner";
}

function cleanEmailInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._%+-]/g, "")
    .slice(0, EMAIL_MAX_LENGTH);
}

function normalizeEmail(value: string): string {
  return cleanEmailInput(value);
}

function validateEmail(value: string): boolean {
  const email = normalizeEmail(value);

  if (!email || email.length > EMAIL_MAX_LENGTH) return false;
  if (email.includes("..") || email.startsWith(".") || email.endsWith(".")) return false;

  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email);
}

function cleanPersonName(value: string): string {
  return value
    .replace(/[^A-Za-zÁÉÍÓÚÜáéíóúüÑñ' -]/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 60);
}

function onlyNumbers(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function cleanRut(value: string): string {
  return onlyNumbers(value, 9);
}

function formatRut(value: string): string {
  const clean = cleanRut(value);

  if (clean.length <= 1) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  const grouped =
    body
      .split("")
      .reverse()
      .join("")
      .match(/.{1,3}/g)
      ?.map((part) => part.split("").reverse().join(""))
      .reverse()
      .join(".") ?? body;

  return `${grouped}-${dv}`;
}

function normalizeRut(value: string): string {
  return formatRut(value);
}

function cleanPhone(value: string): string {
  const digits = onlyNumbers(value, 11);
  const withoutCountryCode = digits.startsWith("56") ? digits.slice(2) : digits;

  return withoutCountryCode.slice(0, LOCAL_PHONE_LENGTH);
}

function normalizePhone(value: string): string {
  const local = cleanPhone(value);

  return local ? `56${local}` : "";
}

function cleanReferralCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

function sanitizeFileName(value: string): string {
  const clean = value
    .replace(/[\\/<>:"'|?*{}()[\];]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 90);

  return clean || "documento-residencia";
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

function persistRegistrationProfile(data: {
  name: string;
  firstName: string;
  lastName: string;
  rut: string;
  passport?: string;
  phone: string;
  email: string;
  requestedPassengerFareType: PassengerFareType;
  effectivePassengerFareType: PassengerFareType;
  residenceVerificationStatus: ResidenceVerificationStatus;
  residenceVerificationMessage?: string;
  residentDocument?: ResidentDocumentData | null;
}): void {
  try {
    clearLegacyAuthPiiLocalStorage();

    const effectivePassengerFareLabel = getPassengerFareTypeLabel(
      data.effectivePassengerFareType,
    );

    const safeProfile = {
      requestedPassengerFareType: data.requestedPassengerFareType,
      passengerFareType: data.effectivePassengerFareType,
      effectivePassengerFareType: data.effectivePassengerFareType,
      passengerFareLabel: effectivePassengerFareLabel,
      residenceVerificationStatus: data.residenceVerificationStatus,
      residenceVerificationMessage:
        data.residenceVerificationMessage ?? "",
      residenceDocumentRequired:
        data.requestedPassengerFareType === "resident",
      residenceDocumentUploaded: Boolean(data.residentDocument),
    };

    const safeSessionProfile = {
      ...data,
      passengerFareType: data.effectivePassengerFareType,
      passengerFareLabel: effectivePassengerFareLabel,
      residentDocument: data.residentDocument
        ? {
            name: data.residentDocument.name,
            type: data.residentDocument.type,
            sizeBytes: data.residentDocument.sizeBytes,
            uploadedAt: data.residentDocument.uploadedAt,
          }
        : null,
    };

    sessionStorage.setItem(
      RAPAGO_AUTH_SESSION_PROFILE_KEY,
      JSON.stringify(safeSessionProfile),
    );
    localStorage.setItem(
      "rapago_registration_profile",
      JSON.stringify(safeProfile),
    );

    sessionStorage.setItem("rapago_passenger_email", data.email);
    sessionStorage.setItem("rapago_profile_email", data.email);
    sessionStorage.setItem("rapago_passenger_phone", data.phone);
    sessionStorage.setItem("rapago_profile_phone", data.phone);
    sessionStorage.setItem("rapago_passenger_rut", data.rut);
    sessionStorage.setItem("rapago_profile_rut", data.rut);

    if (data.effectivePassengerFareType === "foreigner" && data.passport) {
      sessionStorage.setItem(
        "rapago_passenger_passport",
        data.passport,
      );
      sessionStorage.setItem(
        "rapago_profile_passport",
        data.passport,
      );
    } else {
      sessionStorage.removeItem("rapago_passenger_passport");
      sessionStorage.removeItem("rapago_profile_passport");
    }

    localStorage.setItem(
      "rapago_requested_passenger_fare_type",
      data.requestedPassengerFareType,
    );
    localStorage.setItem(
      "rapago_passenger_fare_type",
      data.effectivePassengerFareType,
    );
    localStorage.setItem(
      "rapago_profile_passenger_type",
      data.effectivePassengerFareType,
    );
    localStorage.setItem(
      "rapago_fare_passenger_type",
      data.effectivePassengerFareType,
    );
    localStorage.setItem(
      "rapago_profile_nationality",
      effectivePassengerFareLabel,
    );
    localStorage.setItem(
      "rapago_residence_verification_status",
      data.residenceVerificationStatus,
    );

    if (data.residenceVerificationMessage) {
      localStorage.setItem(
        "rapago_residence_verification_user_message",
        data.residenceVerificationMessage,
      );
    } else if (
      data.residenceVerificationStatus === "not_required"
    ) {
      localStorage.removeItem(
        "rapago_residence_verification_user_message",
      );
    }

    localStorage.setItem(
      "rapago_driver_passenger_fare_type",
      data.effectivePassengerFareType,
    );
    localStorage.setItem(
      "rapago_driver_fare_passenger_type",
      data.effectivePassengerFareType,
    );
    localStorage.setItem(
      "rapago_driver_nationality",
      effectivePassengerFareLabel,
    );
    localStorage.setItem(
      "rapago_driver_is_resident",
      String(data.effectivePassengerFareType === "resident"),
    );
    localStorage.removeItem("rapago_driver_is_rapanui_normal");

    localStorage.removeItem("rapago_resident_document_name");
    localStorage.removeItem(
      "rapago_resident_document_uploaded_at",
    );
  } catch {
    // No bloquea el registro si storage no esta disponible.
  }
}

function readResidentVerificationRequests(): Array<Record<string, unknown>> {
  try {
    const raw = localStorage.getItem(RESIDENT_VERIFICATION_REQUESTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistResidentVerificationRequest(input: {
  userId: string;
  name: string;
  firstName: string;
  lastName: string;
  rut: string;
  passport?: string;
  phone: string;
  email: string;
  document: ResidentDocumentData;
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
      registrationProvider: "email",
      authProvider: "email",
      documentName: input.document.name,
      documentType: input.document.type,
      documentSizeBytes: input.document.sizeBytes,
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
      registrationProvider: "email",
      authProvider: "email",
      documentType: input.document.type,
      documentSizeBytes: input.document.sizeBytes,
      documentUploadedAt: input.document.uploadedAt,
      documentDataUrl: null,
      documentStorage: "backend",
      piiStorage: "minimal_local_mirror",
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer el documento."));
    reader.readAsDataURL(file);
  });
}

function validateRut(value: string): boolean {
  const digits = cleanRut(value);

  // Para no bloquear registros válidos con DV K, aquí solo exigimos números y largo correcto.
  // Si después quieres validar DV exacto, se puede agregar en backend.
  return digits.length >= 8 && digits.length <= 9;
}

function normalizePassportForRegister(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 20);
}

function validatePassportForRegister(value: unknown): boolean {
  const clean = normalizePassportForRegister(value).replace(/-/g, "");
  return clean.length >= 5 && clean.length <= 15;
}

function passengerFareRequiresPassport(value: PassengerFareType | ""): boolean {
  return value === "foreigner";
}

function passengerFareRequiresRut(value: PassengerFareType | ""): boolean {
  return value === "chilean" || value === "resident";
}

function validatePhone(value: string): boolean {
  const local = cleanPhone(value);

  // Chile móvil: +56 9XXXXXXXX. En pantalla se muestra +56 fijo.
  return /^9\d{8}$/.test(local);
}

function getFirstFieldError(
  issues: { path: (string | number)[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (typeof field === "string" && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return errors;
}

const pageContentStyle = {
  "--background":
    "linear-gradient(180deg, #fff7e8 0%, #f9ead0 48%, #edd2a0 100%)",
} as CSSProperties;

const formShellStyle: CSSProperties = {
  maxWidth: 540,
  margin: "1.25rem auto 2rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  padding: "20px 16px 22px",
  borderRadius: 26,
  background: "rgba(255, 252, 244, 0.96)",
  border: "1px solid rgba(205, 157, 60, 0.36)",
  boxShadow: "0 18px 44px rgba(66, 43, 16, 0.18)",
};

const registerItemStyle = {
  "--background": "#fffaf0",
  "--color": "#1f1711",
  "--border-color": "transparent",
  "--highlight-color-focused": "#c99a32",
  "--highlight-color-valid": "#c99a32",
  "--highlight-color-invalid": "#d33b32",
  "--padding-start": "16px",
  "--inner-padding-end": "12px",
  "--min-height": "64px",
  border: "1px solid rgba(198, 151, 54, 0.42)",
  borderRadius: 18,
  boxShadow: "0 8px 20px rgba(78, 52, 18, 0.06)",
  overflow: "hidden",
} as CSSProperties;

const labelStyle: CSSProperties = {
  color: "#3a2a1b",
  fontWeight: 900,
};

const inputStyle = {
  "--color": "#1f1711",
  "--placeholder-color": "#8a765e",
  "--placeholder-opacity": "1",
  fontWeight: 850,
} as CSSProperties;

const softNoteStyle: CSSProperties = {
  display: "block",
  padding: "10px 12px",
  borderRadius: 14,
  background: "#fff3dc",
  border: "1px solid rgba(198, 151, 54, 0.25)",
  color: "#5a4528",
  lineHeight: 1.35,
  fontWeight: 750,
};

const choiceGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
  gap: 8,
};

const nationalityFieldStyle: CSSProperties = {
  border: "1px solid rgba(210, 164, 58, 0.38)",
  borderRadius: 18,
  background: "#242424",
  color: "#f6f2ec",
  padding: "14px 16px",
  boxShadow: "0 8px 20px rgba(0, 0, 0, 0.16)",
  overflow: "hidden",
};

const nationalityLabelStyle: CSSProperties = {
  color: "#e8d7b5",
  fontWeight: 950,
  fontSize: "0.88rem",
  display: "block",
  marginBottom: 10,
};

function passengerChoiceButtonStyle(active: boolean): CSSProperties {
  return {
    width: "100%",
    minHeight: 58,
    border: active ? "1px solid #f4d782" : "1px solid rgba(210, 164, 58, 0.32)",
    borderRadius: 14,
    padding: "11px 12px",
    background: active ? "linear-gradient(135deg, #d2a43a, #f4d782)" : "#1f1f1f",
    color: active ? "#111111" : "#f6f2ec",
    textAlign: "left",
    boxShadow: active ? "0 10px 24px rgba(210, 164, 58, 0.22)" : "none",
    cursor: "pointer",
    transition: "transform .12s ease, border-color .12s ease, box-shadow .12s ease",
  };
}

function passengerBadgeStyle(active: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
    padding: "3px 8px",
    borderRadius: 999,
    background: active ? "rgba(17, 17, 17, 0.12)" : "rgba(244, 215, 130, 0.12)",
    color: active ? "#3a2a1b" : "#f4d782",
    fontSize: "0.66rem",
    fontWeight: 950,
    letterSpacing: ".02em",
    textTransform: "uppercase",
  };
}

const uploadBoxStyle: CSSProperties = {
  padding: "12px",
  borderRadius: 14,
  background: "#1f1f1f",
  border: "1px dashed rgba(244, 215, 130, 0.58)",
  color: "#f6f2ec",
};

const phoneInputRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
};

const phonePrefixStyle: CSSProperties = {
  flex: "0 0 auto",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 52,
  height: 38,
  borderRadius: 12,
  background: "rgba(210, 164, 58, 0.14)",
  border: "1px solid rgba(210, 164, 58, 0.34)",
  color: "#3a2a1b",
  fontWeight: 950,
};

export function RegisterPage(): JSX.Element {
  const history = useHistory();
  const { register } = useAuth();
  const residentDocumentInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [rut, setRut] = useState("");
  const [passport, setPassport] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passengerFareType, setPassengerFareType] = useState<PassengerFareType | "">("");
  const [residentDocument, setResidentDocument] = useState<ResidentDocumentData | null>(null);

  const [referralCode, setReferralCode] = useState("");
  const [referralMsg, setReferralMsg] = useState<string | null>(null);

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptUserConditions, setAcceptUserConditions] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<RegisterField | string, string>>({});
  const [serverError, setServerError] = useState("");

  const passwordMismatch =
    confirmPassword.length > 0 && password.length > 0 && password !== confirmPassword;

  const canSubmit =
    acceptTerms &&
    acceptPrivacy &&
    acceptUserConditions &&
    passengerFareType !== "" &&
    (!passengerFareRequiresRut(passengerFareType) || validateRut(rut)) &&
    (!passengerFareRequiresPassport(passengerFareType) || validatePassportForRegister(passport)) &&
    password.length >= PASSWORD_MIN_LENGTH &&
    !passwordMismatch &&
    !loading;

  function clearFieldError(field: RegisterField): void {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;

      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handlePassengerFareTypeChange(value: PassengerFareType): void {
    setPassengerFareType(value);
    clearFieldError("passengerType");
    clearFieldError("rut");
    clearFieldError("passport");

    if (value === "foreigner") {
      setRut("");
    } else {
      setPassport("");
    }

    if (value !== "resident") {
      setResidentDocument(null);
      clearFieldError("residentDocument");

      if (residentDocumentInputRef.current) {
        residentDocumentInputRef.current.value = "";
      }
    }
  }

  async function handleResidentDocumentSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0] ?? null;

    if (!file) return;

    clearFieldError("residentDocument");

    const safeFileName = sanitizeFileName(file.name);
    const lowerName = safeFileName.toLowerCase();
    const allowedByName =
      lowerName.endsWith(".pdf") ||
      lowerName.endsWith(".jpg") ||
      lowerName.endsWith(".jpeg") ||
      lowerName.endsWith(".png") ||
      lowerName.endsWith(".webp");
    const inferredMimeType = lowerName.endsWith(".pdf")
      ? "application/pdf"
      : lowerName.endsWith(".png")
        ? "image/png"
        : lowerName.endsWith(".webp")
          ? "image/webp"
          : lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")
            ? "image/jpeg"
            : "";
    const normalizedMimeType = file.type || inferredMimeType;
    const allowedByType =
      ALLOWED_RESIDENT_DOCUMENT_MIME_TYPES.has(normalizedMimeType);

    if (!allowedByName || !allowedByType) {
      setResidentDocument(null);
      setFieldErrors((prev) => ({
        ...prev,
        residentDocument: "Adjunta un PDF o una imagen JPG, PNG o WEBP.",
      }));
      return;
    }

    if (file.size > RESIDENT_DOCUMENT_MAX_BYTES) {
      setResidentDocument(null);
      setFieldErrors((prev) => ({
        ...prev,
        residentDocument: "El documento debe pesar máximo 1.5 MB para proteger tus datos y mantener rápida la app.",
      }));
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setResidentDocument({
        name: safeFileName,
        type: normalizedMimeType,
        sizeBytes: file.size,
        dataUrl,
        uploadedAt: new Date().toISOString(),
      });
    } catch {
      setResidentDocument(null);
      setFieldErrors((prev) => ({
        ...prev,
        residentDocument: "No se pudo leer el documento. Intenta con otro archivo.",
      }));
    }
  }

  async function acceptLegalDocuments(accessToken: string): Promise<void> {
    const requiredTypes = [
      "terms_and_conditions",
      "privacy_policy",
      "user_conditions",
    ];
    const documents = await legalService.getActive();

    const requiredDocuments = requiredTypes.map((type) => {
      const document = documents.find(
        (item) => item.type === type && item.isActive,
      );

      if (!document) {
        throw new Error(
          "No están disponibles todos los documentos legales obligatorios.",
        );
      }

      return document;
    });

    await Promise.all(
      requiredDocuments.map((document) =>
        legalService.accept(
          accessToken,
          document.id,
          document.version,
        ),
      ),
    );
  }

  async function applyReferralCode(userId: string): Promise<void> {
    const code = referralCode.trim();

    if (!code) return;

    try {
      const result = await referralsService.applyCode(code, userId);
      setReferralMsg(result.message);
    } catch {
      // El referido es opcional: no bloquea la creación de cuenta.
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();

    setFieldErrors({});
    setServerError("");
    setReferralMsg(null);

    const cleanName = cleanPersonName(name).trim();
    const cleanLastName = cleanPersonName(lastName).trim();
    const cleanRutValue = normalizeRut(rut);
    const cleanPassportValue = normalizePassportForRegister(passport);
    const cleanPhoneValue = normalizePhone(phone);
    const cleanEmailValue = normalizeEmail(email);
    const cleanPassengerFareType = isPassengerFareType(passengerFareType)
      ? passengerFareType
      : "";
    const fullName = `${cleanName} ${cleanLastName}`.trim();

    const nextErrors: Record<string, string> = {};

    if (!cleanName) {
      nextErrors.name = "Ingresa tu nombre.";
    }

    if (!cleanLastName) {
      nextErrors.lastName = "Ingresa tu apellido.";
    }

    if (passengerFareRequiresRut(cleanPassengerFareType)) {
      if (!cleanRutValue) {
        nextErrors.rut = "Ingresa tu RUT.";
      } else if (!validateRut(cleanRutValue)) {
        nextErrors.rut = "El RUT debe tener 8 o 9 números.";
      }
    }

    if (passengerFareRequiresPassport(cleanPassengerFareType)) {
      if (!cleanPassportValue) {
        nextErrors.passport = "Ingresa tu pasaporte.";
      } else if (!validatePassportForRegister(cleanPassportValue)) {
        nextErrors.passport = "Pasaporte inválido. Usa letras y números.";
      }
    }

    if (!cleanPhoneValue) {
      nextErrors.phone = "Ingresa tu teléfono.";
    } else if (!validatePhone(cleanPhoneValue)) {
      nextErrors.phone = "Teléfono inválido. Usa 9 números después de +56. Ej: +56 912345678.";
    }

    if (!cleanPassengerFareType) {
      nextErrors.passengerType = "Selecciona tu nacionalidad.";
    }

    if (!cleanEmailValue) {
      nextErrors.email = "Ingresa tu correo electrónico.";
    } else if (!validateEmail(cleanEmailValue)) {
      nextErrors.email = "Correo inválido. Revisa que no tenga espacios ni caracteres extraños.";
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      nextErrors.password = "La contraseña debe tener mínimo 8 caracteres.";
    } else if (password.length > PASSWORD_MAX_LENGTH) {
      nextErrors.password = "La contraseña debe tener máximo 72 caracteres.";
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Repite tu contraseña.";
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Tu contraseña no coincide. Vuelve a escribirla.";
    }

    if (!acceptTerms || !acceptPrivacy || !acceptUserConditions) {
      nextErrors.terms = "Debes aceptar los términos, privacidad y condiciones de usuario.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    const payload = {
      name: fullName,
      email: cleanEmailValue,
      password,
      role: "passenger" as const,
    };

    const parsed = registerRequestSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(getFirstFieldError(parsed.error.issues));
      return;
    }

    const selectedPassengerFareType =
      cleanPassengerFareType as PassengerFareType;
    const initialEffectivePassengerFareType: PassengerFareType =
      selectedPassengerFareType === "resident"
        ? "chilean"
        : selectedPassengerFareType;

    setLoading(true);
    let createdAccessToken: string | null = null;

    try {
      const result = await register({
        ...parsed.data,
        firstName: cleanName,
        lastName: cleanLastName,
        rut:
          selectedPassengerFareType === "foreigner"
            ? cleanPassportValue
            : cleanRutValue,
        passport:
          selectedPassengerFareType === "foreigner"
            ? cleanPassportValue
            : "",
        phone: cleanPhoneValue,
        passengerFareType: selectedPassengerFareType,
        passengerType: initialEffectivePassengerFareType,
        farePassengerType: initialEffectivePassengerFareType,
        nationality: getPassengerFareTypeLabel(
          initialEffectivePassengerFareType,
        ),
        isResident: selectedPassengerFareType === "resident",
        residenceVerificationStatus:
          selectedPassengerFareType === "resident"
            ? "pending"
            : "not_required",
        residentDocumentName:
          selectedPassengerFareType === "resident"
            ? residentDocument?.name ?? null
            : null,
      } as typeof parsed.data & {
        firstName: string;
        lastName: string;
        rut: string;
        passport: string;
        phone: string;
        passengerFareType: PassengerFareType;
        passengerType: PassengerFareType;
        farePassengerType: PassengerFareType;
        nationality: string;
        isResident: boolean;
        residenceVerificationStatus:
          ResidenceVerificationStatus;
        residentDocumentName: string | null;
      });

      if (result.ok === false) {
        if (result.code === "AUTH_EMAIL_TAKEN") {
          setFieldErrors({
            email: "Este correo ya está registrado.",
          });
          return;
        }

        setServerError(
          result.message ??
            "No se pudo crear la cuenta. Inténtalo de nuevo.",
        );
        return;
      }

      const accessToken = result.session.accessToken;
      createdAccessToken = accessToken;
      const userId = result.session.user.id;
      const registeredRole = result.session.user.role;

      await acceptLegalDocuments(accessToken);
      await applyReferralCode(userId);

      let effectivePassengerFareType: PassengerFareType =
        initialEffectivePassengerFareType;
      let residenceVerificationStatus:
        ResidenceVerificationStatus =
        selectedPassengerFareType === "resident"
          ? "pending"
          : "not_required";
      let residenceVerificationMessage =
        selectedPassengerFareType === "resident"
          ? "Tu cuenta está activa con tarifa Turista chileno. Puedes adjuntar o regularizar tu documento de residencia desde tu perfil."
          : "";

      if (
        selectedPassengerFareType === "resident" &&
        residentDocument
      ) {
        try {
          const submitted =
            await authService.submitFacebookResidentPrecheck({
              provider: "email",
              email: cleanEmailValue,
              phone: cleanPhoneValue,
              rut: cleanRutValue,
              documentName: residentDocument.name,
              documentType: residentDocument.type as
                | "application/pdf"
                | "image/jpeg"
                | "image/png"
                | "image/webp",
              documentSize: residentDocument.sizeBytes,
              documentDataUrl: residentDocument.dataUrl,
            });

          residenceVerificationStatus = submitted.status;
          effectivePassengerFareType =
            submitted.status === "approved"
              ? "resident"
              : "chilean";
          residenceVerificationMessage =
            submitted.status === "approved"
              ? "Tu residencia Rapa Nui fue aprobada."
              : `${submitted.message} Puedes usar Rapa Go de inmediato con tarifa Turista chileno.`;

          persistResidentVerificationRequest({
            userId,
            name: fullName,
            firstName: cleanName,
            lastName: cleanLastName,
            rut: cleanRutValue,
            phone: cleanPhoneValue,
            email: cleanEmailValue,
            document: residentDocument,
          });
        } catch (documentError) {
          effectivePassengerFareType = "chilean";
          residenceVerificationStatus = "pending";
          residenceVerificationMessage =
            documentError instanceof Error
              ? `Tu cuenta está activa como Turista chileno. No se pudo enviar el documento: ${documentError.message}`
              : "Tu cuenta está activa como Turista chileno. No se pudo enviar el documento y podrás intentarlo nuevamente desde tu perfil.";
        }
      }

      persistRegistrationProfile({
        name: fullName,
        firstName: cleanName,
        lastName: cleanLastName,
        rut:
          selectedPassengerFareType === "foreigner"
            ? cleanPassportValue
            : cleanRutValue,
        passport:
          selectedPassengerFareType === "foreigner"
            ? cleanPassportValue
            : "",
        phone: cleanPhoneValue,
        email: cleanEmailValue,
        requestedPassengerFareType: selectedPassengerFareType,
        effectivePassengerFareType,
        residenceVerificationStatus,
        residenceVerificationMessage,
        residentDocument,
      });

      history.replace(getReleaseHome(registeredRole));
    } catch (error) {
      if (createdAccessToken) {
        await authService.logout(createdAccessToken).catch(() => {});
        await sessionStorageService.clearSession();
        window.location.replace(
          `${ROUTES.AUTH.LOGIN}?registration=setup_error`,
        );
        return;
      }

      setServerError(
        error instanceof Error
          ? error.message
          : "Error de conexión. Verifica tu red e inténtalo de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="warning">
          <IonTitle style={{ color: "#111", fontWeight: 950 }}>Crear cuenta</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={pageContentStyle}>
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          style={formShellStyle}
          noValidate
        >
          <IonText>
            <h2 style={{ margin: "0 0 0.25rem", fontWeight: 950, color: "#1f1711" }}>
              Crea tu cuenta Rapa Go
            </h2>
          </IonText>

          <IonText>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", lineHeight: 1.45, color: "#5a4528", fontWeight: 700 }}>
              La cuenta se crea como pasajero. Si eliges Residente Rapa Nui, podrás usar la app de inmediato con tarifa Turista chileno mientras se revisa tu documento.
            </p>
          </IonText>

          {serverError && (
            <IonText color="danger">
              <p
                style={{
                  margin: "0 0 0.75rem",
                  padding: "0.75rem",
                  background: "var(--ion-color-danger-tint)",
                  borderRadius: 10,
                  fontWeight: 700,
                }}
              >
                {serverError}
              </p>
            </IonText>
          )}

          <IonItem className={fieldErrors.name ? "ion-invalid" : ""} style={registerItemStyle}>
            <IonLabel position="stacked" style={labelStyle}>Nombre *</IonLabel>
            <IonInput
              type="text"
              value={name}
              onIonInput={(event) => {
                setName(cleanPersonName(String(event.detail.value ?? "")));
                clearFieldError("name");
              }}
              placeholder="Ej: Leandro"
              style={inputStyle}
              autocomplete="given-name"
              disabled={loading}
              required
            />
            {fieldErrors.name && <IonNote slot="error">{fieldErrors.name}</IonNote>}
          </IonItem>

          <IonItem className={fieldErrors.lastName ? "ion-invalid" : ""} style={registerItemStyle}>
            <IonLabel position="stacked" style={labelStyle}>Apellido *</IonLabel>
            <IonInput
              type="text"
              value={lastName}
              onIonInput={(event) => {
                setLastName(cleanPersonName(String(event.detail.value ?? "")));
                clearFieldError("lastName");
              }}
              placeholder="Ej: Favio"
              style={inputStyle}
              autocomplete="family-name"
              disabled={loading}
              required
            />
            {fieldErrors.lastName && <IonNote slot="error">{fieldErrors.lastName}</IonNote>}
          </IonItem>

                    <div style={nationalityFieldStyle}>
            <IonLabel style={nationalityLabelStyle}>
              Nacionalidad *
            </IonLabel>

            <div style={choiceGridStyle}>
              {PASSENGER_FARE_TYPES.map((item) => {
                const active = passengerFareType === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    disabled={loading}
                    onClick={() => handlePassengerFareTypeChange(item.value)}
                    style={passengerChoiceButtonStyle(active)}
                  >
                    <span style={passengerBadgeStyle(active)}>{item.badge}</span>
                    <div style={{ fontWeight: 950, fontSize: "0.96rem" }}>
                      {item.label}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        color: active ? "#3a2a1b" : "rgba(246, 242, 236, 0.72)",
                        fontSize: "0.76rem",
                        fontWeight: 750,
                        lineHeight: 1.32,
                      }}
                    >
                      {item.helper}
                    </div>
                  </button>
                );
              })}
            </div>

            {fieldErrors.passengerType && (
              <IonText color="danger">
                <p style={{ margin: "8px 2px 0", fontSize: "0.82rem", fontWeight: 800 }}>
                  {fieldErrors.passengerType}
                </p>
              </IonText>
            )}

            {passengerFareType === "resident" && (
              <div style={{ ...uploadBoxStyle, marginTop: 12 }}>
                <input
                  ref={residentDocumentInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,application/pdf"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    void handleResidentDocumentSelected(event);
                  }}
                  disabled={loading}
                />

                <div style={{ fontWeight: 950, marginBottom: 6 }}>
                  Documento de residencia Rapa Nui (opcional)
                </div>

                <IonNote style={{ color: "rgba(246, 242, 236, 0.72)", display: "block", marginBottom: 10, lineHeight: 1.35 }}>
                  Adjunta un documento para solicitar la tarifa de residente. Mientras se revisa, tu cuenta queda activa como Turista chileno.
                </IonNote>

                <IonButton
                  type="button"
                  expand="block"
                  fill="outline"
                  color="warning"
                  disabled={loading}
                  onClick={() => residentDocumentInputRef.current?.click()}
                  style={{ "--border-radius": "14px", fontWeight: 950 } as CSSProperties}
                >
                  {residentDocument ? "Cambiar documento" : "Adjuntar documento"}
                </IonButton>

                {residentDocument && (
                  <IonText color="success">
                    <p style={{ margin: "10px 2px 0", fontSize: "0.82rem", fontWeight: 850 }}>
                      Documento adjunto: {residentDocument.name}
                    </p>
                  </IonText>
                )}

                {fieldErrors.residentDocument && (
                  <IonText color="danger">
                    <p style={{ margin: "8px 2px 0", fontSize: "0.82rem", fontWeight: 800 }}>
                      {fieldErrors.residentDocument}
                    </p>
                  </IonText>
                )}
              </div>
            )}
          </div>

          {/* RUT o Pasaporte según nacionalidad */}
          {passengerFareType !== "" && passengerFareType !== "foreigner" && (
            <IonItem className={fieldErrors.rut ? "ion-invalid" : ""} style={registerItemStyle}>
              <IonLabel position="stacked" style={labelStyle}>RUT *</IonLabel>
              <IonInput
                type="tel"
                value={rut}
                onIonInput={(event) => {
                  setRut(formatRut(String(event.detail.value ?? "")));
                  clearFieldError("rut");
                }}
                placeholder="123456789"
                style={inputStyle}
                autocomplete="off"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength={12}
                disabled={loading}
                required
              />
              {fieldErrors.rut && <IonNote slot="error">{fieldErrors.rut}</IonNote>}
            </IonItem>
          )}

          {passengerFareType === "foreigner" && (
            <IonItem className={fieldErrors.passport ? "ion-invalid" : ""} style={registerItemStyle}>
              <IonLabel position="stacked" style={labelStyle}>Pasaporte *</IonLabel>
              <IonInput
                type="text"
                value={passport}
                onIonInput={(event) => {
                  setPassport(normalizePassportForRegister(event.detail.value ?? ""));
                  clearFieldError("passport");
                }}
                placeholder="Ej: A1234567"
                style={inputStyle}
                autocomplete="off"
                inputmode="text"
                maxlength={20}
                disabled={loading}
                required
              />
              {fieldErrors.passport && <IonNote slot="error">{fieldErrors.passport}</IonNote>}
            </IonItem>
          )}

          <IonItem className={fieldErrors.phone ? "ion-invalid" : ""} style={registerItemStyle}>
            <IonLabel position="stacked" style={labelStyle}>Teléfono *</IonLabel>
            <div style={phoneInputRowStyle}>
              <span style={phonePrefixStyle}>+56</span>
              <IonInput
                type="tel"
                value={phone}
                onIonInput={(event) => {
                  setPhone(cleanPhone(String(event.detail.value ?? "")));
                  clearFieldError("phone");
                }}
                placeholder="912345678"
                style={inputStyle}
                autocomplete="tel"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength={LOCAL_PHONE_LENGTH}
                disabled={loading}
                required
              />
            </div>
            {fieldErrors.phone && <IonNote slot="error">{fieldErrors.phone}</IonNote>}
          </IonItem>

          <IonItem className={fieldErrors.email ? "ion-invalid" : ""} style={registerItemStyle}>
            <IonLabel position="stacked" style={labelStyle}>Correo electrónico *</IonLabel>
            <IonInput
              type="email"
              value={email}
              onIonInput={(event) => {
                setEmail(cleanEmailInput(String(event.detail.value ?? "")));
                clearFieldError("email");
              }}
              placeholder="tu@correo.com"
              style={inputStyle}
              autocomplete="email"
              inputmode="email"
              maxlength={EMAIL_MAX_LENGTH}
              disabled={loading}
              required
            />
            {fieldErrors.email && <IonNote slot="error">{fieldErrors.email}</IonNote>}
          </IonItem>

          <IonItem className={fieldErrors.password ? "ion-invalid" : ""} style={registerItemStyle}>
            <IonLabel position="stacked" style={labelStyle}>Contraseña *</IonLabel>
            <IonInput
              type="password"
              value={password}
              onIonInput={(event) => {
                setPassword(String(event.detail.value ?? ""));
                clearFieldError("password");
              }}
              placeholder="Mínimo 8 caracteres"
              style={inputStyle}
              autocomplete="new-password"
              maxlength={PASSWORD_MAX_LENGTH}
              disabled={loading}
              required
            />
            {fieldErrors.password && <IonNote slot="error">{fieldErrors.password}</IonNote>}
          </IonItem>

          <IonItem className={fieldErrors.confirmPassword ? "ion-invalid" : ""} style={registerItemStyle}>
            <IonLabel position="stacked" style={labelStyle}>Confirmar contraseña *</IonLabel>
            <IonInput
              type="password"
              value={confirmPassword}
              onIonInput={(event) => {
                setConfirmPassword(String(event.detail.value ?? ""));
                clearFieldError("confirmPassword");
              }}
              placeholder="Repite tu contraseña"
              style={inputStyle}
              autocomplete="new-password"
              maxlength={PASSWORD_MAX_LENGTH}
              disabled={loading}
              required
            />
            {passwordMismatch && !fieldErrors.confirmPassword && (
              <IonText color="danger">
                <p style={{ margin: "6px 0 0", fontSize: "0.8rem", fontWeight: 800 }}>
                  Tu contraseña no coincide. Vuelve a escribirla.
                </p>
              </IonText>
            )}
            {fieldErrors.confirmPassword && (
              <IonNote slot="error">{fieldErrors.confirmPassword}</IonNote>
            )}
          </IonItem>

         

          <IonItem style={{ ...registerItemStyle, marginTop: "0.5rem" } as CSSProperties}>
            <IonLabel position="stacked" style={labelStyle}>Código de referido (opcional)</IonLabel>
            <IonInput
              value={referralCode}
              onIonInput={(event) => setReferralCode(cleanReferralCode(String(event.detail.value ?? "")))}
              placeholder="Ej: RODRIGO2024"
              style={inputStyle}
              maxlength={20}
              clearInput
              disabled={loading}
            />
          </IonItem>

          {referralMsg && (
            <IonText color="success">
              <p style={{ margin: "4px 12px", fontSize: "0.8rem" }}>{referralMsg}</p>
            </IonText>
          )}

          <IonList style={{ marginTop: "0.75rem", borderRadius: 18, overflow: "hidden", background: "transparent", border: "1px solid rgba(198,151,54,.30)" }}>
            <IonItem style={{ ...registerItemStyle, borderRadius: 0, boxShadow: "none", borderLeft: 0, borderRight: 0, borderTop: 0 } as CSSProperties}>
              <IonCheckbox
                checked={acceptTerms}
                onIonChange={(event) => {
                  setAcceptTerms(event.detail.checked);
                  clearFieldError("terms");
                }}
                slot="start"
                disabled={loading}
              />
              <IonLabel style={{ whiteSpace: "normal", color: "#2f2217", fontWeight: 750, lineHeight: 1.35 }}>
                He leído y acepto los{" "}
                <a href="/legal/terms-and-conditions" target="_blank" rel="noopener noreferrer">
                  Términos y Condiciones
                </a>
              </IonLabel>
            </IonItem>

            <IonItem style={{ ...registerItemStyle, borderRadius: 0, boxShadow: "none", borderLeft: 0, borderRight: 0, borderTop: 0 } as CSSProperties}>
              <IonCheckbox
                checked={acceptPrivacy}
                onIonChange={(event) => {
                  setAcceptPrivacy(event.detail.checked);
                  clearFieldError("terms");
                }}
                slot="start"
                disabled={loading}
              />
              <IonLabel style={{ whiteSpace: "normal", color: "#2f2217", fontWeight: 750, lineHeight: 1.35 }}>
                He leído y acepto la{" "}
                <a href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                  Política de Privacidad
                </a>
              </IonLabel>
            </IonItem>

            <IonItem style={{ ...registerItemStyle, borderRadius: 0, boxShadow: "none", borderLeft: 0, borderRight: 0, borderTop: 0 } as CSSProperties}>
              <IonCheckbox
                checked={acceptUserConditions}
                onIonChange={(event) => {
                  setAcceptUserConditions(event.detail.checked);
                  clearFieldError("terms");
                }}
                slot="start"
                disabled={loading}
              />
              <IonLabel style={{ whiteSpace: "normal", color: "#2f2217", fontWeight: 750, lineHeight: 1.35 }}>
                Acepto las{" "}
                <a href="/legal/user-conditions" target="_blank" rel="noopener noreferrer">
                  Condiciones para Usuarios
                </a>
              </IonLabel>
            </IonItem>
          </IonList>

          {fieldErrors.terms && (
            <IonText color="danger">
              <p style={{ margin: "4px 12px", fontSize: "0.82rem", fontWeight: 700 }}>
                {fieldErrors.terms}
              </p>
            </IonText>
          )}

          <IonButton
            expand="block"
            type="submit"
            disabled={!canSubmit}
            style={{ marginTop: "1rem", height: "52px", fontWeight: 950, "--border-radius": "18px", "--background": "linear-gradient(135deg, #d2a43a, #f4d782)", "--color": "#111" } as CSSProperties}
          >
            {loading ? <IonSpinner name="crescent" /> : "Crear cuenta"}
          </IonButton>

          <IonButton
            expand="block"
            fill="clear"
            disabled={loading}
            onClick={() => history.push(ROUTES.ROOT)}
          >
            ¿Ya tienes cuenta? Iniciar sesión
          </IonButton>

          <IonButton
            expand="block"
            fill="outline"
            color="warning"
            disabled={loading}
            onClick={() => history.replace(ROUTES.ROOT)}
          >
            Volver al inicio
          </IonButton>
        </form>
      </IonContent>
    </IonPage>
  );
}
