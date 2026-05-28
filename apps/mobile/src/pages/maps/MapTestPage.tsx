import { useCallback, useEffect, useRef, useState } from "react";
import {
  IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonNote, IonPage,
  IonSelect, IonSelectOption, IonSpinner, IonText, IonTitle, IonToolbar,
} from "@ionic/react";
import { locateOutline, locationOutline, navigateOutline, closeCircleOutline } from "ionicons/icons";
import {
  MapView,
  useGoogleMaps,
  useCurrentLocation,
  useDirectionsRoute,
} from "../../features/maps/index.js";
import type {
  GoogleMapInstance,
  GoogleMarkerInstance,
  MapPoint,
} from "../../features/maps/index.js";

// ── Predefined test points for Rapa Nui ─────────────────────────────────────

const POINTS: MapPoint[] = [
  { label: "Hanga Roa centro",    position: { lat: -27.1500, lng: -109.4333 } },
  { label: "Aeropuerto Mataveri", position: { lat: -27.1648, lng: -109.4218 } },
  { label: "Ahu Tahai",           position: { lat: -27.1417, lng: -109.4293 } },
];

const HANGA_ROA = POINTS[0]!.position;

// ── SVG user-location icon (blue dot) ───────────────────────────────────────

const USER_LOCATION_ICON = {
  path:         "M 0 -10 A 10 10 0 1 1 -0.001 -10 Z",
  fillColor:    "#4285F4",
  fillOpacity:  1,
  strokeColor:  "#ffffff",
  strokeWeight: 2,
  scale:        1,
};

// ── Status helpers ───────────────────────────────────────────────────────────

const SDK_COLOR: Record<string, string> = {
  loaded: "success", loading: "warning", idle: "medium", error: "danger", "no-key": "danger",
};
const SDK_LABEL: Record<string, string> = {
  loaded: "SDK cargado", loading: "Cargando SDK…", idle: "En espera",
  error:  "Error de carga", "no-key": "Key no configurada",
};
const LOC_COLOR: Record<string, string> = {
  idle: "medium", requesting_permission: "warning", loading: "warning",
  success: "success", denied: "danger", error: "danger",
};
const LOC_LABEL: Record<string, string> = {
  idle: "Sin ubicación", requesting_permission: "Solicitando…",
  loading: "Obteniendo…", success: "Ubicación activa",
  denied: "Permiso denegado", error: "Error de ubicación",
};
const ROUTE_COLOR: Record<string, string> = {
  idle: "medium", loading: "warning", success: "success", error: "danger",
};
const ROUTE_LABEL: Record<string, string> = {
  idle: "Sin ruta", loading: "Calculando…", success: "Ruta calculada", error: "Error de ruta",
};

// ── Component ────────────────────────────────────────────────────────────────

