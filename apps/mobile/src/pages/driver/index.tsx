import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSelect,  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,  IonToolbar,
} from "@ionic/react";
import { useEffect, useState, useCallback, useRef, type CSSProperties } from "react";
import { useHistory } from "react-router-dom";
import {
  carOutline,
  cashOutline,
  listOutline,
  personOutline,
  refreshOutline,
  navigateOutline,
  locationOutline,
  flagOutline,
  closeOutline,
  checkmarkCircleOutline,
  arrowUpOutline,
  shieldCheckmarkOutline,
  timeOutline,
  walkOutline,
  cardOutline,
  starOutline,
} from "ionicons/icons";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { driverProfileService } from "../../features/drivers/driverProfile.service";
import { HomeHeader } from "../../components/HomeHeader";
import { ActionCard } from "../../components/ActionCard";
import { useConnectivity } from "../../hooks/useConnectivity";
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { ROUTES } from "../../navigation/routes";
import { useAuth } from "../../features/auth";
import { ridesService } from "../../features/rides/rides.service";
import { MapFallback, loadRapaGoGoogleMaps } from "../../components/MapFallback";
import { WhatsAppButton } from "../../components/WhatsAppButton";
import { legalService, type LegalDocumentData, type UserAcceptanceData } from "../../features/legal/legal.service.js";

