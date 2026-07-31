import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useHistory } from "react-router-dom";
import type { LegalDocumentData } from "../legal/legal.service.js";
import type { ResidenceAccreditationInput } from "@rapa-go/shared";
import type { GooglePassengerFareType } from "./auth.types.js";
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

interface GoogleAccountSetupModalProps {
  isOpen: boolean;
  loading: boolean;
  documents: LegalDocumentData[];
  displayEmail: string;
  serverError?: string;
  onCancel: () => void;
  onConfirm: (input: {
    passengerFareType: GooglePassengerFareType;
    acceptedDocumentIds: string[];
    phone: string;
    rut?: string;
    passport?: string;
    residenceAccreditation?: ResidenceAccreditationInput;
  }) => void;
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

export function GoogleAccountSetupModal({
  isOpen,
  loading,
  documents,
  displayEmail,
  serverError,
  onCancel,
  onConfirm,
}: GoogleAccountSetupModalProps): JSX.Element {
  const history = useHistory();
  const [passengerCondition, setPassengerCondition] =
    useState<PassengerCondition>("turista_chileno");
  const [phone, setPhone] = useState("");
  const [rut, setRut] = useState("");
  const [passport, setPassport] = useState("");
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const accreditationInputRef = useRef<HTMLInputElement | null>(null);
  const [residenceAccreditation, setResidenceAccreditation] =
    useState<ResidenceAccreditationInput | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setPassengerCondition("turista_chileno");
    setPhone("");
    setRut("");
    setPassport("");
    setAccepted({});
    setResidenceAccreditation(null);
    setError("");
    if (accreditationInputRef.current) {
      accreditationInputRef.current.value = "";
    }
  }, [isOpen]);

  const isTypeAccepted = (type: string): boolean =>
    documents.some((document) => document.type === type) &&
    documents
      .filter((document) => document.type === type)
      .every((document) => accepted[document.id] === true);

  function setAcceptedForType(type: string, value: boolean): void {
    setAccepted((current) => {
      const next = { ...current };
      for (const document of documents) {
        if (document.type === type) next[document.id] = value;
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
    const cleanPhone = phone.replace(/[^\d+]/g, "").trim();
    const cleanRut = formatRut(rut);
    const cleanPassport = normalizePassportForAuth(passport);

    if (!displayEmail.trim()) {
      setError("Google no entregó un correo verificado. Repite el ingreso.");
      return;
    }

    if (
      !isTypeAccepted("terms_and_conditions") ||
      !isTypeAccepted("privacy_policy") ||
      !isTypeAccepted("user_conditions")
    ) {
      setError(
        "Debes aceptar Términos y Condiciones, Política de Privacidad y Condiciones para Usuarios antes de continuar con Google.",
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
      passengerFareType: getPassengerFareType(passengerCondition),
      acceptedDocumentIds: documents.map((document) => document.id),
      phone: cleanPhone,
      ...(needsRut ? { rut: cleanRut } : {}),
      ...(needsPassport ? { passport: cleanPassport } : {}),
      ...(residenceAccreditation ? { residenceAccreditation } : {}),
    });
  }

  return (
    <PassengerSocialSetupForm
      provider="google"
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
        if (value !== "residente_rapa_nui") {
          setResidenceAccreditation(null);
          if (accreditationInputRef.current) {
            accreditationInputRef.current.value = "";
          }
        }
      }}
      email={displayEmail}
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
      acceptTerms={isTypeAccepted("terms_and_conditions")}
      onAcceptTermsChange={(value) =>
        setAcceptedForType("terms_and_conditions", value)
      }
      acceptPrivacy={isTypeAccepted("privacy_policy")}
      onAcceptPrivacyChange={(value) =>
        setAcceptedForType("privacy_policy", value)
      }
      acceptUserConditions={isTypeAccepted("user_conditions")}
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
