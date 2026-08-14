import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { checkmarkCircleOutline, closeOutline } from "ionicons/icons";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import { useAuth } from "../auth/useAuth.js";
import {
  legalService,
  type LegalDocumentData,
} from "./legal.service.js";

const PASSENGER_REQUIRED_LEGAL_TYPES = [
  "terms_and_conditions",
  "privacy_policy",
  "user_conditions",
] as const;

export function LegalReacceptanceGate(): JSX.Element | null {
  const { session, user } = useAuth();
  const [documents, setDocuments] = useState<LegalDocumentData[]>([]);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [completed, setCompleted] = useState(false);

  const appliesToUser =
    user != null &&
    user.role === "passenger";

  const load = useCallback(async () => {
    if (!session?.accessToken || !appliesToUser) {
      setDocuments([]);
      setAcceptedIds(new Set());
      return;
    }

    setLoading(true);
    setError("");

    try {
      const missing = await legalService.getMissingRequired(
        session.accessToken,
        [...PASSENGER_REQUIRED_LEGAL_TYPES],
      );
      setDocuments(missing);
      setAcceptedIds(new Set());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron comprobar los documentos legales vigentes.",
      );
    } finally {
      setLoading(false);
    }
  }, [appliesToUser, session?.accessToken]);

  useEffect(() => {
    setDismissed(false);
    setCompleted(false);
    void load();
  }, [load]);

  const allAccepted = useMemo(
    () =>
      documents.length > 0 &&
      documents.every((document) => acceptedIds.has(document.id)),
    [acceptedIds, documents],
  );

  async function acceptAll(): Promise<void> {
    if (!session?.accessToken || !allAccepted) return;

    setSaving(true);
    setError("");

    try {
      for (const document of documents) {
        await legalService.accept(
          session.accessToken,
          document.id,
          document.version,
        );
      }

      setCompleted(true);
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "No se pudo registrar la aceptación.",
      );
    } finally {
      setSaving(false);
    }
  }

  function closeNotice(): void {
    setDismissed(true);
  }

  function closeCompleted(): void {
    setCompleted(false);
    setDocuments([]);
    setAcceptedIds(new Set());
    setDismissed(true);
  }

  if (!appliesToUser || !session?.accessToken) return null;

  // El backend sigue siendo la fuente de verdad de las aceptaciones legales.
  // La X solo cierra el aviso visual; nunca registra una aceptación.
  // Si una operación exige una versión vigente, el backend debe mantener
  // su validación aunque el usuario haya cerrado este modal.
  const isOpen =
    !dismissed &&
    (completed || documents.length > 0);

  return (
    <IonModal
      isOpen={isOpen}
      backdropDismiss={false}
      canDismiss={true}
      onDidDismiss={() => setDismissed(true)}
      style={{
        "--width": "min(92vw, 640px)",
        "--height": "min(86vh, 760px)",
        "--border-radius": "22px",
      } as CSSProperties}
    >
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>
            {completed
              ? "Actualización completada"
              : "Documentos y políticas actualizados"}
          </IonTitle>

          <IonButton
            slot="end"
            fill="clear"
            color="light"
            aria-label={
              completed
                ? "Cerrar confirmación"
                : "Cerrar aviso de documentos actualizados"
            }
            onClick={completed ? closeCompleted : closeNotice}
            style={{
              "--padding-start": "10px",
              "--padding-end": "10px",
              marginRight: 6,
            }}
          >
            <IonIcon icon={closeOutline} slot="icon-only" />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {completed ? (
          <div
            style={{
              minHeight: "100%",
              display: "grid",
              placeItems: "center",
            }}
          >
            <section
              style={{
                width: "100%",
                maxWidth: 460,
                textAlign: "center",
                padding: "28px 18px",
              }}
            >
              <IonIcon
                icon={checkmarkCircleOutline}
                color="success"
                style={{ fontSize: 68, marginBottom: 12 }}
              />

              <h2 style={{ margin: "0 0 12px", fontSize: "1.35rem" }}>
                Tus documentos y políticas se actualizaron correctamente
              </h2>

              <p style={{ margin: "0 0 22px", lineHeight: 1.55 }}>
                Tus nuevas aceptaciones quedaron registradas y las versiones
                anteriores permanecen guardadas como historial.
              </p>

              <IonButton
                expand="block"
                color="primary"
                onClick={closeCompleted}
              >
                Continuar
              </IonButton>
            </section>
          </div>
        ) : loading ? (
          <div style={{ textAlign: "center", padding: 30 }}>
            <IonSpinner name="crescent" />
            <p>Comprobando versiones legales vigentes…</p>
          </div>
        ) : (
          <>
            <p style={{ lineHeight: 1.55, marginTop: 4 }}>
              RAPA GO actualizó algunos documentos y políticas. Revisa y acepta
              las versiones vigentes para continuar con las operaciones que las
              requieran. Tus aceptaciones anteriores permanecen guardadas como
              historial.
            </p>

            <IonNote
              style={{
                display: "block",
                margin: "0 0 16px",
                lineHeight: 1.45,
              }}
            >
              Puedes cerrar este aviso con la X. Cerrar la ventana no registra
              una aceptación.
            </IonNote>

            {error && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(220,53,69,.12)",
                  marginBottom: 12,
                }}
              >
                {error}
                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={() => void load()}
                  style={{ marginTop: 10 }}
                >
                  Reintentar
                </IonButton>
              </div>
            )}

            {documents.map((document) => (
              <section
                key={document.id}
                style={{
                  marginBottom: 18,
                  border: "1px solid rgba(128,128,128,.28)",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>
                  {document.title}
                </h2>
                <IonNote>
                  Versión {document.version} · Vigente desde{" "}
                  {document.effectiveDate}
                </IonNote>

                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.55,
                    maxHeight: 260,
                    overflowY: "auto",
                    margin: "14px 0",
                    padding: 12,
                    borderRadius: 10,
                    background: "rgba(128,128,128,.08)",
                  }}
                >
                  {document.content ?? "Documento no disponible."}
                </div>

                <IonItem lines="none">
                  <IonCheckbox
                    slot="start"
                    checked={acceptedIds.has(document.id)}
                    onIonChange={(event) => {
                      setAcceptedIds((current) => {
                        const next = new Set(current);
                        if (event.detail.checked) next.add(document.id);
                        else next.delete(document.id);
                        return next;
                      });
                    }}
                  />
                  <IonLabel className="ion-text-wrap">
                    He leído y acepto esta versión.
                  </IonLabel>
                </IonItem>
              </section>
            ))}

            {documents.length > 0 && (
              <IonButton
                expand="block"
                color="primary"
                disabled={!allAccepted || saving}
                onClick={() => void acceptAll()}
              >
                {saving ? (
                  <IonSpinner name="dots" />
                ) : (
                  "Aceptar documentos y continuar"
                )}
              </IonButton>
            )}
          </>
        )}
      </IonContent>
    </IonModal>
  );
}
