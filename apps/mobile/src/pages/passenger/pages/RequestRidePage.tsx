import {
  IonAlert, IonButton, IonCard, IonCardContent, IonContent, IonHeader,
  IonIcon, IonLabel, IonNote, IonPage, IonSegment, IonSegmentButton,
  IonSpinner, IonText, IonTitle, IonToggle, IonToolbar,
} from "@ionic/react";
import { addOutline, flagOutline, locateOutline, locationOutline, trashOutline } from "ionicons/icons";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../features/auth/index.js";
import {
  ridesService,
  type RideRequestData,
  type RideDestinationInput,
  type RideSegmentInput,
} from "../../../features/rides/rides.service.js";
import {
  MapView,
  PlaceAutocompleteInput,
  useCurrentLocation,
  useMultiStopRoute,
  type MapPoint,
  type GoogleMapInstance,
} from "../../../features/maps/index.js";
import { RIDE_STATUS_LABEL } from "../shared.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const HANGA_ROA          = { lat: -27.15, lng: -109.4333 };
const MIN_SCHEDULED_MINUTES = 30;
const MAX_SCHEDULED_DAYS    = 30;
const MAX_DESTINATIONS      = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function minScheduledDate(): Date {
  return new Date(Date.now() + MIN_SCHEDULED_MINUTES * 60 * 1000);
}

function maxScheduledDate(): Date {
  return new Date(Date.now() + MAX_SCHEDULED_DAYS * 24 * 60 * 60 * 1000);
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  return `${mins} min`;
}

