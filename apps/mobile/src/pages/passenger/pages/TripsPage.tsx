import {
  IonBadge, IonButton, IonCard, IonCardContent, IonChip, IonContent, IonHeader,
IonInfiniteScroll, IonInfiniteScrollContent, IonLabel, IonPage,
  IonRefresher, IonRefresherContent, IonSpinner, IonText, IonTextarea, IonTitle,
  IonToolbar, IonItem, IonToast,
} from "@ionic/react";
import { useState, useCallback, useEffect, useRef, type CSSProperties } from "react";
import { useHistory } from "react-router-dom";
import { carOutline } from "ionicons/icons";
import { EmptyState } from "../../../components/EmptyState.js";
import { TripTimeline } from "../../../components/TripTimeline.js";
import { DriverInfoCard } from "../../../components/DriverInfoCard.js";
import { SkeletonList } from "../../../components/SkeletonCard.js";
import { WhatsAppButton } from "../../../components/WhatsAppButton.js";
import { loadRapaGoGoogleMaps } from "../../../components/MapFallback.js";
import { useAuth } from "../../../features/auth/index.js";
import { ridesService, type RideRequestData } from "../../../features/rides/rides.service.js";
import { ROUTES } from "../../../navigation/routes.js";
import { RAPAGO_CONTACT, WA_MESSAGES } from "@rapa-go/shared";
import { RIDE_STATUS_LABEL, RIDE_STATUS_COLOR } from "../shared.js";

const PAGE_SIZE = 20;
const ACTIVE_STATUSES = ["requested", "accepted", "driver_en_route", "driver_arrived", "in_progress"];

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: "4px", margin: "8px 0" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} onClick={() => onChange(s)}
          style={{ fontSize: "1.6rem", cursor: "pointer", color: s <= value ? "#f4c430" : "#ccc" }}>
          ★
        </span>
      ))}
    </div>
  );
}


type PassengerRideNavPoints = {
  pickupLat: number | null;
  pickupLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  passengerOriginalLat: number | null;
  passengerOriginalLng: number | null;
  pickupWalkMeters: number | null;
};

function extractRideNumber(notes: string | null | undefined, regex: RegExp): number | null {
  if (!notes) return null;
  const match = notes.match(regex);
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractPassengerRideNav(notes: string | null | undefined): PassengerRideNavPoints {
  return {
    pickupLat: extractRideNumber(notes, /Coordenadas recogida accesible:\s*(-?\d+(?:[.,]\d+)?)/i),
    pickupLng: extractRideNumber(notes, /Coordenadas recogida accesible:\s*-?\d+(?:[.,]\d+)?,\s*(-?\d+(?:[.,]\d+)?)/i),
    destinationLat: extractRideNumber(notes, /Coordenadas destino accesible:\s*(-?\d+(?:[.,]\d+)?)/i),
    destinationLng: extractRideNumber(notes, /Coordenadas destino accesible:\s*-?\d+(?:[.,]\d+)?,\s*(-?\d+(?:[.,]\d+)?)/i),
    passengerOriginalLat: extractRideNumber(notes, /Ubicación real del pasajero:\s*(-?\d+(?:[.,]\d+)?)/i),
    passengerOriginalLng: extractRideNumber(notes, /Ubicación real del pasajero:\s*-?\d+(?:[.,]\d+)?,\s*(-?\d+(?:[.,]\d+)?)/i),
    pickupWalkMeters: extractRideNumber(notes, /caminar aprox\.\s*(\d+(?:[.,]\d+)?)\s*m/i),
  };
}

function cleanRideNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;

  return notes
    .replace(/Dirección origen confirmada:.*?(?=Dirección destino confirmada:|$)/i, "")
    .replace(/Dirección destino confirmada:.*?(?=Ubicación real del pasajero:|Coordenadas recogida accesible:|$)/i, "")
    .replace(/Ubicación real del pasajero:.*?(?=Punto accesible de recogida|Coordenadas recogida accesible:|$)/i, "")
    .replace(/Punto accesible de recogida ajustado a calle\..*?(?=Coordenadas recogida accesible:|$)/i, "")
    .replace(/Coordenadas recogida accesible:.*?(?=Coordenadas destino accesible:|$)/i, "")
    .replace(/Coordenadas destino accesible:.*$/i, "")
    .trim() || null;
}

