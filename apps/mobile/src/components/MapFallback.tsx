import {
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonNote,
} from "@ionic/react";
import {
  carOutline,
  navigateOutline,
  walkOutline,
  warningOutline,
} from "ionicons/icons";
import {
  GoogleMap,
  MarkerF,
  PolylineF,
  useJsApiLoader,
} from "@react-google-maps/api";
import { useMemo, useState } from "react";
import { useConnectivity } from "../hooks/useConnectivity.js";
import { getDistanceBetween, getEstimatedFare } from "@rapa-go/shared";

interface MapPoint {
  id?: string;
  text: string;
  lat?: number | null;
  lng?: number | null;
}

interface MapFallbackProps {
  origin: MapPoint;
  destination: MapPoint;
  height?: number;
  showRoute?: boolean;
}

const RAPA_NUI_CENTER = {
  lat: -27.1505,
  lng: -109.4325,
};

const ISLAND_BOUNDS = {
  north: -27.045,
  south: -27.205,
  east: -109.250,
  west: -109.500,
};

const PICKUP_POINTS = [
  {
    id: "hanga-roa-centro",
    name: "Hanga Roa Centro",
    address: "Atamu Tekena",
    lat: -27.1505,
    lng: -109.4325,
  },
  {
    id: "ara-piki",
    name: "Ara Piki",
    address: "Calle principal accesible",
    lat: -27.1489,
    lng: -109.4258,
  },
  {
    id: "aeropuerto-mataveri",
    name: "Aeropuerto Mataveri",
    address: "Acceso principal",
    lat: -27.1648,
    lng: -109.4218,
  },
  {
    id: "tahai",
    name: "Tahai",
    address: "Punto turístico accesible",
    lat: -27.1417,
    lng: -109.4305,
  },
];

const GOOGLE_MAPS_API_KEY = import.meta.env[
  "VITE_GOOGLE_MAPS_API_KEY"
] as string | undefined;

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const earth = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) *
      Math.sin(dLng / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);

  return earth * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function getRecommendedPickup(origin: MapPoint) {
  if (origin.lat == null || origin.lng == null) return null;

  const current = { lat: origin.lat, lng: origin.lng };

  const sorted = [...PICKUP_POINTS].sort((a, b) => {
    return distanceMeters(current, a) - distanceMeters(current, b);
  });

  const pickup = sorted[0];
  const meters = Math.round(distanceMeters(current, pickup));

  return {
    ...pickup,
    meters,
    minutes: Math.max(1, Math.round(meters / 80)),
  };
}

function OfflineFallback({
  origin,
  destination,
  height,
}: {
  origin: MapPoint;
  destination: MapPoint;
  height: number;
}) {
  const dist =
    origin.id && destination.id
      ? getDistanceBetween(origin.id, destination.id)
      : null;

  return (
    <div
      style={{
        height,
        borderRadius: "18px",
        overflow: "hidden",
        background: "#F6F2EC",
        border: "1px solid rgba(200,155,60,.35)",
        padding: "14px",
      }}
    >
      <strong>Mapa no disponible</strong>
      <p style={{ fontSize: ".78rem" }}>
        El operador confirmará el punto de recogida.
      </p>

      {dist && (
        <p style={{ fontSize: ".78rem" }}>
          {dist.km} km · {dist.minutes} min · $
          {getEstimatedFare(dist.km).toLocaleString("es-CL")} CLP
        </p>
      )}
    </div>
  );
}

