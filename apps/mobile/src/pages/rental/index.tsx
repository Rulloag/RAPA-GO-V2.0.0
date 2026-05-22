import {
  IonAlert,
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
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
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToolbar,
  useIonViewWillEnter,
} from "@ionic/react";
import { useCallback, useEffect, useState } from "react";
import { addOutline, bookOutline, carOutline, cashOutline, personOutline } from "ionicons/icons";
import { HomeHeader } from "../../components/HomeHeader";
import { ActionCard } from "../../components/ActionCard";
import { ROUTES } from "../../navigation/routes";
import { useAuth } from "../../features/auth";
import { rentalService, type RentalVehicleData, type RentalBookingData } from "../../features/rental/rental.service.js";

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  car: "Auto", suv: "SUV", van: "Van", motorcycle: "Moto", bicycle: "Bicicleta", quad: "Quad",
};

const VEHICLE_STATUS_COLOR: Record<string, string> = {
  available:   "success",
  rented:      "primary",
  maintenance: "warning",
  inactive:    "medium",
};

const VEHICLE_STATUS_LABEL: Record<string, string> = {
  available:   "Disponible",
  rented:      "Arrendado",
  maintenance: "Mantención",
  inactive:    "Inactivo",
};

const BOOKING_STATUS_COLOR: Record<string, string> = {
  pending:   "warning",
  confirmed: "success",
  active:    "primary",
  completed: "medium",
  cancelled: "danger",
};

const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending:   "Pendiente",
  confirmed: "Confirmada",
  active:    "Activa",
  completed: "Completada",
  cancelled: "Cancelada",
};

