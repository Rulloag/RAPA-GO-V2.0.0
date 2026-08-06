import {
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { alertCircleOutline, checkmarkCircleOutline, logoWhatsapp } from "ionicons/icons";
import { useHistory, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/index.js";
import { ridesService, type DriverRideData, type RideRequestData } from "../../features/rides/rides.service.js";
import {
  supportService,
  type SupportCaseData,
  type SupportCaseDetailData,
  type SupportCategory,
  type SupportPriority,
} from "../../features/support/support.service.js";
import { RapagoSectionHeader } from "../../components/RapagoSectionHeader.js";
import { useRapagoSectionTheme } from "../../theme/rapagoTheme.js";

const SUPPORT_PHONE = "56947964171";
const CATEGORY_LABEL: Record<SupportCategory, string> = {
  support: "Ayuda general",
  complaint: "Reclamo",
  lost_item: "Objeto perdido",
  safety: "Seguridad o emergencia",
  payment: "Pago o devolución",
  identity_correction: "Corrección de datos personales",
  other: "Otro",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Recibido",
  in_review: "En revisión",
  waiting_user: "Esperando tu respuesta",
  resolved: "Resuelto",
  closed: "Cerrado",
  rejected: "Rechazado",
};
const STATUS_COLOR: Record<string, string> = {
  open: "warning",
  in_review: "primary",
  waiting_user: "tertiary",
  resolved: "success",
  closed: "medium",
  rejected: "danger",
};

/* Acento lateral por estado (paleta RAPA GO) */
const STATUS_ACCENT: Record<string, string> = {
  open: "#c89b3c",
  in_review: "#d6a640",
  waiting_user: "#d9c3a0",
  resolved: "#5a8a4a",
  closed: "#8a8577",
  rejected: "#b84f2e",
};

type RideOption = Pick<RideRequestData, "id" | "originText" | "destinationText" | "status" | "completedAt"> | Pick<DriverRideData, "id" | "originText" | "destinationText" | "status" | "completedAt">;

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

export function SupportCenterPage(): JSX.Element {
  const history = useHistory();
  const location = useLocation();
  const { session, user } = useAuth();
  // Solo se lee: el interruptor único vive en el encabezado de Inicio.
  const { theme } = useRapagoSectionTheme("support");

  const handleGoHome = (): void => {
    if (user?.role === "driver") {
      history.replace("/driver/home");
      return;
    }

    if (user?.role === "admin") {
      history.replace("/admin");
      return;
    }

    history.replace("/passenger/home");
  };
  const [cases, setCases] = useState<SupportCaseData[]>([]);
  const [rides, setRides] = useState<RideOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState<SupportCategory>("support");
  const [priority, setPriority] = useState<SupportPriority>("normal");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [rideId, setRideId] = useState("");
  const [phone, setPhone] = useState("");
  const [lostItem, setLostItem] = useState("");
  const [lastSeenAt, setLastSeenAt] = useState("");
  const [detail, setDetail] = useState<SupportCaseDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const completedRides = useMemo(
    () => rides.filter((ride) => ride.status === "completed"),
    [rides],
  );
  const selectableRides = category === "lost_item" ? completedRides : rides;

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [myCases, myRides] = await Promise.all([
        supportService.listMine(session.accessToken),
        user?.role === "driver"
          ? ridesService.listDriverRides(session.accessToken)
          : ridesService.listMyRides(session.accessToken),
      ]);
      setCases(myCases);
      setRides(myRides);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar soporte.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, user?.role]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const requestedCategory = new URLSearchParams(location.search).get("category");
    if (requestedCategory !== "identity_correction") return;

    setCategory("identity_correction");
    setSubject((current) => current || "Solicitud de corrección de datos personales");
    setDescription((current) =>
      current ||
      "Indica qué dato necesitas corregir y el motivo. Administración verificará la solicitud antes de aplicar cualquier cambio.",
    );
  }, [location.search]);


  async function createCase(): Promise<void> {
    if (!session?.accessToken) return;
    if (subject.trim().length < 5 || description.trim().length < 10) {
      setError("Escribe un asunto y una descripción suficientemente claros.");
      return;
    }
    if (category === "lost_item" && (!rideId || !lostItem.trim())) {
      setError("Para objetos perdidos selecciona un viaje completado y describe el objeto.");
      return;
    }
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await supportService.create(session.accessToken, {
        category,
        priority: category === "safety" ? "urgent" : priority,
        subject: subject.trim(),
        description: description.trim(),
        rideRequestId: rideId || null,
        contactPhone: phone.trim() || null,
        contactEmail: user?.email ?? null,
        lostItemDescription: category === "lost_item" ? lostItem.trim() : null,
        lostItemLastSeenAt: category === "lost_item" && lastSeenAt ? new Date(lastSeenAt).toISOString() : null,
      });
      setCases((current) => [created, ...current]);
      setSuccess(`Solicitud creada. Tu folio es ${created.trackingCode}.`);
      setSubject("");
      setDescription("");
      setRideId("");
      setLostItem("");
      setLastSeenAt("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear la solicitud.");
    } finally {
      setCreating(false);
    }
  }

  async function openDetail(caseId: string): Promise<void> {
    if (!session?.accessToken) return;
    setDetailLoading(true);
    setError(null);
    try {
      setDetail(await supportService.getMine(session.accessToken, caseId));
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "No se pudo abrir el caso.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function sendReply(): Promise<void> {
    if (!session?.accessToken || !detail || reply.trim().length < 2) return;
    setSendingReply(true);
    try {
      const updated = await supportService.addMessage(session.accessToken, detail.supportCase.id, reply.trim());
      setDetail(updated);
      setReply("");
      setCases((current) => current.map((item) => item.id === updated.supportCase.id ? updated.supportCase : item));
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "No se pudo enviar la respuesta.");
    } finally {
      setSendingReply(false);
    }
  }

  const whatsappUrl = `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent("Hola RAPA GO, necesito ayuda con mi cuenta o un viaje.")}`;

  return (
    <IonPage
      className="rapago-section-page rapago-support-page"
      data-rapago-theme={theme}
    >
      <RapagoSectionHeader
        title="Centro de ayuda"
      />
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(event) => void load().finally(() => event.detail.complete())}><IonRefresherContent /></IonRefresher>

        <div className="rp-shell">
          <section className="rp-hero rp-hero--surface" aria-label="Soporte RAPA GO">
            <p className="rp-hero__kicker">Centro de ayuda</p>
            <h1 className="rp-hero__title">Soporte RAPA GO</h1>
            <p className="rp-hero__note">
              Crea un reclamo, solicita una corrección de identidad, reporta
              un objeto perdido o revisa el seguimiento administrativo con un folio único.
            </p>
            <IonButton
              className="rp-cta"
              href={whatsappUrl}
              target="_blank"
              color="success"
              expand="block"
              style={{ marginTop: 14 }}
            >
              <IonIcon icon={logoWhatsapp} slot="start" />
              WhatsApp para urgencias
            </IonButton>
          </section>

          {error && (
            <div className="rp-banner rp-banner--error" role="alert">
              <IonIcon icon={alertCircleOutline} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="rp-banner rp-banner--success" role="status">
              <IonIcon icon={checkmarkCircleOutline} />
              <span>{success}</span>
            </div>
          )}

          <h2 className="rapago-section-label">Nueva solicitud</h2>

          <section className="rp-card">
            <IonItem>
              <IonLabel position="stacked">Tipo</IonLabel>
              <IonSelect value={category} onIonChange={(event) => { setCategory(event.detail.value as SupportCategory); setRideId(""); }}>
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => <IonSelectOption key={value} value={value}>{label}</IonSelectOption>)}
              </IonSelect>
            </IonItem>
            <IonItem style={{ marginTop: 10 }}>
              <IonLabel position="stacked">Prioridad</IonLabel>
              <IonSelect value={category === "safety" ? "urgent" : priority} disabled={category === "safety"} onIonChange={(event) => setPriority(event.detail.value as SupportPriority)}>
                <IonSelectOption value="low">Baja</IonSelectOption><IonSelectOption value="normal">Normal</IonSelectOption><IonSelectOption value="high">Alta</IonSelectOption><IonSelectOption value="urgent">Urgente</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem style={{ marginTop: 10 }}>
              <IonLabel position="stacked">Viaje relacionado</IonLabel>
              <IonSelect value={rideId} placeholder="Sin viaje relacionado" onIonChange={(event) => setRideId(String(event.detail.value ?? ""))}>
                <IonSelectOption value="">Sin viaje relacionado</IonSelectOption>
                {selectableRides.map((ride) => <IonSelectOption key={ride.id} value={ride.id}>{ride.originText} → {ride.destinationText} · {ride.status}</IonSelectOption>)}
              </IonSelect>
              <IonNote slot="helper">
                {category === "identity_correction"
                  ? "Las correcciones de identidad no necesitan asociarse a un viaje."
                  : "Objetos perdidos: solo viajes completados."}
              </IonNote>
            </IonItem>
            <IonItem style={{ marginTop: 10 }}>
              <IonLabel position="stacked">Asunto</IonLabel>
              <IonInput value={subject} maxlength={140} onIonInput={(event) => setSubject(String(event.detail.value ?? ""))} />
            </IonItem>
            <IonItem style={{ marginTop: 10 }}>
              <IonLabel position="stacked">Descripción</IonLabel>
              <IonTextarea value={description} maxlength={4000} rows={5} autoGrow onIonInput={(event) => setDescription(String(event.detail.value ?? ""))} />
            </IonItem>
            {category === "lost_item" && <>
              <IonItem style={{ marginTop: 10 }}>
                <IonLabel position="stacked">Objeto perdido</IonLabel>
                <IonInput value={lostItem} maxlength={1500} onIonInput={(event) => setLostItem(String(event.detail.value ?? ""))} />
              </IonItem>
              <IonItem style={{ marginTop: 10 }}>
                <IonLabel position="stacked">Última vez que lo viste</IonLabel>
                <IonInput type="datetime-local" value={lastSeenAt} onIonInput={(event) => setLastSeenAt(String(event.detail.value ?? ""))} />
              </IonItem>
            </>}
            <IonItem style={{ marginTop: 10 }}>
              <IonLabel position="stacked">Celular de contacto (opcional)</IonLabel>
              <IonInput type="tel" value={phone} maxlength={30} onIonInput={(event) => setPhone(String(event.detail.value ?? ""))} />
            </IonItem>
            <IonButton
              className="rp-cta"
              expand="block"
              disabled={creating}
              onClick={() => void createCase()}
              style={{ marginTop: 16 }}
            >
              {creating ? <IonSpinner name="dots" /> : "Enviar a administración"}
            </IonButton>
          </section>

          <h2 className="rapago-section-label">Mis solicitudes</h2>

          {loading ? (
            <div style={{ textAlign: "center", padding: 24 }}><IonSpinner /></div>
          ) : cases.length === 0 ? (
            <div className="rp-empty">
              <p className="rp-empty__body">No tienes solicitudes todavía.</p>
            </div>
          ) : (
            cases.map((item) => (
              <button
                type="button"
                key={item.id}
                className="rp-card rp-card--tap rp-card--accent"
                style={{ "--rp-card-accent": STATUS_ACCENT[item.status] ?? "#c89b3c" } as React.CSSProperties}
                onClick={() => void openDetail(item.id)}
              >
                <div className="rp-card__row">
                  <div className="rp-card__main">
                    <h3 className="rp-card__title">{item.subject}</h3>
                    <p className="rp-card__foot" style={{ marginTop: 5 }}>
                      {item.trackingCode} · {CATEGORY_LABEL[item.category]}
                    </p>
                  </div>
                  <IonBadge color={STATUS_COLOR[item.status] ?? "medium"}>{STATUS_LABEL[item.status] ?? item.status}</IonBadge>
                </div>
                <p className="rp-card__foot">Actualizado: {formatDate(item.updatedAt)}</p>
              </button>
            ))
          )}
        </div>

        <IonModal isOpen={detail !== null || detailLoading} onDidDismiss={() => setDetail(null)}>
          <IonHeader className="rapago-section-header">
            <IonToolbar className="rapago-modal-toolbar">
              <IonTitle className="rapago-section-title">{detail?.supportCase.trackingCode ?? "Cargando caso"}</IonTitle>
              <IonButton slot="end" fill="clear" className="rapago-modal-close" onClick={() => setDetail(null)}>Cerrar</IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="rapago-modal-content">
            <div className="rapago-section-page rapago-modal-body" data-rapago-theme={theme}>
              {detailLoading && !detail ? (
                <div style={{ textAlign: "center", padding: 30 }}><IonSpinner /></div>
              ) : detail && (
                <div className="rp-modal-inner">
                  <article
                    className="rp-card rp-card--accent"
                    style={{ "--rp-card-accent": STATUS_ACCENT[detail.supportCase.status] ?? "#c89b3c" } as React.CSSProperties}
                  >
                    <div className="rp-card__row">
                      <div className="rp-card__main">
                        <h2 className="rp-card__title">{detail.supportCase.subject}</h2>
                      </div>
                      <IonBadge color={STATUS_COLOR[detail.supportCase.status] ?? "medium"}>{STATUS_LABEL[detail.supportCase.status] ?? detail.supportCase.status}</IonBadge>
                    </div>
                    <p className="rp-card__foot" style={{ fontSize: "var(--rp-fs-body)", color: "var(--rp-text)", lineHeight: 1.55 }}>
                      {detail.supportCase.description}
                    </p>
                    {detail.supportCase.adminResolution && (
                      <p className="rp-card__quote">
                        <strong>Resolución:</strong> {detail.supportCase.adminResolution}
                      </p>
                    )}
                  </article>

                  <h3 className="rapago-section-label">Seguimiento</h3>

                  {detail.events.map((event) => (
                    <article className="rp-card" key={event.id}>
                      <p className="rp-card__foot" style={{ marginTop: 0 }}>
                        {formatDate(event.createdAt)} · {event.actorRole}
                      </p>
                      {event.publicMessage && (
                        <p style={{ margin: "8px 0 0", lineHeight: 1.5 }}>{event.publicMessage}</p>
                      )}
                      {event.fromStatus !== event.toStatus && event.toStatus && (
                        <IonBadge
                          color={STATUS_COLOR[event.toStatus] ?? "medium"}
                          style={{ marginTop: 8 }}
                        >
                          {STATUS_LABEL[event.toStatus] ?? event.toStatus}
                        </IonBadge>
                      )}
                    </article>
                  ))}

                  {!["closed", "rejected"].includes(detail.supportCase.status) && (
                    <article className="rp-card">
                      <IonItem>
                        <IonLabel position="stacked">Responder a soporte</IonLabel>
                        <IonTextarea value={reply} rows={4} maxlength={3000} onIonInput={(event) => setReply(String(event.detail.value ?? ""))} />
                      </IonItem>
                      <IonButton
                        className="rp-cta"
                        expand="block"
                        disabled={sendingReply || reply.trim().length < 2}
                        onClick={() => void sendReply()}
                        style={{ marginTop: 12 }}
                      >
                        {sendingReply ? <IonSpinner name="dots" /> : "Enviar respuesta"}
                      </IonButton>
                    </article>
                  )}
                </div>
              )}
            </div>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}

export default SupportCenterPage;
