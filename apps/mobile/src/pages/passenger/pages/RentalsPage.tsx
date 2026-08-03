import {
  IonBadge, IonButton, IonChip, IonContent,
  IonIcon, IonInput, IonItem, IonLabel, IonPage, IonRefresher, IonRefresherContent,
  IonSearchbar, IonSelect, IonSelectOption, IonSpinner, IonTextarea,
  IonToast,
} from "@ionic/react";
import { useState, useCallback, useEffect } from "react";
import {
  alertCircleOutline,
  carSportOutline,
  cogOutline,
  colorPaletteOutline,
  imageOutline,
  peopleOutline,
  waterOutline,
} from "ionicons/icons";
import { SkeletonList } from "../../../components/SkeletonCard.js";
import { RapagoSectionHeader } from "../../../components/RapagoSectionHeader.js";
import { useRapagoSectionTheme } from "../../../theme/rapagoTheme.js";
import { useAuth } from "../../../features/auth/index.js";
import { rentalService } from "../../../features/rental/rental.service.js";
import type { RentalVehicleData, CreateBookingInput } from "../../../features/rental/rental.service.js";
import { useIonViewWillEnter } from "@ionic/react";
import { VEHICLE_TYPE_LABEL, RENTAL_STATUS_COLOR, RENTAL_STATUS_LABEL } from "../shared.js";

/* Arriendo todavía no tiene id propio en `RapagoSection`, y añadirlo es tocar
   rapagoTheme.ts. Se reutiliza "trips" porque lo que decide el tema es el
   ÁMBITO (`passenger`), compartido por todas las pantallas del pasajero: con
   cualquier id de ese grupo la pantalla lee y escribe la misma preferencia. */
const SECCION_TEMA = "trips" as const;

/* Iconografía de la ficha de vehículo. Antes eran emojis (💺 ⚙️ ⛽ 🎨): el SO
   los pinta con su propia paleta, así que no seguían el tema y en modo día
   quedaban como manchas de color ajenas a la marca. */
const META_ICON_STYLE = { fontSize: "1em", flexShrink: 0 } as const;

/* Píldora de característica: mismo cromo que el resto de las etiquetas suaves
   de la sección. Se repite en la lista y en el detalle. */
const FEATURE_PILL_STYLE = {
  background: "var(--rp-surface-soft)",
  border: "1px solid var(--rp-divider)",
  color: "var(--rp-muted)",
  borderRadius: "999px",
  padding: "3px 9px",
  fontSize: "var(--rp-fs-micro)",
} as const;