export function RentalHomePage(): JSX.Element {
  const { session } = useAuth();
  const [vehicles,  setVehicles]  = useState<RentalVehicleData[]>([]);
  const [bookings,  setBookings]  = useState<RentalBookingData[]>([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const [vData, bData] = await Promise.all([
        rentalService.getMyVehicles(session.accessToken),
        rentalService.getMyOperatorBookings(session.accessToken),
      ]);
      setVehicles(vData);
      setBookings(bData.items);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useIonViewWillEnter(() => { void load(); });
  useEffect(() => { void load(); }, [load]);

  const totalVehicles    = vehicles.length;
  const available        = vehicles.filter((v) => v.status === "available").length;
  const rented           = vehicles.filter((v) => v.status === "rented").length;
  const pendingBookings  = bookings.filter((b) => b.status === "pending").length;

  return (
    <IonPage>
      <HomeHeader title="Inicio" />
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}><IonSpinner name="crescent" /></div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            {([
              { label: "Total vehículos", value: totalVehicles, color: "primary" },
              { label: "Disponibles",     value: available,     color: "success" },
              { label: "En arriendo",     value: rented,        color: "tertiary" },
              { label: "Reservas pend.",  value: pendingBookings, color: "warning" },
            ] as { label: string; value: number; color: string }[]).map((s) => (
              <IonCard key={s.label} style={{ margin: 0, textAlign: "center" }}>
                <IonCardContent style={{ padding: "10px" }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 700, color: `var(--ion-color-${s.color})` }}>{s.value}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--ion-color-medium)" }}>{s.label}</div>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <ActionCard icon={carOutline}   title="Vehículos" subtitle="Gestiona tu flota"  route={ROUTES.RENTAL.VEHICLES} color="tertiary" />
          <ActionCard icon={bookOutline}  title="Reservas"  subtitle="Gestiona arriendos" route={ROUTES.RENTAL.BOOKINGS} color="tertiary" />
          <ActionCard icon={cashOutline}  title="Ganancias" subtitle="Próximamente"        route={ROUTES.RENTAL.EARNINGS} color="tertiary" />
          <ActionCard icon={personOutline} title="Perfil"   subtitle="Datos de cuenta"     route={ROUTES.PROFILE.INDEX}  color="medium" />
        </div>
      </IonContent>
    </IonPage>
  );
}

interface VehicleFormState {
  brand: string; model: string; year: string; plate: string; color: string;
  type: "car" | "suv" | "van" | "motorcycle" | "bicycle" | "quad";
  seats: string; transmission: "manual" | "automatic" | "";
  fuelType: "gasoline" | "diesel" | "electric" | "hybrid" | "";
  dailyPrice: string; description: string; features: string[];
}

const EMPTY_FORM: VehicleFormState = {
  brand: "", model: "", year: "", plate: "", color: "",
  type: "car", seats: "", transmission: "", fuelType: "",
  dailyPrice: "", description: "", features: [],
};

export function RentalVehiclesPage(): JSX.Element {
  const { session } = useAuth();
  const [vehicles,    setVehicles]    = useState<RentalVehicleData[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [showModal,   setShowModal]   = useState(false);
  const [editing,     setEditing]     = useState<RentalVehicleData | null>(null);
  const [form,        setForm]        = useState<VehicleFormState>(EMPTY_FORM);
  const [newFeature,  setNewFeature]  = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [toastMsg,    setToastMsg]    = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ id: string; current: string } | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await rentalService.getMyVehicles(session.accessToken);
      setVehicles(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar vehículos.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useIonViewWillEnter(() => { void load(); });
  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(v: RentalVehicleData) {
    setEditing(v);
    setForm({
      brand:        v.brand,
      model:        v.model,
      year:         v.year !== null ? String(v.year) : "",
      plate:        v.plate,
      color:        v.color ?? "",
      type:         v.type as VehicleFormState["type"],
      seats:        v.seats !== null ? String(v.seats) : "",
      transmission: (v.transmission ?? "") as VehicleFormState["transmission"],
      fuelType:     (v.fuelType ?? "") as VehicleFormState["fuelType"],
      dailyPrice:   String(v.dailyPrice),
      description:  v.description ?? "",
      features:     v.features ?? [],
    });
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!session?.accessToken) return;
    setSubmitting(true);
    try {
      const input: import("../../features/rental/rental.service.js").CreateVehicleInput = {
        brand:      form.brand.trim(),
        model:      form.model.trim(),
        plate:      form.plate.trim(),
        type:       form.type,
        dailyPrice: parseInt(form.dailyPrice, 10),
      };
      if (form.year.trim())        input.year         = parseInt(form.year, 10);
      if (form.color.trim())       input.color        = form.color.trim();
      if (form.seats.trim())       input.seats        = parseInt(form.seats, 10);
      if (form.transmission)       input.transmission = form.transmission;
      if (form.fuelType)           input.fuelType     = form.fuelType;
      if (form.description.trim()) input.description  = form.description.trim();
      if (form.features.length)    input.features     = form.features;

      if (editing) {
        const updated = await rentalService.updateVehicle(session.accessToken, editing.id, input);
        setVehicles((prev) => prev.map((v) => (v.id === editing.id ? updated : v)));
        setToastMsg("Vehículo actualizado.");
      } else {
        const created = await rentalService.createVehicle(session.accessToken, input);
        setVehicles((prev) => [created, ...prev]);
        setToastMsg("Vehículo creado.");
      }
      setShowModal(false);
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : "Error al guardar vehículo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(vehicleId: string, newStatus: string) {
    if (!session?.accessToken) return;
    try {
      const updated = await rentalService.updateVehicleStatus(session.accessToken, vehicleId, newStatus);
      setVehicles((prev) => prev.map((v) => (v.id === vehicleId ? updated : v)));
      setToastMsg("Estado actualizado.");
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : "Error al cambiar estado.");
    } finally {
      setStatusTarget(null);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="tertiary">
          <IonTitle>Mis Vehículos</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}><IonSpinner name="crescent" /></div>}
        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && vehicles.length === 0 && (
          <IonText color="medium"><p>No tienes vehículos. Usa el botón + para agregar.</p></IonText>
        )}

        {!loading && vehicles.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "80px" }}>
            {vehicles.map((v) => (
              <IonCard key={v.id} style={{ margin: 0 }}>
                <IonCardContent style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{v.brand} {v.model}{v.year ? ` (${v.year})` : ""}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)" }}>{v.plate} · {VEHICLE_TYPE_LABEL[v.type] ?? v.type}</div>
                    </div>
                    <IonBadge color={VEHICLE_STATUS_COLOR[v.status] ?? "medium"} style={{ fontSize: "0.68rem" }}>
                      {VEHICLE_STATUS_LABEL[v.status] ?? v.status}
                    </IonBadge>
                  </div>
                  <div style={{ fontWeight: 700, color: "var(--ion-color-success)", marginBottom: "8px", fontSize: "0.9rem" }}>
                    ${(v.dailyPrice / 100).toLocaleString("es-CL")}/día
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <IonButton size="small" fill="outline" onClick={() => openEdit(v)}>Editar</IonButton>
                    <IonButton size="small" fill="outline" color="medium" onClick={() => setStatusTarget({ id: v.id, current: v.status })}>Estado</IonButton>
                  </div>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton color="tertiary" onClick={openCreate}>
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>

        <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
          <IonHeader>
            <IonToolbar color="tertiary">
              <IonTitle>{editing ? "Editar vehículo" : "Nuevo vehículo"}</IonTitle>
              <IonButton slot="end" fill="clear" color="light" onClick={() => setShowModal(false)}>Cerrar</IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem lines="full">
              <IonLabel position="stacked">Marca *</IonLabel>
              <IonInput value={form.brand} onIonInput={(e) => setForm((f) => ({ ...f, brand: String(e.detail.value ?? "") }))} placeholder="Ej: Toyota" maxlength={50} clearInput />
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Modelo *</IonLabel>
              <IonInput value={form.model} onIonInput={(e) => setForm((f) => ({ ...f, model: String(e.detail.value ?? "") }))} placeholder="Ej: Hilux" maxlength={50} clearInput />
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Año</IonLabel>
              <IonInput type="number" value={form.year} onIonInput={(e) => setForm((f) => ({ ...f, year: String(e.detail.value ?? "") }))} placeholder="Ej: 2022" />
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Patente *</IonLabel>
              <IonInput value={form.plate} onIonInput={(e) => setForm((f) => ({ ...f, plate: String(e.detail.value ?? "") }))} placeholder="Ej: AB1234" maxlength={10} clearInput />
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Color</IonLabel>
              <IonInput value={form.color} onIonInput={(e) => setForm((f) => ({ ...f, color: String(e.detail.value ?? "") }))} placeholder="Ej: Blanco" maxlength={30} clearInput />
            </IonItem>
            <IonItem lines="full">
              <IonLabel>Tipo *</IonLabel>
              <IonSelect interface="action-sheet" value={form.type} onIonChange={(e) => setForm((f) => ({ ...f, type: e.detail.value as VehicleFormState["type"] }))}>
                <IonSelectOption value="car">Auto</IonSelectOption>
                <IonSelectOption value="suv">SUV</IonSelectOption>
                <IonSelectOption value="van">Van</IonSelectOption>
                <IonSelectOption value="motorcycle">Moto</IonSelectOption>
                <IonSelectOption value="bicycle">Bicicleta</IonSelectOption>
                <IonSelectOption value="quad">Quad</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Asientos</IonLabel>
              <IonInput type="number" value={form.seats} onIonInput={(e) => setForm((f) => ({ ...f, seats: String(e.detail.value ?? "") }))} placeholder="Ej: 5" />
            </IonItem>
            <IonItem lines="full">
              <IonLabel>Transmisión</IonLabel>
              <IonSelect interface="action-sheet" value={form.transmission} onIonChange={(e) => setForm((f) => ({ ...f, transmission: e.detail.value as VehicleFormState["transmission"] }))}>
                <IonSelectOption value="">Sin especificar</IonSelectOption>
                <IonSelectOption value="manual">Manual</IonSelectOption>
                <IonSelectOption value="automatic">Automático</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem lines="full">
              <IonLabel>Combustible</IonLabel>
              <IonSelect interface="action-sheet" value={form.fuelType} onIonChange={(e) => setForm((f) => ({ ...f, fuelType: e.detail.value as VehicleFormState["fuelType"] }))}>
                <IonSelectOption value="">Sin especificar</IonSelectOption>
                <IonSelectOption value="gasoline">Bencina</IonSelectOption>
                <IonSelectOption value="diesel">Diésel</IonSelectOption>
                <IonSelectOption value="electric">Eléctrico</IonSelectOption>
                <IonSelectOption value="hybrid">Híbrido</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Precio diario (centavos) *</IonLabel>
              <IonInput type="number" value={form.dailyPrice} onIonInput={(e) => setForm((f) => ({ ...f, dailyPrice: String(e.detail.value ?? "") }))} placeholder="Ej: 500000" />
              <IonNote slot="helper" style={{ fontSize: "0.7rem" }}>En centavos. Ej: $5.000 CLP = 500000</IonNote>
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Descripción</IonLabel>
              <IonTextarea value={form.description} onIonInput={(e) => setForm((f) => ({ ...f, description: String(e.detail.value ?? "") }))} rows={2} maxlength={500} />
            </IonItem>

            <div style={{ padding: "12px 16px 0" }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "6px" }}>Características</div>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "8px" }}>
                {form.features.map((f) => (
                  <IonChip key={f} color="primary" style={{ fontSize: "0.72rem", height: "24px" }}>
                    <IonLabel>{f}</IonLabel>
                    <span
                      style={{ marginLeft: "4px", cursor: "pointer", fontWeight: 700 }}
                      onClick={() => setForm((prev) => ({ ...prev, features: prev.features.filter((x) => x !== f) }))}
                    >×</span>
                  </IonChip>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <IonInput
                  value={newFeature}
                  onIonInput={(e) => setNewFeature(String(e.detail.value ?? ""))}
                  placeholder="Ej: GPS, A/C..."
                  maxlength={50}
                  style={{ flex: 1 }}
                />
                <IonButton
                  size="small"
                  fill="outline"
                  onClick={() => {
                    const f = newFeature.trim();
                    if (f && !form.features.includes(f)) {
                      setForm((prev) => ({ ...prev, features: [...prev.features, f] }));
                    }
                    setNewFeature("");
                  }}
                >
                  Agregar
                </IonButton>
              </div>
            </div>

            <IonButton expand="block" style={{ margin: "16px 0 8px" }} onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? <IonSpinner name="dots" /> : editing ? "Guardar cambios" : "Crear vehículo"}
            </IonButton>
          </IonContent>
        </IonModal>

        <IonAlert
          isOpen={statusTarget !== null}
          header="Cambiar estado"
          message="Selecciona el nuevo estado del vehículo."
          inputs={[
            { type: "radio", label: "Disponible",  value: "available",   checked: statusTarget?.current === "available" },
            { type: "radio", label: "Arrendado",   value: "rented",      checked: statusTarget?.current === "rented" },
            { type: "radio", label: "Mantención",  value: "maintenance", checked: statusTarget?.current === "maintenance" },
            { type: "radio", label: "Inactivo",    value: "inactive",    checked: statusTarget?.current === "inactive" },
          ]}
          buttons={[
            { text: "Cancelar", role: "cancel", handler: () => setStatusTarget(null) },
            { text: "Confirmar", handler: (data: string) => { if (statusTarget) void handleStatusChange(statusTarget.id, data); } },
          ]}
          onDidDismiss={() => setStatusTarget(null)}
        />

        <IonToast isOpen={toastMsg !== null} message={toastMsg ?? ""} duration={3000} onDidDismiss={() => setToastMsg(null)} color={toastMsg?.includes("Error") || toastMsg?.includes("error") ? "danger" : "success"} />
      </IonContent>
    </IonPage>
  );
}

