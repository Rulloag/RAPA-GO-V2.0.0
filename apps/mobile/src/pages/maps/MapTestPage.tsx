import { useCallback, useEffect, useRef, useState } from "react";
import {
  IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonContent, IonHeader, IonIcon, IonLabel, IonNote, IonPage,
  IonSegment, IonSegmentButton, IonSpinner, IonText, IonTitle, IonToolbar,
  IonSelect, IonSelectOption, IonItem,
} from "@ionic/react";
import {
  locateOutline, locationOutline, navigateOutline,
  closeCircleOutline, searchOutline, listOutline,
} from "ionicons/icons";
import {
  MapView,
  PlaceAutocompleteInput,
  useGoogleMaps,
  useCurrentLocation,
  useDirectionsRoute,
} from "../../features/maps/index.js";
import type {
  GoogleMapInstance,
  GoogleMarkerInstance,
  MapPoint,
} from "../../features/maps/index.js";

// ── Fixed test points (fallback mode) ───────────────────────────────────────

const FIXED_POINTS: MapPoint[] = [
  { label: "Hanga Roa centro",    position: { lat: -27.1500, lng: -109.4333 } },
  { label: "Aeropuerto Mataveri", position: { lat: -27.1648, lng: -109.4218 } },
  { label: "Ahu Tahai",           position: { lat: -27.1417, lng: -109.4293 } },
];

const HANGA_ROA = FIXED_POINTS[0]!.position;

const USER_LOCATION_ICON = {
  path:         "M 0 -10 A 10 10 0 1 1 -0.001 -10 Z",
  fillColor:    "#4285F4",
  fillOpacity:  1,
  strokeColor:  "#ffffff",
  strokeWeight: 2,
  scale:        1,
};

// ── Status badge helpers ─────────────────────────────────────────────────────

const SDK_COLOR: Record<string, string>   = { loaded: "success", loading: "warning", idle: "medium", error: "danger", "no-key": "danger" };
const SDK_LABEL: Record<string, string>   = { loaded: "SDK cargado", loading: "Cargando SDK…", idle: "En espera", error: "Error", "no-key": "Sin API key" };
const LOC_COLOR: Record<string, string>   = { idle: "medium", requesting_permission: "warning", loading: "warning", success: "success", denied: "danger", error: "danger" };
const LOC_LABEL: Record<string, string>   = { idle: "Sin GPS", requesting_permission: "Solicitando…", loading: "Obteniendo…", success: "GPS activo", denied: "Denegado", error: "Error GPS" };
const ROUTE_COLOR: Record<string, string> = { idle: "medium", loading: "warning", success: "success", error: "danger" };
const ROUTE_LABEL: Record<string, string> = { idle: "Sin ruta", loading: "Calculando…", success: "Ruta lista", error: "Error ruta" };

// ── Component ────────────────────────────────────────────────────────────────

type InputMode = "autocomplete" | "fixed";

