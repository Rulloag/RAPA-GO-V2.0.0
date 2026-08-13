import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useHistory } from "react-router-dom";
import type { LegalDocumentData } from "../legal/legal.service.js";
import type { ResidenceAccreditationInput } from "@rapa-go/shared";
import type { ApplePassengerFareType } from "./auth.types.js";
import { ROUTES } from "../../navigation/routes.js";
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
} from "./PassengerSocialSetupForm.js";

interface AppleAccountSetupModalProps {
  isOpen: boolean;
  loading: boolean;
  documents: LegalDocumentData[];
  /** Correo verificado por Apple. Vacío si Apple no lo entregó. */
  displayEmail: string;
  /** Mensaje de error devuelto por el backend al reenviar el formulario. */
  serverError?: string;
  onCancel: () => void;
  onConfirm: (input: {
    passengerFareType: ApplePassengerFareType;
    acceptedDocumentIds: string[];
    displayName: string;
    phone: string;
    rut?: string;
    passport?: string;
    contactEmail?: string;
    residenceAccreditation?: ResidenceAccreditationInput;
  }) => void;
}

function isValidContactEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}


function getAppleLegalLabel(document: LegalDocumentData): string {
  if (document.type === "terms_and_conditions") {
    return `He leído y acepto los Términos y Condiciones Generales de Rapa Go, versión ${document.version}.`;
  }

  if (document.type === "user_conditions") {
    return `He leído y acepto las Condiciones de Usuarios, versión ${document.version}, como anexo subordinado a los Términos Generales.`;
  }

  return `He leído la Política de Privacidad de Rapa Go, versión ${document.version}, y consiento el tratamiento de mis datos personales conforme a ella en los casos en que dicho tratamiento requiera mi consentimiento.`;
}

function getAppleLegalHref(type: string): string {
  if (type === "terms_and_conditions") return ROUTES.PUBLIC.TERMS;
  if (type === "user_conditions") return ROUTES.PUBLIC.USER_CONDITIONS;
  return ROUTES.PUBLIC.PRIVACY;
}