function getDemoDriverPoint(pickup: { lat: number; lng: number } | null): { lat: number; lng: number } | null {
  if (!pickup) return null;

  // Simulación visual para desarrollo hasta persistir GPS real del conductor en backend.
  return {
    lat: pickup.lat - 0.0048,
    lng: pickup.lng - 0.0038,
  };
}

function getDriverPointForPassengerMap(
  ride: RideRequestData,
  pickup: { lat: number; lng: number } | null,
): { lat: number; lng: number } | null {
  const withLocation = ride as RideRequestData & {
    driverLat?: number | null;
    driverLng?: number | null;
    driverLatitude?: number | null;
    driverLongitude?: number | null;
  };

  const lat = withLocation.driverLat ?? withLocation.driverLatitude ?? null;
  const lng = withLocation.driverLng ?? withLocation.driverLongitude ?? null;

  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return {
      lat: Number(lat),
      lng: Number(lng),
    };
  }

  if (ride.status === "driver_arrived") {
    return pickup;
  }

  return getDemoDriverPoint(pickup);
}

function rideStatusTitle(status: string): string {
  if (status === "requested") return "Buscando conductor";
  if (status === "accepted" || status === "driver_en_route") return "Tu conductor va en camino";
  if (status === "driver_arrived") return "Tu conductor llegó";
  if (status === "in_progress") return "Viaje en curso";
  if (status === "completed") return "Viaje completado";
  if (status === "cancelled") return "Viaje cancelado";
  return "Estado del viaje";
}

function rideStatusSubtitle(ride: RideRequestData): string {
  if (ride.status === "requested") return "Enviamos tu solicitud a conductores disponibles.";
  if (ride.status === "accepted" || ride.status === "driver_en_route") {
    return `${ride.driverName ?? "El conductor"} se está acercando al punto de recogida.`;
  }
  if (ride.status === "driver_arrived") return "Mira la ruta en el mapa y espera en el punto accesible.";
  if (ride.status === "in_progress") return `Vas hacia ${ride.destinationText}.`;
  if (ride.status === "completed") return "Gracias por viajar con Rapa Go.";
  if (ride.status === "cancelled") return "Este viaje fue cancelado.";
  return "";
}