export function MapTestPage(): JSX.Element {
  const sdkStatus = useGoogleMaps();
  const location  = useCurrentLocation();
  const route     = useDirectionsRoute();

  const mapRef        = useRef<GoogleMapInstance | null>(null);
  const userMarkerRef = useRef<GoogleMarkerInstance | null>(null);

  const [selectedOriginIdx,      setSelectedOriginIdx]      = useState<number>(0);
  const [selectedDestinationIdx, setSelectedDestinationIdx] = useState<number>(1);

  const handleMapReady = useCallback((map: GoogleMapInstance) => {
    mapRef.current = map;
  }, []);

  // Re-center and update user-location marker when GPS fix arrives
  useEffect(() => {
    if (location.status !== "success" || !location.location) return;
    const mapsApi = window.google?.maps;
    if (!mapsApi || !mapRef.current) return;

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

  const handleCalculate = useCallback(async () => {
    const origin      = POINTS[selectedOriginIdx]?.position;
    const destination = POINTS[selectedDestinationIdx]?.position;
    const map         = mapRef.current;
    if (!origin || !destination || !map) return;
    await route.calculate(origin, destination, map);
  }, [selectedOriginIdx, selectedDestinationIdx, route]);

  const handleClear = useCallback(() => {
    route.clear();
  }, [route]);

  const isLocating = location.status === "requesting_permission" || location.status === "loading";
  const samePoint  = selectedOriginIdx === selectedDestinationIdx;

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
          <IonBadge color={SDK_COLOR[sdkStatus]   ?? "medium"}>{SDK_LABEL[sdkStatus]   ?? sdkStatus}</IonBadge>
          <IonBadge color={LOC_COLOR[location.status]  ?? "medium"}>{LOC_LABEL[location.status]  ?? location.status}</IonBadge>
          <IonBadge color={ROUTE_COLOR[route.status] ?? "medium"}>{ROUTE_LABEL[route.status] ?? route.status}</IonBadge>
        </div>

        {/* Map */}
        <MapView
          center={HANGA_ROA}
          zoom={14}
          height="300px"
          markers={[{ position: HANGA_ROA, title: "Hanga Roa — RAPA GO" }]}
          onMapReady={handleMapReady}
        />

        {/* Ubicación actual */}
        <IonButton
          expand="block"
          fill={location.status === "success" ? "outline" : "solid"}
          style={{ marginTop: "12px" }}
          disabled={isLocating}
          onClick={() => void location.request()}
          aria-label={isLocating ? "Obteniendo ubicación" : "Usar mi ubicación"}
        >
          {isLocating
            ? <IonSpinner name="dots" slot="start" />
            : <IonIcon icon={location.status === "success" ? locationOutline : locateOutline} slot="start" />
          }
          {isLocating
            ? (location.status === "requesting_permission" ? "Solicitando permiso…" : "Obteniendo ubicación…")
            : (location.status === "success" ? "Centrar en mi ubicación" : "Usar mi ubicación")}
        </IonButton>

        {/* Coordinates on success */}
        {location.status === "success" && location.location && (
          <IonNote style={{ display: "block", textAlign: "center", fontSize: "0.72rem", marginTop: "4px", color: "var(--ion-color-medium)" }}>
            {location.location.lat.toFixed(5)}, {location.location.lng.toFixed(5)}
            {" · "}solo en memoria
          </IonNote>
        )}

        {/* Location error */}
        {(location.status === "denied" || location.status === "error") && location.error && (
          <IonCard style={{ marginTop: "8px", background: "var(--ion-color-danger-tint)" }}>
            <IonCardContent style={{ padding: "10px 14px" }}>
              <IonText color="danger"><p style={{ margin: 0, fontSize: "0.8rem" }}>{location.error}</p></IonText>
              {location.status === "denied" && (
                <IonNote style={{ fontSize: "0.7rem", display: "block", marginTop: "4px" }}>
                  Mapa centrado en Hanga Roa por defecto.
                </IonNote>
              )}
            </IonCardContent>
          </IonCard>
        )}

        {/* ── Route section ── */}
        <IonCard style={{ marginTop: "16px" }}>
          <IonCardHeader style={{ paddingBottom: "4px" }}>
            <IonCardTitle style={{ fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "6px" }}>
              <IonIcon icon={navigateOutline} />
              Calcular ruta
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent style={{ paddingTop: 0 }}>

            <IonItem lines="full">
              <IonLabel position="stacked" style={{ fontSize: "0.75rem", marginBottom: "4px" }}>
                Origen
              </IonLabel>
              <IonSelect
                interface="action-sheet"
                value={selectedOriginIdx}
                onIonChange={(e) => setSelectedOriginIdx(e.detail.value as number)}
                placeholder="Selecciona origen"
                aria-label="Seleccionar punto de origen"
              >
                {POINTS.map((p, i) => (
                  <IonSelectOption key={i} value={i}>{p.label}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            <IonItem lines="none" style={{ marginTop: "4px" }}>
              <IonLabel position="stacked" style={{ fontSize: "0.75rem", marginBottom: "4px" }}>
                Destino
              </IonLabel>
              <IonSelect
                interface="action-sheet"
                value={selectedDestinationIdx}
                onIonChange={(e) => setSelectedDestinationIdx(e.detail.value as number)}
                placeholder="Selecciona destino"
                aria-label="Seleccionar punto de destino"
              >
                {POINTS.map((p, i) => (
                  <IonSelectOption key={i} value={i}>{p.label}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            {samePoint && (
              <IonNote color="warning" style={{ fontSize: "0.72rem", display: "block", margin: "6px 0 0 4px" }}>
                Origen y destino son el mismo punto.
              </IonNote>
            )}

            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <IonButton
                expand="block"
                style={{ flex: 1 }}
                disabled={route.status === "loading" || samePoint || sdkStatus !== "loaded"}
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
                  onClick={handleClear}
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--ion-color-primary)" }}>
                    {route.summary.distanceText}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>Distancia</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--ion-color-primary)" }}>
                    {route.summary.durationText}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>Duración estimada</div>
                </div>
              </div>
              <IonNote style={{ fontSize: "0.68rem", display: "block", marginTop: "8px", textAlign: "center" }}>
                Ruta en auto · datos de Google Maps
              </IonNote>
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
              Fase 3 completa — selección de puntos y cálculo de ruta.
              Fase 4: integración con RequestRidePage, Places Autocomplete y solicitud de viaje.
            </IonNote>
          </IonCardContent>
        </IonCard>

      </IonContent>
    </IonPage>
  );
}
