import {
  IonCard,
  IonCardContent,
  IonIcon,
  IonNote,
} from "@ionic/react";
import { carOutline } from "ionicons/icons";
import { useEffect, useRef, useState } from "react";
import { getDistanceBetween, getEstimatedFare } from "@rapa-go/shared";

export interface MapPoint {
  id?: string;
  text: string;
  lat?: number | null;
  lng?: number | null;
  placeId?: string | null;
}

export interface MapPointMovedPayload {
  point: "origin" | "destination";
  lat: number;
  lng: number;
  text: string;
  address?: string;
}

interface MapFallbackProps {
  origin: MapPoint;
  destination: MapPoint;
  height?: number;
  showRoute?: boolean;

  /*
    Permite mover el punto azul de origen.
    El padre puede usar onOriginChange para actualizar su estado.
  */
  originDraggable?: boolean;
  onOriginChange?: (point: MapPointMovedPayload) => void;
}

type LatLng = {
  lat: number;
  lng: number;
};

type RouteInfo = {
  distanceText: string;
  durationText: string;
};

declare global {
  interface Window {
    google?: typeof google;
    initRapaGoGoogleMap?: () => void;
  }

  interface WindowEventMap {
    "rapago:origin-point-moved": CustomEvent<MapPointMovedPayload>;
  }
}

const RAPA_NUI_CENTER: LatLng = {
  lat: -27.1505,
  lng: -109.4325,
};

const GOOGLE_MAPS_SCRIPT_ID = "rapa-go-google-maps-script";
const GOOGLE_MAPS_CALLBACK_NAME = "initRapaGoGoogleMap";

function getGoogleMapsApiKey(): string {
  const envKey = String(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "",
  ).trim();

  if (
    !envKey ||
    envKey === "REDACTED_GOOGLE_MAPS_API_KEY" ||
    envKey.startsWith("<")
  ) {
    return "";
  }

  return envKey;
}

function isGoogleMapsReady(): boolean {
  return Boolean(
    window.google?.maps?.Map &&
      window.google?.maps?.DirectionsService &&
      window.google?.maps?.DirectionsRenderer &&
      window.google?.maps?.Geocoder,
  );
}

function waitForGoogleMapsReady(): Promise<void> {
  if (isGoogleMapsReady()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const check = () => {
      if (isGoogleMapsReady()) {
        resolve();
        return;
      }

      if (Date.now() - startedAt > 15000) {
        reject(new Error("Google Maps cargó incompleto. Recarga la página."));
        return;
      }

      window.setTimeout(check, 50);
    };

    check();
  });
}

