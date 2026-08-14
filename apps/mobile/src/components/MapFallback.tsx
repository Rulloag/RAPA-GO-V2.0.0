import { IonCard, IonCardContent, IonIcon, IonNote } from "@ionic/react";
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

/* Un lugar seleccionable que se pinta como marcador tocable en el mapa. Es la
   misma fuente de datos que alimenta los buscadores de origen y destino. */
export interface MapPlaceMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/* Un icono nativo de Google (restaurante, hotel, atracción…) que el usuario
   tocó sobre el mapa. Google solo entrega el place_id y la coordenada: el
   nombre y la dirección los resuelve el padre con Places Details. */
export interface MapGooglePoi {
  placeId: string;
  lat: number;
  lng: number;
}

interface MapFallbackProps {
  origin: MapPoint;
  destination: MapPoint;
  height?: number;
  showRoute?: boolean;

  /*
    Permite mover el punto VERDE de origen.
    El padre puede usar onOriginChange para actualizar su estado.
  */
  originDraggable?: boolean;
  onOriginChange?: (point: MapPointMovedPayload) => void;

  /*
    Igual que el origen, pero para el punto DORADO de destino. No todo viaje
    termina en un lugar con nombre en el mapa —una casa, una obra, un punto de
    la costa—, así que el destino tiene que poder soltarse en cualquier parte,
    no solo elegirse de una lista.
  */
  destinationDraggable?: boolean;
  onDestinationChange?: (point: MapPointMovedPayload) => void;

  /* Permite al padre vetar un punto soltado en el mapa —fuera de la zona de
     servicio, por ejemplo—. Devuelve el motivo a mostrar, o null si el punto
     vale. Al vetarlo, el marcador vuelve solo a donde estaba: si no, el mapa
     enseñaría un origen o un destino que la app no llegó a aceptar. */
  rejectDroppedPoint?: (
    point: { lat: number; lng: number },
    kind: "origin" | "destination",
  ) => string | null;

  /* Lugares tocables del mapa (POIs de Rapa Nui). Al tocar uno, el padre
     decide si se vuelve origen o destino. */
  places?: MapPlaceMarker[];
  onSelectPlace?: (place: MapPlaceMarker) => void;

  /* Toque sobre un icono propio de Google. Al pasar este callback se cancela
     el globo nativo —el que ofrece "Ver en Google Maps" y saca al pasajero de
     la app— y el lugar se entrega al padre para usarlo como origen o destino.
     Sin callback se conserva el comportamiento por defecto de Google. */
  onSelectGooglePoi?: (poi: MapGooglePoi) => void;
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
    "rapago:origin-point-visibility": CustomEvent<{
      lat: number;
      lng: number;
      screenY: number;
    }>;
  }
}

const RAPA_NUI_CENTER: LatLng = {
  lat: -27.1505,
  lng: -109.4325,
};

const GOOGLE_MAPS_SCRIPT_ID = "rapa-go-google-maps-script";
const GOOGLE_MAPS_CALLBACK_NAME = "initRapaGoGoogleMap";

function getGoogleMapsApiKey(): string {
  const envKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();

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
      }}>
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

/* Mismo color que el punto ya elegido, pero translúcido y sin el punto blanco
   del centro: se lee como "arrástrame hasta tu sitio" y no como "esto ya está
   decidido". */
function makePendingCircleIcon(
  color: string,
  scale: number,
): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor: color,
    fillOpacity: 0.5,
    strokeColor: "#ffffff",
    strokeWeight: 3,
  };
}

/* Dónde dejar un punto que todavía no se ha fijado: los dos por ENCIMA del
   centro y separados en horizontal —origen a la izquierda, destino a la
   derecha—. Arriba porque en la pantalla de solicitud la hoja inferior tapa la
   mitad de abajo del mapa: un punto colocado ahí nacería escondido. */