const RESIDENCE_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);
const RESIDENCE_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function sanitizeAccreditationName(value: string): string {
  const clean = value
    .replace(/[\\/<>:"'|?*{}()[\];]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 90);
  return clean || "acreditacion-residencia";
}

/**
 * Condición de pasajero -> tarifa de Apple. Reutiliza las mismas tres
 * categorías del formulario de Facebook (chilean/foreigner/resident).
 */
function conditionToApple(
  condition: PassengerCondition,
): ApplePassengerFareType {
  return getPassengerFareType(condition);
}

function appleToCondition(
  fareType: ApplePassengerFareType,
): PassengerCondition {
  if (fareType === "resident") return "residente_rapa_nui";
  if (fareType === "chilean") return "turista_chileno";
  return "turista_extranjero";
}

export function AppleAccountSetupModal({
  isOpen,
  loading,
  documents,
  displayEmail,
  serverError,
  onCancel,
  onConfirm,
}: AppleAccountSetupModalProps): JSX.Element {
  const history = useHistory();
  const [passengerCondition, setPassengerCondition] =
    useState<PassengerCondition>("turista_chileno");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [rut, setRut] = useState("");
  const [passport, setPassport] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const accreditationInputRef = useRef<HTMLInputElement | null>(null);
  const [residenceAccreditation, setResidenceAccreditation] =
    useState<ResidenceAccreditationInput | null>(null);
  const [error, setError] = useState("");

  // Apple solo entrega correo real cuando el usuario autoriza por primera
  // vez esta identidad; en reintentos/relanzamientos puede no llegar. Solo
  // en ese caso el campo queda editable y se pide como correo de contacto.
  const hasAppleEmail = displayEmail.trim().length > 0;

  useEffect(() => {
    if (!isOpen) return;
    setPassengerCondition("turista_chileno");
    setDisplayName("");
    setPhone("");
    setRut("");
    setPassport("");
    setContactEmail("");
    setAccepted({});
    setResidenceAccreditation(null);
    setError("");
    if (accreditationInputRef.current) {
      accreditationInputRef.current.value = "";
    }
  }, [isOpen]);

  const acceptTerms = documents
    .filter((document) => document.type === "terms_and_conditions")
    .every((document) => accepted[document.id] === true) && documents.some(
      (document) => document.type === "terms_and_conditions",
    );
  const acceptPrivacy = documents
    .filter((document) => document.type === "privacy_policy")
    .every((document) => accepted[document.id] === true) && documents.some(
      (document) => document.type === "privacy_policy",
    );
  const acceptUserConditions = documents
    .filter((document) => document.type === "user_conditions")
    .every((document) => accepted[document.id] === true) && documents.some(
      (document) => document.type === "user_conditions",
    );

  function setAcceptedForType(type: string, value: boolean): void {
    setAccepted((current) => {
      const next = { ...current };
      for (const document of documents) {
        if (document.type === type) {
          next[document.id] = value;
        }
      }
      return next;
    });
  }

  async function handleResidenceDocumentChange(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    setError("");
    const safeName = sanitizeAccreditationName(file.name);
    const lowerName = safeName.toLowerCase();
    const inferredType = lowerName.endsWith(".pdf")
      ? "application/pdf"
      : lowerName.endsWith(".png")
        ? "image/png"
        : lowerName.endsWith(".webp")
          ? "image/webp"
          : lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")
            ? "image/jpeg"
            : "";
    const documentType = file.type || inferredType;

    if (!RESIDENCE_MIME_TYPES.has(documentType)) {
      setResidenceAccreditation(null);
      setError("Adjunta un PDF o una imagen JPG, PNG o WEBP.");
      return;
    }

    if (file.size > RESIDENCE_MAX_BYTES) {
      setResidenceAccreditation(null);
      setError("La acreditación debe pesar máximo 1.5 MB.");
      return;
    }

    try {
      setResidenceAccreditation({
        documentName: safeName,
        documentType: documentType as ResidenceAccreditationInput["documentType"],
        documentSize: file.size,
        documentDataUrl: await readFileAsDataUrl(file),
      });
    } catch (fileError) {
      setResidenceAccreditation(null);
      setError(
        fileError instanceof Error
          ? fileError.message
          : "No se pudo leer el archivo.",
      );
    }
  }

  function handleSubmit(): void {
    setError("");

    const needsRut = requiresRutForPassengerCondition(passengerCondition);
    const needsPassport =
      requiresPassportForPassengerCondition(passengerCondition);
    const cleanDisplayName = displayName.trim().replace(/\s+/g, " ");
    const cleanPhone = phone.replace(/[^\d+]/g, "").trim();
    const cleanRut = formatRut(rut);
    const cleanPassport = normalizePassportForAuth(passport);
    const cleanContactEmail = contactEmail.trim().toLowerCase();

    if (cleanDisplayName.length < 2 || cleanDisplayName.length > 100) {
      setError("Ingresa tu nombre y apellido para continuar.");
      return;
    }

    if (!hasAppleEmail && !cleanContactEmail) {
      setError("Correo obligatorio.");
      return;
    }

    if (!hasAppleEmail && !isValidContactEmail(cleanContactEmail)) {
      setError("El correo no es válido.");
      return;
    }

    if (!acceptTerms || !acceptPrivacy || !acceptUserConditions) {
      setError(
        "Debes aceptar Términos y Condiciones, Política de Privacidad y Condiciones para Usuarios antes de continuar con Apple.",
      );
      return;
    }

    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
      setError("Ingresa un celular válido de 8 a 15 dígitos.");
      return;
    }

    if (needsRut && !isValidRut(cleanRut)) {
      setError("El RUT no es válido.");
      return;
    }

    if (needsPassport && !isValidPassportForAuth(cleanPassport)) {
      setError("Ingresa un pasaporte válido. Usa letras y números.");
      return;
    }

    if (passengerCondition === "residente_rapa_nui" && !residenceAccreditation) {
      setError("Debes adjuntar tu acreditación de residencia para continuar.");
      return;
    }

    onConfirm({
      passengerFareType: conditionToApple(passengerCondition),
      acceptedDocumentIds: documents.map((document) => document.id),
      displayName: cleanDisplayName,
      phone: cleanPhone,
      ...(needsRut ? { rut: cleanRut } : {}),
      ...(needsPassport ? { passport: cleanPassport } : {}),
      ...(!hasAppleEmail ? { contactEmail: cleanContactEmail } : {}),
      ...(residenceAccreditation ? { residenceAccreditation } : {}),
    });
  }

  return (
    <PassengerSocialSetupForm
      provider="apple"
      visualVariant="apple-light"
      isOpen={isOpen}
      onClose={onCancel}
      loading={loading}
      error={error || serverError || ""}
      passengerCondition={passengerCondition}
      onPassengerConditionChange={(value) => {
        setPassengerCondition(value);
        setError("");
        if (requiresPassportForPassengerCondition(value)) {
          setRut("");
        } else {
          setPassport("");
        }
        if (appleToCondition(conditionToApple(value)) !== "residente_rapa_nui") {
          setResidenceAccreditation(null);
          if (accreditationInputRef.current) {
            accreditationInputRef.current.value = "";
          }
        }
      }}
      displayName={displayName}
      onDisplayNameChange={(value) => {
        setDisplayName(value);
        setError("");
      }}
      email={hasAppleEmail ? displayEmail : contactEmail}
      {...(hasAppleEmail ? {} : { onEmailChange: setContactEmail })}
      phone={phone}
      onPhoneChange={setPhone}
      rut={rut}
      onRutChange={setRut}
      onRutBlur={() => setRut(formatRut(rut))}
      passport={passport}
      onPassportChange={setPassport}
      residenceDocumentName={residenceAccreditation?.documentName ?? ""}
      onResidenceDocumentChange={(event) => {
        void handleResidenceDocumentChange(event);
      }}
      acceptTerms={acceptTerms}
      onAcceptTermsChange={(value) =>
        setAcceptedForType("terms_and_conditions", value)
      }
      acceptPrivacy={acceptPrivacy}
      onAcceptPrivacyChange={(value) =>
        setAcceptedForType("privacy_policy", value)
      }
      acceptUserConditions={acceptUserConditions}
      onAcceptUserConditionsChange={(value) =>
        setAcceptedForType("user_conditions", value)
      }
      onOpenTerms={() => history.push(ROUTES.PUBLIC.TERMS)}
      onOpenPrivacy={() => history.push(ROUTES.PUBLIC.PRIVACY)}
      onOpenUserConditions={() => history.push(ROUTES.PUBLIC.USER_CONDITIONS)}
      onSubmit={handleSubmit}
    />
  );
}
