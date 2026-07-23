import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
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
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import type { LegalDocumentData } from "../legal/legal.service.js";
import type { ResidenceAccreditationInput } from "@rapa-go/shared";
import type { ApplePassengerFareType } from "./auth.types.js";

interface AppleAccountSetupModalProps {
  isOpen: boolean;
  loading: boolean;
  documents: LegalDocumentData[];
  onCancel: () => void;
  onConfirm: (input: {
    passengerFareType: ApplePassengerFareType;
    acceptedDocumentIds: string[];
    phone: string;
    residenceAccreditation?: ResidenceAccreditationInput;
  }) => void;
}

const FARE_LABELS: Record<ApplePassengerFareType, string> = {
  chilean: "Turista chileno",
  foreigner: "Turista extranjero",
  resident: "RAPA NUI / RESIDENTE RAPA NUI",
};

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

export function AppleAccountSetupModal({
  isOpen,
  loading,
  documents,
  onCancel,
  onConfirm,
}: AppleAccountSetupModalProps): JSX.Element {
  const [fareType, setFareType] =
    useState<ApplePassengerFareType>("chilean");
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const accreditationInputRef = useRef<HTMLInputElement | null>(null);
  const [residenceAccreditation, setResidenceAccreditation] =
    useState<ResidenceAccreditationInput | null>(null);
  const [accreditationError, setAccreditationError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setFareType("chilean");
    setAccepted({});
    setPhone("");
    setPhoneTouched(false);
    setResidenceAccreditation(null);
    setAccreditationError("");
    if (accreditationInputRef.current) {
      accreditationInputRef.current.value = "";
    }
  }, [isOpen]);

  const normalizedPhone = phone
    .replace(/[^\d+]/g, "")
    .trim();
  const phoneIsValid =
    normalizedPhone.length >= 8 &&
    normalizedPhone.length <= 15;

  const allAccepted = useMemo(
    () =>
      documents.length >= 3 &&
      documents.every((document) => accepted[document.id] === true),
    [accepted, documents],
  );

  async function handleAccreditationChange(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    setAccreditationError("");
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
      setAccreditationError("Adjunta un PDF o una imagen JPG, PNG o WEBP.");
      return;
    }

    if (file.size > RESIDENCE_MAX_BYTES) {
      setResidenceAccreditation(null);
      setAccreditationError("La acreditación debe pesar máximo 1.5 MB.");
      return;
    }

    try {
      setResidenceAccreditation({
        documentName: safeName,
        documentType: documentType as ResidenceAccreditationInput["documentType"],
        documentSize: file.size,
        documentDataUrl: await readFileAsDataUrl(file),
      });
    } catch (error) {
      setResidenceAccreditation(null);
      setAccreditationError(
        error instanceof Error ? error.message : "No se pudo leer el archivo.",
      );
    }
  }

  const residentAccreditationReady =
    fareType !== "resident" || residenceAccreditation !== null;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onCancel}>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Completar cuenta con Apple</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <p style={{ fontWeight: 750 }}>
          Apple confirmó tu identidad. Para crear tu cuenta de pasajero,
          selecciona la tarifa y acepta los documentos vigentes.
        </p>

        <IonItem>
          <IonLabel position="stacked">Número de celular</IonLabel>
          <IonInput
            value={phone}
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            placeholder="+56 9 1234 5678"
            disabled={loading}
            onIonInput={(event) => {
              setPhone(String(event.detail.value ?? ""));
            }}
            onIonBlur={() => setPhoneTouched(true)}
          />
          {phoneTouched && !phoneIsValid && (
            <IonNote slot="error" color="danger">
              Ingresa un celular válido de 8 a 15 dígitos.
            </IonNote>
          )}
          <IonNote slot="helper">
            Apple no entrega el número de teléfono. Rapa Go lo solicita una sola
            vez para viajes, contacto y seguridad.
          </IonNote>
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Tipo de pasajero</IonLabel>
          <IonSelect
            value={fareType}
            disabled={loading}
            onIonChange={(event) =>
              setFareType(event.detail.value as ApplePassengerFareType)
            }
          >
            {(Object.keys(FARE_LABELS) as ApplePassengerFareType[]).map(
              (value) => (
                <IonSelectOption key={value} value={value}>
                  {FARE_LABELS[value]}
                </IonSelectOption>
              ),
            )}
          </IonSelect>
        </IonItem>

        {fareType === "resident" && (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 16,
              border: "1px dashed rgba(200,155,60,.72)",
            }}
          >
            <strong>ACREDITACIÓN RESIDENCIA *</strong>
            <IonNote
              style={{ display: "block", margin: "6px 0 10px" }}
            >
              Si eres Rapanui, adjunta una fotografía clara de tu cédula de
              identidad. Si eres residente, adjunta tu resolución de residencia
              vigente emitida por la Delegación Presidencial Provincial de Isla
              de Pascua. Se acepta PDF, JPG, JPEG, PNG o WEBP.
            </IonNote>

            <input
              ref={accreditationInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
              hidden
              disabled={loading}
              onChange={(event) => void handleAccreditationChange(event)}
            />

            <IonButton
              type="button"
              expand="block"
              fill="outline"
              disabled={loading}
              onClick={() => accreditationInputRef.current?.click()}
            >
              {residenceAccreditation
                ? "Cambiar acreditación"
                : "Adjuntar acreditación"}
            </IonButton>

            {residenceAccreditation && (
              <IonNote color="success">
                Acreditación adjunta: {residenceAccreditation.documentName}
              </IonNote>
            )}

            {accreditationError && (
              <IonNote color="danger">{accreditationError}</IonNote>
            )}
          </div>
        )}

        <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
          {documents.map((document) => (
            <IonItem key={document.id} lines="full">
              <IonCheckbox
                slot="start"
                checked={accepted[document.id] === true}
                disabled={loading}
                onIonChange={(event) =>
                  setAccepted((current) => ({
                    ...current,
                    [document.id]: event.detail.checked,
                  }))
                }
              />
              <IonLabel className="ion-text-wrap">
                <strong>{document.title}</strong>
                <p>Versión {document.version}</p>
                <a
                  href={`/legal/${encodeURIComponent(document.type)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Leer documento
                </a>
              </IonLabel>
            </IonItem>
          ))}
        </div>

        <IonButton
          expand="block"
          disabled={
            !allAccepted ||
            !phoneIsValid ||
            !residentAccreditationReady ||
            loading
          }
          onClick={() =>
            onConfirm({
              passengerFareType: fareType,
              acceptedDocumentIds: documents.map((document) => document.id),
              phone: normalizedPhone,
              ...(residenceAccreditation
                ? { residenceAccreditation }
                : {}),
            })
          }
          style={{ marginTop: 20, fontWeight: 900 }}
        >
          {loading ? <IonSpinner name="crescent" /> : "Crear cuenta y continuar"}
        </IonButton>

        <IonButton
          expand="block"
          fill="clear"
          disabled={loading}
          onClick={onCancel}
        >
          Cancelar
        </IonButton>
      </IonContent>
    </IonModal>
  );
}
