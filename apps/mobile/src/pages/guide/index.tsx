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
  IonModal,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  useIonViewWillEnter,
} from "@ionic/react";
import { useEffect, useState, useCallback } from "react";
import {
  bookOutline,
  cashOutline,
  compassOutline,
  personOutline,
} from "ionicons/icons";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { HomeHeader } from "../../components/HomeHeader";
import { ActionCard } from "../../components/ActionCard";
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { ROUTES } from "../../navigation/routes";
import { useAuth } from "../../features/auth";
import { touristService, type TouristServiceData, type ServiceBookingData, type CreateServiceInput } from "../../features/tourist/tourist.service.js";
import { NotificationBell } from "../../components/NotificationBell.js";

function meta(path: string) {
  return ROUTE_METADATA.find((r) => r.path === path)!;
}

const PENDING = "Módulo preparado, implementación funcional pendiente.";

const SERVICE_TYPE_OPTIONS = [
  { value: "tour",     label: "Tour" },
  { value: "transfer", label: "Traslado" },
  { value: "workshop", label: "Taller" },
  { value: "custom",   label: "Personalizado" },
] as const;

const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending:   "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
};

const BOOKING_STATUS_COLOR: Record<string, string> = {
  pending:   "warning",
  confirmed: "success",
  completed: "medium",
  cancelled: "danger",
};

export function GuideHomePage(): JSX.Element {
  return (
    <IonPage>
      <HomeHeader title="Inicio" />
      <IonContent className="ion-padding">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginTop: "8px",
          }}
        >
          <ActionCard
            icon={compassOutline}
            title="Mis Tours"
            subtitle={PENDING}
            route={ROUTES.GUIDE.TOURS}
            color="warning"
          />
          <ActionCard
            icon={bookOutline}
            title="Reservas"
            subtitle={PENDING}
            route={ROUTES.GUIDE.BOOKINGS}
            color="warning"
          />
          <ActionCard
            icon={cashOutline}
            title="Ganancias"
            subtitle={PENDING}
            route={ROUTES.GUIDE.EARNINGS}
            color="warning"
          />
          <ActionCard
            icon={personOutline}
            title="Perfil"
            subtitle={PENDING}
            route={ROUTES.PROFILE.INDEX}
            color="medium"
          />
        </div>
      </IonContent>
    </IonPage>
  );
}

