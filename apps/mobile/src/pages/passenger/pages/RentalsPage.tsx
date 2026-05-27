import {
  IonBadge, IonButton, IonCard, IonCardContent, IonChip, IonContent, IonHeader,
  IonIcon, IonInput, IonItem, IonLabel, IonPage, IonRefresher, IonRefresherContent,
  IonSearchbar, IonSelect, IonSelectOption, IonSpinner, IonText, IonTextarea,
  IonTitle, IonToast, IonToolbar,
} from "@ionic/react";
import { useState, useCallback, useEffect } from "react";
import { carSportOutline } from "ionicons/icons";
import { EmptyState } from "../../../components/EmptyState.js";
import { SkeletonList } from "../../../components/SkeletonCard.js";
import { useAuth } from "../../../features/auth/index.js";
import { rentalService } from "../../../features/rental/rental.service.js";
import type { RentalVehicleData, CreateBookingInput } from "../../../features/rental/rental.service.js";
import { useIonViewWillEnter } from "@ionic/react";
import { VEHICLE_TYPE_LABEL, RENTAL_STATUS_COLOR, RENTAL_STATUS_LABEL } from "../shared.js";

export default function RentalsPage(): JSX.Element {
  const { session } = useAuth();
  const [vehicles,   setVehicles]   = useState<RentalVehicleData[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true); setLoadError(null);
    try {
      const filters: { type?: string } = {};
      if (filterType) filters.type = filterType;
      const data = await rentalService.listAvailableVehicles(session.accessToken, filters);
      setVehicles(data.items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar vehículos.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, filterType]);

  useIonViewWillEnter(() => { void load(); });
  useEffect(() => { void load(); }, [load]);

  const filtered = vehicles.filter((v) => {
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return v.brand.toLowerCase().includes(q) || v.model.toLowerCase().includes(q);
  });

  if (selectedId) {
    return <RentalDetailPage vehicleId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary"><IonTitle>Arriendo de Vehículos</IonTitle></IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>
        <IonSearchbar value={searchText} onIonInput={(e) => setSearchText(String(e.detail.value ?? ""))}
          placeholder="Buscar por marca o modelo..." debounce={300} />
        <IonItem lines="none" style={{ marginBottom: "8px" }}>
          <IonLabel>Tipo</IonLabel>
          <IonSelect interface="action-sheet" value={filterType} onIonChange={(e) => setFilterType(String(e.detail.value ?? ""))} placeholder="Todos">
            <IonSelectOption value="">Todos</IonSelectOption>
            <IonSelectOption value="car">Auto</IonSelectOption>
            <IonSelectOption value="suv">SUV</IonSelectOption>
            <IonSelectOption value="van">Van</IonSelectOption>
            <IonSelectOption value="motorcycle">Moto</IonSelectOption>
            <IonSelectOption value="bicycle">Bicicleta</IonSelectOption>
            <IonSelectOption value="quad">Quad</IonSelectOption>
          </IonSelect>
        </IonItem>

        {loading && <SkeletonList count={3} height="200px" />}
        {loadError && <div style={{ padding: "16px" }}><IonText color="danger"><p>{loadError}</p></IonText></div>}
        {!loading && filtered.length === 0 && <EmptyState icon={carSportOutline} title="Sin vehículos disponibles" subtitle="Vuelve a intentarlo más tarde" />}
        {!loading && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "12px 16px 80px" }}>
            {filtered.map((v) => (
              <IonCard key={v.id} className="ion-activatable"
                style={{ margin: 0, borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", overflow: "hidden", cursor: "pointer" }}
                onClick={() => setSelectedId(v.id)}>
                {v.photos && v.photos.length > 0
                  ? <img src={v.photos[0]} alt={`${v.brand} ${v.model}`} style={{ width: "100%", height: "160px", objectFit: "cover", display: "block" }} />
                  : <div style={{ width: "100%", height: "120px", background: "linear-gradient(135deg, var(--ion-color-tertiary-tint) 0%, var(--ion-color-tertiary-shade) 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <IonIcon icon={carSportOutline} style={{ fontSize: "3rem", color: "rgba(255,255,255,0.6)" }} />
                    </div>
                }
                <IonCardContent style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                    <div style={{ fontWeight: 700, fontSize: "1rem" }}>{v.brand} {v.model}{v.year ? ` (${v.year})` : ""}</div>
                    <IonBadge color="tertiary" style={{ fontSize: "0.65rem", flexShrink: 0, marginLeft: "6px" }}>{VEHICLE_TYPE_LABEL[v.type] ?? v.type}</IonBadge>
                  </div>
                  <div style={{ display: "flex", gap: "10px", fontSize: "0.76rem", color: "var(--ion-color-medium)", marginBottom: "8px", flexWrap: "wrap" }}>
                    {v.seats       && <span>💺 {v.seats} asientos</span>}
                    {v.transmission && <span>⚙️ {v.transmission === "manual" ? "Manual" : "Auto"}</span>}
                    {v.fuelType    && <span>⛽ {v.fuelType === "gasoline" ? "Bencina" : v.fuelType === "diesel" ? "Diésel" : v.fuelType === "electric" ? "Eléctrico" : "Híbrido"}</span>}
                    {v.color       && <span>🎨 {v.color}</span>}
                  </div>
                  {(v.features ?? []).length > 0 && (
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "10px" }}>
                      {(v.features ?? []).slice(0, 4).map((f) => (
                        <span key={f} style={{ background: "var(--ion-color-light)", borderRadius: "8px", padding: "2px 8px", fontSize: "0.68rem" }}>{f}</span>
                      ))}
                      {(v.features ?? []).length > 4 && <span style={{ background: "var(--ion-color-light)", borderRadius: "8px", padding: "2px 8px", fontSize: "0.68rem", color: "var(--ion-color-medium)" }}>+{(v.features ?? []).length - 4}</span>}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--ion-color-success)" }}>${(v.dailyPrice / 100).toLocaleString("es-CL")}</span>
                      <span style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)" }}> /día</span>
                    </div>
                    <IonButton size="small" style={{ "--border-radius": "10px" }}>Ver detalles</IonButton>
                  </div>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}

function RentalDetailPage({ vehicleId, onBack }: { vehicleId: string; onBack: () => void }): JSX.Element {
  const { session } = useAuth();
  const [vehicle,        setVehicle]        = useState<RentalVehicleData | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [startDate,      setStartDate]      = useState("");
  const [endDate,        setEndDate]        = useState("");
  const [pickupTime,     setPickupTime]     = useState("");
  const [returnTime,     setReturnTime]     = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [returnLocation, setReturnLocation] = useState("");
  const [notes,          setNotes]          = useState("");
  const [submitting,     setSubmitting]     = useState(false);
  const [toastMsg,       setToastMsg]       = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!session?.accessToken) return;
    void rentalService.getVehicle(session.accessToken, vehicleId)
      .then(setVehicle).catch(() => setVehicle(null)).finally(() => setLoading(false));
  }, [session?.accessToken, vehicleId]);

  const days = (startDate && endDate && endDate > startDate)
    ? Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
    : null;

  async function handleBook() {
    if (!session?.accessToken || !vehicle) return;
    if (!startDate || !endDate) { setToastMsg("Selecciona fechas de inicio y fin."); return; }
    setSubmitting(true);
    try {
      const input: CreateBookingInput = { vehicleId: vehicle.id, startDate, endDate };
      if (pickupTime)            input.pickupTime     = pickupTime;
      if (returnTime)            input.returnTime     = returnTime;
      if (pickupLocation.trim()) input.pickupLocation = pickupLocation.trim();
      if (returnLocation.trim()) input.returnLocation = returnLocation.trim();
      if (notes.trim())          input.notes          = notes.trim();
      await rentalService.createRentalBooking(session.accessToken, input);
      setToastMsg("Reserva creada correctamente.");
      setStartDate(""); setEndDate(""); setNotes(""); setPickupTime(""); setReturnTime("");
      setPickupLocation(""); setReturnLocation("");
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : "Error al reservar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonButton slot="start" fill="clear" color="light" onClick={onBack}>← Volver</IonButton><IonTitle>Vehículo</IonTitle></IonToolbar></IonHeader>
      <IonContent><div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}><IonSpinner name="crescent" /></div></IonContent>
    </IonPage>
  );

  if (!vehicle) return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonButton slot="start" fill="clear" color="light" onClick={onBack}>← Volver</IonButton><IonTitle>Vehículo</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><IonText color="danger"><p>No se pudo cargar el vehículo.</p></IonText></IonContent>
    </IonPage>
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButton slot="start" fill="clear" color="light" onClick={onBack}>← Volver</IonButton>
          <IonTitle>{vehicle.brand} {vehicle.model}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {vehicle.photos && vehicle.photos.length > 0
          ? <img src={vehicle.photos[0]} alt={`${vehicle.brand} ${vehicle.model}`} style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "8px", marginBottom: "12px" }} />
          : <div style={{ width: "100%", height: "120px", borderRadius: "8px", background: "var(--ion-color-light)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px", color: "var(--ion-color-medium)" }}>Sin foto</div>
        }
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{vehicle.brand} {vehicle.model}</div>
            <IonBadge color="tertiary" style={{ fontSize: "0.68rem" }}>{VEHICLE_TYPE_LABEL[vehicle.type] ?? vehicle.type}</IonBadge>
          </div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--ion-color-success)" }}>${(vehicle.dailyPrice / 100).toLocaleString("es-CL")}/día</div>
        </div>
        <IonCard style={{ margin: "0 0 12px" }}>
          <IonCardContent style={{ padding: "12px 14px" }}>
            <div style={{ fontWeight: 600, marginBottom: "8px", fontSize: "0.9rem" }}>Especificaciones</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "0.82rem" }}>
              {vehicle.year         && <span><strong>Año:</strong> {vehicle.year}</span>}
              {vehicle.plate        && <span><strong>Patente:</strong> {vehicle.plate}</span>}
              {vehicle.color        && <span><strong>Color:</strong> {vehicle.color}</span>}
              {vehicle.seats        && <span><strong>Asientos:</strong> {vehicle.seats}</span>}
              {vehicle.transmission && <span><strong>Trans.:</strong> {vehicle.transmission === "manual" ? "Manual" : "Automático"}</span>}
              {vehicle.fuelType     && <span><strong>Combustible:</strong> {vehicle.fuelType === "gasoline" ? "Bencina" : vehicle.fuelType === "diesel" ? "Diésel" : vehicle.fuelType === "electric" ? "Eléctrico" : "Híbrido"}</span>}
            </div>
          </IonCardContent>
        </IonCard>
        {vehicle.description && <IonCard style={{ margin: "0 0 12px" }}><IonCardContent style={{ padding: "12px 14px", fontSize: "0.85rem" }}>{vehicle.description}</IonCardContent></IonCard>}
        {(vehicle.features ?? []).length > 0 && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
            {(vehicle.features ?? []).map((f) => <IonChip key={f} color="primary" style={{ fontSize: "0.72rem", height: "24px" }}><IonLabel>{f}</IonLabel></IonChip>)}
          </div>
        )}
        <IonCard style={{ margin: "0 0 12px" }}>
          <IonCardContent style={{ padding: "12px 14px" }}>
            <div style={{ fontWeight: 600, marginBottom: "10px", fontSize: "0.9rem" }}>Reservar</div>
            <IonItem lines="full"><IonLabel position="stacked">Fecha inicio</IonLabel><IonInput type="date" value={startDate} min={today} onIonInput={(e) => setStartDate(String(e.detail.value ?? ""))} /></IonItem>
            <IonItem lines="full"><IonLabel position="stacked">Fecha fin</IonLabel><IonInput type="date" value={endDate} min={startDate || today} onIonInput={(e) => setEndDate(String(e.detail.value ?? ""))} /></IonItem>
            <IonItem lines="full"><IonLabel position="stacked">Hora recogida (opcional)</IonLabel><IonInput type="time" value={pickupTime} onIonInput={(e) => setPickupTime(String(e.detail.value ?? ""))} /></IonItem>
            <IonItem lines="full"><IonLabel position="stacked">Hora devolución (opcional)</IonLabel><IonInput type="time" value={returnTime} onIonInput={(e) => setReturnTime(String(e.detail.value ?? ""))} /></IonItem>
            <IonItem lines="full"><IonLabel position="stacked">Lugar recogida (opcional)</IonLabel><IonInput value={pickupLocation} onIonInput={(e) => setPickupLocation(String(e.detail.value ?? ""))} placeholder="Ej: Aeropuerto" maxlength={200} clearInput /></IonItem>
            <IonItem lines="full"><IonLabel position="stacked">Lugar devolución (opcional)</IonLabel><IonInput value={returnLocation} onIonInput={(e) => setReturnLocation(String(e.detail.value ?? ""))} placeholder="Ej: Hotel" maxlength={200} clearInput /></IonItem>
            <IonItem lines="none"><IonLabel position="stacked">Notas (opcional)</IonLabel><IonTextarea value={notes} onIonInput={(e) => setNotes(String(e.detail.value ?? ""))} placeholder="Indicaciones especiales..." rows={2} maxlength={500} /></IonItem>
            {days !== null && <div style={{ padding: "10px 0", fontWeight: 600, fontSize: "0.9rem" }}>{days} día{days !== 1 ? "s" : ""} × ${(vehicle.dailyPrice / 100).toLocaleString("es-CL")} = ${((vehicle.dailyPrice * days) / 100).toLocaleString("es-CL")} total</div>}
            <IonButton expand="block" style={{ marginTop: "8px" }} onClick={() => void handleBook()} disabled={submitting}>
              {submitting ? <IonSpinner name="dots" /> : "Confirmar reserva"}
            </IonButton>
          </IonCardContent>
        </IonCard>
        <IonToast isOpen={toastMsg !== null} message={toastMsg ?? ""} duration={3000} onDidDismiss={() => setToastMsg(null)} color={toastMsg?.includes("Error") || toastMsg?.includes("error") ? "danger" : "success"} />
      </IonContent>
    </IonPage>
  );
}