export function loadRapaGoGoogleMaps(): Promise<void> {
  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    return Promise.reject(
      new Error("Falta VITE_GOOGLE_MAPS_API_KEY en apps/mobile/.env"),
    );
  }

  if (isGoogleMapsReady()) return Promise.resolve();

  const oldScripts = Array.from(
    document.querySelectorAll<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]',
    ),
  );

  const scriptUrl =
    `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
    `&v=weekly&language=es&region=CL&loading=async` +
    `&libraries=places,geometry&callback=${GOOGLE_MAPS_CALLBACK_NAME}`;

  for (const script of oldScripts) {
    const hasCurrentKey = script.src.includes(encodeURIComponent(apiKey));

    if (!hasCurrentKey) {
      script.remove();
    }
  }

  const existingScript = document.getElementById(
    GOOGLE_MAPS_SCRIPT_ID,
  ) as HTMLScriptElement | null;

  if (existingScript) {
    return waitForGoogleMapsReady();
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    window.initRapaGoGoogleMap = () => {
      void waitForGoogleMapsReady()
        .then(() => {
          if (settled) return;
          settled = true;
          resolve();
        })
        .catch((err) => {
          if (settled) return;
          settled = true;
          reject(err);
        });
    };

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = scriptUrl;

    script.onerror = () => {
      if (settled) return;
      settled = true;
      reject(new Error("No se pudo cargar Google Maps."));
    };

    document.head.appendChild(script);

    void waitForGoogleMapsReady()
      .then(() => {
        if (settled) return;
        settled = true;
        resolve();
      })
      .catch(() => {
        // El callback resolverá cuando Google termine de cargar.
      });
  });
}

function getPointFromMapPoint(point: MapPoint): LatLng | null {
  if (
    point.lat == null ||
    point.lng == null ||
    !Number.isFinite(point.lat) ||
    !Number.isFinite(point.lng)
  ) {
    return null;
  }

  return {
    lat: Number(point.lat),
    lng: Number(point.lng),
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
        background: "#e8eef4",
        color: "#172033",
        padding: "18px",
      }}
    >
      <strong>Mapa no disponible</strong>

      <p style={{ fontSize: ".78rem", color: "#6b4700" }}>
        Selecciona origen y destino para calcular la ruta.
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

function makeCircleIcon(
  color: string,
  scale = 12,
  strokeColor = "#ffffff",
): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor: color,
    fillOpacity: 1,
    strokeColor,
    strokeWeight: 3,
  };
}

function makeUserCircle(center: LatLng): google.maps.CircleOptions {
  return {
    center,
    radius: 25,
    fillColor: "#12697e",
    fillOpacity: 0.18,
    strokeColor: "#12697e",
    strokeOpacity: 0.28,
    strokeWeight: 1,
    clickable: false,
  };
}

async function reverseGeocodeLatLng(point: LatLng): Promise<string | undefined> {
  if (!window.google?.maps?.Geocoder) return undefined;

  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();

    geocoder.geocode(
      {
        location: point,
        region: "CL",
      },
      (results, status) => {
        if (status !== google.maps.GeocoderStatus.OK || !results?.[0]) {
          resolve(undefined);
          return;
        }

        resolve(results[0].formatted_address);
      },
    );
  });
}

function GoogleRapaMap({
  origin,
  destination,
  height,
  originDraggable = true,
  onOriginChange,
}: {
  origin: MapPoint;
  destination: MapPoint;
  height: number;
  originDraggable?: boolean;
  onOriginChange?: (point: MapPointMovedPayload) => void;
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(
    null,
  );
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const originCircleRef = useRef<google.maps.Circle | null>(null);
  const fallbackLineRef = useRef<google.maps.Polyline | null>(null);
  const lastRouteKeyRef = useRef<string>("");

  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [movingOrigin, setMovingOrigin] = useState(false);
  const [localOrigin, setLocalOrigin] = useState<MapPoint>(origin);

  useEffect(() => {
    setLocalOrigin(origin);
  }, [
    origin.id,
    origin.text,
    origin.lat,
    origin.lng,
    origin.placeId,
  ]);

  useEffect(() => {
    let cancelled = false;

    void loadRapaGoGoogleMaps()
      .then(() => {
        if (cancelled || !mapElementRef.current || !window.google?.maps) return;

        const map = new google.maps.Map(mapElementRef.current, {
          center: RAPA_NUI_CENTER,
          zoom: 14,
          mapTypeControl: false,
          fullscreenControl: true,
          streetViewControl: false,
          clickableIcons: true,
          gestureHandling: "greedy",
          /* Paleta de la isla, no la de fábrica de Google.
             El mapa es la superficie más grande de la app y estaba en gris
             genérico con agua celeste: la marca desaparecía justo en la
             pantalla donde el usuario pasa más tiempo.
             En Rapa Nui el mar ocupa el borde de casi cualquier encuadre, así
             que pintarlo en el teal del eje océano y la tierra en arena de
             Anakena hace que el mapa se vea como esta isla y como ninguna otra,
             sin necesidad de ilustración. */
          styles: [
            { elementType: "geometry", stylers: [{ color: "#f2e6d3" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#4a3b2a" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#f7efe2" }, { weight: 3 }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#12697e" }] },
            { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#dcd0b8" }] },
            /* La isla entera es parque nacional: el verde no es un detalle. */
            { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#b9c48a" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#fffdf9" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e0cfae" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6b5a3e" }] },
            { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#c89b3c" }] },
            { featureType: "poi.business", stylers: [{ visibility: "on" }] },
          ],
        });

        const renderer = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          preserveViewport: false,
          polylineOptions: {
            /* Eje océano: en el sistema de color, lo que se mueve solo (la
               ruta, el conductor acercándose) va en teal; el oro se reserva
               para lo que el usuario controla. Antes era el azul de Tailwind. */
            strokeColor: "#12697e",
            strokeOpacity: 1,
            strokeWeight: 7,
          },
        });

        mapRef.current = map;
        directionsRendererRef.current = renderer;
      })
      .catch((err) => {
        setMapError(
          err instanceof Error ? err.message : "No se pudo cargar Google Maps.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function clearMapObjects(renderer: google.maps.DirectionsRenderer) {
    originMarkerRef.current?.setMap(null);
    destinationMarkerRef.current?.setMap(null);
    originCircleRef.current?.setMap(null);
    fallbackLineRef.current?.setMap(null);

    originMarkerRef.current = null;
    destinationMarkerRef.current = null;
    originCircleRef.current = null;
    fallbackLineRef.current = null;

    renderer.set("directions", null);
  }

  async function notifyOriginMoved(point: LatLng) {
    const address = await reverseGeocodeLatLng(point);
    const text = address || "Punto elegido en el mapa";

    const payload: MapPointMovedPayload = {
      point: "origin",
      lat: point.lat,
      lng: point.lng,
      text,
      address,
    };

    onOriginChange?.(payload);

    window.dispatchEvent(
      new CustomEvent("rapago:origin-point-moved", {
        detail: payload,
      }),
    );
  }

  useEffect(() => {
    const map = mapRef.current;
    const renderer = directionsRendererRef.current;

    if (!map || !renderer || !window.google?.maps) return;

    const originPoint = getPointFromMapPoint(localOrigin);
    const destinationPoint = getPointFromMapPoint(destination);

    const routeKey = JSON.stringify({
      originText: localOrigin.text,
      originLat: originPoint?.lat ?? null,
      originLng: originPoint?.lng ?? null,
      destinationText: destination.text,
      destinationLat: destinationPoint?.lat ?? null,
      destinationLng: destinationPoint?.lng ?? null,
      originDraggable,
    });

    if (lastRouteKeyRef.current === routeKey) {
      return;
    }

    lastRouteKeyRef.current = routeKey;

    setMapError(null);
    setRouteInfo(null);

    clearMapObjects(renderer);

    if (!originPoint && !destinationPoint) {
      map.setCenter(RAPA_NUI_CENTER);
      map.setZoom(14);
      return;
    }

    const bounds = new google.maps.LatLngBounds();

    if (originPoint) {
      originMarkerRef.current = new google.maps.Marker({
        map,
        position: originPoint,
        title: originDraggable
          ? "Mantén presionado y mueve tu punto de partida"
          : localOrigin.text || "Origen",
        draggable: originDraggable,
        cursor: originDraggable ? "grab" : undefined,
        label: {
          text: "●",
          color: "#ffffff",
          fontSize: "16px",
          fontWeight: "900",
        },
        /* Origen en laguna: "confirmado, ya estás aquí". */
        icon: makeCircleIcon("#2e7d5b", 13),
        zIndex: 30,
      });

      originCircleRef.current = new google.maps.Circle({
        map,
        ...makeUserCircle(originPoint),
      });

      if (originDraggable) {
        originMarkerRef.current.addListener("dragstart", () => {
          setMovingOrigin(true);
          map.setOptions({ draggableCursor: "grabbing" });
        });

        originMarkerRef.current.addListener("drag", () => {
          const position = originMarkerRef.current?.getPosition();
          if (!position || !originCircleRef.current) return;

          originCircleRef.current.setCenter({
            lat: position.lat(),
            lng: position.lng(),
          });
        });

        originMarkerRef.current.addListener("dragend", () => {
          const position = originMarkerRef.current?.getPosition();
          setMovingOrigin(false);
          map.setOptions({ draggableCursor: undefined });

          if (!position) return;

          const movedPoint = {
            lat: position.lat(),
            lng: position.lng(),
          };

          setLocalOrigin((current) => ({
            ...current,
            text: "Punto elegido en el mapa",
            lat: movedPoint.lat,
            lng: movedPoint.lng,
            placeId: null,
          }));

          void notifyOriginMoved(movedPoint);
        });
      }

      bounds.extend(originPoint);
    }

    if (destinationPoint) {
      destinationMarkerRef.current = new google.maps.Marker({
        map,
        position: destinationPoint,
        title: destination.text || "Destino",
        label: {
          text: "●",
          color: "#ffffff",
          fontSize: "16px",
          fontWeight: "900",
        },
        /* Destino en oro de marca: es el objetivo del usuario, no un error.
           El rojo Material de antes leía como alerta. */
        icon: makeCircleIcon("#c89b3c", 12),
        zIndex: 19,
      });

      bounds.extend(destinationPoint);
    }

    if (!originPoint || !destinationPoint) {
      const single = originPoint ?? destinationPoint;

      if (single) {
        map.setCenter(single);
        map.setZoom(16);
      }

      return;
    }

    const service = new google.maps.DirectionsService();

    service.route(
      {
        origin: originPoint,
        destination: destinationPoint,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
        region: "CL",
      },
      (result, status) => {
        if (status !== google.maps.DirectionsStatus.OK || !result) {
          renderer.set("directions", null);

          fallbackLineRef.current = new google.maps.Polyline({
            map,
            path: [originPoint, destinationPoint],
            strokeColor: "#12697e",
            strokeOpacity: 0.95,
            strokeWeight: 6,
            icons: [
              {
                icon: {
                  path: "M 0,-1 0,1",
                  strokeOpacity: 1,
                  scale: 4,
                },
                offset: "0",
                repeat: "18px",
              },
            ],
          });

          const fallbackBounds = new google.maps.LatLngBounds();
          fallbackBounds.extend(originPoint);
          fallbackBounds.extend(destinationPoint);
          map.fitBounds(fallbackBounds, 72);

          setRouteInfo({
            durationText: "Ruta referencial",
            distanceText: "Origen → destino",
          });

          setMapError(null);
          return;
        }

        renderer.setDirections(result);

        const leg = result.routes[0]?.legs[0];

        if (leg) {
          const routeBounds = new google.maps.LatLngBounds();
          routeBounds.extend(leg.start_location);
          routeBounds.extend(leg.end_location);

          for (const step of leg.steps) {
            if (step.start_location) routeBounds.extend(step.start_location);
            if (step.end_location) routeBounds.extend(step.end_location);
          }

          map.fitBounds(routeBounds, 72);
        } else if (!bounds.isEmpty()) {
          map.fitBounds(bounds, 72);
        }

        setRouteInfo({
          distanceText: leg?.distance?.text ?? "",
          durationText: leg?.duration?.text ?? "",
        });
      },
    );
  }, [
    localOrigin.text,
    localOrigin.lat,
    localOrigin.lng,
    localOrigin.placeId,
    destination.text,
    destination.lat,
    destination.lng,
    destination.placeId,
    originDraggable,
    onOriginChange,
  ]);

  return (
    <div
      style={{
        background: "#e8eef4",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div style={{ height, position: "relative" }}>
        <div
          ref={mapElementRef}
          style={{
            height: "100%",
            width: "100%",
            background: "#e8eef4",
          }}
        />

        {originDraggable && (
          <div
            style={{
              position: "absolute",
              left: "12px",
              right: "12px",
              top: "12px",
              background: movingOrigin
                ? "rgba(37,99,235,.96)"
                : "rgba(17,17,17,.90)",
              color: "#F6F2EC",
              borderRadius: "999px",
              padding: "8px 12px",
              fontSize: ".76rem",
              fontWeight: 900,
              border: "1px solid rgba(255,255,255,.22)",
              zIndex: 6,
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            {movingOrigin
              ? "Suelta el punto azul donde quieres partir"
              : "Mantén presionado el punto azul y muévelo"}
          </div>
        )}

        {mapError && (
          <div
            style={{
              position: "absolute",
              left: "16px",
              right: "16px",
              top: originDraggable ? "58px" : "16px",
              background: "rgba(17,17,17,.94)",
              color: "#F6F2EC",
              borderRadius: "14px",
              padding: "10px 12px",
              fontSize: ".76rem",
              border: "1px solid rgba(200,155,60,.35)",
              zIndex: 5,
            }}
          >
            {mapError}
          </div>
        )}

        {routeInfo && (
          <div
            style={{
              position: "absolute",
              left: "12px",
              right: "12px",
              bottom: "12px",
              background: "rgba(17,17,17,.92)",
              color: "#F6F2EC",
              borderRadius: "16px",
              padding: "10px 12px",
              boxShadow: "0 12px 28px rgba(0,0,0,.30)",
              zIndex: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                fontWeight: 900,
                fontSize: ".82rem",
              }}
            >
              <IonIcon icon={carOutline} style={{ color: "#C89B3C" }} />
              Ruta del viaje
            </div>

            <div
              style={{
                marginTop: "4px",
                color: "#D9C3A0",
                fontSize: ".76rem",
              }}
            >
              {routeInfo.durationText}
              {routeInfo.durationText && routeInfo.distanceText ? " · " : ""}
              {routeInfo.distanceText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function MapFallback({
  origin,
  destination,
  height = 300,
  showRoute = true,
  originDraggable = true,
  onOriginChange,
}: MapFallbackProps): JSX.Element {
  if (!showRoute) {
    return (
      <OfflineFallback
        origin={origin}
        destination={destination}
        height={height}
      />
    );
  }

  return (
    <GoogleRapaMap
      origin={origin}
      destination={destination}
      height={height}
      originDraggable={originDraggable}
      onOriginChange={onOriginChange}
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
