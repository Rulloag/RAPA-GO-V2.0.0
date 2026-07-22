import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
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
  IonButtons,
} from "@ionic/react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { arrowBackOutline, homeOutline } from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { useAuth } from "../../features/auth/index.js";
import { ridesService, type DriverRideData, type RideRequestData } from "../../features/rides/rides.service.js";
import {
  supportService,
  type SupportCaseData,
  type SupportCaseDetailData,
  type SupportCategory,
  type SupportPriority,
} from "../../features/support/support.service.js";

const SUPPORT_PHONE = "56947964171";
const CATEGORY_LABEL: Record<SupportCategory, string> = {
  support: "Ayuda general",
  complaint: "Reclamo",
  lost_item: "Objeto perdido",
  safety: "Seguridad o emergencia",
  payment: "Pago o devolución",
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

const formItemStyle = {
  "--background": "#ffffff",
  "--border-color": "transparent",
  "--highlight-color-focused": "#c89b3c",
  "--padding-start": "14px",
  "--inner-padding-end": "12px",
  border: "1.5px solid rgba(200,155,60,.30)",
  borderRadius: "14px",
  marginBottom: "10px",
  boxShadow: "0 4px 14px rgba(120,84,20,.06)",
  overflow: "hidden",
} as CSSProperties;

type RideOption = Pick<RideRequestData, "id" | "originText" | "destinationText" | "status" | "completedAt"> | Pick<DriverRideData, "id" | "originText" | "destinationText" | "status" | "completedAt">;

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

export function SupportCenterPage(): JSX.Element {
  const history = useHistory();
  const { session, user } = useAuth();

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
    <IonPage>
      <IonHeader>
        <IonToolbar color="warning">
          <IonButtons slot="start">
            <IonButton
              type="button"
              fill="clear"
              onClick={handleGoHome}
              aria-label="Volver al inicio"
              title="Volver al inicio"
              style={{
                "--color": "#111111",
                fontWeight: 900,
                textTransform: "none",
                marginLeft: 4,
              } as CSSProperties}
            >
              <IonIcon
                slot="start"
                icon={arrowBackOutline}
                style={{ fontSize: 22 }}
              />
              <IonIcon
                icon={homeOutline}
                style={{ fontSize: 20, marginRight: 6 }}
              />
              Inicio
            </IonButton>
          </IonButtons>

          <IonTitle
            style={{
              color: "#111111",
              fontWeight: 950,
              textAlign: "center",
            }}
          >
            Centro de ayuda
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding" style={{ "--background": "linear-gradient(180deg,#fff7e8,#eed5a4)" } as CSSProperties}>
        <IonRefresher slot="fixed" onIonRefresh={(event) => void load().finally(() => event.detail.complete())}><IonRefresherContent /></IonRefresher>
        <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 90 }}>
          <IonCard
            style={{
              borderRadius: 24,
              background: "linear-gradient(135deg,#171717 0%,#241d14 60%,#3a2c12 100%)",
              color: "#fff",
              border: "1px solid rgba(214,166,64,.45)",
              boxShadow: "0 22px 56px rgba(60,40,10,.35)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: "linear-gradient(90deg, transparent, #f8d879 30%, #d6a640 55%, #f8d879 70%, transparent)",
              }}
            />
            <IonCardContent style={{ padding: "22px 20px" }}>
              <p style={{ margin: "0 0 6px", color: "#f8d879", fontWeight: 950, letterSpacing: ".08em", textTransform: "uppercase", fontSize: ".72rem" }}>Centro de ayuda</p>
              <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 950, lineHeight: 1.15 }}>Soporte RAPA GO</h1>
              <p style={{ color: "rgba(255,255,255,.78)", lineHeight: 1.5, margin: "10px 0 16px" }}>Crea un reclamo, reporta un objeto perdido o revisa el seguimiento administrativo con un folio único.</p>
              <IonButton href={whatsappUrl} target="_blank" color="success" expand="block" style={{ "--border-radius": "16px", height: "50px", fontWeight: 900, letterSpacing: ".02em", textTransform: "none" }}>WhatsApp para urgencias</IonButton>
            </IonCardContent>
          </IonCard>

          {error && (
            <div style={{ margin: "14px 0", padding: "12px 14px", borderRadius: 16, background: "rgba(184,79,46,.12)", border: "1.5px solid rgba(184,79,46,.45)", color: "#8a2f18", fontWeight: 850, lineHeight: 1.4 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ margin: "14px 0", padding: "12px 14px", borderRadius: 16, background: "rgba(200,155,60,.16)", border: "1.5px solid rgba(200,155,60,.55)", color: "#6b4f12", fontWeight: 900, lineHeight: 1.4 }}>
              {success}
            </div>
          )}

          <IonCard style={{ borderRadius: 24, border: "1px solid rgba(200,155,60,.35)", boxShadow: "0 18px 46px rgba(120,84,20,.14)" }}>
            <IonCardContent style={{ padding: "22px 20px" }}>
              <h2 style={{ margin: "0 0 14px", fontWeight: 950, display: "flex", alignItems: "center", gap: 10, color: "#1a1a1a" }}>
                <span aria-hidden style={{ width: 20, height: 4, borderRadius: 2, background: "linear-gradient(90deg,#d6a640,#c89b3c)", boxShadow: "0 2px 8px rgba(200,155,60,.40)" }} />
                Nueva solicitud
              </h2>
              <IonItem style={formItemStyle}><IonLabel position="stacked">Tipo</IonLabel><IonSelect value={category} onIonChange={(event) => { setCategory(event.detail.value as SupportCategory); setRideId(""); }}>
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => <IonSelectOption key={value} value={value}>{label}</IonSelectOption>)}
              </IonSelect></IonItem>
              <IonItem style={formItemStyle}><IonLabel position="stacked">Prioridad</IonLabel><IonSelect value={category === "safety" ? "urgent" : priority} disabled={category === "safety"} onIonChange={(event) => setPriority(event.detail.value as SupportPriority)}>
                <IonSelectOption value="low">Baja</IonSelectOption><IonSelectOption value="normal">Normal</IonSelectOption><IonSelectOption value="high">Alta</IonSelectOption><IonSelectOption value="urgent">Urgente</IonSelectOption>
              </IonSelect></IonItem>
              <IonItem style={formItemStyle}><IonLabel position="stacked">Viaje relacionado</IonLabel><IonSelect value={rideId} placeholder="Sin viaje relacionado" onIonChange={(event) => setRideId(String(event.detail.value ?? ""))}>
                <IonSelectOption value="">Sin viaje relacionado</IonSelectOption>
                {selectableRides.map((ride) => <IonSelectOption key={ride.id} value={ride.id}>{ride.originText} → {ride.destinationText} · {ride.status}</IonSelectOption>)}
              </IonSelect><IonNote slot="helper">Objetos perdidos: solo viajes completados.</IonNote></IonItem>
              <IonItem style={formItemStyle}><IonLabel position="stacked">Asunto</IonLabel><IonInput value={subject} maxlength={140} onIonInput={(event) => setSubject(String(event.detail.value ?? ""))} /></IonItem>
              <IonItem style={formItemStyle}><IonLabel position="stacked">Descripción</IonLabel><IonTextarea value={description} maxlength={4000} rows={5} autoGrow onIonInput={(event) => setDescription(String(event.detail.value ?? ""))} /></IonItem>
              {category === "lost_item" && <>
                <IonItem style={formItemStyle}><IonLabel position="stacked">Objeto perdido</IonLabel><IonInput value={lostItem} maxlength={1500} onIonInput={(event) => setLostItem(String(event.detail.value ?? ""))} /></IonItem>
                <IonItem style={formItemStyle}><IonLabel position="stacked">Última vez que lo viste</IonLabel><IonInput type="datetime-local" value={lastSeenAt} onIonInput={(event) => setLastSeenAt(String(event.detail.value ?? ""))} /></IonItem>
              </>}
              <IonItem style={formItemStyle}><IonLabel position="stacked">Celular de contacto (opcional)</IonLabel><IonInput type="tel" value={phone} maxlength={30} onIonInput={(event) => setPhone(String(event.detail.value ?? ""))} /></IonItem>
              <IonButton expand="block" color="warning" disabled={creating} onClick={() => void createCase()} style={{ marginTop: 16, "--border-radius": "16px", height: "52px", fontWeight: 950, letterSpacing: ".02em", textTransform: "none" }}>
                {creating ? <IonSpinner name="dots" /> : "Enviar a administración"}
              </IonButton>
            </IonCardContent>
          </IonCard>

          <h2 style={{ fontWeight: 950, margin: "26px 4px 10px", display: "flex", alignItems: "center", gap: 10, color: "#1a1a1a" }}>
            <span aria-hidden style={{ width: 20, height: 4, borderRadius: 2, background: "linear-gradient(90deg,#d6a640,#c89b3c)", boxShadow: "0 2px 8px rgba(200,155,60,.40)" }} />
            Mis solicitudes
          </h2>
          {loading ? (
            <div style={{ textAlign: "center", padding: 24 }}><IonSpinner /></div>
          ) : cases.length === 0 ? (
            <IonCard style={{ borderRadius: 20, border: "1px dashed rgba(200,155,60,.50)", boxShadow: "none" }}>
              <IonCardContent style={{ textAlign: "center", padding: "26px 18px", color: "#6b5f43", fontWeight: 750 }}>No tienes solicitudes todavía.</IonCardContent>
            </IonCard>
          ) : (
            <IonList style={{ background: "transparent" }}>
              {cases.map((item) => (
                <IonCard
                  key={item.id}
                  button
                  onClick={() => void openDetail(item.id)}
                  style={{
                    borderRadius: 20,
                    border: "1px solid rgba(200,155,60,.28)",
                    borderLeft: `5px solid ${STATUS_ACCENT[item.status] ?? "#c89b3c"}`,
                    boxShadow: "0 12px 30px rgba(120,84,20,.10)",
                    marginInline: 0,
                  }}
                >
                  <IonCardContent style={{ padding: "16px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: ".98rem", lineHeight: 1.3 }}>{item.subject}</strong>
                        <div style={{ fontSize: ".76rem", color: "#8a7a55", marginTop: 5, fontWeight: 750, letterSpacing: ".02em" }}>{item.trackingCode} · {CATEGORY_LABEL[item.category]}</div>
                      </div>
                      <IonBadge color={STATUS_COLOR[item.status] ?? "medium"} style={{ flexShrink: 0, borderRadius: 999, padding: "5px 10px", fontWeight: 850 }}>{STATUS_LABEL[item.status] ?? item.status}</IonBadge>
                    </div>
                    <div style={{ marginTop: 10, fontSize: ".78rem", color: "#6b5f43", fontWeight: 650 }}>Actualizado: {formatDate(item.updatedAt)}</div>
                  </IonCardContent>
                </IonCard>
              ))}
            </IonList>
          )}
        </div>

        <IonModal isOpen={detail !== null || detailLoading} onDidDismiss={() => setDetail(null)}>
          <IonHeader>
            <IonToolbar
              style={{
                "--background": "linear-gradient(135deg,#171717 0%,#241d14 60%,#3a2c12 100%)",
                "--color": "#f6f2ec",
                "border-bottom": "2px solid rgba(214,166,64,.45)",
              } as CSSProperties}
            >
              <IonTitle style={{ fontWeight: 950, letterSpacing: ".02em" }}>{detail?.supportCase.trackingCode ?? "Cargando caso"}</IonTitle>
              <IonButton slot="end" fill="clear" style={{ "--color": "#f8d879", fontWeight: 900, textTransform: "none" } as CSSProperties} onClick={() => setDetail(null)}>Cerrar</IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding" style={{ "--background": "linear-gradient(180deg,#fff7e8,#eed5a4)" } as CSSProperties}>
            {detailLoading && !detail ? <div style={{ textAlign: "center", padding: 30 }}><IonSpinner /></div> : detail && <div style={{ maxWidth: 680, margin: "0 auto" }}>
              <IonCard style={{ borderRadius: 20, border: "1px solid rgba(200,155,60,.35)", borderLeft: `5px solid ${STATUS_ACCENT[detail.supportCase.status] ?? "#c89b3c"}`, boxShadow: "0 14px 36px rgba(120,84,20,.12)" }}>
                <IonCardContent>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}><h2 style={{ margin: 0, fontWeight: 950, lineHeight: 1.25 }}>{detail.supportCase.subject}</h2><IonBadge color={STATUS_COLOR[detail.supportCase.status] ?? "medium"} style={{ flexShrink: 0, borderRadius: 999, padding: "5px 10px", fontWeight: 850 }}>{STATUS_LABEL[detail.supportCase.status] ?? detail.supportCase.status}</IonBadge></div>
                  <p style={{ lineHeight: 1.55 }}>{detail.supportCase.description}</p>
                  {detail.supportCase.adminResolution && <p style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(200,155,60,.14)", border: "1px solid rgba(200,155,60,.40)" }}><strong>Resolución:</strong> {detail.supportCase.adminResolution}</p>}
                </IonCardContent>
              </IonCard>
              <h3 style={{ fontWeight: 950, display: "flex", alignItems: "center", gap: 10, margin: "20px 4px 10px" }}>
                <span aria-hidden style={{ width: 18, height: 4, borderRadius: 2, background: "linear-gradient(90deg,#d6a640,#c89b3c)" }} />
                Seguimiento
              </h3>
              {detail.events.map((event) => <IonCard key={event.id} style={{ borderRadius: 16, border: "1px solid rgba(200,155,60,.24)", boxShadow: "0 8px 22px rgba(120,84,20,.08)" }}><IonCardContent style={{ padding: "14px 16px" }}><div style={{ fontSize: ".76rem", color: "#8a7a55", fontWeight: 750, letterSpacing: ".02em" }}>{formatDate(event.createdAt)} · {event.actorRole}</div>{event.publicMessage && <p style={{ marginBottom: 0, lineHeight: 1.5 }}>{event.publicMessage}</p>}{event.fromStatus !== event.toStatus && event.toStatus && <IonBadge color={STATUS_COLOR[event.toStatus] ?? "medium"} style={{ borderRadius: 999, padding: "4px 10px", fontWeight: 850 }}>{STATUS_LABEL[event.toStatus] ?? event.toStatus}</IonBadge>}</IonCardContent></IonCard>)}
              {!['closed','rejected'].includes(detail.supportCase.status) && <IonCard style={{ borderRadius: 20, border: "1px solid rgba(200,155,60,.35)", boxShadow: "0 14px 36px rgba(120,84,20,.12)" }}><IonCardContent><IonItem style={formItemStyle}><IonLabel position="stacked">Responder a soporte</IonLabel><IonTextarea value={reply} rows={4} maxlength={3000} onIonInput={(event) => setReply(String(event.detail.value ?? ""))} /></IonItem><IonButton expand="block" color="warning" disabled={sendingReply || reply.trim().length < 2} onClick={() => void sendReply()} style={{ "--border-radius": "16px", height: "48px", fontWeight: 950, letterSpacing: ".02em", textTransform: "none" }}>{sendingReply ? <IonSpinner name="dots" /> : "Enviar respuesta"}</IonButton></IonCardContent></IonCard>}
            </div>}
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}

export default SupportCenterPage;