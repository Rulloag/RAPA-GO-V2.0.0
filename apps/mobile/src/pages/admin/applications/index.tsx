import {
  IonAlert,
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from "@ionic/react";
import { useRef, useState } from "react";
import { useAuth } from "../../../features/auth/index.js";
import { applicationsService, type ApplicationData } from "../../../features/applications/applications.service.js";

const STATUS_LABEL: Record<string, string> = {
  pending:      "Pendiente",
  under_review: "En revisión",
  approved:     "Aprobada",
  rejected:     "Rechazada",
  on_hold:      "En espera",
};

const STATUS_COLOR: Record<string, string> = {
  pending:      "warning",
  under_review: "tertiary",
  approved:     "success",
  rejected:     "danger",
  on_hold:      "medium",
};

const TYPE_LABEL: Record<string, string> = {
  driver:          "Conductor",
  guide:           "Guía",
  rental_operator: "Operador de arriendo",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL");
}

function AdminApplicationDetailModal({
  item,
  token,
  onClose,
  onUpdated,
}: {
  item: ApplicationData;
  token: string;
  onClose: () => void;
  onUpdated: (updated: ApplicationData) => void;
}): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApproveAlert, setShowApproveAlert] = useState(false);
  const [showRejectAlert, setShowRejectAlert] = useState(false);
  const [showReviewAlert, setShowReviewAlert] = useState(false);
  const [showHoldAlert, setShowHoldAlert] = useState(false);

  const isReviewable = item.status !== "approved" && item.status !== "rejected";

  async function doReview(status: string, rejectionReason?: string, notes?: string) {
    setLoading(true);
    setError(null);
    try {
      const input: { status: string; rejectionReason?: string; notes?: string } = { status };
      if (rejectionReason) input.rejectionReason = rejectionReason;
      if (notes) input.notes = notes;
      const updated = await applicationsService.reviewApplication(token, item.id, input);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Detalle de postulación</IonTitle>
          <IonButton slot="end" fill="clear" onClick={onClose}>Cerrar</IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle style={{ fontSize: "1rem" }}>
              {item.firstName} {item.lastName}
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p><strong>Tipo:</strong> {TYPE_LABEL[item.type] ?? item.type}</p>
            <p><strong>Estado:</strong>{" "}
              <IonBadge color={STATUS_COLOR[item.status] ?? "medium"}>
                {STATUS_LABEL[item.status] ?? item.status}
              </IonBadge>
            </p>
            <p><strong>Email:</strong> {item.email}</p>
            <p><strong>Teléfono:</strong> {item.phone}</p>
            {item.rut && <p><strong>RUT:</strong> {item.rut}</p>}
            {item.city && <p><strong>Ciudad:</strong> {item.city}</p>}
            {item.birthDate && <p><strong>Nacimiento:</strong> {item.birthDate}</p>}
            {item.emergencyContactName && <p><strong>Contacto emergencia:</strong> {item.emergencyContactName} {item.emergencyContactPhone ?? ""}</p>}

            {item.type === "driver" && (
              <>
                {item.licenseNumber && <p><strong>Licencia:</strong> {item.licenseNumber}</p>}
                {item.licenseExpiry && <p><strong>Vence licencia:</strong> {item.licenseExpiry}</p>}
                {item.vehicleBrand && <p><strong>Vehículo:</strong> {item.vehicleBrand} {item.vehicleModel ?? ""}</p>}
                {item.vehiclePlate && <p><strong>Patente:</strong> {item.vehiclePlate}</p>}
              </>
            )}

            {item.type === "guide" && (
              <>
                {item.experienceYears !== null && <p><strong>Experiencia:</strong> {item.experienceYears} años</p>}
                {item.specialties && item.specialties.length > 0 && <p><strong>Especialidades:</strong> {item.specialties.join(", ")}</p>}
                {item.languages && item.languages.length > 0 && <p><strong>Idiomas:</strong> {item.languages.join(", ")}</p>}
                {item.maxGroupSize !== null && <p><strong>Grupo máximo:</strong> {item.maxGroupSize}</p>}
              </>
            )}

            <p><strong>Fecha postulación:</strong> {fmtDate(item.createdAt)}</p>

            {item.rejectionReason && (
              <IonNote color="danger" style={{ display: "block", marginTop: "8px" }}>
                Motivo de rechazo: {item.rejectionReason}
              </IonNote>
            )}
            {item.notes && (
              <IonNote style={{ display: "block", marginTop: "8px" }}>
                Notas: {item.notes}
              </IonNote>
            )}
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle style={{ fontSize: "0.95rem" }}>Documentos</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonList>
              <IonItem>
                <IonLabel>Carnet frente</IonLabel>
                {item.idFrontUrl ? <a href={item.idFrontUrl} target="_blank" rel="noreferrer">Ver</a> : <IonNote>No subido</IonNote>}
              </IonItem>
              <IonItem>
                <IonLabel>Carnet reverso</IonLabel>
                {item.idBackUrl ? <a href={item.idBackUrl} target="_blank" rel="noreferrer">Ver</a> : <IonNote>No subido</IonNote>}
              </IonItem>
              <IonItem>
                <IonLabel>Licencia frente</IonLabel>
                {item.licenseFrontUrl ? <a href={item.licenseFrontUrl} target="_blank" rel="noreferrer">Ver</a> : <IonNote>No subido</IonNote>}
              </IonItem>
              <IonItem>
                <IonLabel>Licencia reverso</IonLabel>
                {item.licenseBackUrl ? <a href={item.licenseBackUrl} target="_blank" rel="noreferrer">Ver</a> : <IonNote>No subido</IonNote>}
              </IonItem>
              <IonItem>
                <IonLabel>Foto de perfil</IonLabel>
                {item.profilePhotoUrl ? <a href={item.profilePhotoUrl} target="_blank" rel="noreferrer">Ver</a> : <IonNote>No subido</IonNote>}
              </IonItem>
              {item.type === "guide" && (
                <IonItem>
                  <IonLabel>Certificación guía</IonLabel>
                  {item.certificateUrl ? <a href={item.certificateUrl} target="_blank" rel="noreferrer">Ver</a> : <IonNote>No subido</IonNote>}
                </IonItem>
              )}
            </IonList>
          </IonCardContent>
        </IonCard>

        {isReviewable && (
          <div style={{ padding: "0 0 16px" }}>
            <IonButton expand="block" fill="outline" onClick={() => setShowReviewAlert(true)} style={{ marginBottom: "8px" }}>
              En revisión
            </IonButton>
            <IonButton expand="block" color="success" onClick={() => setShowApproveAlert(true)} style={{ marginBottom: "8px" }}>
              Aprobar
            </IonButton>
            <IonButton expand="block" color="danger" onClick={() => setShowRejectAlert(true)} style={{ marginBottom: "8px" }}>
              Rechazar
            </IonButton>
            <IonButton expand="block" color="warning" onClick={() => setShowHoldAlert(true)}>
              En espera
            </IonButton>
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <IonSpinner name="crescent" />
          </div>
        )}
        {error && <IonText color="danger"><p>{error}</p></IonText>}

        <IonAlert
          isOpen={showApproveAlert}
          header="Aprobar postulación"
          message={`¿Confirmas que deseas aprobar la postulación de ${item.firstName} ${item.lastName}? Se creará o actualizará su cuenta.`}
          buttons={[
            { text: "Cancelar", role: "cancel" },
            { text: "Aprobar", handler: () => void doReview("approved") },
          ]}
          onDidDismiss={() => setShowApproveAlert(false)}
        />

        <IonAlert
          isOpen={showRejectAlert}
          header="Rechazar postulación"
          inputs={[{ name: "reason", type: "text", placeholder: "Motivo del rechazo (obligatorio)" }]}
          buttons={[
            { text: "Cancelar", role: "cancel" },
            {
              text: "Rechazar",
              handler: (data: { reason?: string }) => {
                if (!data.reason?.trim()) return false;
                void doReview("rejected", data.reason.trim());
                return true;
              },
            },
          ]}
          onDidDismiss={() => setShowRejectAlert(false)}
        />

        <IonAlert
          isOpen={showReviewAlert}
          header="Marcar en revisión"
          message="¿Marcar esta postulación como en revisión?"
          buttons={[
            { text: "Cancelar", role: "cancel" },
            { text: "Confirmar", handler: () => void doReview("under_review") },
          ]}
          onDidDismiss={() => setShowReviewAlert(false)}
        />

        <IonAlert
          isOpen={showHoldAlert}
          header="Poner en espera"
          inputs={[{ name: "notes", type: "text", placeholder: "Notas (opcional)" }]}
          buttons={[
            { text: "Cancelar", role: "cancel" },
            {
              text: "Confirmar",
              handler: (data: { notes?: string }) => void doReview("on_hold", undefined, data.notes?.trim()),
            },
          ]}
          onDidDismiss={() => setShowHoldAlert(false)}
        />
      </IonContent>
    </>
  );
}

