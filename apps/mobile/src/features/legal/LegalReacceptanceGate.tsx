import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

      await load();
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

  if (!appliesToUser || !session?.accessToken) return null;

  // No bloqueamos toda la aplicación por una caída temporal de red.
  // El modal solo se abre cuando el backend confirmó que faltan
  // aceptaciones de documentos actualmente vigentes.
  const isOpen = documents.length > 0;

  return (
    <IonModal
      isOpen={isOpen}
      backdropDismiss={false}
      canDismiss={false}
    >
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Documentos actualizados</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {loading ? (
          <div style={{ textAlign: "center", padding: 30 }}>
            <IonSpinner name="crescent" />
            <p>Comprobando versiones legales vigentes…</p>
          </div>
        ) : (
          <>
            <p>
              RAPA GO actualizó documentos relevantes. Para continuar con
              operaciones que los requieren, revisa y acepta las versiones
              vigentes. Tus aceptaciones anteriores permanecen guardadas como
              historial.
            </p>

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