export function MapTestPage(): JSX.Element {
  const sdkStatus = useGoogleMaps();
  const location  = useCurrentLocation();
  const route     = useDirectionsRoute();

  const mapRef        = useRef<GoogleMapInstance | null>(null);
  const userMarkerRef = useRef<GoogleMarkerInstance | null>(null);

  // Search mode: autocomplete inputs vs fixed point selects
  const [inputMode, setInputMode] = useState<InputMode>("autocomplete");

  // Selected points (both modes share these)
  const [origin,      setOrigin]      = useState<MapPoint | null>(null);
  const [destination, setDestination] = useState<MapPoint | null>(null);

  // Display values for autocomplete inputs (controlled text)
  const [originDisplay,      setOriginDisplay]      = useState("");
  const [destinationDisplay, setDestinationDisplay] = useState("");

  // Fixed-mode indices
  const [fixedOriginIdx, setFixedOriginIdx]           = useState(0);
  const [fixedDestinationIdx, setFixedDestinationIdx] = useState(1);

  // ── Map ready ──────────────────────────────────────────────────────────────

  const handleMapReady = useCallback((map: GoogleMapInstance) => {
    mapRef.current = map;
  }, []);

  // ── GPS location → update map + set as origin option ──────────────────────

  useEffect(() => {
    if (location.status !== "success" || !location.location) return;
    const mapsApi = window.google?.maps;
    if (!mapsApi?.LatLng || !mapsApi.Marker || !mapRef.current) return;

    const latLng = new mapsApi.LatLng(location.location.lat, location.location.lng);
    mapRef.current.setCenter(latLng);
    mapRef.current.setZoom(16);

    userMarkerRef.current?.setMap(null);
    userMarkerRef.current = new mapsApi.Marker({
      position: latLng,
      map:      mapRef.current,
      title:    "Mi ubicación",
      icon:     USER_LOCATION_ICON,
    });
  }, [location.status, location.location]);

  // ── "Use my location" as origin ────────────────────────────────────────────

  const handleUseMyLocationAsOrigin = useCallback(() => {
    if (location.status === "success" && location.location) {
      const point: MapPoint = { label: "Mi ubicación", position: location.location };
      setOrigin(point);
      setOriginDisplay("Mi ubicación");
    }
  }, [location.status, location.location]);

  // ── Autocomplete callbacks ─────────────────────────────────────────────────

  const handleOriginSelect = useCallback((point: MapPoint) => {
    setOrigin(point);
    setOriginDisplay(point.label);
    route.clear();
  }, [route]);

  const handleDestinationSelect = useCallback((point: MapPoint) => {
    setDestination(point);
    setDestinationDisplay(point.label);
    route.clear();
  }, [route]);

  const handleOriginClear = useCallback(() => {
    setOrigin(null);
    setOriginDisplay("");
    route.clear();
  }, [route]);

  const handleDestinationClear = useCallback(() => {
    setDestination(null);
    setDestinationDisplay("");
    route.clear();
  }, [route]);

  // ── Fixed mode: sync to shared points ─────────────────────────────────────

  useEffect(() => {
    if (inputMode !== "fixed") return;
    setOrigin(FIXED_POINTS[fixedOriginIdx] ?? null);
    setDestination(FIXED_POINTS[fixedDestinationIdx] ?? null);
  }, [inputMode, fixedOriginIdx, fixedDestinationIdx]);

  // ── Mode switch: clear route and selections ────────────────────────────────

  const handleModeChange = useCallback((mode: InputMode) => {
    setInputMode(mode);
    setOrigin(null);
    setDestination(null);
    setOriginDisplay("");
    setDestinationDisplay("");
    route.clear();
    if (mode === "fixed") {
      setOrigin(FIXED_POINTS[fixedOriginIdx] ?? null);
      setDestination(FIXED_POINTS[fixedDestinationIdx] ?? null);
    }
  }, [route, fixedOriginIdx, fixedDestinationIdx]);

  // ── Calculate route ────────────────────────────────────────────────────────

  const handleCalculate = useCallback(async () => {
    if (!origin || !destination || !mapRef.current) return;
    await route.calculate(origin.position, destination.position, mapRef.current);
  }, [origin, destination, route]);

  // ── Guards ─────────────────────────────────────────────────────────────────

  const isLocating   = location.status === "requesting_permission" || location.status === "loading";
  const samePoint    = origin && destination && origin.label === destination.label
    && origin.position.lat === destination.position.lat
    && origin.position.lng === destination.position.lng;
  const canCalculate = !!origin && !!destination && !samePoint && sdkStatus === "loaded" && route.status !== "loading";

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Test — Google Maps</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">

        {/* Status row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
          <IonBadge color={SDK_COLOR[sdkStatus]        ?? "medium"}>{SDK_LABEL[sdkStatus]        ?? sdkStatus}</IonBadge>
          <IonBadge color={LOC_COLOR[location.status]  ?? "medium"}>{LOC_LABEL[location.status]  ?? location.status}</IonBadge>
          <IonBadge color={ROUTE_COLOR[route.status]   ?? "medium"}>{ROUTE_LABEL[route.status]   ?? route.status}</IonBadge>
        </div>

        {/* Map */}
        <MapView
          center={HANGA_ROA}
          zoom={14}
          height="280px"
          markers={[{ position: HANGA_ROA, title: "Hanga Roa — RAPA GO" }]}
          onMapReady={handleMapReady}
        />

        {/* GPS button */}
        <IonButton
          expand="block"
          fill={location.status === "success" ? "outline" : "solid"}
          style={{ marginTop: "12px" }}
          disabled={isLocating}
          onClick={() => void location.request()}
          aria-label="Usar mi ubicación"
        >
          {isLocating
            ? <IonSpinner name="dots" slot="start" />
            : <IonIcon icon={location.status === "success" ? locationOutline : locateOutline} slot="start" />
          }
          {isLocating
            ? (location.status === "requesting_permission" ? "Solicitando permiso…" : "Obteniendo ubicación…")
            : (location.status === "success" ? "Centrar en mi ubicación" : "Usar mi ubicación")}
        </IonButton>

        {location.status === "success" && location.location && (
          <IonNote style={{ display: "block", textAlign: "center", fontSize: "0.72rem", marginTop: "2px", color: "var(--ion-color-medium)" }}>
            {location.location.lat.toFixed(5)}, {location.location.lng.toFixed(5)} · solo en memoria
          </IonNote>
        )}

        {(location.status === "denied" || location.status === "error") && location.error && (
          <IonCard style={{ marginTop: "8px", background: "var(--ion-color-danger-tint)" }}>
            <IonCardContent style={{ padding: "10px 14px" }}>
              <IonText color="danger"><p style={{ margin: 0, fontSize: "0.8rem" }}>{location.error}</p></IonText>
            </IonCardContent>
          </IonCard>
        )}

        {/* ── Route section ── */}
        <IonCard style={{ marginTop: "16px" }}>
          <IonCardHeader style={{ paddingBottom: "6px" }}>
            <IonCardTitle style={{ fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "6px" }}>
              <IonIcon icon={navigateOutline} />
              Calcular ruta
            </IonCardTitle>
          </IonCardHeader>

          <IonCardContent style={{ paddingTop: 0 }}>

            {/* Mode toggle */}
            <IonSegment
              value={inputMode}
              onIonChange={(e) => handleModeChange(e.detail.value as InputMode)}
              style={{ marginBottom: "14px" }}
            >
              <IonSegmentButton value="autocomplete">
                <IonIcon icon={searchOutline} style={{ marginRight: "4px" }} />
                <IonLabel>Buscar</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="fixed">
                <IonIcon icon={listOutline} style={{ marginRight: "4px" }} />
                <IonLabel>Puntos fijos</IonLabel>
              </IonSegmentButton>
            </IonSegment>

            {/* ── Autocomplete mode ── */}
            {inputMode === "autocomplete" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <PlaceAutocompleteInput
                    label="Origen"
                    placeholder="¿Desde dónde?"
                    displayValue={originDisplay}
                    onSelect={handleOriginSelect}
                    onClear={handleOriginClear}
                    iconSlot={navigateOutline}
                  />
                  {location.status === "success" && (
                    <button
                      onClick={handleUseMyLocationAsOrigin}
                      style={{
                        background: "none", border: "none", padding: "4px 4px 0",
                        cursor: "pointer", display: "flex", alignItems: "center",
                        gap: "4px", color: "var(--ion-color-primary)", fontSize: "0.75rem",
                      }}
                      aria-label="Usar mi ubicación como origen"
                    >
                      <IonIcon icon={locateOutline} style={{ fontSize: "0.85rem" }} />
                      Usar mi ubicación como origen
                    </button>
                  )}
                </div>

                <PlaceAutocompleteInput
                  label="Destino"
                  placeholder="¿A dónde vas?"
                  displayValue={destinationDisplay}
                  onSelect={handleDestinationSelect}
                  onClear={handleDestinationClear}
                  iconSlot={locationOutline}
                />
              </div>
            )}

            {/* ── Fixed points mode ── */}
            {inputMode === "fixed" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <IonItem lines="full">
                  <IonLabel position="stacked" style={{ fontSize: "0.75rem" }}>Origen</IonLabel>
                  <IonSelect
                    interface="action-sheet"
                    value={fixedOriginIdx}
                    onIonChange={(e) => setFixedOriginIdx(e.detail.value as number)}
                    aria-label="Seleccionar origen"
                  >
                    {FIXED_POINTS.map((p, i) => (
                      <IonSelectOption key={i} value={i}>{p.label}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>

                <IonItem lines="none">
                  <IonLabel position="stacked" style={{ fontSize: "0.75rem" }}>Destino</IonLabel>
                  <IonSelect
                    interface="action-sheet"
                    value={fixedDestinationIdx}
                    onIonChange={(e) => setFixedDestinationIdx(e.detail.value as number)}
                    aria-label="Seleccionar destino"
                  >
                    {FIXED_POINTS.map((p, i) => (
                      <IonSelectOption key={i} value={i}>{p.label}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
              </div>
            )}

            {samePoint && (
              <IonNote color="warning" style={{ fontSize: "0.72rem", display: "block", margin: "6px 0 0" }}>
                Origen y destino son el mismo punto.
              </IonNote>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
              <IonButton
                expand="block"
                style={{ flex: 1 }}
                disabled={!canCalculate}
                onClick={() => void handleCalculate()}
                aria-label="Calcular ruta"
              >
                {route.status === "loading"
                  ? <IonSpinner name="dots" />
                  : <><IonIcon icon={navigateOutline} slot="start" />Calcular ruta</>
                }
              </IonButton>

              {route.status !== "idle" && (
                <IonButton
                  fill="outline"
                  color="medium"
                  style={{ flexShrink: 0 }}
                  onClick={() => route.clear()}
                  aria-label="Limpiar ruta"
                >
                  <IonIcon icon={closeCircleOutline} />
                </IonButton>
              )}
            </div>

          </IonCardContent>
        </IonCard>

        {/* Route result */}
        {route.status === "success" && route.summary && (
          <IonCard style={{ marginTop: "8px", background: "#e8f5e9" }}>
            <IonCardContent style={{ padding: "12px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "6px" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--ion-color-primary)" }}>
                    {route.summary.distanceText}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>Distancia</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--ion-color-primary)" }}>
                    {route.summary.durationText}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>Duración estimada</div>
                </div>
              </div>
              {origin && destination && (
                <IonNote style={{ fontSize: "0.68rem", display: "block", textAlign: "center" }}>
                  {origin.label} → {destination.label}
                </IonNote>
              )}
            </IonCardContent>
          </IonCard>
        )}

        {/* Route error */}
        {route.status === "error" && route.error && (
          <IonCard style={{ marginTop: "8px", background: "var(--ion-color-danger-tint)" }}>
            <IonCardContent style={{ padding: "10px 14px" }}>
              <IonText color="danger"><p style={{ margin: 0, fontSize: "0.8rem" }}>{route.error}</p></IonText>
            </IonCardContent>
          </IonCard>
        )}

        {/* Phase note */}
        <IonCard style={{ marginTop: "10px", marginBottom: "24px", background: "var(--ion-color-light)" }}>
          <IonCardContent style={{ padding: "10px 14px" }}>
            <IonNote style={{ fontSize: "0.72rem", lineHeight: 1.5 }}>
              Fase 4 completa — Places Autocomplete + puntos fijos + GPS como origen.
              Siguiente: conectar con RequestRidePage y solicitud de viaje.
            </IonNote>
          </IonCardContent>
        </IonCard>

      </IonContent>
    </IonPage>
  );
}