function PassengerLiveRouteMap({
  ride,
  height = 300,
}: {
  ride: RideRequestData;
  height?: number;
}): JSX.Element {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const passengerMarkerRef = useRef<google.maps.Marker | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const fallbackRouteLineRef = useRef<google.maps.Polyline | null>(null);
  const walkLineRef = useRef<google.maps.Polyline | null>(null);

  const routeKeyRef = useRef<string>("");
  const didFitBoundsRef = useRef(false);
  const lastDriverPointRef = useRef<{ lat: number; lng: number } | null>(null);

  const [mapReady, setMapReady] = useState(false);

  const nav = extractPassengerRideNav(ride.notes);

  const pickup =
    nav.pickupLat != null && nav.pickupLng != null
      ? { lat: nav.pickupLat, lng: nav.pickupLng }
      : null;

  const passenger =
    nav.passengerOriginalLat != null && nav.passengerOriginalLng != null
      ? { lat: nav.passengerOriginalLat, lng: nav.passengerOriginalLng }
      : null;

  const destination =
    nav.destinationLat != null && nav.destinationLng != null
      ? { lat: nav.destinationLat, lng: nav.destinationLng }
      : null;

  const driverPoint = getDriverPointForPassengerMap(ride, pickup);

  const routeOrigin = ride.status === "in_progress" ? pickup : driverPoint;
  const routeDestination = ride.status === "in_progress" ? destination : pickup;

  function makeMarkerIcon(
    color: string,
    scale: number,
    strokeColor = "#ffffff",
    strokeWeight = 3,
  ): google.maps.Symbol {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale,
      fillColor: color,
      fillOpacity: 1,
      strokeColor,
      strokeWeight,
    };
  }

  function createOrMoveMarker(
    ref: React.MutableRefObject<google.maps.Marker | null>,
    map: google.maps.Map,
    point: { lat: number; lng: number } | null,
    options: {
      title: string;
      icon: google.maps.Symbol;
      label?: google.maps.MarkerLabel;
      zIndex: number;
      visible?: boolean;
    },
  ): void {
    if (!point || options.visible === false) {
      ref.current?.setMap(null);
      ref.current = null;
      return;
    }

    if (ref.current) {
      ref.current.setPosition(point);
      ref.current.setTitle(options.title);
      ref.current.setIcon(options.icon);
      ref.current.setLabel(options.label ?? null);
      ref.current.setZIndex(options.zIndex);
      ref.current.setMap(map);
      return;
    }

    ref.current = new google.maps.Marker({
      map,
      position: point,
      title: options.title,
      icon: options.icon,
      label: options.label,
      zIndex: options.zIndex,
    });
  }

  function smoothMoveDriverMarker(
    marker: google.maps.Marker,
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): void {
    const distance =
      Math.abs(from.lat - to.lat) + Math.abs(from.lng - to.lng);

    if (distance < 0.000001) {
      marker.setPosition(to);
      return;
    }

    const startedAt = performance.now();
    const duration = 850;

    function frame(now: number) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);

      marker.setPosition({
        lat: from.lat + (to.lat - from.lat) * eased,
        lng: from.lng + (to.lng - from.lng) * eased,
      });

      if (progress < 1) {
        window.requestAnimationFrame(frame);
      }
    }

    window.requestAnimationFrame(frame);
  }

  function fitMapOnce(map: google.maps.Map): void {
    if (didFitBoundsRef.current || !window.google?.maps) return;

    const bounds = new google.maps.LatLngBounds();

    if (driverPoint && ["accepted", "driver_en_route", "driver_arrived"].includes(ride.status)) {
      bounds.extend(driverPoint);
    }

    if (passenger) bounds.extend(passenger);
    if (pickup) bounds.extend(pickup);
    if (destination) bounds.extend(destination);
    if (routeOrigin) bounds.extend(routeOrigin);
    if (routeDestination) bounds.extend(routeDestination);

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 72);
      didFitBoundsRef.current = true;
    }
  }

  useEffect(() => {
    let cancelled = false;

    void loadRapaGoGoogleMaps()
      .then(() => {
        if (cancelled || !mapElementRef.current || !window.google?.maps) return;

        const center =
          passenger ??
          pickup ??
          destination ??
          { lat: -27.1505, lng: -109.4325 };

        const map = new google.maps.Map(mapElementRef.current, {
          center,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
          gestureHandling: "greedy",
          styles: [
            { elementType: "geometry", stylers: [{ color: "#1d2633" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#1d2633" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#d7dde8" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#334155" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#ffffff" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
          ],
        });

        mapRef.current = map;

        rendererRef.current = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          preserveViewport: true,
          polylineOptions: {
            strokeColor: "#2382ff",
            strokeOpacity: 1,
            strokeWeight: 7,
          },
        });

        setMapReady(true);
      })
      .catch(() => {
        setMapReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !window.google?.maps) return;

    createOrMoveMarker(passengerMarkerRef, map, passenger, {
      title: "Tu ubicación",
      label: { text: "●", color: "#ffffff", fontSize: "17px", fontWeight: "900" },
      icon: makeMarkerIcon("#8b5cf6", 15),
      zIndex: 35,
    });

    createOrMoveMarker(pickupMarkerRef, map, pickup, {
      title: "Punto de recogida",
      label: { text: "●", color: "#ffffff", fontSize: "18px", fontWeight: "900" },
      icon: makeMarkerIcon("#22c55e", 17, "#0b3d16", 5),
      zIndex: 34,
    });

    createOrMoveMarker(destinationMarkerRef, map, destination, {
      title: "Destino",
      label: { text: "●", color: "#ffffff", fontSize: "18px", fontWeight: "900" },
      icon: makeMarkerIcon("#ef4444", 16),
      zIndex: 33,
    });

    walkLineRef.current?.setMap(null);
    walkLineRef.current = null;

    if (passenger && pickup) {
      walkLineRef.current = new google.maps.Polyline({
        map,
        path: [passenger, pickup],
        strokeColor: "#ffffff",
        strokeOpacity: 0,
        icons: [
          {
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 3,
              fillColor: "#ffffff",
              fillOpacity: 1,
              strokeColor: "#111827",
              strokeWeight: 1,
            },
            offset: "0",
            repeat: "14px",
          },
        ],
        zIndex: 20,
      });
    }

    fitMapOnce(map);
  }, [
    mapReady,
    passenger?.lat,
    passenger?.lng,
    pickup?.lat,
    pickup?.lng,
    destination?.lat,
    destination?.lng,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !window.google?.maps) return;

    const shouldShowDriver =
      driverPoint && ["accepted", "driver_en_route", "driver_arrived"].includes(ride.status);

    if (!shouldShowDriver || !driverPoint) {
      driverMarkerRef.current?.setMap(null);
      driverMarkerRef.current = null;
      lastDriverPointRef.current = null;
      return;
    }

    const icon = {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 17,
      fillColor: "#2382ff",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 4,
    };

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        map,
        position: driverPoint,
        title: "Conductor",
        label: { text: "▲", color: "#ffffff", fontSize: "18px", fontWeight: "900" },
        icon,
        zIndex: 40,
      });

      lastDriverPointRef.current = driverPoint;
      fitMapOnce(map);
      return;
    }

    const previous = lastDriverPointRef.current;

    driverMarkerRef.current.setMap(map);
    driverMarkerRef.current.setTitle("Conductor");
    driverMarkerRef.current.setIcon(icon);
    driverMarkerRef.current.setLabel({
      text: "▲",
      color: "#ffffff",
      fontSize: "18px",
      fontWeight: "900",
    });

    if (previous) {
      smoothMoveDriverMarker(driverMarkerRef.current, previous, driverPoint);
    } else {
      driverMarkerRef.current.setPosition(driverPoint);
    }

    lastDriverPointRef.current = driverPoint;
  }, [
    mapReady,
    ride.status,
    driverPoint?.lat,
    driverPoint?.lng,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const renderer = rendererRef.current;

    if (!mapReady || !map || !renderer || !window.google?.maps) return;

    const routeKey = JSON.stringify({
      status: ride.status,
      originLat: routeOrigin?.lat ?? null,
      originLng: routeOrigin?.lng ?? null,
      destinationLat: routeDestination?.lat ?? null,
      destinationLng: routeDestination?.lng ?? null,
    });

    if (routeKeyRef.current === routeKey) {
      return;
    }

    routeKeyRef.current = routeKey;

    renderer.set("directions", null);
    fallbackRouteLineRef.current?.setMap(null);
    fallbackRouteLineRef.current = null;

    if (!routeOrigin || !routeDestination) {
      return;
    }

    const service = new google.maps.DirectionsService();

    service.route(
      {
        origin: routeOrigin,
        destination: routeDestination,
        travelMode: google.maps.TravelMode.DRIVING,
        region: "CL",
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result && rendererRef.current) {
          rendererRef.current.setDirections(result);
          fitMapOnce(map);
          return;
        }

        rendererRef.current?.set("directions", null);

        fallbackRouteLineRef.current = new google.maps.Polyline({
          map,
          path: [routeOrigin, routeDestination],
          strokeColor: "#2382ff",
          strokeOpacity: 1,
          strokeWeight: 7,
          icons: [
            {
              icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 },
              offset: "0",
              repeat: "18px",
            },
          ],
          zIndex: 25,
        });

        fitMapOnce(map);
      },
    );
  }, [
    mapReady,
    ride.status,
    routeOrigin?.lat,
    routeOrigin?.lng,
    routeDestination?.lat,
    routeDestination?.lng,
  ]);

  return (
    <div
      style={{
        position: "relative",
        height,
        width: "100%",
        background: "#111827",
        overflow: "hidden",
      }}
    >
      <div
        ref={(el) => {
          mapElementRef.current = el;
        }}
        style={{ width: "100%", height: "100%" }}
      />

      <div
        style={{
          position: "absolute",
          left: 10,
          right: 10,
          bottom: 10,
          background: "rgba(15,15,15,.88)",
          color: "#fff",
          borderRadius: 14,
          padding: "8px 10px",
          fontSize: ".72rem",
          lineHeight: 1.35,
          pointerEvents: "none",
          boxShadow: "0 10px 24px rgba(0,0,0,.30)",
        }}
      >
        <strong>Ruta del viaje</strong>
        <div><span style={{ color: "#2382ff" }}>●</span> Conductor acercándose</div>
        <div><span style={{ color: "#8b5cf6" }}>●</span> Tu ubicación real</div>
        <div><span style={{ color: "#22c55e" }}>●</span> Punto de recogida</div>
        <div><span style={{ color: "#ef4444" }}>●</span> Destino</div>
      </div>
    </div>
  );
}

