import { useCallback, useEffect, useRef } from "react";
import {
  IonButton, IonContent, IonHeader, IonIcon, IonPage,
  IonSpinner, IonText, IonTitle, IonToolbar,
  IonCard, IonCardContent, IonNote, IonBadge,
} from "@ionic/react";
import { locateOutline, locationOutline } from "ionicons/icons";
import {
  MapView,
  useGoogleMaps,
  useCurrentLocation,
} from "../../features/maps/index.js";
import type { GoogleMapInstance, GoogleMarkerInstance } from "../../features/maps/index.js";

// Default center — Hanga Roa, Isla de Pascua
const HANGA_ROA = { lat: -27.1500, lng: -109.4333 } as const;

// ── Status display helpers ───────────────────────────────────────────────────

const SDK_STATUS_COLOR: Record<string, string> = {
  loaded:   "success",
  loading:  "warning",
  idle:     "medium",
  error:    "danger",
  "no-key": "danger",
};

const SDK_STATUS_LABEL: Record<string, string> = {
  loaded:   "SDK cargado",
  loading:  "Cargando SDK…",
  idle:     "En espera",
  error:    "Error de carga",
  "no-key": "Key no configurada",
};

const LOC_STATUS_COLOR: Record<string, string> = {
  idle:                 "medium",
  requesting_permission: "warning",
  loading:              "warning",
  success:              "success",
  denied:               "danger",
  error:                "danger",
};

const LOC_STATUS_LABEL: Record<string, string> = {
  idle:                 "Sin ubicación",
  requesting_permission: "Solicitando permiso…",
  loading:              "Obteniendo ubicación…",
  success:              "Ubicación activa",
  denied:               "Permiso denegado",
  error:                "Error de ubicación",
};

// SVG path for a filled circle — used as "My Location" marker icon
const USER_LOCATION_ICON = {
  path: "M 0 -10 A 10 10 0 1 1 -0.001 -10 Z",
  fillColor:    "#4285F4",
  fillOpacity:  1,
  strokeColor:  "#ffffff",
  strokeWeight: 2,
  scale:        1,
  anchor:       { x: 0, y: 0 },
};

// ── Component ────────────────────────────────────────────────────────────────

export function MapTestPage(): JSX.Element {
  const sdkStatus  = useGoogleMaps();
  const location   = useCurrentLocation();

  const mapRef        = useRef<GoogleMapInstance | null>(null);
  const userMarkerRef = useRef<GoogleMarkerInstance | null>(null);

  // Receive map instance from MapView once it initializes
  const handleMapReady = useCallback((map: GoogleMapInstance) => {
    mapRef.current = map;
  }, []);

  // Re-center and update marker whenever a successful location arrives
  useEffect(() => {
    if (location.status !== "success" || !location.location) return;
    const mapsApi = window.google?.maps;
    if (!mapsApi || !mapRef.current) return;

    const latLng = new mapsApi.LatLng(location.location.lat, location.location.lng);

    // Pan to user location
    mapRef.current.setCenter(latLng);
    mapRef.current.setZoom(16);

    // Remove previous user-location marker if present
    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
    }

    // Place new marker
    userMarkerRef.current = new mapsApi.Marker({
      position: latLng,
      map:      mapRef.current,
      title:    "Mi ubicación",
      icon:     USER_LOCATION_ICON,
    });
  }, [location.status, location.location]);

  const isLocating =
    location.status === "requesting_permission" || location.status === "loading";

  const buttonLabel = () => {
    if (location.status === "requesting_permission") return "Solicitando permiso…";
    if (location.status === "loading")               return "Obteniendo ubicación…";
    if (location.status === "success")               return "Centrar en mi ubicación";
    return "Usar mi ubicación";
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Test — Google Maps</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">

        {/* Status badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
          <IonBadge color={SDK_STATUS_COLOR[sdkStatus] ?? "medium"}>
            {SDK_STATUS_LABEL[sdkStatus] ?? sdkStatus}
          </IonBadge>
          <IonBadge color={LOC_STATUS_COLOR[location.status] ?? "medium"}>
            {LOC_STATUS_LABEL[location.status] ?? location.status}
          </IonBadge>
        </div>

        {/* Map */}
        <MapView
          center={HANGA_ROA}
          zoom={14}
          height="340px"
          markers={[{ position: HANGA_ROA, title: "Hanga Roa — RAPA GO" }]}
          onMapReady={handleMapReady}
        />

        {/* Location button */}
        <IonButton
          expand="block"
          fill={location.status === "success" ? "outline" : "solid"}
          style={{ marginTop: "14px" }}
          disabled={isLocating}
          onClick={() => void location.request()}
          aria-label={buttonLabel()}
        >
          {isLocating
            ? <IonSpinner name="dots" slot="start" />
            : <IonIcon icon={location.status === "success" ? locationOutline : locateOutline} slot="start" />
          }
          {buttonLabel()}
        </IonButton>

        {/* Location coordinates — shown on success */}
        {location.status === "success" && location.location && (
          <IonCard style={{ marginTop: "10px", background: "#e8f5e9" }}>
            <IonCardContent style={{ padding: "10px 14px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.8rem" }}>
                <div><strong>Lat:</strong> {location.location.lat.toFixed(6)}</div>
                <div><strong>Lng:</strong> {location.location.lng.toFixed(6)}</div>
              </div>
              <IonNote style={{ fontSize: "0.7rem", display: "block", marginTop: "4px" }}>
                Coordenadas en memoria — no se almacenan ni se envían al backend.
              </IonNote>
            </IonCardContent>
          </IonCard>
        )}

        {/* Permission/error notice */}
        {(location.status === "denied" || location.status === "error") && location.error && (
          <IonCard style={{ marginTop: "10px", background: "var(--ion-color-danger-tint)" }}>
            <IonCardContent style={{ padding: "10px 14px" }}>
              <IonText color="danger">
                <p style={{ margin: 0, fontSize: "0.8rem" }}>{location.error}</p>
              </IonText>
              {location.status === "denied" && (
                <IonNote style={{ fontSize: "0.7rem", display: "block", marginTop: "4px" }}>
                  El mapa permanece centrado en Hanga Roa como ubicación por defecto.
                </IonNote>
              )}
            </IonCardContent>
          </IonCard>
        )}

        {/* Phase note */}
        <IonCard style={{ marginTop: "8px", background: "var(--ion-color-light)" }}>
          <IonCardContent style={{ padding: "10px 14px" }}>
            <IonNote style={{ fontSize: "0.72rem", lineHeight: 1.5 }}>
              Fase 2 completa — ubicación en tiempo real. Fase 3: origen, destino y cálculo de ruta.
            </IonNote>
          </IonCardContent>
        </IonCard>

      </IonContent>
    </IonPage>
  );
}