export function GuideToursPage(): JSX.Element {
  const { session } = useAuth();
  const [services, setServices] = useState<TouristServiceData[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editService, setEditService] = useState<TouristServiceData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [fTitle,              setFTitle]              = useState("");
  const [fDesc,               setFDesc]               = useState("");
  const [fType,               setFType]               = useState<"tour"|"transfer"|"workshop"|"custom">("tour");
  const [fDuration,           setFDuration]           = useState("");
  const [fMaxPeople,          setFMaxPeople]          = useState("");
  const [fPrice,              setFPrice]              = useState("");
  const [fMeeting,            setFMeeting]            = useState("");
  const [fIncludesVehicle,    setFIncludesVehicle]    = useState(false);
  const [fConditions,         setFConditions]         = useState("");
  const [fCancellationPolicy, setFCancellationPolicy] = useState("");
  const [fPricingTiers,       setFPricingTiers]       = useState<Array<{minPeople: number; maxPeople: number; price: number}>>([]);
  const [tierMin,             setTierMin]             = useState("");
  const [tierMax,             setTierMax]             = useState("");
  const [tierPrice,           setTierPrice]           = useState("");

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await touristService.getMyServices(session.accessToken);
      setServices(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar servicios.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useIonViewWillEnter(() => { void load(); });
  useEffect(() => { void load(); }, [load]);

  function resetForm() {
    setFTitle(""); setFDesc(""); setFType("tour");
    setFDuration(""); setFMaxPeople(""); setFPrice(""); setFMeeting("");
    setFIncludesVehicle(false); setFConditions(""); setFCancellationPolicy("");
    setFPricingTiers([]); setTierMin(""); setTierMax(""); setTierPrice("");
    setSaveError(null);
  }

  function openCreate() {
    setEditService(null);
    resetForm();
    setShowModal(true);
  }

  function openEdit(svc: TouristServiceData) {
    setEditService(svc);
    setFTitle(svc.title);
    setFDesc(svc.description ?? "");
    setFType(svc.type as "tour"|"transfer"|"workshop"|"custom");
    setFDuration(svc.durationMinutes?.toString() ?? "");
    setFMaxPeople(svc.maxPeople?.toString() ?? "");
    setFPrice(svc.price !== null ? (svc.price / 100).toString() : "");
    setFMeeting(svc.meetingPoint ?? "");
    setFIncludesVehicle(svc.includesVehicle);
    setFConditions(svc.conditions ?? "");
    setFCancellationPolicy(svc.cancellationPolicy ?? "");
    setFPricingTiers([]);
    setTierMin(""); setTierMax(""); setTierPrice("");
    setSaveError(null);
    setShowModal(true);
  }

  async function handleSave() {
    if (!session?.accessToken) return;
    setSaving(true);
    setSaveError(null);
    try {
      const input: CreateServiceInput = {
        title: fTitle.trim(),
        type:  fType,
      };
      if (fDesc.trim())               input.description         = fDesc.trim();
      if (fDuration)                  input.durationMinutes     = parseInt(fDuration, 10);
      if (fMaxPeople)                 input.maxPeople           = parseInt(fMaxPeople, 10);
      if (fPrice)                     input.price               = Math.round(parseFloat(fPrice) * 100);
      if (fMeeting.trim())            input.meetingPoint        = fMeeting.trim();
      input.includesVehicle           = fIncludesVehicle;
      if (fConditions.trim())         input.conditions          = fConditions.trim();
      if (fCancellationPolicy.trim()) input.cancellationPolicy  = fCancellationPolicy.trim();
      if (fPricingTiers.length > 0)   input.pricingTiers        = fPricingTiers;

      if (editService) {
        await touristService.updateService(session.accessToken, editService.id, input);
      } else {
        await touristService.createService(session.accessToken, input);
      }
      await load();
      setShowModal(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(svc: TouristServiceData) {
    if (!session?.accessToken) return;
    const newStatus = svc.status === "active" ? "inactive" : "active";
    try {
      await touristService.updateService(session.accessToken, svc.id, { ...svc, status: newStatus } as unknown as Partial<CreateServiceInput>);
      await load();
    } catch (_) { /* ignore */ }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="warning">
          <IonTitle>Mis Servicios</IonTitle>
          <IonButton slot="end" fill="clear" color="dark" onClick={openCreate}>+ Nuevo</IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}><IonSpinner name="crescent" /></div>}
        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && services.length === 0 && (
          <IonText color="medium"><p>No tienes servicios. Crea uno con "+ Nuevo".</p></IonText>
        )}

        {!loading && services.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {services.map((svc) => (
              <IonCard key={svc.id} style={{ margin: 0 }}>
                <IonCardContent style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{svc.title}</div>
                    <IonBadge color={svc.status === "active" ? "success" : "medium"} style={{ fontSize: "0.68rem" }}>
                      {svc.status === "active" ? "Activo" : "Inactivo"}
                    </IonBadge>
                  </div>
                  {svc.description && (
                    <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginTop: "4px" }}>{svc.description}</div>
                  )}
                  <div style={{ fontSize: "0.78rem", marginTop: "4px" }}>
                    {svc.type} · {svc.durationMinutes ? `${svc.durationMinutes} min · ` : ""}
                    {svc.price !== null ? `$${(svc.price / 100).toLocaleString("es-CL")} CLP` : "Sin precio"}
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                    <IonButton size="small" fill="outline" onClick={() => openEdit(svc)}>Editar</IonButton>
                    <IonButton size="small" fill="outline" color={svc.status === "active" ? "medium" : "success"} onClick={() => void handleToggleStatus(svc)}>
                      {svc.status === "active" ? "Desactivar" : "Activar"}
                    </IonButton>
                  </div>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}

        <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
          <IonHeader>
            <IonToolbar color="warning">
              <IonTitle>{editService ? "Editar servicio" : "Nuevo servicio"}</IonTitle>
              <IonButton slot="end" fill="clear" color="dark" onClick={() => setShowModal(false)}>Cerrar</IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem lines="full">
              <IonLabel position="stacked">Título *</IonLabel>
              <IonInput value={fTitle} onIonInput={(e) => setFTitle(String(e.detail.value ?? ""))} placeholder="Nombre del servicio" maxlength={120} />
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Descripción</IonLabel>
              <IonTextarea value={fDesc} onIonInput={(e) => setFDesc(String(e.detail.value ?? ""))} rows={3} maxlength={500} />
            </IonItem>
            <IonItem lines="full">
              <IonLabel>Tipo</IonLabel>
              <IonSelect interface="action-sheet" value={fType} onIonChange={(e) => setFType(e.detail.value as "tour"|"transfer"|"workshop"|"custom")}>
                {SERVICE_TYPE_OPTIONS.map((o) => <IonSelectOption key={o.value} value={o.value}>{o.label}</IonSelectOption>)}
              </IonSelect>
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Duración (min)</IonLabel>
              <IonInput type="number" value={fDuration} onIonInput={(e) => setFDuration(String(e.detail.value ?? ""))} placeholder="60" />
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Máx. personas</IonLabel>
              <IonInput type="number" value={fMaxPeople} onIonInput={(e) => setFMaxPeople(String(e.detail.value ?? ""))} placeholder="10" />
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Precio por persona (CLP)</IonLabel>
              <IonInput type="number" value={fPrice} onIonInput={(e) => setFPrice(String(e.detail.value ?? ""))} placeholder="25000" />
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Punto de encuentro</IonLabel>
              <IonInput value={fMeeting} onIonInput={(e) => setFMeeting(String(e.detail.value ?? ""))} placeholder="Ej: Plaza de Hanga Roa" maxlength={150} />
            </IonItem>
            <IonItem lines="full">
              <IonLabel>Incluye vehículo</IonLabel>
              <IonToggle checked={fIncludesVehicle} onIonChange={(e) => setFIncludesVehicle(e.detail.checked)} slot="end" />
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Condiciones generales</IonLabel>
              <IonTextarea value={fConditions} onIonInput={(e) => setFConditions(String(e.detail.value ?? ""))} rows={2} maxlength={500} placeholder="Ej: Requiere calzado cómodo..." />
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Política de cancelación</IonLabel>
              <IonTextarea value={fCancellationPolicy} onIonInput={(e) => setFCancellationPolicy(String(e.detail.value ?? ""))} rows={2} maxlength={500} placeholder="Ej: Cancelación gratuita hasta 24h..." />
            </IonItem>
            <div style={{ padding: "8px 0 4px" }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "6px" }}>Precios por cantidad de personas</div>
              {fPricingTiers.map((t, i) => (
                <IonItem key={i} lines="full">
                  <IonLabel>{t.minPeople}–{t.maxPeople} personas: ${(t.price / 100).toLocaleString("es-CL")} CLP</IonLabel>
                  <IonButton slot="end" fill="clear" color="danger" size="small" onClick={() => setFPricingTiers((prev) => prev.filter((_, idx) => idx !== i))}>✕</IonButton>
                </IonItem>
              ))}
              <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", marginTop: "6px" }}>
                <IonInput
                  type="number" placeholder="Mín" value={tierMin}
                  onIonInput={(e) => setTierMin(String(e.detail.value ?? ""))}
                  style={{ flex: 1, border: "1px solid var(--ion-color-light-shade)", borderRadius: "4px", padding: "4px" }}
                />
                <IonInput
                  type="number" placeholder="Máx" value={tierMax}
                  onIonInput={(e) => setTierMax(String(e.detail.value ?? ""))}
                  style={{ flex: 1, border: "1px solid var(--ion-color-light-shade)", borderRadius: "4px", padding: "4px" }}
                />
                <IonInput
                  type="number" placeholder="Precio CLP" value={tierPrice}
                  onIonInput={(e) => setTierPrice(String(e.detail.value ?? ""))}
                  style={{ flex: 2, border: "1px solid var(--ion-color-light-shade)", borderRadius: "4px", padding: "4px" }}
                />
                <IonButton
                  size="small"
                  onClick={() => {
                    const mn = parseInt(tierMin, 10);
                    const mx = parseInt(tierMax, 10);
                    const pr = Math.round(parseFloat(tierPrice) * 100);
                    if (!isNaN(mn) && !isNaN(mx) && !isNaN(pr) && mn > 0 && mx >= mn && pr >= 0) {
                      setFPricingTiers((prev) => [...prev, { minPeople: mn, maxPeople: mx, price: pr }]);
                      setTierMin(""); setTierMax(""); setTierPrice("");
                    }
                  }}
                >+</IonButton>
              </div>
            </div>
            {saveError && <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{saveError}</p></IonText>}
            <IonButton expand="block" style={{ marginTop: "16px" }} onClick={() => void handleSave()} disabled={saving || !fTitle.trim()}>
              {saving ? <IonSpinner name="dots" /> : (editService ? "Guardar cambios" : "Crear servicio")}
            </IonButton>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}

function getBookingCountdown(createdAt: string): string {
  const expires   = new Date(createdAt).getTime() + 4 * 60 * 60 * 1000;
  const remaining = expires - Date.now();
  if (remaining <= 0) return "expired";
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export function GuideBookingsPage(): JSX.Element {
  const { session } = useAuth();
  const [bookings,   setBookings]   = useState<ServiceBookingData[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [segment,    setSegment]    = useState<"pending"|"confirmed"|"completed">("pending");
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { items } = await touristService.getGuideBookings(session.accessToken);
      setBookings(items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar reservas.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useIonViewWillEnter(() => { void load(); });
  useEffect(() => { void load(); }, [load]);

  const filtered = bookings.filter((b) => b.status === segment);

  async function handleConfirm(bookingId: string) {
    if (!session?.accessToken) return;
    setProcessing(bookingId);
    try {
      const updated = await touristService.confirmBooking(session.accessToken, bookingId);
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
    } catch (_) { /* ignore */ } finally {
      setProcessing(null);
    }
  }

  async function handleComplete(bookingId: string) {
    if (!session?.accessToken) return;
    setProcessing(bookingId);
    try {
      const updated = await touristService.completeBooking(session.accessToken, bookingId);
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
    } catch (_) { /* ignore */ } finally {
      setProcessing(null);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="warning">
          <IonTitle>Mis Reservas</IonTitle>
          <div slot="end"><NotificationBell /></div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        <IonSegment value={segment} onIonChange={(e) => setSegment(e.detail.value as "pending"|"confirmed"|"completed")}>
          <IonSegmentButton value="pending"><IonLabel>Pendientes</IonLabel></IonSegmentButton>
          <IonSegmentButton value="confirmed"><IonLabel>Confirmadas</IonLabel></IonSegmentButton>
          <IonSegmentButton value="completed"><IonLabel>Completadas</IonLabel></IonSegmentButton>
        </IonSegment>

        <div className="ion-padding">
          {loading && <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}><IonSpinner name="crescent" /></div>}
          {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

          {!loading && filtered.length === 0 && (
            <IonText color="medium"><p>No hay reservas en este estado.</p></IonText>
          )}

          {!loading && filtered.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filtered.map((b) => (
                <IonCard key={b.id} style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>Reserva #{b.id.slice(0, 8)}</span>
                      {Date.now() - new Date(b.createdAt).getTime() < 3600000 && b.status === "pending" && (
                        <IonBadge color="secondary" style={{ fontSize: "0.65rem" }}>Nueva</IonBadge>
                      )}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)" }}>
                      Fecha: {b.bookingDate}{b.bookingTime ? ` ${b.bookingTime}` : ""}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)" }}>
                      {b.numberOfPeople} persona{b.numberOfPeople !== 1 ? "s" : ""}
                      {b.totalPrice !== null && ` · $${(b.totalPrice / 100).toLocaleString("es-CL")} CLP`}
                    </div>
                    {b.notes && <div style={{ fontSize: "0.75rem", marginTop: "4px" }}>{b.notes}</div>}
                    <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <IonBadge color={BOOKING_STATUS_COLOR[b.status] ?? "medium"} style={{ fontSize: "0.68rem" }}>
                        {BOOKING_STATUS_LABEL[b.status] ?? b.status}
                      </IonBadge>
                      {b.status === "pending" && (() => {
                        const cd = getBookingCountdown(b.createdAt);
                        return cd === "expired"
                          ? <IonBadge color="danger" style={{ fontSize: "0.68rem" }}>Expirada</IonBadge>
                          : <IonBadge color="warning" style={{ fontSize: "0.68rem" }}>Confirmar antes: {cd}</IonBadge>;
                      })()}
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                      {b.status === "pending" && (() => {
                        const expired = getBookingCountdown(b.createdAt) === "expired";
                        return (
                          <IonButton size="small" color="success" disabled={processing === b.id || expired} onClick={() => void handleConfirm(b.id)}>
                            {processing === b.id ? <IonSpinner name="dots" /> : "Confirmar"}
                          </IonButton>
                        );
                      })()}
                      {b.status === "confirmed" && (
                        <IonButton size="small" color="tertiary" disabled={processing === b.id} onClick={() => void handleComplete(b.id)}>
                          {processing === b.id ? <IonSpinner name="dots" /> : "Completar"}
                        </IonButton>
                      )}
                    </div>
                  </IonCardContent>
                </IonCard>
              ))}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

export function GuideEarningsPage(): JSX.Element {
  const m = meta("/guide/earnings");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="warning"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="guide" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function GuideProfilePage(): JSX.Element {
  const m = meta("/guide/profile");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="warning"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="guide" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}