function PassengerRideCard({
  ride,
  cancelling,
  rated,
  onCancel,
  onCancelAccepted,
  onRate,
}: {
  ride: RideRequestData;
  cancelling: boolean;
  rated: boolean;
  onCancel: (rideId: string) => void;
  onCancelAccepted: (rideId: string) => void;
  onRate: (rideId: string) => void;
}): JSX.Element {
  const nav = extractPassengerRideNav(ride.notes);
const hasDriver = ride.status !== "requested" || !!ride.driverName;
  const showMap = ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(ride.status);
const color = RIDE_STATUS_COLOR[ride.status] ?? "medium";
  const label = RIDE_STATUS_LABEL[ride.status] ?? ride.status;

  return (
    <IonCard
      aria-label={`Viaje ${label} de ${ride.originText} a ${ride.destinationText}`}
      style={{
        margin: 0,
        borderRadius: "22px",
        overflow: "hidden",
        background: "#F6F2EC",
        border: "2px solid rgba(210,164,58,.65)",
        boxShadow: "0 12px 32px rgba(0,0,0,.16)",
      }}
    >
      <IonCardContent style={{ padding: 0 }}>
        <div style={{ position: "relative", background: "#111827" }}>
          {showMap && (
            <PassengerLiveRouteMap ride={ride} height={300} />
          )}

          {showMap && (
            <div
              style={{
                position: "absolute",
                left: 10,
                right: 10,
                top: 10,
                background: "rgba(15,15,15,.92)",
                color: "#F6F2EC",
                borderRadius: 16,
                padding: "11px 12px",
                boxShadow: "0 14px 34px rgba(0,0,0,.35)",
                backdropFilter: "blur(8px)",
                pointerEvents: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 950, fontSize: ".94rem", lineHeight: 1.15 }}>
                    {rideStatusTitle(ride.status)}
                  </div>
                  <div style={{ color: "rgba(246,242,236,.74)", fontSize: ".75rem", marginTop: 4, lineHeight: 1.25 }}>
                    {rideStatusSubtitle(ride)}
                  </div>
                </div>

                <IonBadge
                  color={color}
                  style={{
                    flexShrink: 0,
                    fontSize: ".62rem",
                    borderRadius: "999px",
                    padding: "5px 7px",
                    maxWidth: 86,
                    whiteSpace: "normal",
                    textAlign: "center",
                    lineHeight: 1.05,
                  }}
                >
                  {label}
                </IonBadge>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: showMap ? "16px" : "12px 16px", color: "#111111" }}>
          {ride.status === "requested" && (
            <div
              style={{
                background: "#ffffff",
                borderRadius: 18,
                padding: "12px",
                border: "1px solid rgba(0,0,0,.06)",
                boxShadow: "0 6px 18px rgba(0,0,0,.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <IonSpinner name="crescent" />
                <div>
                  <div style={{ fontWeight: 950, fontSize: ".9rem" }}>Buscando conductor</div>
                  <div style={{ color: "#666", fontSize: ".78rem", marginTop: 2 }}>
                    Tu solicitud ya fue enviada a conductores cercanos.
                  </div>
                </div>
              </div>
            </div>
          )}

          {hasDriver && ride.status !== "requested" && ride.status !== "cancelled" && (
            <div
              style={{
                marginBottom: 14,
                background: "#ffffff",
                borderRadius: 18,
                padding: 10,
                boxShadow: "0 6px 18px rgba(0,0,0,.06)",
              }}
            >
              <DriverInfoCard
                name={ride.driverName ?? "Conductor asignado"}
                rating={ride.driverRatingAverage}
                ratingCount={ride.driverRatingCount}
                vehicleBrand={ride.driverVehicleBrand}
                vehicleModel={ride.driverVehicleModel}
                vehicleColor={ride.driverVehicleColor}
                vehiclePlate={ride.driverVehiclePlate}
                vehicleYear={ride.driverVehicleYear}
                phone={ACTIVE_STATUSES.includes(ride.status) ? ride.driverPhone : null}
                waMessage={ACTIVE_STATUSES.includes(ride.status) && ride.driverPhone
                  ? WA_MESSAGES.passengerToDriver({
                      driverName: ride.driverName ?? "conductor",
                      passengerName: "pasajero",
                      origin: ride.originText,
                    })
                  : null}
              />
            </div>
          )}

          <div
            style={{
              background: "#ffffff",
              borderRadius: 18,
              padding: "12px",
              border: "1px solid rgba(0,0,0,.06)",
            }}
          >
            <div style={{ fontWeight: 950, fontSize: ".86rem", marginBottom: 10 }}>
              Detalle del viaje
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 9, fontSize: ".84rem", lineHeight: 1.35 }}>
              {nav.passengerOriginalLat != null && nav.passengerOriginalLng != null && (
                <>
                  <span style={{ color: "#3b82f6", fontSize: "1rem" }}>●</span>
                  <div>
                    <strong>Tu ubicación:</strong> punto donde solicitaste el viaje
                    <div style={{ color: "#777", fontSize: ".73rem", marginTop: 2 }}>
                      {nav.passengerOriginalLat.toFixed(5)}, {nav.passengerOriginalLng.toFixed(5)}
                    </div>
                  </div>
                </>
              )}

              <span style={{ color: "#22c55e", fontSize: "1rem" }}>●</span>
              <div>
                <strong>Recogida accesible:</strong> {ride.originText}
                {nav.pickupWalkMeters != null && nav.pickupWalkMeters > 8 && (
                  <div style={{ color: "#666", fontSize: ".76rem", marginTop: 2 }}>
                    Camina aprox. {Math.round(nav.pickupWalkMeters)} m hasta este punto para que el conductor te encuentre.
                  </div>
                )}
              </div>

              <span style={{ color: "#ef4444", fontSize: "1rem" }}>●</span>
              <div>
                <strong>Destino:</strong> {ride.destinationText}
              </div>
            </div>
          </div>

          {ride.estimatedFareClp != null && (
            <div
              style={{
                marginTop: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(210,164,58,.16)",
                color: "#9A6A00",
                borderRadius: 999,
                padding: "8px 12px",
                fontWeight: 950,
                fontSize: ".9rem",
              }}
            >
              ${ride.estimatedFareClp.toLocaleString("es-CL")} CLP
              {ride.discountApplied && ride.originalFareClp != null && (
                <span style={{ color: "#666", fontSize: ".72rem", textDecoration: "line-through" }}>
                  ${ride.originalFareClp.toLocaleString("es-CL")}
                </span>
              )}
            </div>
          )}

          {cleanRideNotes(ride.notes) && (
            <div style={{ marginTop: 8, color: "#666", fontSize: ".78rem" }}>
              {cleanRideNotes(ride.notes)}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {ride.status === "requested" && (
              <IonButton
                size="small"
                fill="outline"
                color="danger"
                disabled={cancelling}
                onClick={() => onCancel(ride.id)}
              >
                {cancelling ? <IonSpinner name="dots" /> : "Cancelar"}
              </IonButton>
            )}

            {["accepted", "driver_en_route"].includes(ride.status) && (
              <IonButton
                size="small"
                fill="outline"
                color="danger"
                disabled={cancelling}
                onClick={() => onCancelAccepted(ride.id)}
              >
                {cancelling ? <IonSpinner name="dots" /> : "Cancelar viaje"}
              </IonButton>
            )}

            {ride.status === "completed" && !rated && (
              <IonButton
                size="small"
                fill="outline"
                color="warning"
                onClick={() => onRate(ride.id)}
              >
                ⭐ Calificar
              </IonButton>
            )}

            {ride.status === "completed" && rated && (
              <IonBadge color="success" style={{ fontSize: "0.72rem", padding: "4px 8px" }}>
                ✓ Calificado
              </IonBadge>
            )}

            {ride.driverName && ACTIVE_STATUSES.includes(ride.status) && !ride.driverPhone && (
              <WhatsAppButton
                phone={RAPAGO_CONTACT.adminPhone}
                message={WA_MESSAGES.passengerToAdmin({
                  origin: ride.originText,
                  destination: ride.destinationText,
                  name: "pasajero",
                })}
                label="Operador"
                size="small"
              />
            )}
          </div>
        </div>
      </IonCardContent>
    </IonCard>
  );
}

export default function TripsPage(): JSX.Element {
  const history = useHistory();
  const { session } = useAuth();

  const [allRides,    setAllRides]    = useState<RideRequestData[]>([]);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [cancelling,  setCancelling]  = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [ratingRideId,     setRatingRideId]     = useState<string | null>(null);
  const [ratingStars,      setRatingStars]      = useState(5);
  const [ratingComment,    setRatingComment]    = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingError,      setRatingError]      = useState<string | null>(null);
  const [ratedIds,         setRatedIds]         = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "cancelled">("active");
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [knownAssignedRideIds, setKnownAssignedRideIds] = useState<Set<string>>(new Set());

  const loadRides = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await ridesService.listMyRides(session.accessToken);

      const assignedActiveRides = data.filter((ride) =>
        ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(ride.status),
      );

      const assignedIds = new Set(assignedActiveRides.map((ride) => ride.id));
      setKnownAssignedRideIds(assignedIds);
      setAllRides(data);
      setPage(1);
      setLastRefreshAt(new Date());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar tus viajes.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, knownAssignedRideIds]);

  useEffect(() => {
    void loadRides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  const rides = allRides.slice(0, page * PAGE_SIZE);

  async function handleCancel(rideId: string) {
    if (!session?.accessToken) return;
    setCancelling(rideId);
    setCancelError(null);
    try {
      const updated = await ridesService.cancelRideRequest(session.accessToken, rideId);
      setAllRides((prev) => prev.map((r) => (r.id === rideId ? updated : r)));
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Error al cancelar el viaje.");
    } finally {
      setCancelling(null);
    }
  }

  async function handleCancelAccepted(rideId: string) {
    if (!session?.accessToken) return;
    setCancelling(rideId);
    setCancelError(null);
    try {
      const updated = await ridesService.cancelAcceptedRide(session.accessToken, rideId);
      setAllRides((prev) => prev.map((r) => (r.id === rideId ? updated : r)));
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Error al cancelar el viaje.");
    } finally {
      setCancelling(null);
    }
  }

  async function handleSubmitRating() {
    if (!session?.accessToken || !ratingRideId) return;
    setSubmittingRating(true);
    setRatingError(null);
    try {
      await ridesService.rateRide(session.accessToken, ratingRideId, ratingStars, ratingComment.trim() || undefined);
      setRatedIds((prev) => new Set([...prev, ratingRideId]));
      setRatingRideId(null);
      setRatingStars(5);
      setRatingComment("");
    } catch (err) {
      setRatingError(err instanceof Error ? err.message : "Error al calificar el viaje.");
    } finally {
      setSubmittingRating(false);
    }
  }

  const filtered = rides.filter((r) => {
    if (statusFilter === "all")       return true;
    if (statusFilter === "active")    return ACTIVE_STATUSES.includes(r.status);
    if (statusFilter === "completed") return r.status === "completed";
    if (statusFilter === "cancelled") return r.status === "cancelled";
    return true;
  });

  const counts = {
    all:       allRides.length,
    active:    allRides.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
    completed: allRides.filter((r) => r.status === "completed").length,
    cancelled: allRides.filter((r) => r.status === "cancelled").length,
  };

  const hasMore = page * PAGE_SIZE < allRides.length;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mis Viajes</IonTitle>
        </IonToolbar>
        <IonToolbar style={{ "--background": "var(--ion-color-primary)", "--border-width": "0" }}>
          <div style={{ display: "flex", gap: "8px", padding: "0 12px 10px", overflowX: "auto" }}>
            {(["all", "active", "completed", "cancelled"] as const).map((f) => {
              const labels = { all: "Todos", active: "Activos", completed: "Completados", cancelled: "Cancelados" };
              const active = statusFilter === f;
              return (
                <IonChip key={f}
                  aria-label={`Filtrar por ${labels[f]}`}
                  style={{
                    flexShrink: 0,
                    "--background": active ? "#fff" : "rgba(255,255,255,0.2)",
                    "--color": active ? "var(--ion-color-primary)" : "#fff",
                    fontSize: "0.78rem", height: "36px",
                    fontWeight: active ? 700 : 400,
                  }}
                  onClick={() => setStatusFilter(f)}
                >
                  {labels[f]}{counts[f] > 0 ? ` (${counts[f]})` : ""}
                </IonChip>
              );
            })}
          </div>
        </IonToolbar>

        <IonToolbar style={{ "--background": "#111111", "--border-width": "0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "8px 14px 10px",
              color: "#F6F2EC",
              fontSize: ".78rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: "#C89B3C", fontSize: 18, lineHeight: 1 }}>🔔</span>
              <span>
                {counts.active > 0
                  ? "Notificaciones: tu conductor ya tomó el viaje. Revisa el mapa para ver dónde viene."
                  : "Sin conductor activo por ahora."}
              </span>
            </div>

            <IonButton
              size="small"
              color="warning"
              disabled={loading}
              onClick={() => void loadRides()}
              style={{ "--border-radius": "999px", fontWeight: 900 } as React.CSSProperties}
            >
              {loading ? <IonSpinner name="dots" /> : "Actualizar"}
            </IonButton>
          </div>

          {lastRefreshAt && (
            <div
              style={{
                color: "rgba(246,242,236,.64)",
                fontSize: ".68rem",
                padding: "0 14px 8px",
              }}
            >
              Última actualización: {lastRefreshAt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void loadRides().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && <SkeletonList count={3} height="140px" />}

        {loadError && (
          <div style={{ padding: "16px" }}>
            <IonText color="danger"><p>{loadError}</p></IonText>
          </div>
        )}

        {!loading && allRides.length === 0 && (
          <EmptyState icon={carOutline} title="Sin viajes todavía"
            subtitle="Solicita tu primer traslado en Rapa Nui"
            actionLabel="Solicitar viaje"
            onAction={() => history.push(ROUTES.PASSENGER.REQUEST_RIDE)}
          />
        )}

        {!loading && allRides.length > 0 && filtered.length === 0 && (
          <EmptyState icon={carOutline} title="Sin resultados" subtitle="No hay viajes en esta categoría" />
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "12px 14px 18px" }}>
            {filtered.map((ride) => (
              <PassengerRideCard
                key={ride.id}
                ride={ride}
                cancelling={cancelling === ride.id}
                rated={ratedIds.has(ride.id)}
                onCancel={(rideId) => void handleCancel(rideId)}
                onCancelAccepted={(rideId) => void handleCancelAccepted(rideId)}
                onRate={(rideId) => {
                  setRatingRideId(rideId);
                  setRatingStars(5);
                  setRatingComment("");
                  setRatingError(null);
                }}
              />
            ))}
          </div>
        )}

        <IonInfiniteScroll threshold="100px" disabled={!hasMore || loading}
          onIonInfinite={(ev) => {
            setPage((p) => p + 1);
            void (ev.target as HTMLIonInfiniteScrollElement).complete();
          }}>
          <IonInfiniteScrollContent loadingText="Cargando más viajes..." />
        </IonInfiniteScroll>

        {cancelError && (
          <div style={{ padding: "0 16px" }}>
            <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{cancelError}</p></IonText>
          </div>
        )}

        {ratingRideId && (
          <IonCard style={{ margin: "12px 16px" }}>
            <IonCardContent style={{ padding: "14px 16px" }}>
              <div style={{ fontWeight: 600, marginBottom: "8px" }}>⭐ Calificar conductor</div>
              <StarRatingInput value={ratingStars} onChange={setRatingStars} />
              <IonItem lines="none" style={{ "--padding-start": "0", marginTop: "8px" }}>
                <IonTextarea value={ratingComment} onIonInput={(e) => setRatingComment(String(e.detail.value ?? ""))}
                  placeholder="Comentario opcional" maxlength={500} rows={2} />
              </IonItem>
              {ratingError && <IonText color="danger"><p style={{ fontSize: "0.82rem", margin: "4px 0" }}>{ratingError}</p></IonText>}
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <IonButton size="small" onClick={() => void handleSubmitRating()} disabled={submittingRating}>
                  {submittingRating ? <IonSpinner name="dots" /> : "Enviar"}
                </IonButton>
                <IonButton size="small" fill="outline" color="medium" onClick={() => setRatingRideId(null)}>Cancelar</IonButton>
              </div>
            </IonCardContent>
          </IonCard>
        )}
</IonContent>
    </IonPage>
  );
}