export function AdminApplicationsPage(): JSX.Element {
  const { session } = useAuth();
  const [items, setItems] = useState<ApplicationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<ApplicationData | null>(null);
  const modal = useRef<HTMLIonModalElement>(null);

  async function load() {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await applicationsService.listApplications(session.accessToken, { page: 1 });
      setItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useIonViewWillEnter(() => { void load(); });

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  const total       = items.length;
  const pending     = items.filter((i) => i.status === "pending").length;
  const inReview    = items.filter((i) => i.status === "under_review").length;
  const approved    = items.filter((i) => i.status === "approved").length;
  const rejected    = items.filter((i) => i.status === "rejected").length;

  function handleUpdated(updated: ApplicationData) {
    setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i));
    setSelected(updated);
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Postulaciones</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", padding: "12px" }}>
          {[
            { label: "Total", count: total, color: "primary" },
            { label: "Pendientes", count: pending, color: "warning" },
            { label: "En revisión", count: inReview, color: "tertiary" },
            { label: "Aprobadas", count: approved, color: "success" },
            { label: "Rechazadas", count: rejected, color: "danger" },
          ].map(({ label, count, color }) => (
            <IonCard key={label} style={{ margin: 0, textAlign: "center" }}>
              <IonCardContent style={{ padding: "8px" }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: `var(--ion-color-${color})` }}>{count}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--ion-color-medium)" }}>{label}</div>
              </IonCardContent>
            </IonCard>
          ))}
        </div>

        <IonSegment value={filter} onIonChange={(e) => setFilter(String(e.detail.value ?? "all"))} style={{ padding: "0 12px" }}>
          <IonSegmentButton value="all"><IonLabel>Todas</IonLabel></IonSegmentButton>
          <IonSegmentButton value="pending"><IonLabel>Pendientes</IonLabel></IonSegmentButton>
          <IonSegmentButton value="under_review"><IonLabel>Revisión</IonLabel></IonSegmentButton>
          <IonSegmentButton value="approved"><IonLabel>Aprob.</IonLabel></IonSegmentButton>
          <IonSegmentButton value="rejected"><IonLabel>Rech.</IonLabel></IonSegmentButton>
        </IonSegment>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}
        {error && <IonText color="danger"><p style={{ padding: "0 16px" }}>{error}</p></IonText>}

        <IonList style={{ padding: "8px 12px" }}>
          {filtered.map((item) => (
            <IonItem key={item.id} button onClick={() => { setSelected(item); }} detail>
              <IonLabel>
                <h3>{item.firstName} {item.lastName}</h3>
                <p>{TYPE_LABEL[item.type] ?? item.type} — {fmtDate(item.createdAt)}</p>
              </IonLabel>
              <IonBadge slot="end" color={STATUS_COLOR[item.status] ?? "medium"}>
                {STATUS_LABEL[item.status] ?? item.status}
              </IonBadge>
            </IonItem>
          ))}
        </IonList>

        <IonModal ref={modal} isOpen={selected !== null} onDidDismiss={() => setSelected(null)}>
          {selected !== null && session?.accessToken && (
            <AdminApplicationDetailModal
              item={selected}
              token={session.accessToken}
              onClose={() => setSelected(null)}
              onUpdated={handleUpdated}
            />
          )}
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