function getPendingSpot(
  map: google.maps.Map,
  kind: "origin" | "destination",
): LatLng | null {
  const center = map.getCenter();
  if (!center) return null;

  const bounds = map.getBounds();
  const latSpan = bounds
    ? Math.abs(bounds.getNorthEast().lat() - bounds.getSouthWest().lat())
    : 0.02;
  const lngSpan = bounds
    ? Math.abs(bounds.getNorthEast().lng() - bounds.getSouthWest().lng())
    : 0.02;
  const sideways = kind === "origin" ? -1 : 1;

  return {
    lat: center.lat() + latSpan * 0.18,
    lng: center.lng() + sideways * lngSpan * 0.14,
  };
}

/* Instrucción de la píldora superior. Nombra el punto por su color porque es
   lo único que el pasajero ve en el mapa: verde = de dónde sale, oro = a dónde
   llega. Antes decía "punto azul" y ningún punto era azul. */
function getDragHint({
  movingPoint,
  originDraggable,
  destinationDraggable,
}: {
  movingPoint: "origin" | "destination" | null;
  originDraggable: boolean;
  destinationDraggable: boolean;
}): string {
  if (movingPoint === "origin") {
    return "Suelta el punto verde donde quieres partir";
  }

  if (movingPoint === "destination") {
    return "Suelta el punto dorado en tu destino";
  }

  if (originDraggable && destinationDraggable) {
    return "Mueve el punto verde (origen) y el dorado (destino)";
  }

  return originDraggable
    ? "Mantén presionado el punto verde y muévelo"
    : "Mantén presionado el punto dorado y muévelo";
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

async function reverseGeocodeLatLng(
  point: LatLng,
): Promise<string | undefined> {
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
  destinationDraggable = false,
  onDestinationChange,
  rejectDroppedPoint,
  places,
  onSelectPlace,
  onSelectGooglePoi,
}: {
  origin: MapPoint;
  destination: MapPoint;
  height: number;
  originDraggable?: boolean;
  onOriginChange?: (point: MapPointMovedPayload) => void;
  destinationDraggable?: boolean;
  onDestinationChange?: (point: MapPointMovedPayload) => void;
  rejectDroppedPoint?: (
    point: LatLng,
    kind: "origin" | "destination",
  ) => string | null;
  places?: MapPlaceMarker[];
  onSelectPlace?: (place: MapPlaceMarker) => void;
  onSelectGooglePoi?: (poi: MapGooglePoi) => void;
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
  const placeMarkersRef = useRef<google.maps.Marker[]>([]);
  const lastRouteKeyRef = useRef<string>("");
  /* Puntos "sin elegir todavía": el verde y el dorado que se ofrecen sobre el
     mapa antes de que el pasajero haya fijado origen o destino. */
  const pendingOriginMarkerRef = useRef<google.maps.Marker | null>(null);
  const pendingDestinationMarkerRef = useRef<google.maps.Marker | null>(null);
  /* Los puntos pendientes ya se colocaron con el encuadre real del mapa. */
  const pendingSettledRef = useRef(false);

  /* El listener del mapa se registra una sola vez, así que lee el callback
     desde un ref para no quedarse con la versión de la primera renderización. */
  const googlePoiHandlerRef = useRef<((poi: MapGooglePoi) => void) | undefined>(
    onSelectGooglePoi,
  );
  googlePoiHandlerRef.current = onSelectGooglePoi;

  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  /* Qué punto se está arrastrando ahora mismo, para que el aviso de arriba
     hable del punto correcto en vez de dar una instrucción genérica. */
  const [movingPoint, setMovingPoint] = useState<
    "origin" | "destination" | null
  >(null);
  const [mapReady, setMapReady] = useState(false);
  const [localOrigin, setLocalOrigin] = useState<MapPoint>(origin);

  useEffect(() => {
    setLocalOrigin(origin);
  }, [origin.id, origin.text, origin.lat, origin.lng, origin.placeId]);

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
            {
              elementType: "labels.text.fill",
              stylers: [{ color: "#4a3b2a" }],
            },
            {
              elementType: "labels.text.stroke",
              stylers: [{ color: "#f7efe2" }, { weight: 3 }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#12697e" }],
            },
            {
              featureType: "landscape.natural",
              elementType: "geometry",
              stylers: [{ color: "#dcd0b8" }],
            },
            /* La isla entera es parque nacional: el verde no es un detalle. */
            {
              featureType: "poi.park",
              elementType: "geometry",
              stylers: [{ color: "#b9c48a" }],
            },
            {
              featureType: "road",
              elementType: "geometry",
              stylers: [{ color: "#fffdf9" }],
            },
            {
              featureType: "road",
              elementType: "geometry.stroke",
              stylers: [{ color: "#e0cfae" }],
            },
            {
              featureType: "road",
              elementType: "labels.text.fill",
              stylers: [{ color: "#6b5a3e" }],
            },
            {
              featureType: "administrative",
              elementType: "geometry.stroke",
              stylers: [{ color: "#c89b3c" }],
            },
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

        /* Icono propio de Google tocado. `event.placeId` solo viene cuando el
           toque cayó sobre un POI de Google; `event.stop()` cancela el globo
           nativo que ofrece abrir Google Maps, que es justo lo que sacaba al
           pasajero de la app. Sin `onSelectGooglePoi` no se intercepta nada. */
        map.addListener("click", (event: google.maps.MapMouseEvent) => {
          const placeId = (event as google.maps.IconMouseEvent).placeId;
          const position = event.latLng;

          if (!placeId || !googlePoiHandlerRef.current) return;

          event.stop();

          if (!position) return;

          googlePoiHandlerRef.current({
            placeId,
            lat: position.lat(),
            lng: position.lng(),
          });
        });

        mapRef.current = map;
        directionsRendererRef.current = renderer;
        setMapReady(true);
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

  function getMapScreenPosition(
    map: google.maps.Map,
    point: LatLng,
  ): { x: number; y: number } | null {
    const projection = map.getProjection();
    const center = map.getCenter();
    const mapElement = map.getDiv();

    if (!projection || !center || !mapElement) return null;

    const centerPoint = projection.fromLatLngToPoint(center);
    const markerPoint = projection.fromLatLngToPoint(
      new google.maps.LatLng(point.lat, point.lng),
    );
    const zoomScale = Math.pow(2, map.getZoom() ?? 0);

    return {
      x:
        (markerPoint.x - centerPoint.x) * zoomScale +
        mapElement.clientWidth / 2,
      y:
        (markerPoint.y - centerPoint.y) * zoomScale +
        mapElement.clientHeight / 2,
    };
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

    const map = mapRef.current;
    const markerScreen = map ? getMapScreenPosition(map, point) : null;

    if (markerScreen) {
      window.dispatchEvent(
        new CustomEvent("rapago:origin-point-visibility", {
          detail: {
            lat: point.lat,
            lng: point.lng,
            screenY: markerScreen.y,
          },
        }),
      );
    }
  }

  /* El destino no emite evento de ventana: solo lo escucha el padre que pasó
     el callback. El del origen existe porque hay pantallas que lo escuchan
     sin ser el padre directo del mapa. */
  /* Los marcadores se crean una vez y sobreviven a las re-renderizaciones, así
     que sus listeners leen la versión actual del aviso desde estos refs en vez
     de quedarse con la del render en que nacieron. */
  const notifyOriginMovedRef = useRef(notifyOriginMoved);
  notifyOriginMovedRef.current = notifyOriginMoved;

  async function notifyDestinationMoved(point: LatLng) {
    const address = await reverseGeocodeLatLng(point);

    onDestinationChange?.({
      point: "destination",
      lat: point.lat,
      lng: point.lng,
      text: address || "Punto elegido en el mapa",
      address,
    });
  }

  const notifyDestinationMovedRef = useRef(notifyDestinationMoved);
  notifyDestinationMovedRef.current = notifyDestinationMoved;

  /* Solo la PRESENCIA del callback entra en las dependencias: los padres pasan
     funciones nuevas en cada render y los marcadores ya leen la versión actual
     desde los refs de arriba, así que la identidad no debe rehacer nada. */
  const canReportOrigin = Boolean(onOriginChange);
  const canReportDestination = Boolean(onDestinationChange);

  const rejectDroppedPointRef = useRef(rejectDroppedPoint);
  rejectDroppedPointRef.current = rejectDroppedPoint;
  /* Dónde estaba el marcador al empezar a arrastrarlo, para devolverlo ahí si
     el padre rechaza el punto. Solo se arrastra uno a la vez. */
  const dragStartPositionRef = useRef<google.maps.LatLng | null>(null);

  /* true si el punto se puede usar. Si no, el marcador vuelve a su sitio y el
     motivo se muestra en el aviso del mapa. */
  function acceptDroppedPoint(
    marker: google.maps.Marker,
    point: LatLng,
    kind: "origin" | "destination",
  ): boolean {
    const reason = rejectDroppedPointRef.current?.(point, kind) ?? null;

    if (!reason) {
      setMapError(null);
      return true;
    }

    const previous = dragStartPositionRef.current;
    if (previous) marker.setPosition(previous);

    setMapError(reason);
    return false;
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
      destinationDraggable,
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
          dragStartPositionRef.current =
            originMarkerRef.current?.getPosition() ?? null;
          setMovingPoint("origin");
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
          setMovingPoint(null);
          map.setOptions({ draggableCursor: undefined });

          if (!position) return;

          const movedPoint = {
            lat: position.lat(),
            lng: position.lng(),
          };

          const marker = originMarkerRef.current;

          if (marker && !acceptDroppedPoint(marker, movedPoint, "origin")) {
            /* El círculo siguió al marcador durante el arrastre: vuelve con él. */
            const previous = dragStartPositionRef.current;
            if (previous) originCircleRef.current?.setCenter(previous);
            return;
          }

          setLocalOrigin((current) => ({
            ...current,
            text: "Punto elegido en el mapa",
            lat: movedPoint.lat,
            lng: movedPoint.lng,
            placeId: null,
          }));

          void notifyOriginMovedRef.current(movedPoint);
        });
      }

      bounds.extend(originPoint);
    }

    if (destinationPoint) {
      destinationMarkerRef.current = new google.maps.Marker({
        map,
        position: destinationPoint,
        title: destinationDraggable
          ? "Mantén presionado y mueve tu destino"
          : destination.text || "Destino",
        draggable: destinationDraggable,
        cursor: destinationDraggable ? "grab" : undefined,
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

      if (destinationDraggable) {
        destinationMarkerRef.current.addListener("dragstart", () => {
          dragStartPositionRef.current =
            destinationMarkerRef.current?.getPosition() ?? null;
          setMovingPoint("destination");
          map.setOptions({ draggableCursor: "grabbing" });
        });

        destinationMarkerRef.current.addListener("dragend", () => {
          const marker = destinationMarkerRef.current;
          const position = marker?.getPosition();
          setMovingPoint(null);
          map.setOptions({ draggableCursor: undefined });

          if (!marker || !position) return;

          const movedPoint = {
            lat: position.lat(),
            lng: position.lng(),
          };

          if (!acceptDroppedPoint(marker, movedPoint, "destination")) return;

          void notifyDestinationMovedRef.current(movedPoint);
        });
      }

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
    destinationDraggable,
    onDestinationChange,
  ]);

  /* Puntos SIEMPRE disponibles. Antes el verde solo existía después de haber
     elegido un origen, así que quien no salía ni llegaba a un lugar con nombre
     en el mapa —una casa, un portón, un tramo de costa— no tenía forma de
     marcarlo: primero había que buscar algo parecido y recién ahí aparecía el
     punto para corregirlo. Ahora el verde (origen) y el dorado (destino) están
     sobre el mapa desde el principio y basta arrastrarlos hasta el sitio real.
     Se ofrecen solo si el padre puede recibirlos, así que las pantallas que
     únicamente muestran un viaje ya hecho siguen sin puntos sueltos. */
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !window.google?.maps) return;

    const needsOrigin =
      originDraggable &&
      canReportOrigin &&
      !getPointFromMapPoint(localOrigin);
    const needsDestination =
      destinationDraggable &&
      canReportDestination &&
      !getPointFromMapPoint(destination);

    if (!needsOrigin && pendingOriginMarkerRef.current) {
      pendingOriginMarkerRef.current.setMap(null);
      pendingOriginMarkerRef.current = null;
    }

    if (!needsDestination && pendingDestinationMarkerRef.current) {
      pendingDestinationMarkerRef.current.setMap(null);
      pendingDestinationMarkerRef.current = null;
    }

    if (!needsOrigin && !needsDestination) return;

    const createPendingMarker = (
      kind: "origin" | "destination",
    ): google.maps.Marker | null => {
      const spot = getPendingSpot(map, kind);
      if (!spot) return null;

      const isOrigin = kind === "origin";
      const marker = new google.maps.Marker({
        map,
        position: spot,
        draggable: true,
        cursor: "grab",
        title: isOrigin
          ? "Arrastra este punto verde hasta dónde te recogemos"
          : "Arrastra este punto dorado hasta dónde quieres llegar",
        icon: isOrigin
          ? makePendingCircleIcon("#2e7d5b", 13)
          : makePendingCircleIcon("#c89b3c", 12),
        zIndex: isOrigin ? 29 : 18,
      });

      marker.addListener("dragstart", () => {
        dragStartPositionRef.current = marker.getPosition() ?? null;
        setMovingPoint(kind);
        map.setOptions({ draggableCursor: "grabbing" });
      });

      marker.addListener("dragend", () => {
        const position = marker.getPosition();
        setMovingPoint(null);
        map.setOptions({ draggableCursor: undefined });

        if (!position) return;

        const moved = {
          lat: position.lat(),
          lng: position.lng(),
        };

        if (!acceptDroppedPoint(marker, moved, kind)) return;

        /* Aceptado: el punto pasa a ser real de inmediato para que el mapa no
           parpadee mientras se resuelve la dirección. Al confirmarse, este
           efecto retira el marcador pendiente y el definitivo toma su sitio. */
        if (isOrigin) {
          setLocalOrigin((current) => ({
            ...current,
            text: "Punto elegido en el mapa",
            lat: moved.lat,
            lng: moved.lng,
            placeId: null,
          }));

          void notifyOriginMovedRef.current(moved);
          return;
        }

        void notifyDestinationMovedRef.current(moved);
      });

      return marker;
    };

    if (needsOrigin && !pendingOriginMarkerRef.current) {
      pendingOriginMarkerRef.current = createPendingMarker("origin");
      pendingSettledRef.current = false;
    }

    if (needsDestination && !pendingDestinationMarkerRef.current) {
      pendingDestinationMarkerRef.current = createPendingMarker("destination");
      pendingSettledRef.current = false;
    }

    /* Dos motivos para recolocar en cada parada del mapa:
       1) El primer marcador nace antes de que Google conozca el encuadre, así
          que se reparte con una medida supuesta; en cuanto hay encuadre real
          se coloca bien (una sola vez, para no perseguir al usuario después).
       2) Si el pasajero navega lejos, el punto pendiente dejaría de estar
          "siempre disponible": vuelve a la vista si se quedó fuera. */
    const keepPendingInView = (): void => {
      const bounds = map.getBounds();
      if (!bounds) return;

      const settling = !pendingSettledRef.current;

      const reposition = (
        marker: google.maps.Marker | null,
        kind: "origin" | "destination",
      ): void => {
        const position = marker?.getPosition();
        if (!marker || !position) return;
        if (!settling && bounds.contains(position)) return;

        const spot = getPendingSpot(map, kind);
        if (spot) marker.setPosition(spot);
      };

      reposition(pendingOriginMarkerRef.current, "origin");
      reposition(pendingDestinationMarkerRef.current, "destination");
      pendingSettledRef.current = true;
    };

    const idleListener = map.addListener("idle", keepPendingInView);

    return () => {
      google.maps.event.removeListener(idleListener);
    };
  }, [
    mapReady,
    originDraggable,
    canReportOrigin,
    destinationDraggable,
    canReportDestination,
    localOrigin.lat,
    localOrigin.lng,
    destination.lat,
    destination.lng,
  ]);

  /* Marcadores de POIs tocables. Van en su propio efecto para no reconstruir la
     ruta al seleccionarlos. Se omite el POI que ya es origen o destino: ese
     punto lo dibuja el efecto de la ruta con su color propio. */
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !window.google?.maps) return;

    for (const marker of placeMarkersRef.current) {
      marker.setMap(null);
    }
    placeMarkersRef.current = [];

    if (!places || places.length === 0) return;

    const originPoint = getPointFromMapPoint(localOrigin);
    const destinationPoint = getPointFromMapPoint(destination);

    const sameSpot = (spot: LatLng | null, lat: number, lng: number): boolean =>
      spot != null &&
      Math.abs(spot.lat - lat) < 1e-4 &&
      Math.abs(spot.lng - lng) < 1e-4;

    for (const place of places) {
      if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) continue;
      if (
        sameSpot(originPoint, place.lat, place.lng) ||
        sameSpot(destinationPoint, place.lat, place.lng)
      ) {
        continue;
      }

      const marker = new google.maps.Marker({
        map,
        position: { lat: place.lat, lng: place.lng },
        title: place.name,
        cursor: "pointer",
        /* Punto disponible: oro claro con borde tostado, más pequeño que el
           origen (verde) y el destino (oro fuerte), para leerse como "tócame". */
        icon: makeCircleIcon("#f6c945", 7, "#7a4f12"),
        zIndex: 8,
      });

      marker.addListener("click", () => {
        onSelectPlace?.(place);
      });

      placeMarkersRef.current.push(marker);
    }
  }, [
    mapReady,
    places,
    onSelectPlace,
    localOrigin.lat,
    localOrigin.lng,
    destination.lat,
    destination.lng,
  ]);

  return (
    <div
      style={{
        background: "#e8eef4",
        overflow: "hidden",
        position: "relative",
      }}>
      <div style={{ height, position: "relative" }}>
        <div
          ref={mapElementRef}
          style={{
            height: "100%",
            width: "100%",
            background: "#e8eef4",
          }}
        />

        {(originDraggable || destinationDraggable) && (
          <div
            style={{
              position: "absolute",
              left: "12px",
              right: "12px",
              top: "12px",
              /* El aviso se tiñe del color del punto que se está moviendo:
                 verde para el origen, oro para el destino. */
              background:
                movingPoint === "origin"
                  ? "rgba(46,125,91,.96)"
                  : movingPoint === "destination"
                    ? "rgba(200,155,60,.96)"
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
            }}>
            {getDragHint({
              movingPoint,
              originDraggable,
              destinationDraggable,
            })}
          </div>
        )}

        {mapError && (
          <div
            style={{
              position: "absolute",
              left: "16px",
              right: "16px",
              top: originDraggable || destinationDraggable ? "58px" : "16px",
              background: "rgba(17,17,17,.94)",
              color: "#F6F2EC",
              borderRadius: "14px",
              padding: "10px 12px",
              fontSize: ".76rem",
              border: "1px solid rgba(200,155,60,.35)",
              zIndex: 5,
            }}>
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
            }}>
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                fontWeight: 900,
                fontSize: ".82rem",
              }}>
              <IonIcon icon={carOutline} style={{ color: "#C89B3C" }} />
              Ruta del viaje
            </div>

            <div
              style={{
                marginTop: "4px",
                color: "#D9C3A0",
                fontSize: ".76rem",
              }}>
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
  destinationDraggable = false,
  onDestinationChange,
  rejectDroppedPoint,
  places,
  onSelectPlace,
  onSelectGooglePoi,
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
      destinationDraggable={destinationDraggable}
      onDestinationChange={onDestinationChange}
      rejectDroppedPoint={rejectDroppedPoint}
      places={places}
      onSelectPlace={onSelectPlace}
      onSelectGooglePoi={onSelectGooglePoi}
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
          }}>
          <span>
            <strong>📏</strong> {dist.km} km
          </span>
          <span>
            <strong>⏱</strong> ~{dist.minutes} min
          </span>
          <span>
            <strong>💰</strong> $
            {getEstimatedFare(dist.km).toLocaleString("es-CL")} CLP est.
          </span>
        </div>

        <IonNote
          style={{
            fontSize: "0.7rem",
            display: "block",
            marginTop: "4px",
          }}>
          Tarifa estimada — sujeta a confirmación del operador
        </IonNote>
      </IonCardContent>
    </IonCard>
  );
}
