import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../features/auth/index.js";
import {
  supportService,
  type SupportCaseData,
  type SupportCaseDetailData,
  type SupportPriority,
  type SupportStatus,
} from "../../../features/support/support.service.js";

const STATUS_LABEL: Record<string, string> = { open: "Recibido", in_review: "En revisión", waiting_user: "Esperando usuario", resolved: "Resuelto", closed: "Cerrado", rejected: "Rechazado" };
const STATUS_COLOR: Record<string, string> = { open: "warning", in_review: "primary", waiting_user: "tertiary", resolved: "success", closed: "medium", rejected: "danger" };
const CATEGORY_LABEL: Record<string, string> = { support: "Ayuda", complaint: "Reclamo", lost_item: "Objeto perdido", safety: "Seguridad", payment: "Pago", other: "Otro" };

function formatDate(value: string | null | undefined): string { return value ? new Date(value).toLocaleString("es-CL") : "—"; }

export function AdminSupportPage(): JSX.Element {
  const { session } = useAuth();
  const [items, setItems] = useState<SupportCaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<SupportCaseDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [status, setStatus] = useState<SupportStatus>("in_review");
  const [priority, setPriority] = useState<SupportPriority>("normal");
  const [publicMessage, setPublicMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true); setError(null);
    try {
      setItems(await supportService.listAdmin(session.accessToken, { status: statusFilter || undefined, category: categoryFilter || undefined, search: search.trim() || undefined }));
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los casos."); }
    finally { setLoading(false); }
  }, [session?.accessToken, statusFilter, categoryFilter, search]);

  useEffect(() => { void load(); }, [load]);

  async function openCase(id: string): Promise<void> {
    if (!session?.accessToken) return;
    setDetailLoading(true); setError(null);
    try {
      const next = await supportService.getAdmin(session.accessToken, id);
      setDetail(next); setStatus(next.supportCase.status); setPriority(next.supportCase.priority); setResolution(next.supportCase.adminResolution ?? ""); setPublicMessage(""); setInternalNote("");
    } catch (detailError) { setError(detailError instanceof Error ? detailError.message : "No se pudo abrir el caso."); }
    finally { setDetailLoading(false); }
  }

  async function save(): Promise<void> {
    if (!session?.accessToken || !detail) return;
    setSaving(true); setError(null);
    try {
      const updated = await supportService.updateAdmin(session.accessToken, detail.supportCase.id, {
        status,
        priority,
        assignToMe: true,
        ...(publicMessage.trim() ? { publicMessage: publicMessage.trim() } : {}),
        ...(internalNote.trim() ? { internalNote: internalNote.trim() } : {}),
        ...(resolution.trim() ? { resolution: resolution.trim() } : {}),
      });
      setDetail(updated); setPublicMessage(""); setInternalNote("");
      setItems((current) => current.map((item) => item.id === updated.supportCase.id ? updated.supportCase : item));
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar el caso."); }
    finally { setSaving(false); }
  }

  return <IonPage><IonHeader><IonToolbar color="dark"><IonTitle>Soporte y reclamos</IonTitle></IonToolbar></IonHeader><IonContent className="ion-padding">
    <IonRefresher slot="fixed" onIonRefresh={(event) => void load().finally(() => event.detail.complete())}><IonRefresherContent /></IonRefresher>
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 80 }}>
      <IonCard><IonCardContent><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
        <IonItem><IonLabel position="stacked">Estado</IonLabel><IonSelect value={statusFilter} onIonChange={(event) => setStatusFilter(String(event.detail.value ?? ""))}><IonSelectOption value="">Todos</IonSelectOption>{Object.entries(STATUS_LABEL).map(([value,label]) => <IonSelectOption key={value} value={value}>{label}</IonSelectOption>)}</IonSelect></IonItem>
        <IonItem><IonLabel position="stacked">Categoría</IonLabel><IonSelect value={categoryFilter} onIonChange={(event) => setCategoryFilter(String(event.detail.value ?? ""))}><IonSelectOption value="">Todas</IonSelectOption>{Object.entries(CATEGORY_LABEL).map(([value,label]) => <IonSelectOption key={value} value={value}>{label}</IonSelectOption>)}</IonSelect></IonItem>
        <IonItem><IonLabel position="stacked">Buscar folio, usuario o asunto</IonLabel><IonInput value={search} onIonInput={(event) => setSearch(String(event.detail.value ?? ""))} /></IonItem>
      </div><IonButton expand="block" onClick={() => void load()}>Actualizar</IonButton></IonCardContent></IonCard>
      {error && <IonText color="danger"><p>{error}</p></IonText>}
      {loading ? <div style={{ textAlign: "center", padding: 30 }}><IonSpinner /></div> : <IonList>{items.map((item) => <IonCard key={item.id} button onClick={() => void openCase(item.id)}><IonCardContent><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><div><strong>{item.trackingCode} · {item.subject}</strong><div style={{ marginTop: 4, color: "#6b7280", fontSize: ".78rem" }}>{item.requesterName ?? item.requesterEmail} · {CATEGORY_LABEL[item.category] ?? item.category} · {formatDate(item.updatedAt)}</div></div><div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}><IonBadge color={STATUS_COLOR[item.status] ?? "medium"}>{STATUS_LABEL[item.status] ?? item.status}</IonBadge><IonBadge color={item.priority === "urgent" ? "danger" : item.priority === "high" ? "warning" : "medium"}>{item.priority}</IonBadge></div></div></IonCardContent></IonCard>)}</IonList>}
    </div>
    <IonModal isOpen={detail !== null || detailLoading} onDidDismiss={() => setDetail(null)}><IonHeader><IonToolbar color="dark"><IonTitle>{detail?.supportCase.trackingCode ?? "Cargando"}</IonTitle><IonButton slot="end" fill="clear" color="light" onClick={() => setDetail(null)}>Cerrar</IonButton></IonToolbar></IonHeader><IonContent className="ion-padding">
      {detailLoading && !detail ? <div style={{ textAlign: "center", padding: 30 }}><IonSpinner /></div> : detail && <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <IonCard><IonCardContent><h2>{detail.supportCase.subject}</h2><p>{detail.supportCase.description}</p><div><strong>Solicitante:</strong> {detail.supportCase.requesterName} · {detail.supportCase.requesterEmail}</div><div><strong>Viaje:</strong> {detail.supportCase.rideRequestId ?? "No asociado"}</div>{detail.supportCase.lostItemDescription && <div><strong>Objeto:</strong> {detail.supportCase.lostItemDescription}</div>}</IonCardContent></IonCard>
        <IonCard><IonCardContent><h3>Gestión administrativa</h3><IonItem><IonLabel position="stacked">Estado</IonLabel><IonSelect value={status} onIonChange={(event) => setStatus(event.detail.value as SupportStatus)}>{Object.entries(STATUS_LABEL).map(([value,label]) => <IonSelectOption key={value} value={value}>{label}</IonSelectOption>)}</IonSelect></IonItem><IonItem><IonLabel position="stacked">Prioridad</IonLabel><IonSelect value={priority} onIonChange={(event) => setPriority(event.detail.value as SupportPriority)}><IonSelectOption value="low">Baja</IonSelectOption><IonSelectOption value="normal">Normal</IonSelectOption><IonSelectOption value="high">Alta</IonSelectOption><IonSelectOption value="urgent">Urgente</IonSelectOption></IonSelect></IonItem><IonItem><IonLabel position="stacked">Mensaje visible para el usuario</IonLabel><IonTextarea rows={3} value={publicMessage} onIonInput={(event) => setPublicMessage(String(event.detail.value ?? ""))} /></IonItem><IonItem><IonLabel position="stacked">Nota interna</IonLabel><IonTextarea rows={3} value={internalNote} onIonInput={(event) => setInternalNote(String(event.detail.value ?? ""))} /></IonItem><IonItem><IonLabel position="stacked">Resolución</IonLabel><IonTextarea rows={3} value={resolution} onIonInput={(event) => setResolution(String(event.detail.value ?? ""))} /></IonItem><IonButton expand="block" disabled={saving} onClick={() => void save()}>{saving ? <IonSpinner name="dots" /> : "Guardar seguimiento"}</IonButton></IonCardContent></IonCard>
        <h3>Historial completo</h3>{detail.events.map((event) => <IonCard key={event.id}><IonCardContent><div style={{ color: "#6b7280", fontSize: ".76rem" }}>{formatDate(event.createdAt)} · {event.actorRole} · {event.eventType}</div>{event.publicMessage && <p><strong>Usuario:</strong> {event.publicMessage}</p>}{event.internalNote && <p style={{ background: "#fff3cd", padding: 8, borderRadius: 8 }}><strong>Interno:</strong> {event.internalNote}</p>}</IonCardContent></IonCard>)}
      </div>}
    </IonContent></IonModal>
  </IonContent></IonPage>;
}

export default AdminSupportPage;
