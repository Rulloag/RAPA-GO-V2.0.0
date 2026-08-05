import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCheckbox,
  IonIcon,
  IonLabel,
  IonNote,
  IonSpinner,
} from "@ionic/react";
import {
  checkmarkCircleOutline,
  documentTextOutline,
  helpCircleOutline,
  lockClosedOutline,
  refreshOutline,
  shieldCheckmarkOutline,
  trashOutline,
} from "ionicons/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";

import {
  legalService,
  type LegalDocumentData,
  type UserAcceptanceData,
} from "../../features/legal/legal.service.js";
import { ROUTES } from "../../navigation/routes.js";

type LegalAndHelpCardProps = {
  token: string | null;
  language?: "es" | "en";
};

const REQUIRED_TYPES = [
  "terms_and_conditions",
  "user_conditions",
  "privacy_policy",
] as const;

const DOCUMENT_LABEL: Record<string, { es: string; en: string }> = {
  terms_and_conditions: {
    es: "Términos Generales",
    en: "General Terms",
  },
  user_conditions: {
    es: "Condiciones de Usuarios",
    en: "User Conditions",
  },
  privacy_policy: {
    es: "Política de Privacidad",
    en: "Privacy Policy",
  },
};

function routeForDocument(type: string): string {
  if (type === "terms_and_conditions") {
    return ROUTES.PUBLIC.TERMS;
  }

  if (type === "user_conditions") {
    return ROUTES.PUBLIC.USER_CONDITIONS;
  }

  return ROUTES.PUBLIC.PRIVACY;
}