function LegalStatusSection({ token }: { token: string }): React.ReactElement {
  const [docs,        setDocs]        = useState<LegalDocumentData[]>([]);
  const [acceptances, setAcceptances] = useState<UserAcceptanceData[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([legalService.getActive(), legalService.getMyAcceptances(token)])
      .then(([d, a]) => { setDocs(d); setAcceptances(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const getStatus = (doc: LegalDocumentData) => {
    const acc = acceptances.find((a) => a.legalDocumentId === doc.id);
    if (!acc) return "not_accepted";
    if (acc.versionAccepted !== doc.version) return "new_version";
    return "accepted";
  };

  const handleAccept = (doc: LegalDocumentData) => {
    void legalService.accept(token, doc.id, doc.version).then(() => {
      legalService.getMyAcceptances(token).then(setAcceptances).catch(() => {});
    });
  };

  return (
    <IonCard style={{ margin: "0 0 16px" }}>
      <IonCardContent>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "8px" }}>Documentos Legales</div>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px" }}>
            <IonSpinner name="dots" />
          </div>
        ) : (
          docs.map((doc) => {
            const status = getStatus(doc);
            return (
              <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                <div>
                  <div style={{ fontSize: "0.9rem" }}>{doc.title}</div>
                  <div style={{ fontSize: "0.75rem", color: "gray" }}>v{doc.version}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {status === "accepted" && <IonBadge color="success">Aceptado</IonBadge>}
                  {status === "new_version" && <IonBadge color="warning">Nueva versión</IonBadge>}
                  {status === "not_accepted" && <IonBadge color="danger">Pendiente</IonBadge>}
                  {(status === "not_accepted" || status === "new_version") && (
                    <IonButton fill="clear" size="small" onClick={() => handleAccept(doc)}>
                      Aceptar
                    </IonButton>
                  )}
                </div>
              </div>
            );
          })
        )}
      </IonCardContent>
    </IonCard>
  );
}

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: "4px", margin: "8px 0" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          onClick={() => onChange(s)}
          style={{ fontSize: "1.6rem", cursor: "pointer", color: s <= value ? "#f4c430" : "#ccc" }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function meta(path: string) {
  return ROUTE_METADATA.find((r) => r.path === path)!;
}

type RideNavigationPoints = {
  pickupLat: number | null;
  pickupLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  passengerOriginalLat: number | null;
  passengerOriginalLng: number | null;
  pickupWalkMeters: number | null;
};

function extractNumberFromNotes(notes: string | null | undefined, regex: RegExp): number | null {
  if (!notes) return null;

  const match = notes.match(regex);
  if (!match?.[1]) return null;

  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractRideNavigationPoints(notes: string | null | undefined): RideNavigationPoints {
  return {
    pickupLat: extractNumberFromNotes(notes, /Coordenadas recogida accesible:\s*(-?\d+(?:[.,]\d+)?)/i),
    pickupLng: extractNumberFromNotes(notes, /Coordenadas recogida accesible:\s*-?\d+(?:[.,]\d+)?,\s*(-?\d+(?:[.,]\d+)?)/i),
    destinationLat: extractNumberFromNotes(notes, /Coordenadas destino accesible:\s*(-?\d+(?:[.,]\d+)?)/i),
    destinationLng: extractNumberFromNotes(notes, /Coordenadas destino accesible:\s*-?\d+(?:[.,]\d+)?,\s*(-?\d+(?:[.,]\d+)?)/i),
    passengerOriginalLat: extractNumberFromNotes(notes, /Ubicación real del pasajero:\s*(-?\d+(?:[.,]\d+)?)/i),
    passengerOriginalLng: extractNumberFromNotes(notes, /Ubicación real del pasajero:\s*-?\d+(?:[.,]\d+)?,\s*(-?\d+(?:[.,]\d+)?)/i),
    pickupWalkMeters: extractNumberFromNotes(notes, /caminar aprox\.\s*(\d+(?:[.,]\d+)?)\s*m/i),
  };
}

function getCleanRideNote(notes: string | null | undefined): string | null {
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

function openGoogleNavigation(
  origin: { lat: number; lng: number } | null,
  destination: { lat: number; lng: number },
): void {
  const destinationParam = `${destination.lat},${destination.lng}`;

  if (origin) {
    const originParam = `${origin.lat},${origin.lng}`;
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destinationParam)}&travelmode=driving`,
      "_blank",
    );
    return;
  }

  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationParam)}&travelmode=driving`,
    "_blank",
  );
}

function isInsideRapaNui(point: { lat: number; lng: number } | null): boolean {
  if (!point) return false;

  return (
    point.lat <= -27.045 &&
    point.lat >= -27.205 &&
    point.lng <= -109.25 &&
    point.lng >= -109.5
  );
}


function getDriverLocationMessage(): string {
  if (!navigator.geolocation) {
    return "Tu navegador no permite usar GPS. Activa ubicación para tomar viajes reales.";
  }

  return "Activa el permiso de ubicación para ver rutas reales del conductor.";
}


function getCurrentLocationForNavigation(
  destination: { lat: number; lng: number },
): void {
  if (!navigator.geolocation) {
    openGoogleNavigation(null, destination);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      openGoogleNavigation(
        {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        destination,
      );
    },
    () => openGoogleNavigation(null, destination),
    {
      enableHighAccuracy: true,
      timeout: 9000,
      maximumAge: 30000,
    },
  );
}


function uberPanelStyle(extra?: CSSProperties): CSSProperties {
  return {
    background: "rgba(15,15,15,.96)",
    color: "#F6F2EC",
    borderRadius: "20px",
    border: "1px solid rgba(255,255,255,.08)",
    boxShadow: "0 18px 40px rgba(0,0,0,.35)",
    ...extra,
  };
}

function UberDriverNavigationMap({
  ride,
  height = 360,
}: {
  ride: {
    originText: string;
    destinationText: string;
    notes?: string | null;
    status: string;
  };
  height?: number;
}): JSX.Element {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const fallbackLineRef = useRef<google.maps.Polyline | null>(null);

  const driverPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastGpsPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const headingRef = useRef(0);
  const lastCameraAtRef = useRef(0);
  const routeRequestIdRef = useRef(0);
  const routeKeyRef = useRef("");
  const didInitialCameraRef = useRef(false);
  const mapReadyRef = useRef(false);

  const [driverGpsReady, setDriverGpsReady] = useState(false);
  const [driverOutsideRapaNui, setDriverOutsideRapaNui] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ duration: string; distance: string } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const nav = extractRideNavigationPoints(ride.notes);

  const pickup =
    nav.pickupLat != null && nav.pickupLng != null
      ? { lat: nav.pickupLat, lng: nav.pickupLng }
      : null;

  const destination =
    nav.destinationLat != null && nav.destinationLng != null
      ? { lat: nav.destinationLat, lng: nav.destinationLng }
      : null;

  const goingToPickup = ["accepted", "driver_en_route"].includes(ride.status);
  const waitingPassenger = ride.status === "driver_arrived";
  const goingToDestination = ride.status === "in_progress";

  const target = goingToDestination ? destination : goingToPickup ? pickup : null;
  const targetLabel = goingToDestination
    ? ride.destinationText
    : goingToPickup || waitingPassenger
      ? ride.originText
      : ride.destinationText;

  function toRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function bearingDegrees(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);
    const dLng = toRad(to.lng - from.lng);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
  }

  function makeDriverIcon(heading: number): google.maps.Symbol {
    return {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 8,
      fillColor: "#2382ff",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 4,
      rotation: heading,
    };
  }

  function makeCircleIcon(color: string, strokeColor = "#ffffff", scale = 15): google.maps.Symbol {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale,
      fillColor: color,
      fillOpacity: 1,
      strokeColor,
      strokeWeight: 4,
    };
  }

  function setMarker(
    markerRef: { current: google.maps.Marker | null },
    point: { lat: number; lng: number } | null,
    options: google.maps.MarkerOptions,
  ): void {
    const map = mapRef.current;

    if (!map || !window.google?.maps || !point) {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        ...options,
        map,
        position: point,
      });
      return;
    }

    markerRef.current.setMap(map);
    markerRef.current.setPosition(point);
    markerRef.current.setOptions(options);
  }

  function followDriverCamera(point: { lat: number; lng: number }, heading: number, force = false): void {
    const map = mapRef.current;
    if (!map) return;

    const now = Date.now();
    if (!force && now - lastCameraAtRef.current < 1400) return;
    lastCameraAtRef.current = now;

    if (!didInitialCameraRef.current || force) {
      map.setZoom(18);
      didInitialCameraRef.current = true;
    }

    map.panTo(point);

    try {
      map.setHeading(heading);
      map.setTilt(45);
    } catch {
      // Algunos navegadores no soportan heading/tilt en mapas raster.
    }
  }

  function moveDriverOnly(point: { lat: number; lng: number }, heading: number): void {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    setMarker(driverMarkerRef, point, {
      title: "Conductor",
      icon: makeDriverIcon(heading),
      zIndex: 50,
    });

    followDriverCamera(point, heading);
  }

  function drawStaticMarkers(): void {
    if (!mapRef.current || !window.google?.maps) return;

    setMarker(pickupMarkerRef, pickup, {
      title: "Punto de recogida",
      icon: makeCircleIcon("#22c55e", "#ffffff", 17),
      zIndex: 40,
    });

    setMarker(destinationMarkerRef, destination, {
      title: "Destino",
      icon: makeCircleIcon("#ef4444", "#ffffff", 15),
      zIndex: 35,
    });
  }

  function calculateRouteOnce(force = false): void {
    const map = mapRef.current;
    const renderer = directionsRendererRef.current;
    const service = directionsServiceRef.current;
    const driverPoint = driverPointRef.current;

    if (!map || !renderer || !service || !window.google?.maps) return;

    const currentTarget = goingToDestination ? destination : goingToPickup ? pickup : null;
    const currentKey = `${ride.status}:${currentTarget?.lat ?? "none"},${currentTarget?.lng ?? "none"}`;

    if (!force && routeKeyRef.current === currentKey) return;
    routeKeyRef.current = currentKey;

    fallbackLineRef.current?.setMap(null);
    fallbackLineRef.current = null;

    if (!driverPoint || !currentTarget) {
      renderer.set("directions", null);
      setRouteInfo(null);
      return;
    }

    const requestId = routeRequestIdRef.current + 1;
    routeRequestIdRef.current = requestId;

    service.route(
      {
        origin: driverPoint,
        destination: currentTarget,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
        optimizeWaypoints: false,
        region: "CL",
      },
      (result, status) => {
        if (requestId !== routeRequestIdRef.current) return;

        if (status === google.maps.DirectionsStatus.OK && result) {
          fallbackLineRef.current?.setMap(null);
          fallbackLineRef.current = null;
          renderer.setDirections(result);

          const leg = result.routes[0]?.legs[0];
          setRouteInfo({
            duration: leg?.duration?.text ?? "",
            distance: leg?.distance?.text ?? "",
          });
          return;
        }

        renderer.set("directions", null);
        fallbackLineRef.current?.setMap(null);
        fallbackLineRef.current = new google.maps.Polyline({
          map,
          path: [driverPoint, currentTarget],
          strokeColor: "#00b7ff",
          strokeOpacity: 1,
          strokeWeight: 7,
          zIndex: 20,
        });

        setRouteInfo({ duration: "Ruta referencial", distance: "" });
      },
    );
  }

  useEffect(() => {
    let cancelled = false;

    void loadRapaGoGoogleMaps()
      .then(() => {
        if (cancelled || !mapElementRef.current || !window.google?.maps) return;

        const center = driverPointRef.current ?? pickup ?? destination ?? { lat: -27.1505, lng: -109.4325 };

        const map = new google.maps.Map(mapElementRef.current, {
          center,
          zoom: driverPointRef.current ? 18 : 14,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          disableDefaultUI: true,
          zoomControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
          styles: [
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "on" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#d4dbe7" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#334155" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#a8d7e8" }] },
            { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f3f4ef" }] },
          ],
        });

        mapRef.current = map;
        mapReadyRef.current = true;
        directionsServiceRef.current = new google.maps.DirectionsService();
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          preserveViewport: true,
          polylineOptions: {
            strokeColor: "#00b7ff",
            strokeOpacity: 1,
            strokeWeight: 8,
          },
        });

        drawStaticMarkers();
        setMapReady(true);

        if (driverPointRef.current) {
          moveDriverOnly(driverPointRef.current, headingRef.current);
          calculateRouteOnce(true);
        } else {
          const bounds = new google.maps.LatLngBounds();
          if (pickup) bounds.extend(pickup);
          if (destination) bounds.extend(destination);
          if (!bounds.isEmpty()) map.fitBounds(bounds, 80);
        }
      })
      .catch(() => setMapError("No se pudo cargar Google Maps."));

    return () => {
      cancelled = true;
      mapReadyRef.current = false;
    };
    // El mapa se crea una sola vez. No depende del GPS para evitar remounts/parpadeos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    drawStaticMarkers();
    calculateRouteOnce(true);
    // Solo recalcula cuando cambia el estado o el destino. Nunca en cada punto GPS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride.status, pickup?.lat, pickup?.lng, destination?.lat, destination?.lng]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setMapError(getDriverLocationMessage());
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        const previous = lastGpsPointRef.current;
        const moved = previous ? distanceMeters(previous, next) : Number.POSITIVE_INFINITY;

        // Filtra ruido del GPS. Evita que el mapa tiemble por cambios mínimos.
        if (previous && moved < 8) return;

        if (previous && moved >= 8) {
          headingRef.current = bearingDegrees(previous, next);
        } else if (typeof position.coords.heading === "number" && Number.isFinite(position.coords.heading)) {
          headingRef.current = position.coords.heading;
        }

        lastGpsPointRef.current = next;
        driverPointRef.current = next;

        const ready = true;
        if (!driverGpsReady) setDriverGpsReady(ready);

        const outside = !isInsideRapaNui(next);
        if (outside !== driverOutsideRapaNui) setDriverOutsideRapaNui(outside);

        setMapError(null);

        // Punto azul + cámara. No recalcula ruta aquí.
        if (mapReadyRef.current) {
          moveDriverOnly(next, headingRef.current);

          // La ruta se dibuja una sola vez cuando aparece el primer GPS.
          if (!routeKeyRef.current) {
            calculateRouteOnce(true);
          }
        }
      },
      () => {
        setMapError(getDriverLocationMessage());
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
    // No incluimos driverGpsReady/driverOutsideRapaNui para no reiniciar watchPosition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: "relative",
        height,
        overflow: "hidden",
        borderRadius: "22px",
        background: "#f3f4ef",
      }}
    >
      <div
        ref={(el) => {
          mapElementRef.current = el;
        }}
        style={{ width: "100%", height: "100%" }}
      />

      {driverOutsideRapaNui && (
        <div
          style={{
            position: "absolute",
            left: "14px",
            top: "76px",
            background: "rgba(239,68,68,.96)",
            color: "#ffffff",
            borderRadius: "999px",
            padding: "6px 10px",
            fontSize: ".72rem",
            fontWeight: 950,
            boxShadow: "0 8px 18px rgba(0,0,0,.25)",
            zIndex: 5,
          }}
        >
          GPS real fuera de Rapa Nui
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: "14px",
          right: "14px",
          top: "14px",
          ...uberPanelStyle({
            background: "rgba(0, 91, 86, .96)",
            borderRadius: "20px",
            padding: "14px 16px",
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }),
        }}
      >
        <IonIcon icon={arrowUpOutline} style={{ fontSize: 30, color: "#ffffff" }} />
        <div>
          <div style={{ fontWeight: 950, fontSize: "1rem" }}>
            {goingToPickup
              ? "Dirígete al punto de recogida"
              : waitingPassenger
                ? "Espera al pasajero"
                : "Dirígete al destino"}
          </div>
          <div style={{ color: "rgba(246,242,236,.78)", fontSize: ".82rem", marginTop: 3 }}>
            {targetLabel} {routeInfo?.distance ? `• ${routeInfo.distance}` : ""}
          </div>
        </div>
      </div>

      {!driverGpsReady && (
        <div
          style={{
            position: "absolute",
            left: "14px",
            right: "14px",
            bottom: "88px",
            ...uberPanelStyle({
              padding: "10px 12px",
              border: "1px solid rgba(239,68,68,.45)",
            }),
            color: "#F6F2EC",
            fontSize: ".78rem",
            fontWeight: 900,
          }}
        >
          📍 Esperando ubicación real del conductor. Activa el GPS para iniciar rutas reales.
        </div>
      )}

      {routeInfo && (
        <div
          style={{
            position: "absolute",
            left: "14px",
            bottom: "14px",
            ...uberPanelStyle({
              minWidth: 130,
              padding: "12px 14px",
            }),
          }}
        >
          <div style={{ color: "#22c55e", fontSize: "1.25rem", fontWeight: 950 }}>
            {routeInfo.duration}
          </div>
          <div style={{ color: "rgba(246,242,236,.72)", fontSize: ".78rem" }}>
            {routeInfo.distance}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => calculateRouteOnce(true)}
        style={{
          position: "absolute",
          right: "16px",
          bottom: "16px",
          width: 58,
          height: 58,
          borderRadius: 999,
          border: "0",
          background: "#111111",
          color: "#ffffff",
          boxShadow: "0 12px 28px rgba(0,0,0,.45)",
          fontSize: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="Recalcular ruta"
      >
        <IonIcon icon={navigateOutline} />
      </button>

      {mapError && (
        <div
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 82,
            background: "rgba(17,17,17,.88)",
            color: "#fff",
            borderRadius: 12,
            padding: "9px 12px",
            fontSize: ".76rem",
          }}
        >
          {mapError}
        </div>
      )}
    </div>
  );
}