export default function RentalsPage(): JSX.Element {
  const { session } = useAuth();
  // Solo se lee: el interruptor único vive en el encabezado de Inicio.
  const { theme } = useRapagoSectionTheme(SECCION_TEMA);
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
    <IonPage className="rapago-section-page rapago-rentals-page" data-rapago-theme={theme}>
      <RapagoSectionHeader title="Arriendo de Vehículos" />
      {/* Sin `ion-padding`: el ritmo lo pone .rp-shell, que además centra la
          columna en el mismo ancho de lectura que el resto de secciones. */}
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="rp-shell">
          <IonSearchbar value={searchText} onIonInput={(e) => setSearchText(String(e.detail.value ?? ""))}
            placeholder="Buscar por marca o modelo..." debounce={300} style={{ padding: 0 }} />
          <IonItem lines="none">
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
          {loadError && (
            <div className="rp-banner rp-banner--error" role="alert">
              <IonIcon icon={alertCircleOutline} />
              <span>{loadError}</span>
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="rp-empty">
              <div className="rp-empty__icon" aria-hidden>
                <IonIcon icon={carSportOutline} />
              </div>
              <h3 className="rp-empty__title">Sin vehículos disponibles</h3>
              <p className="rp-empty__body">Vuelve a intentarlo más tarde</p>
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--rp-gap-sm)" }}>
              {filtered.map((v) => (
                /* Deja de ser IonCard: sections.css mantiene a propósito las
                   ion-card sobre superficie clara en ambos temas (deuda de las
                   pantallas con texto oscuro inline). Con .rp-card la ficha
                   adopta la superficie del tema activo. */
                <button key={v.id} type="button" className="rp-card rp-card--tap"
                  onClick={() => setSelectedId(v.id)}>
                  {v.photos && v.photos.length > 0
                    ? <img src={v.photos[0]} alt={`${v.brand} ${v.model}`} style={{ width: "100%", height: "160px", objectFit: "cover", display: "block", borderRadius: "var(--rp-radius-sm)", marginBottom: "var(--rp-gap-sm)" }} />
                    : <div style={{ width: "100%", height: "120px", borderRadius: "var(--rp-radius-sm)", marginBottom: "var(--rp-gap-sm)", background: "var(--rp-surface-soft)", border: "1px solid var(--rp-divider)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <IonIcon icon={carSportOutline} style={{ fontSize: "3rem", color: "var(--rp-icon-fg)" }} />
                      </div>
                  }
                  <div className="rp-card__row">
                    <h3 className="rp-card__title">{v.brand} {v.model}{v.year ? ` (${v.year})` : ""}</h3>
                    {/* El tipo de vehículo no es un estado: no le corresponde un
                        color semántico de Ionic. Va con el cromo dorado. */}
                    <IonBadge className="rp-badge" style={{
                      marginLeft: "6px",
                      "--background": "var(--rp-icon-bg)", "--color": "var(--rp-icon-fg)",
                      border: "1px solid var(--rp-icon-bd)",
                    }}>{VEHICLE_TYPE_LABEL[v.type] ?? v.type}</IonBadge>
                  </div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", fontSize: "var(--rp-fs-sub)", color: "var(--rp-muted)", margin: "8px 0", flexWrap: "wrap" }}>
                    {v.seats       && <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><IonIcon icon={peopleOutline} style={META_ICON_STYLE} /> {v.seats} asientos</span>}
                    {v.transmission && <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><IonIcon icon={cogOutline} style={META_ICON_STYLE} /> {v.transmission === "manual" ? "Manual" : "Auto"}</span>}
                    {v.fuelType    && <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><IonIcon icon={waterOutline} style={META_ICON_STYLE} /> {v.fuelType === "gasoline" ? "Bencina" : v.fuelType === "diesel" ? "Diésel" : v.fuelType === "electric" ? "Eléctrico" : "Híbrido"}</span>}
                    {v.color       && <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><IonIcon icon={colorPaletteOutline} style={META_ICON_STYLE} /> {v.color}</span>}
                  </div>
                  {(v.features ?? []).length > 0 && (
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "10px" }}>
                      {(v.features ?? []).slice(0, 4).map((f) => (
                        <span key={f} style={FEATURE_PILL_STYLE}>{f}</span>
                      ))}
                      {(v.features ?? []).length > 4 && <span style={FEATURE_PILL_STYLE}>+{(v.features ?? []).length - 4}</span>}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--rp-gap-sm)" }}>
                    <div>
                      <span style={{ fontWeight: 850, fontSize: "var(--rp-fs-stat)", letterSpacing: "-0.01em", color: "var(--rp-text)" }}>${(v.dailyPrice / 100).toLocaleString("es-CL")}</span>
                      <span style={{ fontSize: "var(--rp-fs-sub)", color: "var(--rp-muted)" }}> /día</span>
                    </div>
                    <IonButton size="small">Ver detalles</IonButton>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

function RentalDetailPage({ vehicleId, onBack }: { vehicleId: string; onBack: () => void }): JSX.Element {
  const { session } = useAuth();
  const { theme } = useRapagoSectionTheme(SECCION_TEMA);
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
    <IonPage className="rapago-section-page rapago-rentals-page" data-rapago-theme={theme}>
      <RapagoSectionHeader title="Vehículo" onBack={onBack} />
      <IonContent><div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}><IonSpinner name="crescent" /></div></IonContent>
    </IonPage>
  );

  if (!vehicle) return (
    <IonPage className="rapago-section-page rapago-rentals-page" data-rapago-theme={theme}>
      <RapagoSectionHeader title="Vehículo" onBack={onBack} />
      <IonContent>
        <div className="rp-shell">
          <div className="rp-banner rp-banner--error" role="alert">
            <IonIcon icon={alertCircleOutline} />
            <span>No se pudo cargar el vehículo.</span>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );

  return (
    <IonPage className="rapago-section-page rapago-rentals-page" data-rapago-theme={theme}>
      <RapagoSectionHeader title={`${vehicle.brand} ${vehicle.model}`} onBack={onBack} />
      <IonContent>
        <div className="rp-shell">
          {vehicle.photos && vehicle.photos.length > 0
            ? <img src={vehicle.photos[0]} alt={`${vehicle.brand} ${vehicle.model}`} style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "var(--rp-radius)" }} />
            : <div style={{ width: "100%", height: "120px", borderRadius: "var(--rp-radius)", background: "var(--rp-surface-soft)", border: "1px solid var(--rp-divider)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "var(--rp-muted)", fontSize: "var(--rp-fs-sub)" }}>
                <IonIcon icon={imageOutline} style={META_ICON_STYLE} /> Sin foto
              </div>
          }
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--rp-gap-sm)" }}>
            <div>
              <div style={{ fontWeight: 850, fontSize: "var(--rp-fs-h2)", letterSpacing: "-0.01em", color: "var(--rp-text)" }}>{vehicle.brand} {vehicle.model}</div>
              <IonBadge className="rp-badge" style={{
                marginTop: "6px",
                "--background": "var(--rp-icon-bg)", "--color": "var(--rp-icon-fg)",
                border: "1px solid var(--rp-icon-bd)",
              }}>{VEHICLE_TYPE_LABEL[vehicle.type] ?? vehicle.type}</IonBadge>
            </div>
            <div style={{ fontWeight: 850, fontSize: "var(--rp-fs-stat)", letterSpacing: "-0.01em", color: "var(--rp-text)" }}>${(vehicle.dailyPrice / 100).toLocaleString("es-CL")}/día</div>
          </div>

          <article className="rp-card">
            <div style={{ fontSize: "var(--rp-fs-label)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--rp-muted)" }}>Especificaciones</div>
            <div className="rp-card__meta">
              {vehicle.year         && <span><strong>Año:</strong> {vehicle.year}</span>}
              {vehicle.plate        && <span><strong>Patente:</strong> {vehicle.plate}</span>}
              {vehicle.color        && <span><strong>Color:</strong> {vehicle.color}</span>}
              {vehicle.seats        && <span><strong>Asientos:</strong> {vehicle.seats}</span>}
              {vehicle.transmission && <span><strong>Trans.:</strong> {vehicle.transmission === "manual" ? "Manual" : "Automático"}</span>}
              {vehicle.fuelType     && <span><strong>Combustible:</strong> {vehicle.fuelType === "gasoline" ? "Bencina" : vehicle.fuelType === "diesel" ? "Diésel" : vehicle.fuelType === "electric" ? "Eléctrico" : "Híbrido"}</span>}
            </div>
          </article>

          {vehicle.description && <article className="rp-card" style={{ fontSize: "var(--rp-fs-body)", lineHeight: 1.55 }}>{vehicle.description}</article>}

          {(vehicle.features ?? []).length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {(vehicle.features ?? []).map((f) => (
                <IonChip key={f} style={{
                  fontSize: "var(--rp-fs-micro)", height: "26px", margin: 0,
                  "--background": "var(--rp-icon-bg)", "--color": "var(--rp-icon-fg)",
                  border: "1px solid var(--rp-icon-bd)",
                }}><IonLabel>{f}</IonLabel></IonChip>
              ))}
            </div>
          )}

          <article className="rp-card">
            <div style={{ fontSize: "var(--rp-fs-label)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--rp-muted)", marginBottom: "10px" }}>Reservar</div>
            <IonItem lines="full"><IonLabel position="stacked">Fecha inicio</IonLabel><IonInput type="date" value={startDate} min={today} onIonInput={(e) => setStartDate(String(e.detail.value ?? ""))} /></IonItem>
            <IonItem lines="full"><IonLabel position="stacked">Fecha fin</IonLabel><IonInput type="date" value={endDate} min={startDate || today} onIonInput={(e) => setEndDate(String(e.detail.value ?? ""))} /></IonItem>
            <IonItem lines="full"><IonLabel position="stacked">Hora recogida (opcional)</IonLabel><IonInput type="time" value={pickupTime} onIonInput={(e) => setPickupTime(String(e.detail.value ?? ""))} /></IonItem>
            <IonItem lines="full"><IonLabel position="stacked">Hora devolución (opcional)</IonLabel><IonInput type="time" value={returnTime} onIonInput={(e) => setReturnTime(String(e.detail.value ?? ""))} /></IonItem>
            <IonItem lines="full"><IonLabel position="stacked">Lugar recogida (opcional)</IonLabel><IonInput value={pickupLocation} onIonInput={(e) => setPickupLocation(String(e.detail.value ?? ""))} placeholder="Ej: Aeropuerto" maxlength={200} clearInput /></IonItem>
            <IonItem lines="full"><IonLabel position="stacked">Lugar devolución (opcional)</IonLabel><IonInput value={returnLocation} onIonInput={(e) => setReturnLocation(String(e.detail.value ?? ""))} placeholder="Ej: Hotel" maxlength={200} clearInput /></IonItem>
            <IonItem lines="none"><IonLabel position="stacked">Notas (opcional)</IonLabel><IonTextarea value={notes} onIonInput={(e) => setNotes(String(e.detail.value ?? ""))} placeholder="Indicaciones especiales..." rows={2} maxlength={500} /></IonItem>
            {days !== null && <div style={{ padding: "10px 0", fontWeight: 800, fontSize: "var(--rp-fs-body)", color: "var(--rp-text)" }}>{days} día{days !== 1 ? "s" : ""} × ${(vehicle.dailyPrice / 100).toLocaleString("es-CL")} = ${((vehicle.dailyPrice * days) / 100).toLocaleString("es-CL")} total</div>}
            <IonButton className="rp-cta" expand="block" style={{ marginTop: "8px" }} onClick={() => void handleBook()} disabled={submitting}>
              {submitting ? <IonSpinner name="dots" /> : "Confirmar reserva"}
            </IonButton>
          </article>
        </div>
        <IonToast isOpen={toastMsg !== null} message={toastMsg ?? ""} duration={3000} onDidDismiss={() => setToastMsg(null)} color={toastMsg?.includes("Error") || toastMsg?.includes("error") ? "danger" : "success"} />
      </IonContent>
    </IonPage>
  );
}
