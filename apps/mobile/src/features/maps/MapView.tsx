import { useEffect, useRef } from "react";
import { IonSpinner, IonText } from "@ionic/react";
import { useGoogleMaps } from "./useGoogleMaps.js";
import type { MapViewOptions, GoogleMapInstance } from "./maps.types.js";

interface MapViewProps extends MapViewOptions {
  height?: string;
  /** Called once the map instance is ready — use to attach ride/route logic later. */
  onMapReady?: (map: GoogleMapInstance) => void;
}

function NoKeyNotice(): JSX.Element {
  return (
    <div style={containerStyle}>
      <div style={noticeCardStyle}>
        <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🗺️</div>
        <p style={{ fontWeight: 700, margin: "0 0 4px", fontSize: "0.9rem", color: "var(--ion-color-dark)" }}>
          Google Maps no configurado
        </p>
        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--ion-color-medium)", lineHeight: 1.4 }}>
          Agrega <code style={{ background: "#f0f0f0", padding: "1px 4px", borderRadius: "3px" }}>VITE_GOOGLE_MAPS_API_KEY</code> en{" "}
          <code style={{ background: "#f0f0f0", padding: "1px 4px", borderRadius: "3px" }}>apps/mobile/.env</code>
        </p>
      </div>
    </div>
  );
}

function LoadingState({ height }: { height: string }): JSX.Element {
  return (
    <div style={{ ...containerStyle, height }}>
      <IonSpinner name="crescent" />
      <IonText color="medium">
        <p style={{ margin: "8px 0 0", fontSize: "0.8rem" }}>Cargando mapa…</p>
      </IonText>
    </div>
  );
}

function ErrorState({ height }: { height: string }): JSX.Element {
  return (
    <div style={{ ...containerStyle, height }}>
      <div style={noticeCardStyle}>
        <div style={{ fontSize: "1.5rem", marginBottom: "6px" }}>⚠️</div>
        <p style={{ fontWeight: 700, margin: "0 0 4px", fontSize: "0.85rem", color: "var(--ion-color-danger)" }}>
          Error al cargar el mapa
        </p>
        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--ion-color-medium)" }}>
          Verifica que la API key sea válida y tenga la Maps JavaScript API habilitada.
        </p>
      </div>
    </div>
  );
}

/**
 * MapView — renders a Google Maps instance in an isolated div.
 *
 * Gracefully handles: missing key, loading state, SDK errors.
 * Ready to receive ride origin/destination/route logic via `onMapReady`.
 */
export function MapView({
  center,
  zoom       = 14,
  markers    = [],
  height     = "300px",
  onMapReady,
}: MapViewProps): JSX.Element {
  const mapStatus  = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef       = useRef<GoogleMapInstance | null>(null);

  useEffect(() => {
    if (mapStatus !== "loaded") return;
    if (!containerRef.current)  return;
    if (!window.google?.maps?.Map) return; // Map class must be available
    // Avoid re-initializing on fast re-renders
    if (mapRef.current)         return;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const mapsApi = window.google!.maps!; // guarded above: Map is present

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const map = new mapsApi.Map!(containerRef.current, {
      center,
      zoom,
      disableDefaultUI:    false,
      zoomControl:         true,
      mapTypeControl:      false,
      streetViewControl:   false,
      fullscreenControl:   false,
      gestureHandling:     "greedy",
    });

    mapRef.current = map;

    // Drop markers
    for (const m of markers) {
      if (mapsApi.Marker && mapsApi.LatLng) {
        new mapsApi.Marker({
          position: new mapsApi.LatLng(m.position.lat, m.position.lng),
          map,
          title: m.title,
        });
      }
    }

    onMapReady?.(map);
  }, [mapStatus, center, zoom, markers, onMapReady]);

  if (mapStatus === "no-key") return <NoKeyNotice />;
  if (mapStatus === "loading" || mapStatus === "idle") return <LoadingState height={height} />;
  if (mapStatus === "error") return <ErrorState height={height} />;

  return (
    <div
      ref={containerRef}
      style={{
        width:        "100%",
        height,
        borderRadius: "12px",
        overflow:     "hidden",
        border:       "1px solid var(--ion-color-light-shade)",
        background:   "var(--ion-color-light)",
      }}
      aria-label="Mapa de Rapa Nui"
      role="img"
    />
  );
}

// ── Shared layout helpers ────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display:        "flex",
  flexDirection:  "column",
  alignItems:     "center",
  justifyContent: "center",
  width:          "100%",
  minHeight:      "180px",
  borderRadius:   "12px",
  border:         "1px solid var(--ion-color-light-shade)",
  background:     "var(--ion-color-light)",
  padding:        "16px",
};

const noticeCardStyle: React.CSSProperties = {
  textAlign:    "center",
  background:   "#fff",
  borderRadius: "10px",
  padding:      "16px 20px",
  maxWidth:     "280px",
  boxShadow:    "0 2px 8px rgba(0,0,0,0.08)",
};