export function RentalBookingsPage(): JSX.Element {
  const { session } = useAuth();
  const [bookings,   setBookings]   = useState<RentalBookingData[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [segment,    setSegment]    = useState<"pending" | "confirmed" | "active" | "completed">("pending");
  const [toastMsg,   setToastMsg]   = useState<string | null>(null);
  const [actionId,   setActionId]   = useState<string | null>(null);
  const [actionType, setActionType] = useState<"confirm" | "complete" | "cancel" | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await rentalService.getMyOperatorBookings(session.accessToken);
      setBookings(data.items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar reservas.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useIonViewWillEnter(() => { void load(); });
  useEffect(() => { void load(); }, [load]);

  const filtered = bookings.filter((b) => b.status === segment);

  async function handleAction() {
    if (!session?.accessToken || !actionId || !actionType) return;
    try {
      let updated: RentalBookingData;
      if (actionType === "confirm")  updated = await rentalService.confirmBooking(session.accessToken, actionId);
      else if (actionType === "complete") updated = await rentalService.completeBooking(session.accessToken, actionId);
      else updated = await rentalService.cancelOperatorBooking(session.accessToken, actionId, cancelReason || undefined);
      setBookings((prev) => prev.map((b) => (b.id === actionId ? updated : b)));
      setToastMsg("Reserva actualizada.");
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : "Error al actualizar reserva.");
    } finally {
      setActionId(null);
      setActionType(null);
      setCancelReason("");
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="tertiary">
          <IonTitle>Reservas</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonSegment
          value={segment}
          onIonChange={(e) => setSegment(e.detail.value as typeof segment)}
          style={{ padding: "8px" }}
        >
          <IonSegmentButton value="pending"><IonLabel>Pendientes</IonLabel></IonSegmentButton>
          <IonSegmentButton value="confirmed"><IonLabel>Confirmadas</IonLabel></IonSegmentButton>
          <IonSegmentButton value="active"><IonLabel>Activas</IonLabel></IonSegmentButton>
          <IonSegmentButton value="completed"><IonLabel>Completadas</IonLabel></IonSegmentButton>
        </IonSegment>

        <div style={{ padding: "0 16px" }}>
          <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
            <IonRefresherContent />
          </IonRefresher>

          {loading && <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}><IonSpinner name="crescent" /></div>}
          {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

          {!loading && filtered.length === 0 && (
            <IonText color="medium"><p>No hay reservas en este estado.</p></IonText>
          )}

          {!loading && filtered.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "20px" }}>
              {filtered.map((b) => {
                const days = Math.max(1, Math.round((new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) / (1000 * 60 * 60 * 24)));
                return (
                  <IonCard key={b.id} style={{ margin: 0 }}>
                    <IonCardContent style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "4px" }}>
                        {b.vehicleBrand ?? ""} {b.vehicleModel ?? ""} ({b.vehiclePlate ?? ""})
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)" }}>
                        {b.startDate} → {b.endDate} · {days} día{days !== 1 ? "s" : ""}
                      </div>
                      {b.passengerName && (
                        <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)" }}>Pasajero: {b.passengerName}</div>
                      )}
                      {b.totalPrice !== null && (
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--ion-color-success)", marginTop: "2px" }}>
                          ${(b.totalPrice / 100).toLocaleString("es-CL")}
                        </div>
                      )}
                      <IonBadge color={BOOKING_STATUS_COLOR[b.status] ?? "medium"} style={{ fontSize: "0.68rem", margin: "6px 0" }}>
                        {BOOKING_STATUS_LABEL[b.status] ?? b.status}
                      </IonBadge>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                        {b.status === "pending" && (
                          <IonButton size="small" color="success" onClick={() => { setActionId(b.id); setActionType("confirm"); }}>Confirmar</IonButton>
                        )}
                        {(b.status === "confirmed" || b.status === "active") && (
                          <IonButton size="small" color="primary" onClick={() => { setActionId(b.id); setActionType("complete"); }}>Completar</IonButton>
                        )}
                        {b.status !== "cancelled" && b.status !== "completed" && (
                          <IonButton size="small" fill="outline" color="danger" onClick={() => { setActionId(b.id); setActionType("cancel"); }}>Cancelar</IonButton>
                        )}
                      </div>
                    </IonCardContent>
                  </IonCard>
                );
              })}
            </div>
          )}
        </div>

        <IonAlert
          isOpen={actionId !== null && actionType !== null && actionType !== "cancel"}
          header={actionType === "confirm" ? "¿Confirmar reserva?" : "¿Completar reserva?"}
          message="Esta acción actualizará el estado de la reserva."
          buttons={[
            { text: "No", role: "cancel", handler: () => { setActionId(null); setActionType(null); } },
            { text: "Sí", role: "confirm", handler: () => void handleAction() },
          ]}
          onDidDismiss={() => { if (actionType !== "cancel") { setActionId(null); setActionType(null); } }}
        />

        <IonAlert
          isOpen={actionId !== null && actionType === "cancel"}
          header="Cancelar reserva"
          inputs={[
            { name: "reason", type: "text", placeholder: "Razón (opcional)" },
          ]}
          buttons={[
            { text: "No", role: "cancel", handler: () => { setActionId(null); setActionType(null); } },
            { text: "Cancelar reserva", handler: (data: { reason?: string }) => { setCancelReason(data.reason ?? ""); void handleAction(); } },
          ]}
          onDidDismiss={() => { setActionId(null); setActionType(null); }}
        />

        <IonToast isOpen={toastMsg !== null} message={toastMsg ?? ""} duration={3000} onDidDismiss={() => setToastMsg(null)} color={toastMsg?.includes("Error") || toastMsg?.includes("error") ? "danger" : "success"} />
      </IonContent>
    </IonPage>
  );
}

export function RentalEarningsPage(): JSX.Element {
  return (
    <IonPage>
      <IonHeader><IonToolbar color="tertiary"><IonTitle>Ganancias</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding">
        <IonText color="medium"><p>Módulo de ganancias próximamente disponible.</p></IonText>
      </IonContent>
    </IonPage>
  );
}

export function RentalProfilePage(): JSX.Element {
  return (
    <IonPage>
      <IonHeader><IonToolbar color="tertiary"><IonTitle>Perfil</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding">
        <IonText color="medium"><p>Perfil de operador próximamente.</p></IonText>
      </IonContent>
    </IonPage>
  );
}
