import { useEffect, useMemo, useState } from "react";
import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonHeader,
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
import type { ApplePassengerFareType } from "./auth.types.js";

interface AppleAccountSetupModalProps {
  isOpen: boolean;
  loading: boolean;
  documents: LegalDocumentData[];
  onCancel: () => void;
  onConfirm: (input: {
    passengerFareType: ApplePassengerFareType;
    acceptedDocumentIds: string[];
  }) => void;
}

const FARE_LABELS: Record<ApplePassengerFareType, string> = {
  chilean: "Turista chileno",
  foreigner: "Turista extranjero",
  resident: "Residente Rapa Nui",
};

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

  useEffect(() => {
    if (!isOpen) return;
    setFareType("chilean");
    setAccepted({});
  }, [isOpen]);

  const allAccepted = useMemo(
    () =>
      documents.length >= 3 &&
      documents.every((document) => accepted[document.id] === true),
    [accepted, documents],
  );

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
          <IonNote color="warning">
            La cuenta quedará activa con tarifa Turista chileno hasta que el
            administrador apruebe el documento de residencia.
          </IonNote>
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
          disabled={!allAccepted || loading}
          onClick={() =>
            onConfirm({
              passengerFareType: fareType,
              acceptedDocumentIds: documents.map((document) => document.id),
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