function hasDuplicatePoints(origin: MapPoint, dests: MapPoint[]): boolean {
  const all    = [origin, ...dests];
  const coords = all.map(p => `${p.position.lat.toFixed(6)},${p.position.lng.toFixed(6)}`);
  return new Set(coords).size < coords.length;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RideMode  = "immediate" | "scheduled";
type PageStatus =
  | "idle"
  | "calculating_route"
  | "ready_to_submit"
  | "submitting"
  | "success"
  | "error";

// ── Component ─────────────────────────────────────────────────────────────────

export default function RequestRidePage(): JSX.Element {
  const { session } = useAuth();

  // ── Route / map state ───────────────────────────────────────────────────────
  const [origin,       setOrigin]       = useState<MapPoint | null>(null);
  const [destinations, setDestinations] = useState<(MapPoint | null)[]>([null]);
  const [notes,        setNotes]        = useState("");
  const [pageStatus,   setPageStatus]   = useState<PageStatus>("idle");
  const [submitError,  setSubmitError]  = useState<string | null>(null);
  const [submitted,    setSubmitted]    = useState<RideRequestData | null>(null);
  const [mapInstance,  setMapInstance]  = useState<GoogleMapInstance | null>(null);

  // ── Scheduled-ride state ────────────────────────────────────────────────────
  const [rideMode,          setRideMode]         = useState<RideMode>("immediate");
  const [scheduledPickupAt, setScheduledPickupAt] = useState<string>("");
  const [flightNumber,      setFlightNumber]      = useState<string>("");
  const [scheduleError,     setScheduleError]     = useState<string | null>(null);

  // ── Female driver preference state ──────────────────────────────────────────
  const [preferFemaleDriver, setPreferFemaleDriver] = useState(false);
  const [femaleAlertRide,    setFemaleAlertRide]    = useState<RideRequestData | null>(null);
  const [waitingForFemale,   setWaitingForFemale]   = useState(false);
  const [acceptAnyMessage,   setAcceptAnyMessage]   = useState<string | null>(null);
  const [acceptAnyLoading,   setAcceptAnyLoading]   = useState(false);

  const route = useMultiStopRoute();
  const geo   = useCurrentLocation();

  const { calculate: calcRoute, clear: clearRoute } = route;

  // ── Map ready ───────────────────────────────────────────────────────────────

  const handleMapReady = useCallback((map: GoogleMapInstance) => {
    setMapInstance(map);
  }, []);

  // ── Auto-calculate route when all points + map are ready ───────────────────

  useEffect(() => {
    const filledDests = destinations.filter((d): d is MapPoint => d !== null);
    const allFilled   = filledDests.length === destinations.length && destinations.length >= 1;
    if (!origin || !allFilled || !mapInstance) return;
    setPageStatus("calculating_route");
    void calcRoute(origin, filledDests, mapInstance);
  }, [origin, destinations, mapInstance, calcRoute]);

  // ── Sync pageStatus with route result ──────────────────────────────────────

  useEffect(() => {
    if (route.status === "success") setPageStatus("ready_to_submit");
    if (route.status === "error")   setPageStatus("idle");
  }, [route.status]);

  // ── Use GPS as origin ───────────────────────────────────────────────────────

  useEffect(() => {
    if (geo.status === "success" && geo.location) {
      setOrigin({ label: "Mi ubicación actual", position: geo.location });
    }
  }, [geo.status, geo.location]);

  // ── Handlers — origin ───────────────────────────────────────────────────────

  const handleOriginSelect = useCallback((point: MapPoint) => {
    setOrigin(point);
    clearRoute();
    setSubmitted(null);
    setSubmitError(null);
    setPageStatus("idle");
  }, [clearRoute]);

  const handleClearOrigin = useCallback(() => {
    setOrigin(null);
    clearRoute();
    setPageStatus("idle");
    setSubmitError(null);
  }, [clearRoute]);

  // ── Handlers — destinations ─────────────────────────────────────────────────

  const handleDestinationSelect = useCallback((index: number, point: MapPoint) => {
    setDestinations(prev => {
      const next = [...prev];
      next[index] = point;
      return next;
    });
    clearRoute();
    setSubmitted(null);
    setSubmitError(null);
    setPageStatus("idle");
  }, [clearRoute]);

  const handleClearDestination = useCallback((index: number) => {
    setDestinations(prev => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    clearRoute();
    setPageStatus("idle");
    setSubmitError(null);
  }, [clearRoute]);

  const handleAddDestination = useCallback(() => {
    setDestinations(prev => prev.length < MAX_DESTINATIONS ? [...prev, null] : prev);
    clearRoute();
    setPageStatus("idle");
    setSubmitError(null);
  }, [clearRoute]);

  const handleRemoveDestination = useCallback((index: number) => {
    setDestinations(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
    clearRoute();
    setPageStatus("idle");
    setSubmitError(null);
  }, [clearRoute]);

  // ── Handlers — mode / misc ──────────────────────────────────────────────────

  function handleRideModeChange(mode: RideMode) {
    setRideMode(mode);
    setScheduleError(null);
    setSubmitError(null);
    setSubmitted(null);
    if (mode === "immediate") {
      setScheduledPickupAt("");
      setFlightNumber("");
    }
  }

  function handleReset() {
    setOrigin(null);
    setDestinations([null]);
    setNotes("");
    clearRoute();
    setSubmitted(null);
    setSubmitError(null);
    setPageStatus("idle");
    setRideMode("immediate");
    setScheduledPickupAt("");
    setFlightNumber("");
    setScheduleError(null);
    setPreferFemaleDriver(false);
    setFemaleAlertRide(null);
    setWaitingForFemale(false);
    setAcceptAnyMessage(null);
    setAcceptAnyLoading(false);
  }

  // ── Validate scheduled fields ───────────────────────────────────────────────

  function validateScheduled(): boolean {
    if (!scheduledPickupAt) {
      setScheduleError("Selecciona la fecha y hora del viaje programado.");
      return false;
    }
    const pickup = new Date(scheduledPickupAt);
    if (isNaN(pickup.getTime())) {
      setScheduleError("Fecha y hora no válidas.");
      return false;
    }
    if (pickup < minScheduledDate()) {
      setScheduleError(`La fecha debe ser al menos ${MIN_SCHEDULED_MINUTES} minutos desde ahora.`);
      return false;
    }
    if (pickup > maxScheduledDate()) {
      setScheduleError(`La fecha no puede superar ${MAX_SCHEDULED_DAYS} días desde hoy.`);
      return false;
    }
    if (flightNumber.trim().length > 20) {
      setScheduleError("El número de vuelo no puede superar 20 caracteres.");
      return false;
    }
    setScheduleError(null);
    return true;
  }

  // ── Accept any driver (after female preference unavailable) ────────────────

  async function handleAcceptAnyDriver() {
    if (!session?.accessToken || !submitted) return;
    setAcceptAnyLoading(true);
    try {
      const updated = await ridesService.acceptAnyDriver(session.accessToken, submitted.id);
      setSubmitted(updated);
      if (updated.status === "accepted" || updated.autoAssigned) {
        setAcceptAnyMessage("Conductor asignado.");
      } else if (updated.queuedOfferPending) {
        setAcceptAnyMessage("Estamos consultando a un conductor cercano.");
      } else {
        setAcceptAnyMessage("Seguimos buscando conductor disponible.");
      }
    } catch {
      setAcceptAnyMessage("Seguimos buscando conductor disponible.");
    } finally {
      setAcceptAnyLoading(false);
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!session?.accessToken) return;
    if (!origin) {
      setSubmitError("Selecciona el origen.");
      return;
    }

    const filledDests = destinations.filter((d): d is MapPoint => d !== null);
    if (filledDests.length === 0) {
      setSubmitError("Selecciona al menos un destino.");
      return;
    }
    if (filledDests.length !== destinations.length) {
      setSubmitError("Completa todos los destinos o elimina los vacíos.");
      return;
    }
    if (hasDuplicatePoints(origin, filledDests)) {
      setSubmitError("Hay puntos duplicados. Verifica origen y destinos.");
      return;
    }
    if (route.status !== "success" || route.segments.length === 0) {
      setSubmitError("Espera a que se calcule la ruta.");
      return;
    }
    if (route.totalDistanceMeters <= 0) {
      setSubmitError("La distancia debe ser mayor a 0.");
      return;
    }
    if (rideMode === "scheduled" && !validateScheduled()) return;

    setPageStatus("submitting");
    setSubmitError(null);

    try {
      const trimmedNotes  = notes.trim();
      const trimmedFlight = flightNumber.trim().toUpperCase();

      const destInputs: RideDestinationInput[] = filledDests.map((d, i) => ({
        text:  d.label,
        lat:   d.position.lat,
        lng:   d.position.lng,
        order: i + 1,
      }));

      const segInputs: RideSegmentInput[] = route.segments.map(s => ({
        fromOrder:       s.fromOrder,
        toOrder:         s.toOrder,
        distanceMeters:  s.distanceMeters,
        durationSeconds: s.durationSeconds,
      }));

      const ride = await ridesService.createRideRequest(session.accessToken, {
        originText:      origin.label,
        originLat:       origin.position.lat,
        originLng:       origin.position.lng,
        destinations:    destInputs,
        segments:        segInputs,
        distanceMeters:  route.totalDistanceMeters,
        durationSeconds: route.totalDurationSeconds,
        ...(trimmedNotes ? { notes: trimmedNotes } : {}),
        ...(preferFemaleDriver ? { preferredDriverGender: "female" as const } : {}),
        ...(rideMode === "scheduled" ? {
          rideType:          "scheduled" as const,
          scheduledPickupAt: new Date(scheduledPickupAt).toISOString(),
          ...(trimmedFlight ? { flightNumber: trimmedFlight } : {}),
        } : {}),
      });

      setSubmitted(ride);
      setPageStatus("success");

      if (ride.preferredDriverUnavailable) {
        setFemaleAlertRide(ride);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error al solicitar el viaje.");
      setPageStatus("error");
    }
  }

  // ── Derived UI state ────────────────────────────────────────────────────────

  const allDestsFilled = destinations.length >= 1 && destinations.every(d => d !== null);

  const isSubmitDisabled =
    pageStatus === "submitting"        ||
    pageStatus === "calculating_route" ||
    pageStatus === "success"           ||
    !origin                            ||
    !allDestsFilled                    ||
    route.status !== "success";

  // ── Styles ──────────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width:        "100%",
    border:       "1.5px solid var(--ion-color-light-shade)",
    borderRadius: "10px",
    padding:      "10px 12px",
    fontSize:     "0.9rem",
    background:   "var(--ion-card-background, #fff)",
    color:        "var(--ion-color-dark)",
    outline:      "none",
    boxSizing:    "border-box",
    fontFamily:   "inherit",
  };

  const labelStyle: React.CSSProperties = {
    fontSize:      "0.72rem",
    fontWeight:    600,
    color:         "var(--ion-color-medium)",
    marginBottom:  "4px",
    paddingLeft:   "4px",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
    display:       "block",
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Solicitar Viaje</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">

        {/* Map — shows route once calculated */}
        <MapView
          center={HANGA_ROA}
          zoom={13}
          height="200px"
          onMapReady={handleMapReady}
        />

        <IonCard style={{ marginTop: "12px" }}>
          <IonCardContent style={{ paddingTop: "14px" }}>

            {/* ── Origin ─────────────────────────────────────────────────── */}
            <div style={{ marginBottom: "14px" }}>
              <PlaceAutocompleteInput
                label="Origen"
                placeholder="¿Dónde te recogemos?"
                displayValue={origin?.label ?? ""}
                onSelect={handleOriginSelect}
                onClear={handleClearOrigin}
                iconSlot={locationOutline}
              />

              <IonButton
                fill="clear"
                size="small"
                style={{ marginTop: "2px", height: "30px", fontSize: "0.78rem" }}
                onClick={() => void geo.request()}
                disabled={
                  geo.status === "requesting_permission" ||
                  geo.status === "loading"
                }
              >
                {(geo.status === "requesting_permission" || geo.status === "loading")
                  ? <IonSpinner name="dots" style={{ width: "14px", height: "14px", marginRight: "6px" }} />
                  : <IonIcon icon={locateOutline} style={{ marginRight: "4px" }} />
                }
                {(geo.status === "requesting_permission" || geo.status === "loading")
                  ? "Obteniendo ubicación…"
                  : "Usar mi ubicación actual"
                }
              </IonButton>

              {(geo.status === "denied" || geo.status === "error") && geo.error && (
                <IonNote
                  color="danger"
                  style={{ fontSize: "0.72rem", display: "block", paddingLeft: "4px", marginTop: "2px" }}
                >
                  {geo.error}
                </IonNote>
              )}
            </div>

            {/* ── Destinations ───────────────────────────────────────────── */}
            {destinations.map((dest, i) => (
              <div key={i} style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <PlaceAutocompleteInput
                      label={destinations.length === 1 ? "Destino" : `Destino ${i + 1}`}
                      placeholder="¿A dónde vas?"
                      displayValue={dest?.label ?? ""}
                      onSelect={(point) => handleDestinationSelect(i, point)}
                      onClear={() => handleClearDestination(i)}
                      iconSlot={flagOutline}
                    />
                  </div>
                  {destinations.length > 1 && (
                    <button
                      onClick={() => handleRemoveDestination(i)}
                      aria-label={`Eliminar Destino ${i + 1}`}
                      style={{
                        background: "none",
                        border:     "none",
                        padding:    "4px 6px",
                        cursor:     "pointer",
                        color:      "var(--ion-color-danger)",
                        marginTop:  "18px",
                        flexShrink: 0,
                      }}
                    >
                      <IonIcon icon={trashOutline} style={{ fontSize: "1.1rem" }} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* ── Add destination button ──────────────────────────────────── */}
            {destinations.length < MAX_DESTINATIONS && (
              <IonButton
                fill="outline"
                size="small"
                style={{ marginBottom: "14px", height: "34px", fontSize: "0.8rem" }}
                onClick={handleAddDestination}
              >
                <IonIcon icon={addOutline} slot="start" />
                Agregar destino
              </IonButton>
            )}

            {/* ── Route summary ──────────────────────────────────────────── */}
            {route.status === "loading" && (
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 0", fontSize: "0.85rem",
                color: "var(--ion-color-medium)",
              }}>
                <IonSpinner name="dots" style={{ width: "16px", height: "16px" }} />
                Calculando ruta…
              </div>
            )}

            {route.status === "success" && route.segments.length > 0 && (
              <div style={{
                padding:      "12px 14px",
                background:   "var(--ion-color-light)",
                borderRadius: "8px",
                fontSize:     "0.85rem",
                marginBottom: "14px",
              }}>
                {/* Totals row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ color: "var(--ion-color-dark)" }}>
                    <strong>{formatDistance(route.totalDistanceMeters)}</strong>
                    <span style={{ color: "var(--ion-color-medium)", marginLeft: "6px" }}>
                      · {formatDuration(route.totalDurationSeconds)}
                    </span>
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", fontStyle: "italic" }}>
                    {route.segments.length === 1 ? "1 tramo" : `${route.segments.length} tramos`}
                  </span>
                </div>

                {/* Per-segment breakdown */}
                {route.segments.map((seg, i) => {
                  const fromLabel = i === 0
                    ? (origin?.label ?? "Origen")
                    : (destinations[i - 1]?.label ?? `Destino ${i}`);
                  const toLabel = destinations[i]?.label ?? `Destino ${i + 1}`;
                  return (
                    <div key={i} style={{
                      fontSize: "0.78rem",
                      color:    "var(--ion-color-medium)",
                      marginTop: "4px",
                      paddingLeft: "4px",
                      borderLeft: `3px solid ${["#3880ff", "#2dd36f", "#ffc409"][i] ?? "#3880ff"}`,
                      paddingTop: "2px",
                      paddingBottom: "2px",
                    }}>
                      <span style={{ color: "var(--ion-color-dark)", fontWeight: 500 }}>{fromLabel}</span>
                      {" → "}
                      <span style={{ color: "var(--ion-color-dark)", fontWeight: 500 }}>{toLabel}</span>
                      <span style={{ marginLeft: "6px" }}>
                        · {seg.distanceText} · {seg.durationText}
                      </span>
                    </div>
                  );
                })}

                {/* Fare note */}
                <div style={{
                  marginTop:  "8px",
                  fontSize:   "0.72rem",
                  color:      "var(--ion-color-medium)",
                  fontStyle:  "italic",
                }}>
                  La tarifa final se calcula en el servidor.
                </div>
              </div>
            )}

            {route.status === "error" && route.error && (
              <IonText color="danger">
                <p style={{ margin: "0 0 10px", fontSize: "0.82rem" }}>{route.error}</p>
              </IonText>
            )}

            {/* ── Ahora / Programar selector ─────────────────────────────── */}
            <div style={{ marginBottom: "16px" }}>
              <span style={labelStyle}>Tipo de viaje</span>
              <IonSegment
                value={rideMode}
                onIonChange={(e) => handleRideModeChange(e.detail.value as RideMode)}
                disabled={pageStatus === "submitting" || pageStatus === "success"}
              >
                <IonSegmentButton value="immediate">
                  <IonLabel>Ahora</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="scheduled">
                  <IonLabel>Programar</IonLabel>
                </IonSegmentButton>
              </IonSegment>
            </div>

            {/* ── Scheduled fields ───────────────────────────────────────── */}
            {rideMode === "scheduled" && (
              <div style={{
                padding:      "14px",
                border:       "1.5px solid var(--ion-color-primary-tint)",
                borderRadius: "10px",
                marginBottom: "14px",
                background:   "var(--ion-color-light)",
              }}>

                {/* Fecha y hora */}
                <div style={{ marginBottom: "12px" }}>
                  <label style={labelStyle} htmlFor="scheduled-pickup-at">
                    Fecha y hora de recogida
                  </label>
                  <input
                    id="scheduled-pickup-at"
                    type="datetime-local"
                    value={scheduledPickupAt}
                    min={toDatetimeLocalValue(minScheduledDate())}
                    max={toDatetimeLocalValue(maxScheduledDate())}
                    onChange={(e) => {
                      setScheduledPickupAt(e.target.value);
                      setScheduleError(null);
                    }}
                    disabled={pageStatus === "submitting" || pageStatus === "success"}
                    style={{ ...inputStyle, colorScheme: "light" }}
                  />
                  <IonNote style={{ fontSize: "0.72rem", paddingLeft: "4px", marginTop: "3px", display: "block" }}>
                    Mínimo {MIN_SCHEDULED_MINUTES} min desde ahora · Máximo {MAX_SCHEDULED_DAYS} días
                  </IonNote>
                </div>

                {/* Número de vuelo (opcional) */}
                <div style={{ marginBottom: "12px" }}>
                  <label style={labelStyle} htmlFor="flight-number">
                    Número de vuelo (opcional)
                  </label>
                  <input
                    id="flight-number"
                    type="text"
                    value={flightNumber}
                    maxLength={20}
                    placeholder="Ej: LA800"
                    onChange={(e) => setFlightNumber(e.target.value)}
                    disabled={pageStatus === "submitting" || pageStatus === "success"}
                    style={inputStyle}
                  />
                </div>

                {/* Aviso recargo prioritario */}
                <div style={{
                  display:      "flex",
                  alignItems:   "flex-start",
                  gap:          "8px",
                  padding:      "10px 12px",
                  background:   "var(--ion-color-warning-tint, #fff8e1)",
                  borderRadius: "8px",
                  fontSize:     "0.8rem",
                  color:        "var(--ion-color-dark)",
                }}>
                  <span style={{ fontSize: "1rem" }}>⚡</span>
                  <span>
                    <strong>Reserva con prioridad.</strong>{" "}
                    El sistema aplica un recargo por programación prioritaria.
                    El monto se mostrará en la tarifa al confirmar.
                  </span>
                </div>

                {scheduleError && (
                  <IonText color="danger">
                    <p style={{ margin: "8px 0 0", fontSize: "0.82rem" }}>{scheduleError}</p>
                  </IonText>
                )}
              </div>
            )}

            {/* ── Notes ──────────────────────────────────────────────────── */}
            <div style={{ marginBottom: "12px" }}>
              <span style={labelStyle}>Notas (opcional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Llevar maletas grandes"
                maxLength={500}
                rows={2}
                disabled={pageStatus === "submitting" || pageStatus === "success"}
                style={{ ...inputStyle, resize: "none" }}
              />
            </div>

            {/* ── Female driver preference ────────────────────────────────── */}
            <div style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              gap:            "12px",
              padding:        "12px 14px",
              border:         "1.5px solid var(--ion-color-light-shade)",
              borderRadius:   "10px",
              marginBottom:   "14px",
              background:     preferFemaleDriver
                ? "var(--ion-color-primary-tint, #ebf2ff)"
                : "var(--ion-card-background, #fff)",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ion-color-dark)" }}>
                  Prefiero conductora mujer
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "3px", lineHeight: 1.4 }}>
                  Intentaremos asignarte una conductora si hay una disponible y conectada.
                  No podemos garantizar disponibilidad.
                </div>
              </div>
              <IonToggle
                checked={preferFemaleDriver}
                onIonChange={(e) => setPreferFemaleDriver(e.detail.checked)}
                disabled={pageStatus === "submitting" || pageStatus === "success"}
              />
            </div>

            {/* ── Success result ─────────────────────────────────────────── */}
            {pageStatus === "success" && submitted && (
              <div style={{ margin: "10px 0 8px" }}>
                <IonText color="success">
                  <p style={{ margin: "0 0 6px", fontSize: "0.85rem", fontWeight: 600 }}>
                    ✓ Solicitud enviada — Estado: {RIDE_STATUS_LABEL[submitted.status] ?? submitted.status}
                  </p>
                </IonText>

                {/* Mensaje según tipo de viaje y preferencia de conductora */}
                {acceptAnyLoading ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 6px", fontSize: "0.82rem", color: "var(--ion-color-medium)" }}>
                    <IonSpinner name="dots" style={{ width: "14px", height: "14px" }} />
                    Buscando conductor…
                  </div>
                ) : acceptAnyMessage ? (
                  <IonText color={acceptAnyMessage === "Conductor asignado." ? "success" : "medium"}>
                    <p style={{ margin: "0 0 6px", fontSize: "0.82rem" }}>{acceptAnyMessage}</p>
                  </IonText>
                ) : waitingForFemale ? (
                  <IonText color="primary">
                    <p style={{ margin: "0 0 6px", fontSize: "0.82rem" }}>
                      Te avisaremos cuando una conductora esté disponible.
                    </p>
                  </IonText>
                ) : submitted.rideType === "scheduled" ? (
                  <IonText color="primary">
                    <p style={{ margin: "0 0 6px", fontSize: "0.82rem" }}>
                      {submitted.preferredDriverGender === "female"
                        ? "Reserva programada creada. El equipo intentará asignar una conductora si está disponible."
                        : "Reserva programada recibida con prioridad. Te avisaremos cuando se asigne un conductor."
                      }
                    </p>
                  </IonText>
                ) : (submitted.autoAssigned || submitted.status === "accepted") ? (
                  <IonText color="success">
                    <p style={{ margin: "0 0 6px", fontSize: "0.82rem" }}>
                      {submitted.preferredDriverGender === "female"
                        ? "Conductora asignada."
                        : "Conductor asignado automáticamente."
                      }
                    </p>
                  </IonText>
                ) : (
                  <IonText color="medium">
                    <p style={{ margin: "0 0 6px", fontSize: "0.82rem" }}>
                      Estamos buscando un conductor disponible. Un administrador podrá asignarlo si es necesario.
                    </p>
                  </IonText>
                )}

                {/* Tarifa estimada */}
                {submitted.estimatedFareClp != null && (
                  <div style={{
                    padding:      "10px 14px",
                    background:   "var(--ion-color-light)",
                    borderRadius: "8px",
                    fontSize:     "0.85rem",
                  }}>
                    {submitted.discountApplied && submitted.originalFareClp != null ? (
                      <>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <strong>${submitted.estimatedFareClp.toLocaleString("es-CL")} CLP</strong>
                          <span style={{
                            background: "var(--ion-color-success)", color: "#fff",
                            borderRadius: "4px", padding: "1px 6px", fontSize: "0.72rem",
                          }}>
                            -{submitted.discountPercent}% referido
                          </span>
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>
                          Precio original: ${submitted.originalFareClp.toLocaleString("es-CL")} CLP
                        </div>
                      </>
                    ) : (
                      <>
                        <strong>Tarifa estimada: ${submitted.estimatedFareClp.toLocaleString("es-CL")} CLP</strong>
                        {submitted.priorityFeeClp != null && submitted.priorityFeeClp > 0 && (
                          <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>
                            Incluye recargo prioritario: ${submitted.priorityFeeClp.toLocaleString("es-CL")} CLP
                          </div>
                        )}
                      </>
                    )}
                    <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "4px" }}>
                      Tarifa referencial. El precio final lo acuerda con el conductor.
                    </div>
                  </div>
                )}

                {/* Paradas confirmadas */}
                {submitted.stops && submitted.stops.length > 0 && (
                  <div style={{
                    marginTop:    "8px",
                    padding:      "8px 12px",
                    background:   "var(--ion-color-light)",
                    borderRadius: "8px",
                    fontSize:     "0.8rem",
                    color:        "var(--ion-color-dark)",
                  }}>
                    <strong>{submitted.stops.length} parada{submitted.stops.length > 1 ? "s" : ""} confirmadas:</strong>
                    {submitted.stops.map((stop) => (
                      <div key={stop.id} style={{ marginTop: "4px", color: "var(--ion-color-medium)" }}>
                        {stop.order}. {stop.destinationText}
                        {stop.segmentFareClp != null && (
                          <span style={{ marginLeft: "6px" }}>
                            — ${stop.segmentFareClp.toLocaleString("es-CL")} CLP
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Detalle viaje programado en éxito */}
                {submitted.rideType === "scheduled" && submitted.scheduledPickupAt && (
                  <div style={{
                    marginTop:    "8px",
                    padding:      "8px 12px",
                    background:   "var(--ion-color-light)",
                    borderRadius: "8px",
                    fontSize:     "0.8rem",
                    color:        "var(--ion-color-dark)",
                  }}>
                    <div>
                      <strong>Fecha programada:</strong>{" "}
                      {new Date(submitted.scheduledPickupAt).toLocaleString("es-CL", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                    {submitted.flightNumber && (
                      <div style={{ marginTop: "2px" }}>
                        <strong>Vuelo:</strong> {submitted.flightNumber}
                      </div>
                    )}
                  </div>
                )}

                <IonButton
                  fill="outline"
                  expand="block"
                  style={{ marginTop: "12px" }}
                  onClick={handleReset}
                >
                  Nueva solicitud
                </IonButton>
              </div>
            )}

            {/* ── Error ──────────────────────────────────────────────────── */}
            {submitError && (
              <IonText color="danger">
                <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>{submitError}</p>
              </IonText>
            )}

            {/* ── Submit button ──────────────────────────────────────────── */}
            {pageStatus !== "success" && (
              <IonButton
                expand="block"
                style={{ marginTop: "16px" }}
                onClick={() => void handleSubmit()}
                disabled={isSubmitDisabled}
              >
                {pageStatus === "submitting"
                  ? <IonSpinner name="dots" />
                  : pageStatus === "calculating_route"
                    ? "Calculando ruta…"
                    : route.status !== "success" && (origin != null || destinations.some(d => d !== null))
                      ? "Selecciona origen y destino"
                      : rideMode === "scheduled"
                        ? "Confirmar reserva programada"
                        : "Solicitar viaje"
                }
              </IonButton>
            )}

          </IonCardContent>
        </IonCard>

        {/* ── Female driver unavailable alert ─────────────────────────── */}
        <IonAlert
          isOpen={femaleAlertRide !== null}
          header="No hay conductoras disponibles"
          message="En este momento no hay conductoras disponibles cerca de tu ubicación. Puedes esperar o continuar con cualquier conductor disponible."
          buttons={[
            {
              text:    "Esperar conductora",
              role:    "cancel",
              handler: () => {
                setFemaleAlertRide(null);
                setWaitingForFemale(true);
              },
            },
            {
              text:    "Continuar con cualquier conductor",
              handler: () => {
                setFemaleAlertRide(null);
                void handleAcceptAnyDriver();
              },
            },
          ]}
        />

      </IonContent>
    </IonPage>
  );
}