function DriverRideMap({
  ride,
  height = 190,
}: {
  ride: {
    originText: string;
    destinationText: string;
    notes?: string | null;
    status: string;
  };
  height?: number;
}): JSX.Element {
  return <UberDriverNavigationMap ride={ride} height={height} />;
}


export function DriverHomePage(): JSX.Element {
  const { session } = useAuth();
  const isOnline = useConnectivity();

  const driverName =
    session?.user?.name?.split(" ")[0] ??
    session?.user?.email?.split("@")[0] ??
    "conductor";

  const quickCardStyle: CSSProperties = {
    margin: 0,
    borderRadius: "20px",
    background: "#F6F2EC",
    border: "1px solid rgba(0,0,0,.06)",
    boxShadow: "0 14px 32px rgba(0,0,0,.16)",
    minHeight: "132px",
  };

  const iconBoxStyle: CSSProperties = {
    width: "54px",
    height: "54px",
    borderRadius: "18px",
    background: "#2dd36f",
    color: "#111",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "12px",
    boxShadow: "0 12px 24px rgba(45,211,111,.28)",
  };

  return (
    <IonPage>
      <HomeHeader title="Inicio" />

      <IonContent
        className="ion-padding"
        style={{
          "--background":
            "linear-gradient(180deg, rgba(15,15,15,.86), rgba(15,15,15,.97)), url('/assets/rapa-go-bg.jpg') center/cover no-repeat",
        } as CSSProperties}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: isOnline ? "var(--ion-color-success)" : "var(--ion-color-danger)",
              flexShrink: 0,
            }}
          />
          <IonText color={isOnline ? "success" : "danger"}>
            <small style={{ fontSize: "0.78rem", fontWeight: 800 }}>
              {isOnline ? "Conectado" : "Sin conexión"}
            </small>
          </IonText>
        </div>

        <section
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "22px",
            minHeight: "155px",
            padding: "18px",
            background:
              "linear-gradient(135deg, rgba(45,211,111,.96), rgba(210,164,58,.90))",
            boxShadow: "0 18px 42px rgba(0,0,0,.30)",
            color: "#fff",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: "-35px",
              top: "-45px",
              width: "155px",
              height: "155px",
              borderRadius: "999px",
              background: "rgba(255,255,255,.16)",
            }}
          />

          <div
            style={{
              position: "absolute",
              right: "26px",
              bottom: "-38px",
              width: "120px",
              height: "120px",
              borderRadius: "999px",
              background: "rgba(0,0,0,.12)",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: "1.45rem", fontWeight: 950, lineHeight: 1.1 }}>
                  Hola, {driverName} 👋
                </div>
                <div style={{ marginTop: 5, fontSize: ".88rem", fontWeight: 700, opacity: .94 }}>
                  Panel de conductor Rapa Go
                </div>
              </div>

              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "18px",
                  background: "rgba(255,255,255,.20)",
                  border: "1px solid rgba(255,255,255,.30)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backdropFilter: "blur(8px)",
                }}
              >
                <IonIcon icon={carOutline} style={{ fontSize: "30px" }} />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginTop: "18px",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,.18)",
                  border: "1px solid rgba(255,255,255,.25)",
                  borderRadius: "16px",
                  padding: "12px",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div style={{ fontSize: ".74rem", opacity: .86 }}>Estado</div>
                <div style={{ fontWeight: 950, marginTop: 2 }}>Listo para viajes</div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,.18)",
                  border: "1px solid rgba(255,255,255,.25)",
                  borderRadius: "16px",
                  padding: "12px",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div style={{ fontSize: ".74rem", opacity: .86 }}>Zona</div>
                <div style={{ fontWeight: 950, marginTop: 2 }}>Rapa Nui</div>
              </div>
            </div>
          </div>
        </section>

        <div style={{ marginTop: "18px" }}>
          <div style={{ color: "#F6F2EC", fontSize: "1rem", fontWeight: 950, marginBottom: "10px" }}>
            Accesos rápidos
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <IonCard button routerLink={ROUTES.DRIVER.REQUESTS} style={quickCardStyle}>
              <IonCardContent style={{ padding: "18px" }}>
                <div style={iconBoxStyle}>
                  <IonIcon icon={listOutline} style={{ fontSize: "28px" }} />
                </div>
                <div style={{ fontWeight: 950, color: "#111", fontSize: "1rem" }}>Solicitudes</div>
                <div style={{ marginTop: 5, color: "#333", fontSize: ".78rem", fontWeight: 800, lineHeight: 1.35 }}>
                  Viajes disponibles y activos
                </div>
              </IonCardContent>
            </IonCard>

            <IonCard button routerLink={ROUTES.DRIVER.TRIPS} style={quickCardStyle}>
              <IonCardContent style={{ padding: "18px" }}>
                <div style={iconBoxStyle}>
                  <IonIcon icon={carOutline} style={{ fontSize: "28px" }} />
                </div>
                <div style={{ fontWeight: 950, color: "#111", fontSize: "1rem" }}>Mis viajes</div>
                <div style={{ marginTop: 5, color: "#333", fontSize: ".78rem", fontWeight: 800, lineHeight: 1.35 }}>
                  Historial y navegación
                </div>
              </IonCardContent>
            </IonCard>

            <IonCard button routerLink={ROUTES.DRIVER.EARNINGS} style={quickCardStyle}>
              <IonCardContent style={{ padding: "18px" }}>
                <div style={iconBoxStyle}>
                  <IonIcon icon={cashOutline} style={{ fontSize: "28px" }} />
                </div>
                <div style={{ fontWeight: 950, color: "#111", fontSize: "1rem" }}>Ganancias</div>
                <div style={{ marginTop: 5, color: "#333", fontSize: ".78rem", fontWeight: 800, lineHeight: 1.35 }}>
                  Resumen de ingresos
                </div>
              </IonCardContent>
            </IonCard>

            <IonCard button routerLink={ROUTES.DRIVER.PROFILE} style={quickCardStyle}>
              <IonCardContent style={{ padding: "18px" }}>
                <div
                  style={{
                    ...iconBoxStyle,
                    background: "#6b7280",
                    color: "#fff",
                    boxShadow: "0 12px 24px rgba(107,114,128,.28)",
                  }}
                >
                  <IonIcon icon={personOutline} style={{ fontSize: "28px" }} />
                </div>
                <div style={{ fontWeight: 950, color: "#111", fontSize: "1rem" }}>Perfil</div>
                <div style={{ marginTop: 5, color: "#333", fontSize: ".78rem", fontWeight: 800, lineHeight: 1.35 }}>
                  Datos personales y vehículo
                </div>
              </IonCardContent>
            </IonCard>
          </div>
        </div>

        <IonCard
          style={{
            margin: "18px 0 0",
            borderRadius: "22px",
            background: "linear-gradient(135deg, #d2a43a, #c5532f)",
            color: "#fff",
            boxShadow: "0 16px 32px rgba(0,0,0,.22)",
          }}
        >
          <IonCardContent
            style={{
              padding: "18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div>
              <div style={{ fontWeight: 950, fontSize: "1rem" }}>
                Revisa tus solicitudes
              </div>
              <div style={{ opacity: .92, fontSize: ".8rem", marginTop: 4 }}>
                Cuando un pasajero pida un viaje, aparecerá aquí.
              </div>
            </div>

            <IonButton
              routerLink={ROUTES.DRIVER.REQUESTS}
              fill="solid"
              color="light"
              style={{ "--border-radius": "999px", "--color": "#111" } as CSSProperties}
            >
              Ver
            </IonButton>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
}


export function DriverRequestsPage(): JSX.Element {
  return <AssignedRidesPage />;
}


function formatClp(value: number | null | undefined): string {
  if (value == null) return "$0 CLP";
  return `$${value.toLocaleString("es-CL")} CLP`;
}

function getRequestCardStyles(): Record<string, CSSProperties> {
  return {
    card: {
      position: "relative",
      margin: 0,
      borderRadius: "28px",
      overflow: "hidden",
      background: "linear-gradient(145deg, #F6F2EC 0%, #EFE6D8 100%)",
      color: "#111111",
      border: "1px solid rgba(210,164,58,.42)",
      boxShadow: "0 24px 64px rgba(0,0,0,.34)",
      "--background": "#F6F2EC",
      "--color": "#111111",
    } as CSSProperties,
    darkLayer: {
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(circle at 10% 0%, rgba(45,211,111,.16), transparent 34%), radial-gradient(circle at 95% 100%, rgba(210,164,58,.18), transparent 36%)",
      pointerEvents: "none",
    },
    pill: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "7px 10px",
      borderRadius: "999px",
      background: "rgba(17,17,17,.06)",
      border: "1px solid rgba(17,17,17,.10)",
      color: "#111111",
      fontSize: ".72rem",
      fontWeight: 950,
    },
    routeBox: {
      marginTop: "16px",
      padding: "14px",
      borderRadius: "20px",
      background: "#FFFFFF",
      border: "1px solid rgba(210,164,58,.30)",
      boxShadow: "0 10px 26px rgba(0,0,0,.08)",
      color: "#111111",
    },
    routeDot: {
      width: 13,
      height: 13,
      borderRadius: 999,
      marginTop: 5,
      boxShadow: "0 0 0 5px rgba(17,17,17,.05)",
      flexShrink: 0,
    },
    primaryButton: {
      "--border-radius": "17px",
      height: "56px",
      "--background": "linear-gradient(135deg, #D8A83E 0%, #F0D9AA 100%)",
      "--background-activated": "#d2a43a",
      "--color": "#111111",
      fontWeight: 950,
      letterSpacing: ".2px",
      boxShadow: "0 14px 30px rgba(210,164,58,.30)",
    } as CSSProperties,
    secondaryButton: {
      "--border-radius": "17px",
      height: "56px",
      "--background": "linear-gradient(135deg, #2A1A18 0%, #8F3F25 52%, #C5532F 100%)",
      "--background-activated": "#6f2f1e",
      "--background-hover": "linear-gradient(135deg, #351f1b 0%, #9f472b 52%, #d26037 100%)",
      "--color": "#FFFFFF",
      "--box-shadow": "0 14px 30px rgba(143,63,37,.32)",
      "--border-color": "rgba(255,255,255,.18)",
      fontWeight: 950,
      letterSpacing: ".2px",
    } as CSSProperties,
  };
}

