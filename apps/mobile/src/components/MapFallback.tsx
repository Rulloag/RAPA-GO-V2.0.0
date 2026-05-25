import { IonCard, IonCardContent, IonText, IonNote } from "@ionic/react";
import { useConnectivity } from "../hooks/useConnectivity.js";
import { getDistanceBetween, getEstimatedFare } from "@rapa-go/shared";

interface MapPoint {
  id?:   string;
  text:  string;
  lat?:  number | null;
  lng?:  number | null;
}

interface MapFallbackProps {
  origin:      MapPoint;
  destination: MapPoint;
  height?:     number;
  showRoute?:  boolean;
}

function OfflineFallback({
  origin,
  destination,
  height,
}: {
  origin:      MapPoint;
  destination: MapPoint;
  height:      number;
}) {
  const dist = (origin.id && destination.id)
    ? getDistanceBetween(origin.id, destination.id)
    : null;

  return (
    <div
      style={{
        height,
        borderRadius: "10px",
        overflow:     "hidden",
        border:       "1px solid var(--ion-color-medium-shade)",
        background:   "linear-gradient(135deg, #e8f0e9 0%, #d4e6d5 40%, #c8ddc9 100%)",
        display:      "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding:      "14px 16px",
        gap:          "8px",
        position:     "relative",
      }}
    >
      {/* Decorative grid */}
      <svg style={{ position: "absolute", inset: 0, opacity: 0.1, width: "100%", height: "100%" }} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((y) => (
          <line key={`h${y}`} x1="0%" y1={`${y * 100}%`} x2="100%" y2={`${y * 100}%`} stroke="#2d6a4f" strokeWidth="1" />
        ))}
        {[0.2, 0.4, 0.6, 0.8].map((x) => (
          <line key={`v${x}`} x1={`${x * 100}%`} y1="0%" x2={`${x * 100}%`} y2="100%" stroke="#2d6a4f" strokeWidth="1" />
        ))}
        <path d="M 5% 75% Q 45% 35% 95% 20%" stroke="#74c69d" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>

      {/* Route info card */}
      <div style={{ zIndex: 1, background: "rgba(255,255,255,0.92)", borderRadius: "8px", padding: "10px 12px" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ion-color-dark)", marginBottom: "4px" }}>
          <span style={{ color: "var(--ion-color-success-shade)" }}>▲</span> {origin.text}
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--ion-color-medium)", margin: "2px 6px" }}>↓</div>
        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ion-color-dark)", marginBottom: "6px" }}>
          <span style={{ color: "var(--ion-color-danger)" }}>▼</span> {destination.text}
        </div>

        {dist ? (
          <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "var(--ion-color-dark)" }}>
            <span>📏 {dist.km} km</span>
            <span>⏱ ~{dist.minutes} min</span>
            <span>💰 ${getEstimatedFare(dist.km).toLocaleString("es-CL")} CLP est.</span>
          </div>
        ) : (
          <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)" }}>
            Distancia a confirmar por operador
          </div>
        )}
      </div>

      {/* Offline notice */}
      <div style={{ zIndex: 1, background: "rgba(255,243,205,0.95)", borderRadius: "6px", padding: "5px 10px" }}>
        <IonText>
          <p style={{ margin: 0, fontSize: "0.68rem", color: "#6b4700" }}>
            Mapa no disponible sin conexión. Siga las indicaciones del conductor.
          </p>
        </IonText>
      </div>
    </div>
  );
}

const GOOGLE_MAPS_API_KEY = import.meta.env["VITE_GOOGLE_MAPS_API_KEY"] as string | undefined;

function OnlineMap({
  origin,
  destination,
  height,
}: {
  origin:      MapPoint;
  destination: MapPoint;
  height:      number;
}) {
  const q = encodeURIComponent(`${origin.text}, Isla de Pascua, Chile`);
  const dq = encodeURIComponent(`${destination.text}, Isla de Pascua, Chile`);
  const src = `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_API_KEY}&origin=${q}&destination=${dq}&mode=driving`;

  return (
    <div style={{ height, borderRadius: "10px", overflow: "hidden", border: "1px solid var(--ion-color-medium-shade)", position: "relative" }}>
      <iframe
        src={src}
        width="100%"
        height={height}
        style={{ border: 0, display: "block" }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title={`Ruta de ${origin.text} a ${destination.text}`}
      />
    </div>
  );
}

export function MapFallback({
  origin,
  destination,
  height     = 220,
  showRoute  = true,
}: MapFallbackProps): JSX.Element {
  const isOnline = useConnectivity();

  if (!showRoute || !isOnline || !GOOGLE_MAPS_API_KEY) {
    return <OfflineFallback origin={origin} destination={destination} height={height} />;
  }

  return <OnlineMap origin={origin} destination={destination} height={height} />;
}

export function RouteEstimate({
  originId,
  destId,
}: {
  originId: string;
  destId:   string;
}): JSX.Element | null {
  const dist = getDistanceBetween(originId, destId);
  if (!dist) return null;

  return (
    <IonCard style={{ margin: "8px 0 0" }}>
      <IonCardContent style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "0.82rem" }}>
          <span><strong>📏</strong> {dist.km} km</span>
          <span><strong>⏱</strong> ~{dist.minutes} min</span>
          <span><strong>💰</strong> ${getEstimatedFare(dist.km).toLocaleString("es-CL")} CLP est.</span>
        </div>
        <IonNote style={{ fontSize: "0.7rem", display: "block", marginTop: "4px" }}>
          Tarifa estimada — sujeta a confirmación del operador
        </IonNote>
      </IonCardContent>
    </IonCard>
  );
}