function InteractiveMap({
  origin,
  destination,
  height,
}: {
  origin: MapPoint;
  destination: MapPoint;
  height: number;
}) {
  const [selectedPoint, setSelectedPoint] = useState<{
    lat: number;
    lng: number;
  } | null>(
    origin.lat != null && origin.lng != null
      ? { lat: origin.lat, lng: origin.lng }
      : null,
  );

  const originPoint =
    selectedPoint ??
    (origin.lat != null && origin.lng != null
      ? { lat: origin.lat, lng: origin.lng }
      : null);

  const pickup = originPoint
    ? getRecommendedPickup({
        text: origin.text,
        lat: originPoint.lat,
        lng: originPoint.lng,
      })
    : null;

  const destinationPoint =
    destination.lat != null && destination.lng != null
      ? { lat: destination.lat, lng: destination.lng }
      : null;

  const routePath = useMemo(() => {
    const path: Array<{ lat: number; lng: number }> = [];

    if (originPoint) path.push(originPoint);
    if (pickup) path.push({ lat: pickup.lat, lng: pickup.lng });
    if (destinationPoint) path.push(destinationPoint);

    return path;
  }, [originPoint, pickup, destinationPoint]);

  return (
    <div
      style={{
        borderRadius: "18px",
        overflow: "hidden",
        background: "#1A1A1A",
        border: "1px solid rgba(200,155,60,.35)",
      }}
    >
      <div style={{ height, position: "relative" }}>
        <GoogleMap
          mapContainerStyle={{
            width: "100%",
            height: "100%",
          }}
          center={originPoint ?? RAPA_NUI_CENTER}
          zoom={originPoint ? 16 : 13}
          options={{
            restriction: {
              latLngBounds: ISLAND_BOUNDS,
              strictBounds: false,
            },
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
            gestureHandling: "greedy",
            styles: [
              {
                featureType: "poi",
                stylers: [{ visibility: "off" }],
              },
            ],
          }}
          onClick={(e) => {
            const lat = e.latLng?.lat();
            const lng = e.latLng?.lng();

            if (lat == null || lng == null) return;

            setSelectedPoint({ lat, lng });
          }}
        >
          {originPoint && (
            <MarkerF
              position={originPoint}
              label={{
                text: "●",
                color: "#2563eb",
                fontSize: "24px",
              }}
            />
          )}

          {pickup && (
            <MarkerF
              position={{ lat: pickup.lat, lng: pickup.lng }}
              label={{
                text: "🚗",
                fontSize: "22px",
              }}
            />
          )}

          {destinationPoint && (
            <MarkerF
              position={destinationPoint}
              label={{
                text: "📍",
                fontSize: "22px",
              }}
            />
          )}

          {routePath.length >= 2 && (
            <PolylineF
              path={routePath}
              options={{
                strokeColor: "#2563eb",
                strokeOpacity: 0.95,
                strokeWeight: 5,
              }}
            />
          )}
        </GoogleMap>

        <div
          style={{
            position: "absolute",
            left: "14px",
            right: "14px",
            top: "14px",
            background: "rgba(255,255,255,.95)",
            borderRadius: "18px",
            padding: "12px",
            boxShadow: "0 8px 25px rgba(0,0,0,.25)",
          }}
        >
          <div style={{ fontWeight: 900, color: "#1A1A1A" }}>
            Confirma el punto de partida
          </div>
          <div style={{ fontSize: ".78rem", color: "#555", marginTop: "4px" }}>
            Mueve el mapa o toca un punto dentro de Rapa Nui.
          </div>
        </div>

        {pickup && (
          <div
            style={{
              position: "absolute",
              left: "14px",
              right: "14px",
              bottom: "14px",
              background: "rgba(26,26,26,.94)",
              color: "#F6F2EC",
              borderRadius: "18px",
              padding: "14px",
              border: "1px solid rgba(200,155,60,.45)",
              boxShadow: "0 10px 30px rgba(0,0,0,.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                fontWeight: 900,
              }}
            >
              <IonIcon icon={warningOutline} style={{ color: "#C89B3C" }} />
              Punto recomendado
            </div>

            <div style={{ marginTop: "6px", fontWeight: 900 }}>
              {pickup.name}
            </div>

            <div style={{ fontSize: ".76rem", color: "#D9C3A0" }}>
              Camina {pickup.meters} m ({pickup.minutes} min) hasta el punto
              donde el auto puede llegar.
            </div>
          </div>
        )}
      </div>

      {pickup && (
        <IonCard style={{ margin: 0, borderRadius: 0 }}>
          <IonCardContent style={{ padding: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "16px",
                  background: "linear-gradient(135deg,#C89B3C,#D9C3A0)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IonIcon
                  icon={carOutline}
                  style={{ color: "#1A1A1A", fontSize: "1.4rem" }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, color: "#1A1A1A" }}>
                  {pickup.name}
                </div>
                <div style={{ fontSize: ".74rem", color: "#666" }}>
                  {pickup.address}
                </div>
              </div>

              <div
                style={{
                  fontSize: ".72rem",
                  color: "#1A1A1A",
                  fontWeight: 900,
                  textAlign: "right",
                }}
              >
                🚶 {pickup.meters} m
                <br />
                {pickup.minutes} min
              </div>
            </div>

            <IonButton
              expand="block"
              style={{ marginTop: "12px" }}
              onClick={() => {
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${pickup.lat},${pickup.lng}&travelmode=walking`,
                  "_blank",
                );
              }}
            >
              <IonIcon icon={navigateOutline} slot="start" />
              Iniciar navegación peatonal
            </IonButton>
          </IonCardContent>
        </IonCard>
      )}
    </div>
  );
}

export function MapFallback({
  origin,
  destination,
  height = 360,
  showRoute = true,
}: MapFallbackProps): JSX.Element {
  const isOnline = useConnectivity();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY ?? "",
  });

  if (!showRoute || !isOnline || !GOOGLE_MAPS_API_KEY || !isLoaded) {
    return (
      <OfflineFallback
        origin={origin}
        destination={destination}
        height={height}
      />
    );
  }

  return (
    <InteractiveMap
      origin={origin}
      destination={destination}
      height={height}
    />
  );
}

export function RouteEstimate({
  originId,
  destId,
}: {
  originId: string;
  destId: string;
}): JSX.Element | null {
  const dist = getDistanceBetween(originId, destId);

  if (!dist) return null;

  return (
    <IonCard style={{ margin: "8px 0 0" }}>
      <IonCardContent style={{ padding: "10px 14px" }}>
        <div
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            fontSize: "0.82rem",
          }}
        >
          <span>
            <strong>📏</strong> {dist.km} km
          </span>
          <span>
            <strong>⏱</strong> ~{dist.minutes} min
          </span>
          <span>
            <strong>💰</strong>{" "}
            ${getEstimatedFare(dist.km).toLocaleString("es-CL")} CLP est.
          </span>
        </div>

        <IonNote
          style={{
            fontSize: "0.7rem",
            display: "block",
            marginTop: "4px",
          }}
        >
          Tarifa estimada — sujeta a confirmación del operador
        </IonNote>
      </IonCardContent>
    </IonCard>
  );
}