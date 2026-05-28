import {
  IonButton, IonCard, IonCardContent, IonContent, IonHeader,
  IonIcon, IonNote, IonPage, IonSpinner, IonText, IonTitle, IonToolbar,
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

// ── Types ─────────────────────────────────────────────────────────────────────

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

  const [origin,      setOrigin]      = useState<MapPoint | null>(null);
  const [destination, setDestination] = useState<MapPoint | null>(null);
  const [notes,       setNotes]       = useState("");
  const [pageStatus,  setPageStatus]  = useState<PageStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted,   setSubmitted]   = useState<RideRequestData | null>(null);
  const [mapInstance, setMapInstance] = useState<GoogleMapInstance | null>(null);

  const route = useDirectionsRoute();
  const geo   = useCurrentLocation();

  // Stable references to avoid stale closures in callbacks
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

  function handleReset() {
    setOrigin(null);
    setDestination(null);
    setNotes("");
    clearRoute();
    setSubmitted(null);
    setSubmitError(null);
    setPageStatus("idle");
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

    setPageStatus("submitting");
    setSubmitError(null);

    try {
      const trimmedNotes = notes.trim();
      const ride = await ridesService.createRideRequest(session.accessToken, {
        originText:      origin.label,
        destinationText: destination.label,
        originLat:       origin.position.lat,
        originLng:       origin.position.lng,
        destinationLat:  destination.position.lat,
        destinationLng:  destination.position.lng,
        distanceMeters:  route.summary.distanceValue,
        durationSeconds: route.summary.durationValue,
        ...(trimmedNotes ? { notes: trimmedNotes } : {}),
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
    pageStatus === "submitting"       ||
    pageStatus === "calculating_route" ||
    pageStatus === "success"          ||
    !origin                           ||
    !destination                      ||
    route.status !== "success";

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
                marginBottom: "12px",
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
                <span style={{
                  fontSize: "0.72rem",
                  color: "var(--ion-color-medium)",
                  fontStyle: "italic",
                }}>
                  Ruta calculada
                </span>
              </div>
            )}

            {route.status === "error" && route.error && (
              <IonText color="danger">
                <p style={{ margin: "0 0 10px", fontSize: "0.82rem" }}>{route.error}</p>
              </IonText>
            )}

            {/* ── Notes ──────────────────────────────────────────────────── */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{
                fontSize: "0.72rem", fontWeight: 600,
                color: "var(--ion-color-medium)",
                marginBottom: "4px", paddingLeft: "4px",
                letterSpacing: "0.03em", textTransform: "uppercase",
              }}>
                Notas (opcional)
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Llevar maletas grandes"
                maxLength={500}
                rows={2}
                disabled={pageStatus === "submitting" || pageStatus === "success"}
                style={{
                  width: "100%",
                  border: "1.5px solid var(--ion-color-light-shade)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  fontSize: "0.9rem",
                  resize: "none",
                  background: "var(--ion-card-background, #fff)",
                  color: "var(--ion-color-dark)",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
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

                {submitted.estimatedFareClp != null && (
                  <div style={{
                    padding: "10px 14px",
                    background: "var(--ion-color-light)",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
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
                      <strong>Tarifa estimada: ${submitted.estimatedFareClp.toLocaleString("es-CL")} CLP</strong>
                    )}
                    <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "4px" }}>
                      Tarifa referencial. El precio final lo acuerda con el conductor.
                    </div>
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
