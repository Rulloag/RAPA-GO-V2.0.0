import {
  IonButton, IonCard, IonCardContent, IonContent, IonHeader,
  IonIcon, IonLabel, IonNote, IonPage, IonSegment, IonSegmentButton,
  IonSpinner, IonText, IonTitle, IonToolbar,
} from "@ionic/react";
import { flagOutline, locateOutline, locationOutline } from "ionicons/icons";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../features/auth/index.js";
import { ridesService, type RideRequestData } from "../../../features/rides/rides.service.js";
import {
  MapView,
  PlaceAutocompleteInput,
  useCurrentLocation,
  useDirectionsRoute,
  type MapPoint,
  type GoogleMapInstance,
} from "../../../features/maps/index.js";
import { RIDE_STATUS_LABEL } from "../shared.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const HANGA_ROA = { lat: -27.15, lng: -109.4333 };
const MIN_SCHEDULED_MINUTES = 30;
const MAX_SCHEDULED_DAYS    = 30;

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
  const [origin,      setOrigin]      = useState<MapPoint | null>(null);
  const [destination, setDestination] = useState<MapPoint | null>(null);
  const [notes,       setNotes]       = useState("");
  const [pageStatus,  setPageStatus]  = useState<PageStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted,   setSubmitted]   = useState<RideRequestData | null>(null);
  const [mapInstance, setMapInstance] = useState<GoogleMapInstance | null>(null);

  // ── Scheduled-ride state ────────────────────────────────────────────────────
  const [rideMode,          setRideMode]         = useState<RideMode>("immediate");
  const [scheduledPickupAt, setScheduledPickupAt] = useState<string>("");
  const [flightNumber,      setFlightNumber]      = useState<string>("");
  const [scheduleError,     setScheduleError]     = useState<string | null>(null);

  const route = useDirectionsRoute();
  const geo   = useCurrentLocation();

  const { calculate: calcRoute, clear: clearRoute } = route;

  // ── Map ready ───────────────────────────────────────────────────────────────

  const handleMapReady = useCallback((map: GoogleMapInstance) => {
    setMapInstance(map);
  }, []);

  // ── Auto-calculate route when both points + map are ready ──────────────────

  useEffect(() => {
    if (!origin || !destination || !mapInstance) return;
    setPageStatus("calculating_route");
    void calcRoute(origin.position, destination.position, mapInstance);
  }, [origin, destination, mapInstance, calcRoute]);

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

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleOriginSelect = useCallback((point: MapPoint) => {
    setOrigin(point);
    clearRoute();
    setSubmitted(null);
    setSubmitError(null);
    setPageStatus("idle");
  }, [clearRoute]);

  const handleDestinationSelect = useCallback((point: MapPoint) => {
    setDestination(point);
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

  const handleClearDestination = useCallback(() => {
    setDestination(null);
    clearRoute();
    setPageStatus("idle");
    setSubmitError(null);
  }, [clearRoute]);

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
    setDestination(null);
    setNotes("");
    clearRoute();
    setSubmitted(null);
    setSubmitError(null);
    setPageStatus("idle");
    setRideMode("immediate");
    setScheduledPickupAt("");
    setFlightNumber("");
    setScheduleError(null);
  }

  // ── Validate scheduled fields before submit ─────────────────────────────────

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

  async function handleSubmit() {
    if (!session?.accessToken) return;

    if (!origin || !destination) {
      setSubmitError("Selecciona origen y destino.");
      return;
    }
    if (route.status !== "success" || !route.summary) {
      setSubmitError("Espera a que se calcule la ruta.");
      return;
    }
    if (route.summary.distanceValue <= 0) {
      setSubmitError("La distancia debe ser mayor a 0.");
      return;
    }
    if (rideMode === "scheduled" && !validateScheduled()) return;

    setPageStatus("submitting");
    setSubmitError(null);

    try {
      const trimmedNotes    = notes.trim();
      const trimmedFlight   = flightNumber.trim().toUpperCase();

      const ride = await ridesService.createRideRequest(session.accessToken, {
        originText:      origin.label,
        destinationText: destination.label,
        originLat:       origin.position.lat,
        originLng:       origin.position.lng,
        destinationLat:  destination.position.lat,
        destinationLng:  destination.position.lng,
        distanceMeters:  route.summary.distanceValue,
        durationSeconds: route.summary.durationValue,
        ...(trimmedNotes  ? { notes: trimmedNotes }                               : {}),
        ...(rideMode === "scheduled" ? {
          rideType:          "scheduled",
          scheduledPickupAt: new Date(scheduledPickupAt).toISOString(),
          ...(trimmedFlight ? { flightNumber: trimmedFlight } : {}),
        } : {}),
      });

      setSubmitted(ride);
      setPageStatus("success");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error al solicitar el viaje.");
      setPageStatus("error");
    }
  }

  // ── Derived UI state ────────────────────────────────────────────────────────

  const isSubmitDisabled =
    pageStatus === "submitting"        ||
    pageStatus === "calculating_route" ||
    pageStatus === "success"           ||
    !origin                            ||
    !destination                       ||
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

            {/* ── Destination ────────────────────────────────────────────── */}
            <div style={{ marginBottom: "14px" }}>
              <PlaceAutocompleteInput
                label="Destino"
                placeholder="¿A dónde vas?"
                displayValue={destination?.label ?? ""}
                onSelect={handleDestinationSelect}
                onClear={handleClearDestination}
                iconSlot={flagOutline}
              />
            </div>

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

            {route.status === "success" && route.summary && (
              <div style={{
                padding: "10px 14px",
                background: "var(--ion-color-light)",
                borderRadius: "8px",
                fontSize: "0.85rem",
                marginBottom: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <span style={{ color: "var(--ion-color-dark)" }}>
                  <strong>{route.summary.distanceText}</strong>
                  <span style={{ color: "var(--ion-color-medium)", marginLeft: "6px" }}>
                    · {route.summary.durationText}
                  </span>
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", fontStyle: "italic" }}>
                  Ruta calculada
                </span>
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

                {/* Error de validación scheduled */}
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
                style={{
                  ...inputStyle,
                  resize: "none",
                }}
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

                {/* Mensaje según tipo de viaje */}
                {(submitted.rideType === "scheduled") ? (
                  <IonText color="primary">
                    <p style={{ margin: "0 0 6px", fontSize: "0.82rem" }}>
                      Reserva programada recibida con prioridad. Te avisaremos cuando se asigne un conductor.
                    </p>
                  </IonText>
                ) : (submitted.autoAssigned || submitted.status === "accepted") ? (
                  <IonText color="success">
                    <p style={{ margin: "0 0 6px", fontSize: "0.82rem" }}>
                      Conductor asignado automáticamente.
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
                    : route.status !== "success" && (origin != null || destination != null)
                      ? "Selecciona origen y destino"
                      : rideMode === "scheduled"
                        ? "Confirmar reserva programada"
                        : "Solicitar viaje"
                }
              </IonButton>
            )}

          </IonCardContent>
        </IonCard>

      </IonContent>
    </IonPage>
  );
}