export function LegalAndHelpCard({
  token,
  language = "es",
}: LegalAndHelpCardProps): JSX.Element {
  const history = useHistory();
  const location = useLocation();
  const cardRef = useRef<HTMLIonCardElement>(null);
  /** Evita repetir el salto si la lista de pendientes cambia luego. */
  const attentionFiredRef = useRef(false);
  const [attentionRequested, setAttentionRequested] = useState(false);
  const [attention, setAttention] = useState(false);
  const [documents, setDocuments] = useState<LegalDocumentData[]>([]);
  const [acceptances, setAcceptances] = useState<UserAcceptanceData[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const copy =
    language === "en"
      ? {
          title: "Help and legal",
          subtitle:
            "Review the current documents, support channels, EULA, and account deletion.",
          current: "Your legal documents are up to date.",
          pending:
            "A newer legal version requires your explicit acceptance.",
          accept: "Accept selected documents",
          retry: "Reload legal status",
          eula: "EULA",
          support: "Support",
          deleteAccount: "Delete account",
          open: "Open",
          accepted: "Accepted",
          version: "Version",
          selectAll: "Select all pending documents",
          saving: "Saving acceptance…",
          rideBlocked:
            "To request your ride you must accept every legal document listed below.",
        }
      : {
          title: "Ayuda y legal",
          subtitle:
            "Consulta documentos vigentes, soporte, EULA y eliminación de cuenta.",
          current: "Tus documentos legales están al día.",
          pending:
            "Existe una versión legal nueva que requiere aceptación expresa.",
          accept: "Aceptar documentos seleccionados",
          retry: "Recargar estado legal",
          eula: "EULA",
          support: "Soporte",
          deleteAccount: "Eliminar cuenta",
          open: "Abrir",
          accepted: "Aceptado",
          version: "Versión",
          selectAll: "Seleccionar todos los documentos pendientes",
          saving: "Guardando aceptación…",
          rideBlocked:
            "Para solicitar tu viaje debes aceptar todos los documentos legales que aparecen aquí abajo.",
        };

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const active = await legalService.getActive();
      const required = REQUIRED_TYPES.map((type) =>
        active.find(
          (document) =>
            document.type === type &&
            document.isActive,
        ),
      ).filter(
        (document): document is LegalDocumentData =>
          Boolean(document),
      );

      setDocuments(required);

      if (!token) {
        setAcceptances([]);
        return;
      }

      setAcceptances(
        await legalService.getMyAcceptances(token),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible consultar los documentos legales.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const acceptedKeys = useMemo(
    () =>
      new Set(
        acceptances.map(
          (acceptance) =>
            `${acceptance.legalDocumentId}:${acceptance.versionAccepted}`,
        ),
      ),
    [acceptances],
  );

  const pendingDocuments = useMemo(
    () =>
      documents.filter(
        (document) =>
          !acceptedKeys.has(
            `${document.id}:${document.version}`,
          ),
      ),
    [acceptedKeys, documents],
  );

  useEffect(() => {
    setSelected((current) => {
      const next: Record<string, boolean> = {};

      for (const document of pendingDocuments) {
        next[document.id] =
          current[document.id] === true;
      }

      return next;
    });
  }, [pendingDocuments]);

  // Solicitar un viaje sin aceptar la legal vigente redirige aquí con
  // ?legal=required. Guardamos la señal y limpiamos la URL para que un
  // refresco no vuelva a disparar el salto.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("legal") !== "required") return;

    setAttentionRequested(true);
    params.delete("legal");
    const rest = params.toString();
    history.replace(
      rest ? `${location.pathname}?${rest}` : location.pathname,
    );
  }, [history, location.pathname, location.search]);

  // Una vez cargado el estado legal, llevamos la vista a la tarjeta y la
  // hacemos saltar para que el pendiente no pase desapercibido.
  useEffect(() => {
    if (!attentionRequested || loading) return;
    if (pendingDocuments.length === 0) return;
    if (attentionFiredRef.current) return;

    attentionFiredRef.current = true;
    setAttention(true);

    const scrollTimer = window.setTimeout(() => {
      cardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);

    const stopTimer = window.setTimeout(
      () => setAttention(false),
      2600,
    );

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(stopTimer);
    };
  }, [attentionRequested, loading, pendingDocuments.length]);

  const rideBlocked =
    attentionRequested && !loading && pendingDocuments.length > 0;

  const allPendingSelected =
    pendingDocuments.length > 0 &&
    pendingDocuments.every(
      (document) => selected[document.id] === true,
    );

  async function acceptSelected(): Promise<void> {
    if (!token || saving) return;

    const toAccept = pendingDocuments.filter(
      (document) => selected[document.id] === true,
    );

    if (toAccept.length === 0) {
      setError(
        language === "en"
          ? "Select each document after opening and reading it."
          : "Selecciona cada documento después de abrirlo y leerlo.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      for (const document of toAccept) {
        await legalService.accept(
          token,
          document.id,
          document.version,
        );
      }

      setMessage(
        language === "en"
          ? "Your acceptance was recorded with the current versions."
          : "La aceptación quedó registrada con las versiones vigentes.",
      );
      await load();
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "No fue posible registrar la aceptación.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <IonCard
      ref={cardRef}
      className={
        "rapago-profile-card rapago-profile-legal-card" +
        (attention ? " rapago-profile-legal-card--attention" : "")
      }
    >
      <IonCardContent>
        <div className="rapago-profile-card-head">
          <span className="rapago-profile-card-icon">
            <IonIcon icon={shieldCheckmarkOutline} />
          </span>

          <div>
            <h2 className="rapago-profile-card-title">
              {copy.title}
            </h2>
            <p className="rapago-profile-card-sub">
              {copy.subtitle}
            </p>
          </div>
        </div>

        {rideBlocked && (
          <div
            className="rapago-profile-legal-blocked"
            role="alert"
          >
            <IonIcon icon={documentTextOutline} />
            <span>{copy.rideBlocked}</span>
          </div>
        )}

        <div className="rapago-profile-legal-links">
          {documents.map((document) => {
            const accepted = acceptedKeys.has(
              `${document.id}:${document.version}`,
            );

            return (
              <button
                key={document.id}
                type="button"
                className="rapago-profile-legal-link"
                onClick={() =>
                  history.push(
                    routeForDocument(document.type),
                  )
                }
              >
                <span className="rapago-profile-legal-link-icon">
                  <IonIcon
                    icon={
                      accepted
                        ? checkmarkCircleOutline
                        : documentTextOutline
                    }
                  />
                </span>

                <span>
                  <strong>
                    {DOCUMENT_LABEL[document.type]?.[language] ??
                      document.title}
                  </strong>
                  <small>
                    {copy.version} {document.version}
                    {accepted ? ` · ${copy.accepted}` : ""}
                  </small>
                </span>

                <span className="rapago-profile-legal-open">
                  {copy.open}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            className="rapago-profile-legal-link"
            onClick={() =>
              history.push(ROUTES.PUBLIC.EULA)
            }
          >
            <span className="rapago-profile-legal-link-icon">
              <IonIcon icon={lockClosedOutline} />
            </span>
            <span>
              <strong>{copy.eula}</strong>
              <small>Apple Standard EULA</small>
            </span>
            <span className="rapago-profile-legal-open">
              {copy.open}
            </span>
          </button>

          <button
            type="button"
            className="rapago-profile-legal-link"
            onClick={() =>
              history.push(ROUTES.PUBLIC.SUPPORT)
            }
          >
            <span className="rapago-profile-legal-link-icon">
              <IonIcon icon={helpCircleOutline} />
            </span>
            <span>
              <strong>{copy.support}</strong>
              <small>Centro de Ayuda RAPA GO</small>
            </span>
            <span className="rapago-profile-legal-open">
              {copy.open}
            </span>
          </button>

          <button
            type="button"
            className="rapago-profile-legal-link rapago-profile-legal-link--danger"
            onClick={() =>
              history.push(ROUTES.PUBLIC.DELETE_ACCOUNT)
            }
          >
            <span className="rapago-profile-legal-link-icon">
              <IonIcon icon={trashOutline} />
            </span>
            <span>
              <strong>{copy.deleteAccount}</strong>
              <small>Solicitud y seguimiento</small>
            </span>
            <span className="rapago-profile-legal-open">
              {copy.open}
            </span>
          </button>
        </div>

        {loading ? (
          <div className="rapago-profile-legal-status">
            <IonSpinner name="crescent" />
            <IonNote>
              {language === "en"
                ? "Checking legal versions…"
                : "Comprobando versiones legales…"}
            </IonNote>
          </div>
        ) : pendingDocuments.length === 0 ? (
          <div className="rapago-profile-legal-ok">
            <IonIcon icon={checkmarkCircleOutline} />
            {copy.current}
          </div>
        ) : token ? (
          <div className="rapago-profile-legal-pending">
            <strong>{copy.pending}</strong>

            <label className="rapago-profile-legal-select-all">
              <IonCheckbox
                checked={allPendingSelected}
                onIonChange={(event) => {
                  const checked = event.detail.checked;
                  setSelected(
                    Object.fromEntries(
                      pendingDocuments.map(
                        (document) => [
                          document.id,
                          checked,
                        ],
                      ),
                    ),
                  );
                }}
              />
              <span>{copy.selectAll}</span>
            </label>

            {pendingDocuments.map((document) => (
              <label
                key={document.id}
                className="rapago-profile-legal-consent"
              >
                <IonCheckbox
                  checked={
                    selected[document.id] === true
                  }
                  onIonChange={(event) =>
                    setSelected((current) => ({
                      ...current,
                      [document.id]:
                        event.detail.checked,
                    }))
                  }
                />

                <IonLabel>
                  {DOCUMENT_LABEL[document.type]?.[
                    language
                  ] ?? document.title}
                  <small>
                    {copy.version} {document.version}
                  </small>
                </IonLabel>
              </label>
            ))}

            <IonButton
              expand="block"
              className="rapago-profile-btn-primary"
              disabled={
                saving ||
                !pendingDocuments.some(
                  (document) =>
                    selected[document.id] === true,
                )
              }
              onClick={() => void acceptSelected()}
            >
              {saving ? (
                <>
                  <IonSpinner
                    name="crescent"
                    style={{ marginRight: 8 }}
                  />
                  {copy.saving}
                </>
              ) : (
                copy.accept
              )}
            </IonButton>
          </div>
        ) : null}

        {error && (
          <div className="rapago-profile-feedback rapago-profile-feedback--error">
            {error}
            <IonButton
              size="small"
              fill="clear"
              onClick={() => void load()}
            >
              <IonIcon icon={refreshOutline} slot="start" />
              {copy.retry}
            </IonButton>
          </div>
        )}

        {message && (
          <div className="rapago-profile-feedback rapago-profile-feedback--success">
            <IonIcon icon={checkmarkCircleOutline} />
            {message}
          </div>
        )}
      </IonCardContent>
    </IonCard>
  );
}