function AssignedRidesPage(): JSX.Element {
  const { session } = useAuth();

  type DriverRideData = import("../../features/rides/rides.service").DriverRideData;
  type AvailableRideData = import("../../features/rides/rides.service").AvailableRideData;

  const [availableRides, setAvailableRides] = useState<AvailableRideData[]>([]);
  const [assignedRides, setAssignedRides] = useState<DriverRideData[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const driverLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const activeRide = assignedRides[0] ?? null;

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Este dispositivo no permite GPS. No puedes tomar viajes reales sin ubicación.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        driverLocationRef.current = nextLocation;

        // Cuando hay viaje activo NO actualizamos estado en cada GPS,
        // porque eso remonta la pantalla y provoca el bucle visual del mapa.
        if (activeRide) {
          return;
        }

        setDriverLocation(nextLocation);
        setLocationError(null);
      },
      () => {
        setDriverLocation(null);
        setLocationError("Activa el permiso de ubicación para tomar viajes reales.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 12000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [activeRide?.id]);

  const loadRides = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const [available, mine] = await Promise.all([
        ridesService.listAvailableRides(session.accessToken),
        ridesService.listDriverRides(session.accessToken),
      ]);

      setAvailableRides(available.filter((ride) => ride.status === "requested"));
      setAssignedRides(
        mine.filter((ride) =>
          ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(
            ride.status,
          ),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar solicitudes.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void loadRides();
  }, [loadRides]);

  async function handleAcceptRide(rideId: string): Promise<void> {
    if (!session?.accessToken) return;

    if (!driverLocation) {
      setError("Activa tu ubicación real para tomar este viaje.");
      return;
    }

    setAcceptingId(rideId);
    setError(null);

    try {
      const accepted = await ridesService.acceptRideRequest(
        session.accessToken,
        rideId,
      );

      try {
        localStorage.setItem(
          "rapago_current_driver_location",
          JSON.stringify({
            rideId,
            lat: driverLocation.lat,
            lng: driverLocation.lng,
            updatedAt: new Date().toISOString(),
          }),
        );
      } catch {
        // No bloquea la aceptación del viaje.
      }

      setAvailableRides((prev) => prev.filter((ride) => ride.id !== rideId));
      setAssignedRides([accepted as DriverRideData]);

      // Forzamos recarga para traer notes/coordenadas completas y renderizar ruta.
      window.setTimeout(() => {
        void loadRides();
      }, 300);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Este viaje ya fue tomado por otro conductor.",
      );
      void loadRides();
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleArrivedSmart(ride: DriverRideData): Promise<void> {
    if (!session?.accessToken) return;

    try {
      /*
       * Backend exige este orden:
       * accepted -> driver_en_route -> driver_arrived
       *
       * En la pantalla tipo Uber mostramos directamente "Llegué",
       * pero por dentro hacemos los dos pasos para evitar el 409.
       */
      if (ride.status === "accepted") {
        await ridesService.markEnRoute(session.accessToken, ride.id);
      }

      await ridesService.markArrived(session.accessToken, ride.id);
      await loadRides();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo marcar llegada.",
      );
      await loadRides();
    }
  }

  async function handleStartRide(rideId: string): Promise<void> {
    if (!session?.accessToken) return;
    try {
      await ridesService.startRide(session.accessToken, rideId);
      await loadRides();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el viaje.");
    }
  }

  async function handleCompleteRide(rideId: string): Promise<void> {
    if (!session?.accessToken) return;
    try {
      await ridesService.completeRide(session.accessToken, rideId);
      await loadRides();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo finalizar el viaje.");
    }
  }

  async function handleCancelRide(rideId: string): Promise<void> {
    if (!session?.accessToken) return;
    try {
      await ridesService.cancelAcceptedRide(session.accessToken, rideId);
      await loadRides();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar el viaje.");
    }
  }

  function AvailableRideCard({ ride }: { ride: AvailableRideData }): JSX.Element {
    const nav = extractRideNavigationPoints(ride.notes);
    const styles = getRequestCardStyles();

    const pickupWalkText =
      nav.pickupWalkMeters != null && nav.pickupWalkMeters > 8
        ? `Pasajero caminando ${Math.round(nav.pickupWalkMeters)} m`
        : "Punto de recogida confirmado";

    return (
      <IonCard style={styles.card}>
        <div style={styles.darkLayer} />

        <IonCardContent style={{ position: "relative", zIndex: 1, padding: "16px" }}>
          {/* Encabezado */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 11px",
                  borderRadius: "999px",
                  background: "rgba(45,211,111,.18)",
                  border: "1px solid rgba(15,138,58,.22)",
                  color: "#0F8A3A",
                  fontSize: ".72rem",
                  fontWeight: 950,
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: ".45px",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: "#22c55e",
                    boxShadow: "0 0 18px rgba(34,197,94,.9)",
                  }}
                />
                Nuevo viaje
              </div>

              <div style={{ fontWeight: 950, fontSize: "1.22rem", lineHeight: 1.08, color: "#111111" }}>
                Solicitud cercana
              </div>
              <div style={{ marginTop: 5, color: "rgba(17,17,17,.66)", fontSize: ".78rem", lineHeight: 1.35 }}>
                Revisa origen, destino y pago antes de aceptar.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAvailableRides((prev) => prev.filter((item) => item.id !== ride.id))}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,.16)",
                background: "rgba(255,255,255,.08)",
                color: "#111111",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              aria-label="Cerrar solicitud"
            >
              <IonIcon icon={closeOutline} style={{ fontSize: 20 }} />
            </button>
          </div>

          {/* Chips */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <div style={styles.pill}>
              <IonIcon icon={timeOutline} style={{ fontSize: 15, color: "#ffd33d" }} />
              Ahora
            </div>
            <div style={styles.pill}>
              <IonIcon icon={cardOutline} style={{ fontSize: 15, color: "#22c55e" }} />
              Efectivo
            </div>
            <div style={styles.pill}>
              <IonIcon icon={starOutline} style={{ fontSize: 15, color: "#ffd33d" }} />
              Verificado
            </div>
          </div>

          {/* Ruta clara */}
          <div style={styles.routeBox}>
            <div style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: "10px", alignItems: "start" }}>
              <div style={{ ...styles.routeDot, background: "#22c55e" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#22c55e", fontSize: ".72rem", fontWeight: 950, letterSpacing: ".35px" }}>
                  RECOGER EN
                </div>
                <div style={{ fontWeight: 950, fontSize: "1.02rem", marginTop: 3, lineHeight: 1.25, color: "#111111" }}>
                  {ride.originText}
                </div>
                <div style={{ color: "rgba(17,17,17,.66)", fontSize: ".78rem", marginTop: 5, lineHeight: 1.35 }}>
                  <IonIcon icon={walkOutline} style={{ fontSize: 14, marginRight: 4, verticalAlign: "-2px", color: "#d2a43a" }} />
                  {pickupWalkText}
                </div>
              </div>

              <div
                style={{
                  width: 2,
                  height: 34,
                  background: "linear-gradient(180deg, #22c55e, #ef4444)",
                  marginLeft: 6,
                  borderRadius: 999,
                }}
              />
              <div />

              <div style={{ ...styles.routeDot, background: "#ef4444" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#ef4444", fontSize: ".72rem", fontWeight: 950, letterSpacing: ".35px" }}>
                  DESTINO
                </div>
                <div style={{ fontWeight: 950, fontSize: "1.02rem", marginTop: 3, lineHeight: 1.25, color: "#111111" }}>
                  {ride.destinationText}
                </div>
              </div>
            </div>
          </div>

          {/* Resumen precio */}
          <div
            style={{
              marginTop: 14,
              padding: "14px 15px",
              borderRadius: "20px",
              background: "linear-gradient(135deg, rgba(34,197,94,.16), rgba(210,164,58,.20))",
              border: "1px solid rgba(15,138,58,.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ color: "rgba(17,17,17,.62)", fontSize: ".72rem", fontWeight: 900 }}>
                GANANCIA ESTIMADA
              </div>
              <div style={{ color: "#0F8A3A", fontWeight: 950, fontSize: "1.48rem", lineHeight: 1.05, marginTop: 4 }}>
                {formatClp(ride.estimatedFareClp)}
              </div>
              <div style={{ color: "rgba(17,17,17,.66)", fontSize: ".74rem", marginTop: 4 }}>
                Pago en efectivo al finalizar
              </div>
            </div>

            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: "17px",
                background: "rgba(15,138,58,.10)",
                border: "1px solid rgba(15,138,58,.20)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0F8A3A",
                fontWeight: 950,
                fontSize: "1.22rem",
                flexShrink: 0,
              }}
            >
              $
            </div>
          </div>

          {/* Acciones */}
          <div style={{ display: "grid", gridTemplateColumns: "0.86fr 1.14fr", gap: 12, marginTop: 16 }}>
            <IonButton
              expand="block"
              fill="solid"
              style={styles.secondaryButton}
              onClick={() => setAvailableRides((prev) => prev.filter((item) => item.id !== ride.id))}
            >
              Rechazar
            </IonButton>

            <IonButton
              expand="block"
              disabled={acceptingId === ride.id || activeRide != null || !driverLocation}
              style={styles.primaryButton}
              onClick={() => void handleAcceptRide(ride.id)}
            >
              {acceptingId === ride.id ? <IonSpinner name="dots" /> : driverLocation ? "Aceptar viaje" : "Activa GPS"}
            </IonButton>
          </div>
        </IonCardContent>
      </IonCard>
    );
  }

  function ActiveRideScreen({ ride }: { ride: DriverRideData }): JSX.Element {
    const statusText =
      ride.status === "driver_arrived"
        ? "Esperando pasajero"
        : ride.status === "in_progress"
          ? "Navegando al destino"
          : "Navegando al punto de recogida";

    return (
      <div
        style={{
          minHeight: "100%",
          background: "#0f1115",
          margin: "-16px",
          color: "#F6F2EC",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1, position: "relative", minHeight: 420 }}>
          <UberDriverNavigationMap ride={ride} height={520} />

          <div
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: 16,
              ...uberPanelStyle({
                padding: 18,
              }),
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 999,
                  background: "#22c55e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: 28, color: "#fff" }} />
              </div>
              <div>
                <div style={{ fontWeight: 950, fontSize: "1.1rem" }}>{statusText}</div>
                <div style={{ color: "rgba(246,242,236,.68)", fontSize: ".82rem", marginTop: 2 }}>
                  {ride.status === "in_progress" ? ride.destinationText : ride.originText}
                </div>
              </div>
            </div>

            {ride.status === "driver_arrived" && (
              <IonButton
                expand="block"
                color="success"
                style={{ "--border-radius": "14px", height: "52px" } as CSSProperties}
                onClick={() => void handleStartRide(ride.id)}
              >
                Iniciar viaje
              </IonButton>
            )}

            {ride.status === "in_progress" && (
              <IonButton
                expand="block"
                color="success"
                style={{ "--border-radius": "14px", height: "52px" } as CSSProperties}
                onClick={() => void handleCompleteRide(ride.id)}
              >
                Finalizar viaje
              </IonButton>
            )}

            {["accepted", "driver_en_route"].includes(ride.status) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <IonButton
                  expand="block"
                  color="success"
                  style={{ "--border-radius": "14px", height: "52px" } as CSSProperties}
                  onClick={() => void handleArrivedSmart(ride)}
                >
                 Tomar pasajero
                </IonButton>

                <IonButton
                  expand="block"
                  fill="outline"
                  color="light"
                  style={{ "--border-radius": "14px", height: "52px" } as CSSProperties}
                  onClick={() => void handleCancelRide(ride.id)}
                >
                  Cancelar
                </IonButton>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="success">
          <IonTitle>{activeRide ? "Viaje activo" : "Solicitudes"}</IonTitle>
          <div slot="end" style={{ paddingRight: 8 }}>
            {!activeRide && (
              <IonButton fill="clear" color="light" onClick={() => void loadRides()} disabled={loading}>
                <IonIcon icon={refreshOutline} slot="icon-only" />
              </IonButton>
            )}
          </div>
        </IonToolbar>
        {!activeRide && (
          <IonToolbar
            style={{
              "--background": "linear-gradient(135deg, #1f1f1f, #8f3f25)",
              "--border-width": "0",
            } as CSSProperties}
          >
            <div style={{ padding: "9px 16px 12px", color: "#F6F2EC" }}>
              <div style={{ fontWeight: 950, fontSize: ".92rem" }}>Viajes disponibles</div>
              <div style={{ color: "rgba(246,242,236,.62)", fontSize: ".74rem", marginTop: 2 }}>
                Acepta solo cuando puedas iniciar la ruta.
              </div>
            </div>
          </IonToolbar>
        )}
      </IonHeader>

      <IonContent
        className={activeRide ? "" : "ion-padding"}
        style={{
          "--background":
            "linear-gradient(180deg, rgba(246,242,236,.86), rgba(217,195,160,.72)), url('/assets/rapa-go-bg.jpg') center/cover no-repeat",
        } as CSSProperties}
      >
        {activeRide ? (
          <ActiveRideScreen ride={activeRide} />
        ) : (
          <>
            <IonRefresher
              slot="fixed"
              onIonRefresh={(event) => {
                void loadRides().then(() => event.detail.complete());
              }}
            >
              <IonRefresherContent />
            </IonRefresher>

            {loading && (
              <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
                <IonSpinner name="crescent" />
              </div>
            )}

            {error && <IonText color="danger"><p style={{ fontWeight: 900 }}>{error}</p></IonText>}

            {locationError && (
              <IonCard
                style={{
                  margin: "0 0 14px",
                  borderRadius: "18px",
                  background: "#fff3cd",
                  color: "#111",
                  border: "1px solid rgba(210,164,58,.45)",
                }}
              >
                <IonCardContent style={{ padding: "12px 14px", fontWeight: 900, fontSize: ".82rem" }}>
                  📍 {locationError}
                </IonCardContent>
              </IonCard>
            )}

            {!loading && availableRides.length === 0 && (
              <div style={{ textAlign: "center", paddingTop: 40 }}>
                <IonText color="medium">
                  <p>No hay solicitudes disponibles.</p>
                </IonText>
              </div>
            )}

            {!loading && availableRides.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 90, maxWidth: 520, margin: "0 auto" }}>
                {availableRides.map((ride) => (
                  <AvailableRideCard key={ride.id} ride={ride} />
                ))}
              </div>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  );
}


export function DriverTripsPage(): JSX.Element {
  return <DriverMyRidesPage />;
}


function DriverHistoryRideCard({
  ride,
  onRate,
  alreadyRated,
}: {
  ride: {
    id: string;
    originText: string;
    destinationText: string;
    status: string;
    estimatedFareClp?: number | null;
    acceptedAt?: string | null;
    completedAt?: string | null;
    cancelledAt?: string | null;
  };
  onRate: () => void;
  alreadyRated: boolean;
}): JSX.Element {
  const label =
    ride.status === "completed"
      ? "Completado"
      : ride.status === "cancelled"
        ? "Cancelado"
        : ride.status;

  return (
    <IonCard
      style={{
        margin: 0,
        borderRadius: "18px",
        background: "#F6F2EC",
        color: "#111111",
        border: "1px solid rgba(0,0,0,.08)",
      }}
    >
      <IonCardContent style={{ padding: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: ".92rem" }}>
              {ride.originText} → {ride.destinationText}
            </div>

            <IonBadge
              color={ride.status === "completed" ? "medium" : "danger"}
              style={{ marginTop: 6 }}
            >
              {label}
            </IonBadge>

            {ride.estimatedFareClp != null && (
              <div style={{ marginTop: 8, fontWeight: 800, fontSize: ".82rem" }}>
                Tarifa est.: ${ride.estimatedFareClp.toLocaleString("es-CL")} CLP
              </div>
            )}

            {ride.completedAt && (
              <div style={{ marginTop: 4, color: "#666", fontSize: ".74rem" }}>
                Completado: {new Date(ride.completedAt).toLocaleString("es-CL")}
              </div>
            )}

            {ride.cancelledAt && (
              <div style={{ marginTop: 4, color: "#666", fontSize: ".74rem" }}>
                Cancelado: {new Date(ride.cancelledAt).toLocaleString("es-CL")}
              </div>
            )}
          </div>

          {ride.status === "completed" && !alreadyRated && (
            <IonButton size="small" fill="outline" color="warning" onClick={onRate}>
              Calificar
            </IonButton>
          )}
        </div>
      </IonCardContent>
    </IonCard>
  );
}

function DriverMyRidesPage(): JSX.Element {
  const { session } = useAuth();
  type DriverRideData = import("../../features/rides/rides.service").DriverRideData;

  const [rides, setRides] = useState<DriverRideData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadRides = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setLoadError(null);

    try {
      const data = await ridesService.listDriverRides(session.accessToken);
      setRides(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar tus viajes.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void loadRides();
  }, [loadRides]);

  const activeRide = rides.find((ride) =>
    ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(
      ride.status,
    ),
  );

  const historyRides = rides.filter(
    (ride) =>
      !["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(
        ride.status,
      ),
  );

  async function runRideAction(
    rideId: string,
    action: () => Promise<unknown>,
  ): Promise<void> {
    setActionLoading(rideId);

    try {
      await action();
      await loadRides();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudo actualizar el viaje.");
    } finally {
      setActionLoading(null);
    }
  }

  function statusLabel(status: string): string {
    if (status === "accepted") return "Aceptado";
    if (status === "driver_en_route") return "En camino";
    if (status === "driver_arrived") return "Llegué";
    if (status === "in_progress") return "En viaje";
    if (status === "completed") return "Completado";
    if (status === "cancelled") return "Cancelado";
    return status;
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="success">
          <IonTitle>Mis Viajes</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonRefresher
          slot="fixed"
          onIonRefresh={(event) => {
            void loadRides().then(() => event.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && (
          <IonText color="danger">
            <p>{loadError}</p>
          </IonText>
        )}

        {!loading && activeRide && (
          <IonCard
            style={{
              margin: "0 0 14px",
              borderRadius: "22px",
              overflow: "hidden",
              background: "#F6F2EC",
              border: "2px solid rgba(45,211,111,.55)",
            }}
          >
            <IonCardContent style={{ padding: "12px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "10px",
                  marginBottom: "10px",
                }}
              >
                <div>
                  <div style={{ fontWeight: 950, fontSize: "1.08rem", color: "#111" }}>
                    Viaje activo
                  </div>
                  <div style={{ color: "#333", fontSize: ".78rem", fontWeight: 800, marginTop: 2 }}>
                    {activeRide.status === "in_progress"
                      ? "Guía al pasajero al destino"
                      : "Primero ve al punto de recogida"}
                  </div>
                </div>

                <IonBadge color="success">
                  {statusLabel(activeRide.status)}
                </IonBadge>
              </div>

              <div
                style={{
                  borderRadius: "18px",
                  overflow: "hidden",
                  border: "1px solid rgba(0,0,0,.1)",
                  background: "#111827",
                }}
              >
                <UberDriverNavigationMap ride={activeRide} height={320} />
              </div>

              <div style={{ marginTop: "12px", color: "#111" }}>
                <div style={{ fontWeight: 900, fontSize: ".92rem" }}>
                  {activeRide.originText} → {activeRide.destinationText}
                </div>

                {activeRide.estimatedFareClp != null && (
                  <div style={{ marginTop: 6, color: "#C89B3C", fontWeight: 950 }}>
                    ${activeRide.estimatedFareClp.toLocaleString("es-CL")} CLP
                  </div>
                )}

                {getCleanRideNote(activeRide.notes) && (
                  <div style={{ marginTop: 6, color: "#333", fontSize: ".78rem", fontWeight: 800, lineHeight: 1.35 }}>
                    {getCleanRideNote(activeRide.notes)}
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "14px" }}>
                {activeRide.status === "accepted" && (
                  <IonButton
                    expand="block"
                    color="success"
                    disabled={actionLoading === activeRide.id}
                    onClick={() =>
                      void runRideAction(activeRide.id, async () => {
                        const nav = extractRideNavigationPoints(activeRide.notes);
                        if (nav.pickupLat != null && nav.pickupLng != null) {
                          getCurrentLocationForNavigation({
                            lat: nav.pickupLat,
                            lng: nav.pickupLng,
                          });
                        }

                        return ridesService.markEnRoute(
                          session!.accessToken,
                          activeRide.id,
                        );
                      })
                    }
                  >
                    {actionLoading === activeRide.id ? <IonSpinner name="dots" /> : "Comenzar ruta"}
                  </IonButton>
                )}

                {activeRide.status === "driver_en_route" && (
                  <IonButton
                    expand="block"
                    color="success"
                    disabled={actionLoading === activeRide.id}
                    onClick={() =>
                      void runRideAction(activeRide.id, () =>
                        ridesService.markArrived(session!.accessToken, activeRide.id),
                      )
                    }
                  >
                    {actionLoading === activeRide.id ? <IonSpinner name="dots" /> : "Llegué"}
                  </IonButton>
                )}

                {activeRide.status === "driver_arrived" && (
                  <IonButton
                    expand="block"
                    color="success"
                    disabled={actionLoading === activeRide.id}
                    onClick={() =>
                      void runRideAction(activeRide.id, () =>
                        ridesService.startRide(session!.accessToken, activeRide.id),
                      )
                    }
                  >
                    {actionLoading === activeRide.id ? <IonSpinner name="dots" /> : "Iniciar viaje"}
                  </IonButton>
                )}

                {activeRide.status === "in_progress" && (
                  <IonButton
                    expand="block"
                    color="success"
                    disabled={actionLoading === activeRide.id}
                    onClick={() =>
                      void runRideAction(activeRide.id, () =>
                        ridesService.completeRide(session!.accessToken, activeRide.id),
                      )
                    }
                  >
                    {actionLoading === activeRide.id ? <IonSpinner name="dots" /> : "Finalizar"}
                  </IonButton>
                )}

                {["accepted", "driver_en_route", "driver_arrived"].includes(activeRide.status) && (
                  <IonButton
                    expand="block"
                    fill="outline"
                    color="danger"
                    disabled={actionLoading === activeRide.id}
                    onClick={() =>
                      void runRideAction(activeRide.id, () =>
                        ridesService.cancelAcceptedRide(session!.accessToken, activeRide.id),
                      )
                    }
                  >
                    Cancelar
                  </IonButton>
                )}
              </div>
            </IonCardContent>
          </IonCard>
        )}

        {!loading && !activeRide && historyRides.length === 0 && (
          <IonText color="medium">
            <p>No tienes viajes todavía.</p>
          </IonText>
        )}

        {!loading && !activeRide && historyRides.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {historyRides.map((ride) => (
              <IonCard
                key={ride.id}
                style={{
                  margin: 0,
                  borderRadius: "16px",
                  background: "#F6F2EC",
                }}
              >
                <IonCardContent style={{ padding: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                    <div>
                      <div style={{ fontWeight: 900, color: "#111" }}>
                        {ride.originText} → {ride.destinationText}
                      </div>
                      <IonBadge
                        color={ride.status === "completed" ? "medium" : "danger"}
                        style={{ marginTop: 6 }}
                      >
                        {statusLabel(ride.status)}
                      </IonBadge>
                      {ride.estimatedFareClp != null && (
                        <div style={{ marginTop: 8, color: "#333", fontSize: ".82rem" }}>
                          Tarifa est.: ${ride.estimatedFareClp.toLocaleString("es-CL")} CLP
                        </div>
                      )}
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}

export function DriverEarningsPage(): JSX.Element {
  const m = meta("/driver/earnings");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="success"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="driver" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "es",       label: "Español" },
  { value: "en",       label: "Inglés" },
  { value: "rapa_nui", label: "Rapa Nui" },
  { value: "fr",       label: "Francés" },
];

function isLicenseExpiringSoon(expiry: string | null): boolean {
  if (!expiry) return false;
  const expiryDate = new Date(expiry);
  const diff = expiryDate.getTime() - Date.now();
  return diff >= 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

function isLicenseExpired(expiry: string | null): boolean {
  if (!expiry) return false;
  return new Date(expiry).getTime() < Date.now();
}


type StoredDriverRegistrationProfile = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  rut?: string | null;
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: string | number | null;
  vehiclePlate?: string | null;
  vehicleColor?: string | null;
  licenseNumber?: string | null;
};

function readStoredDriverRegistrationProfile(): StoredDriverRegistrationProfile {
  try {
    const raw =
      localStorage.getItem("rapago_driver_registration_profile") ??
      localStorage.getItem("rapago_registration_profile");

    const parsed = raw ? (JSON.parse(raw) as StoredDriverRegistrationProfile) : {};

    return {
      ...parsed,
      phone:
        parsed.phone ??
        localStorage.getItem("rapago_profile_phone") ??
        localStorage.getItem("rapago_driver_phone"),
      rut:
        parsed.rut ??
        localStorage.getItem("rapago_profile_rut") ??
        localStorage.getItem("rapago_driver_rut"),
    };
  } catch {
    return {};
  }
}

function persistStoredDriverRegistrationProfile(data: Partial<StoredDriverRegistrationProfile>): void {
  try {
    const current = readStoredDriverRegistrationProfile();
    const next = { ...current, ...data };

    localStorage.setItem("rapago_driver_registration_profile", JSON.stringify(next));

    if (next.phone) {
      localStorage.setItem("rapago_profile_phone", String(next.phone));
      localStorage.setItem("rapago_driver_phone", String(next.phone));
    }

    if (next.rut) {
      localStorage.setItem("rapago_profile_rut", String(next.rut));
      localStorage.setItem("rapago_driver_rut", String(next.rut));
    }
  } catch {
    // No bloquea el perfil si localStorage no está disponible.
  }
}

function getSessionPhone(user: unknown): string {
  if (!user || typeof user !== "object") return "";
  const value = (user as { phone?: string | null }).phone;
  return typeof value === "string" ? value.trim() : "";
}

function getAutoDriverPhone(sessionUser: unknown, profilePhone?: string | null): string {
  const stored = readStoredDriverRegistrationProfile();

  return (
    profilePhone?.trim() ||
    getSessionPhone(sessionUser) ||
    stored.phone?.trim() ||
    ""
  );
}

function driverFormCardStyle(extra?: CSSProperties): CSSProperties {
  return {
    margin: "0 0 14px",
    borderRadius: "22px",
    background: "#F6F2EC",
    color: "#111",
    border: "1px solid rgba(210,164,58,.28)",
    boxShadow: "0 14px 34px rgba(0,0,0,.18)",
    overflow: "hidden",
    ...extra,
  };
}

function driverInputItemStyle(): CSSProperties {
  return {
    "--background": "#ffffff",
    "--color": "#050505",
    "--placeholder-color": "#5f5f5f",
    "--placeholder-opacity": "1",
    "--highlight-color-focused": "#d2a43a",
    "--border-color": "rgba(210,164,58,.55)",
    "--border-radius": "16px",
    "--padding-start": "14px",
    "--inner-padding-end": "14px",
    marginTop: "10px",
    border: "1.5px solid rgba(210,164,58,.55)",
    borderRadius: "16px",
    overflow: "hidden",
    fontWeight: 900,
  } as CSSProperties;
}

function driverFieldTextStyle(): CSSProperties {
  return {
    color: "#050505",
    fontWeight: 950,
    fontSize: ".95rem",
    opacity: 1,
    "--color": "#050505",
    "--placeholder-color": "#5f5f5f",
    "--placeholder-opacity": "1",
  } as CSSProperties;
}

function driverFieldLabelStyle(): CSSProperties {
  return {
    color: "#050505",
    fontWeight: 950,
    fontSize: ".78rem",
    opacity: 1,
  };
}

function safeProfileMessage(message: string | null): string | null {
  if (!message) return null;

  if (
    message.toLowerCase().includes("token") ||
    message.toLowerCase().includes("sesión expir") ||
    message.toLowerCase().includes("unauthorized") ||
    message.includes("401")
  ) {
    return "No se pudo cargar el perfil desde el servidor. La sesión sigue abierta.";
  }

  return message;
}

export function DriverProfilePage(): JSX.Element {
  const auth = useAuth() as ReturnType<typeof useAuth> & {
    logout?: () => void | Promise<void>;
    signOut?: () => void | Promise<void>;
  };

  const { session } = auth;
  const history = useHistory();

  const storedProfile = readStoredDriverRegistrationProfile();

  const [phone, setPhone] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState(String(storedProfile.vehicleBrand ?? ""));
  const [vehicleModel, setVehicleModel] = useState(String(storedProfile.vehicleModel ?? ""));
  const [vehicleYear, setVehicleYear] = useState(
    storedProfile.vehicleYear != null ? String(storedProfile.vehicleYear) : "",
  );
  const [vehiclePlate, setVehiclePlate] = useState(String(storedProfile.vehiclePlate ?? ""));
  const [vehicleColor, setVehicleColor] = useState(String(storedProfile.vehicleColor ?? ""));
  const [licenseNumber, setLicenseNumber] = useState(String(storedProfile.licenseNumber ?? ""));
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState<string[]>(["es"]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!session?.accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const profile = await driverProfileService.getMyProfile(session.accessToken);
      const autoPhone = getAutoDriverPhone(session.user, profile?.phone);

      if (profile) {
        setPhone(autoPhone);
        setVehicleBrand(profile.vehicleBrand ?? String(storedProfile.vehicleBrand ?? ""));
        setVehicleModel(profile.vehicleModel ?? String(storedProfile.vehicleModel ?? ""));
        setVehicleYear(profile.vehicleYear != null ? String(profile.vehicleYear) : String(storedProfile.vehicleYear ?? ""));
        setVehiclePlate(profile.vehiclePlate ?? String(storedProfile.vehiclePlate ?? ""));
        setVehicleColor(profile.vehicleColor ?? String(storedProfile.vehicleColor ?? ""));
        setLicenseNumber(profile.licenseNumber ?? String(storedProfile.licenseNumber ?? ""));
        setLicenseExpiry(profile.licenseExpiry ?? "");
        setProfilePhotoUrl(profile.profilePhotoUrl ?? "");
        setBio(profile.bio ?? "");
        setLanguages(profile.languages?.length ? profile.languages : ["es"]);
      } else {
        setPhone(autoPhone);
      }

      if (autoPhone) {
        persistStoredDriverRegistrationProfile({
          phone: autoPhone,
          email: session.user?.email ?? null,
          name: session.user?.name ?? null,
        });
      }
    } catch (err) {
      const fallbackPhone = getAutoDriverPhone(session.user, null);
      setPhone(fallbackPhone);

      if (fallbackPhone) {
        persistStoredDriverRegistrationProfile({
          phone: fallbackPhone,
          email: session.user?.email ?? null,
          name: session.user?.name ?? null,
        });
      }

      const message = err instanceof Error ? err.message : "Error al cargar perfil.";
      setError(safeProfileMessage(message));
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, session?.user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function handleSave() {
    if (!session?.accessToken) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const payload: Parameters<typeof driverProfileService.upsertMyProfile>[1] = {};
      const trimPhone = phone.trim();

      if (trimPhone) payload.phone = trimPhone;
      if (vehicleBrand.trim()) payload.vehicleBrand = vehicleBrand.trim();
      if (vehicleModel.trim()) payload.vehicleModel = vehicleModel.trim();
      if (vehicleYear.trim()) payload.vehicleYear = parseInt(vehicleYear, 10);
      if (vehiclePlate.trim()) payload.vehiclePlate = vehiclePlate.trim().toUpperCase();
      if (vehicleColor.trim()) payload.vehicleColor = vehicleColor.trim();
      if (licenseNumber.trim()) payload.licenseNumber = licenseNumber.trim();
      if (licenseExpiry) payload.licenseExpiry = licenseExpiry;
      if (profilePhotoUrl.trim()) payload.profilePhotoUrl = profilePhotoUrl.trim();
      if (bio.trim()) payload.bio = bio.trim();
      payload.languages = languages.length > 0 ? languages : ["es"];

      await driverProfileService.upsertMyProfile(session.accessToken, payload);

      persistStoredDriverRegistrationProfile({
        phone: trimPhone,
        email: session.user?.email ?? null,
        name: session.user?.name ?? null,
        vehicleBrand: vehicleBrand.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleYear: vehicleYear.trim(),
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        vehicleColor: vehicleColor.trim(),
        licenseNumber: licenseNumber.trim(),
      });

      setSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al guardar perfil.";
      setError(safeProfileMessage(message));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      if (typeof auth.logout === "function") {
        await auth.logout();
      } else if (typeof auth.signOut === "function") {
        await auth.signOut();
      } else {
        localStorage.removeItem("rapago_session");
        localStorage.removeItem("rapago_auth_session");
        localStorage.removeItem("auth_session");
        sessionStorage.clear();
      }
    } finally {
      history.replace(ROUTES.AUTH.LOGIN);
    }
  }

  function toggleLanguage(value: string): void {
    setLanguages((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  }

  const displayName = session?.user?.name ?? "Conductor";
  const initials =
    displayName
      .split(" ")
      .slice(0, 2)
      .map((word) => word[0] ?? "")
      .join("")
      .toUpperCase() || "C";

  const licenseWarning = isLicenseExpired(licenseExpiry)
    ? "Licencia vencida. Actualiza la fecha."
    : isLicenseExpiringSoon(licenseExpiry)
      ? "Tu licencia vence pronto."
      : null;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="success">
          <IonTitle>Mi Perfil</IonTitle>
          <IonButtons slot="end">
            <IonButton color="light" onClick={() => void handleLogout()}>
              Cerrar sesión
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent
        className="ion-padding"
        style={{
          "--background":
            "linear-gradient(180deg, rgba(15,15,15,.86), rgba(15,15,15,.96)), url('/assets/rapa-go-bg.jpg') center/cover no-repeat",
        } as CSSProperties}
      >
        <IonRefresher
          slot="fixed"
          onIonRefresh={(event) => {
            void loadProfile().then(() => event.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && (
          <div style={{ maxWidth: 560, margin: "0 auto", paddingBottom: 96 }}>
            <section
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: "26px",
                padding: "20px",
                marginBottom: 14,
                background: "linear-gradient(135deg, rgba(45,211,111,.95), rgba(210,164,58,.92))",
                color: "#fff",
                boxShadow: "0 18px 44px rgba(0,0,0,.30)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  right: -45,
                  top: -50,
                  width: 150,
                  height: 150,
                  borderRadius: 999,
                  background: "rgba(255,255,255,.16)",
                }}
              />
              <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "22px",
                    background: "rgba(17,17,17,.24)",
                    border: "1px solid rgba(255,255,255,.30)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.55rem",
                    fontWeight: 950,
                  }}
                >
                  {initials}
                </div>
                <div>
                  <div style={{ fontSize: "1.28rem", fontWeight: 950, lineHeight: 1.1 }}>
                    {displayName}
                  </div>
                  <div style={{ marginTop: 4, fontSize: ".83rem", opacity: .94 }}>
                    Perfil de conductor Rapa Go
                  </div>
                  <div style={{ marginTop: 8, fontSize: ".78rem", fontWeight: 850 }}>
                    {phone.trim() ? phone : "Teléfono pendiente"}
                  </div>
                </div>
              </div>
            </section>

            {error && (
              <IonCard style={driverFormCardStyle({ background: "#fff3cd", border: "1px solid #ffc107" })}>
                <IonCardContent style={{ padding: "10px 14px" }}>
                  <IonText>
                    <p style={{ margin: 0, color: "#6b4700", fontWeight: 800, fontSize: ".82rem" }}>
                      {error}
                    </p>
                  </IonText>
                </IonCardContent>
              </IonCard>
            )}

            {success && (
              <IonCard style={driverFormCardStyle({ background: "#e8fff1", border: "1px solid rgba(34,197,94,.40)" })}>
                <IonCardContent style={{ padding: "10px 14px" }}>
                  <IonText color="success">
                    <p style={{ margin: 0, fontWeight: 900, fontSize: ".82rem" }}>
                      Perfil guardado correctamente.
                    </p>
                  </IonText>
                </IonCardContent>
              </IonCard>
            )}

            <IonCard style={driverFormCardStyle()}>
              <IonCardContent>
                <div style={{ fontWeight: 950, fontSize: "1rem", marginBottom: 4 }}>Datos personales</div>
                <div style={{ color: "#333", fontSize: ".78rem", fontWeight: 800, marginBottom: 10 }}>
                  El teléfono se toma automáticamente desde el registro si está disponible.
                </div>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>Teléfono</IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={phone}
                    onIonInput={(event) => setPhone(String(event.detail.value ?? ""))}
                    placeholder="+56 9 1234 5678"
                    type="tel"
                    maxlength={20}
                    clearInput
                  />
                </IonItem>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>Foto de perfil</IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={profilePhotoUrl}
                    onIonInput={(event) => setProfilePhotoUrl(String(event.detail.value ?? ""))}
                    placeholder="https://..."
                    type="url"
                    clearInput
                  />
                </IonItem>
              </IonCardContent>
            </IonCard>

            <IonCard style={driverFormCardStyle()}>
              <IonCardContent>
                <div style={{ fontWeight: 950, fontSize: "1rem", marginBottom: 4 }}>Vehículo</div>
                <div style={{ color: "#333", fontSize: ".78rem", fontWeight: 800, marginBottom: 10 }}>
                  Estos datos ayudan al pasajero a reconocerte.
                </div>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>Marca</IonLabel>
                  <IonInput style={driverFieldTextStyle()} value={vehicleBrand} onIonInput={(event) => setVehicleBrand(String(event.detail.value ?? ""))} placeholder="Toyota" clearInput />
                </IonItem>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>Modelo</IonLabel>
                  <IonInput style={driverFieldTextStyle()} value={vehicleModel} onIonInput={(event) => setVehicleModel(String(event.detail.value ?? ""))} placeholder="Yaris" clearInput />
                </IonItem>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>Año</IonLabel>
                  <IonInput style={driverFieldTextStyle()} value={vehicleYear} onIonInput={(event) => setVehicleYear(String(event.detail.value ?? ""))} placeholder="2020" inputmode="numeric" clearInput />
                </IonItem>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>Patente</IonLabel>
                  <IonInput style={driverFieldTextStyle()} value={vehiclePlate} onIonInput={(event) => setVehiclePlate(String(event.detail.value ?? "").toUpperCase())} placeholder="ABCD12" clearInput />
                </IonItem>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>Color</IonLabel>
                  <IonInput style={driverFieldTextStyle()} value={vehicleColor} onIonInput={(event) => setVehicleColor(String(event.detail.value ?? ""))} placeholder="Blanco" clearInput />
                </IonItem>
              </IonCardContent>
            </IonCard>

            <IonCard style={driverFormCardStyle()}>
              <IonCardContent>
                <div style={{ fontWeight: 950, fontSize: "1rem", marginBottom: 4 }}>Licencia de conducir</div>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>Número de licencia</IonLabel>
                  <IonInput style={driverFieldTextStyle()} value={licenseNumber} onIonInput={(event) => setLicenseNumber(String(event.detail.value ?? ""))} placeholder="12345678-9" clearInput />
                </IonItem>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>Fecha de vencimiento</IonLabel>
                  <IonInput style={driverFieldTextStyle()} value={licenseExpiry} onIonInput={(event) => setLicenseExpiry(String(event.detail.value ?? ""))} type="date" />
                </IonItem>

                {licenseWarning && (
                  <IonText color={isLicenseExpired(licenseExpiry) ? "danger" : "warning"}>
                    <p style={{ fontSize: ".8rem", fontWeight: 800, margin: "8px 0 0" }}>
                      {licenseWarning}
                    </p>
                  </IonText>
                )}
              </IonCardContent>
            </IonCard>

            <IonCard style={driverFormCardStyle()}>
              <IonCardContent>
                <div style={{ fontWeight: 950, fontSize: "1rem", marginBottom: 10 }}>Biografía</div>
                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>Sobre ti</IonLabel>
                  <IonTextarea
                    style={driverFieldTextStyle()}
                    value={bio}
                    onIonInput={(event) => setBio(String(event.detail.value ?? ""))}
                    placeholder="Cuéntale al pasajero sobre tu experiencia..."
                    autoGrow
                    rows={4}
                  />
                </IonItem>
              </IonCardContent>
            </IonCard>

            <IonCard style={driverFormCardStyle()}>
              <IonCardContent>
                <div style={{ fontWeight: 950, fontSize: "1rem", marginBottom: 10 }}>Idiomas</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {LANGUAGE_OPTIONS.map((option) => {
                    const selected = languages.includes(option.value);
                    return (
                      <IonChip
                        key={option.value}
                        color={selected ? "success" : "medium"}
                        outline={!selected}
                        onClick={() => toggleLanguage(option.value)}
                        style={{ fontWeight: 850 }}
                      >
                        {option.label}
                      </IonChip>
                    );
                  })}
                </div>
              </IonCardContent>
            </IonCard>

            {session?.accessToken && (
              <LegalStatusSection token={session.accessToken} />
            )}

            <IonButton
              expand="block"
              color="success"
              onClick={() => void handleSave()}
              disabled={saving}
              style={{ "--border-radius": "16px", height: "52px", fontWeight: 950 } as CSSProperties}
            >
              {saving ? <IonSpinner name="dots" /> : "Guardar cambios"}
            </IonButton>

            <IonButton
              expand="block"
              fill="outline"
              color="danger"
              onClick={() => void handleLogout()}
              disabled={saving}
              style={{ "--border-radius": "16px", height: "52px", marginTop: 12, fontWeight: 950 } as CSSProperties}
            >
              Cerrar sesión
            </IonButton>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
