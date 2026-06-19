import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonPage,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  calendarOutline,
  checkmarkCircleOutline,
  flagOutline,
  locationOutline,
  locateOutline,
  navigateOutline,
  searchOutline,
  shieldCheckmarkOutline,
  timeOutline,
} from "ionicons/icons";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useHistory } from "react-router-dom";
import { MapFallback, loadRapaGoGoogleMaps } from "../../../components/MapFallback.js";
import { useAuth } from "../../../features/auth/index.js";
import {
  ridesService,
  type CreateRideInput,
} from "../../../features/rides/rides.service.js";
import {
  legalService,
  type LegalDocumentData,
  type UserAcceptanceData,
} from "../../../features/legal/legal.service.js";
import { RIDE_STATUS_LABEL } from "../shared.js";

type RideMode = "now" | "scheduled";
type PickerTarget = "origin" | "destination";

type Coords = {
  lat: number;
  lng: number;
  placeId?: string | null;
};

type ConfirmedPoint = Coords & {
  text: string;
  address: string;
  originalLat?: number | null;
  originalLng?: number | null;
  walkMeters?: number;
  isAccessiblePickup?: boolean;
};

type GoogleSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

type PickerResult = {
  text: string;
  address: string;
  lat: number;
  lng: number;
  placeId?: string | null;

  // Punto real donde estaba el usuario/pin antes de ajustar a calle.
  originalLat?: number | null;
  originalLng?: number | null;

  // Distancia caminando aproximada desde el punto real hasta la calle accesible.
  walkMeters?: number;
  isAccessiblePickup?: boolean;
};

type MapPointMovedPayload = {
  point: "origin" | "destination";
  lat: number;
  lng: number;
  text: string;
  address?: string;
};

declare global {
  interface Window {
    google?: typeof google;
  }

  interface WindowEventMap {
    "rapago:origin-point-moved": CustomEvent<MapPointMovedPayload>;
  }
}

const RAPA_NUI_CENTER = {
  lat: -27.1505,
  lng: -109.4325,
};

function inputItemStyle(extra?: CSSProperties): CSSProperties {
  return {
    "--background": "#242424",
    "--border-radius": "14px",
    "--padding-start": "14px",
    "--inner-padding-end": "12px",
    "--min-height": "48px",
    "--color": "#F6F2EC",
    "--placeholder-color": "rgba(246,242,236,.58)",
    marginBottom: "14px",
    ...extra,
  } as CSSProperties;
}

function sectionLabelStyle(): CSSProperties {
  return {
    color: "rgba(246,242,236,.52)",
    fontSize: "0.72rem",
    fontWeight: 900,
    letterSpacing: "0.04em",
    margin: "0 0 8px 2px",
    textTransform: "uppercase",
  };
}

function suggestionBoxStyle(): CSSProperties {
  return {
    margin: "-8px 0 14px",
    border: "1px solid rgba(210,164,58,.35)",
    borderRadius: "12px",
    overflow: "hidden",
    background: "#171717",
  };
}

function getShortAddress(result: google.maps.GeocoderResult | null): {
  title: string;
  subtitle: string;
} {
  if (!result) {
    return {
      title: "Punto seleccionado",
      subtitle: "Rapa Nui, Chile",
    };
  }

  const route = result.address_components.find((item) =>
    item.types.includes("route"),
  )?.long_name;

  const premise =
    result.address_components.find((item) => item.types.includes("premise"))
      ?.long_name ??
    result.address_components.find((item) => item.types.includes("establishment"))
      ?.long_name;

  const title = route || premise || result.formatted_address.split(",")[0];

  return {
    title,
    subtitle: result.formatted_address,
  };
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
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

function findNearestRoadResult(
  results: google.maps.GeocoderResult[] | null | undefined,
): google.maps.GeocoderResult | null {
  if (!results?.length) return null;

  return (
    results.find((result) => result.types.includes("route")) ??
    results.find((result) =>
      result.address_components.some((component) =>
        component.types.includes("route"),
      ),
    ) ??
    null
  );
}


async function reverseGeocodeExact(point: Coords): Promise<PickerResult> {
  await loadRapaGoGoogleMaps();

  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve) => {
    geocoder.geocode(
      {
        location: {
          lat: point.lat,
          lng: point.lng,
        },
      },
      (results, status) => {
        const first =
          status === google.maps.GeocoderStatus.OK && results?.[0]
            ? results[0]
            : null;

        const label = getShortAddress(first);

        resolve({
          text: label.title,
          address: label.subtitle,
          lat: point.lat,
          lng: point.lng,
          placeId: first?.place_id ?? point.placeId ?? null,
          originalLat: null,
          originalLng: null,
          walkMeters: 0,
          isAccessiblePickup: false,
        });
      },
    );
  });
}


async function resolveMovedOriginPoint(point: {
  lat: number;
  lng: number;
  text?: string;
  address?: string;
}): Promise<PickerResult> {
  const resolved = await reverseGeocode({
    lat: point.lat,
    lng: point.lng,
    placeId: null,
  });

  return {
    ...resolved,
    originalLat: point.lat,
    originalLng: point.lng,
  };
}

async function reverseGeocode(point: Coords): Promise<PickerResult> {
  await loadRapaGoGoogleMaps();

  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve) => {
    geocoder.geocode(
      {
        location: {
          lat: point.lat,
          lng: point.lng,
        },
      },
      (results, status) => {
        const first =
          status === google.maps.GeocoderStatus.OK && results?.[0]
            ? results[0]
            : null;

        const roadResult = findNearestRoadResult(results);
        const best = roadResult ?? first;
        const label = getShortAddress(best);

        const roadLocation = roadResult?.geometry?.location ?? null;
        const pickupPoint = roadLocation
          ? {
              lat: roadLocation.lat(),
              lng: roadLocation.lng(),
            }
          : {
              lat: point.lat,
              lng: point.lng,
            };

        const meters = Math.round(distanceMeters(point, pickupPoint));
        const adjustedToRoad = Boolean(roadResult && meters >= 8);

        resolve({
          text: adjustedToRoad
            ? `Recogida en ${label.title}`
            : label.title,
          address: adjustedToRoad
            ? `${label.subtitle} · Camina aprox. ${meters} m hasta la calle accesible`
            : label.subtitle,
          lat: pickupPoint.lat,
          lng: pickupPoint.lng,
          placeId: best?.place_id ?? point.placeId ?? null,
          originalLat: point.lat,
          originalLng: point.lng,
          walkMeters: meters,
          isAccessiblePickup: Boolean(roadResult),
        });
      },
    );
  });
}

async function geocodeTextExact(text: string): Promise<PickerResult | null> {
  await loadRapaGoGoogleMaps();

  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve) => {
    geocoder.geocode(
      {
        address: `${text}, Hanga Roa, Rapa Nui, Chile`,
        region: "CL",
        componentRestrictions: {
          country: "CL",
        },
      },
      (results, status) => {
        if (status !== google.maps.GeocoderStatus.OK || !results?.[0]) {
          resolve(null);
          return;
        }

        const result = results[0];
        const label = getShortAddress(result);

        resolve({
          text: text.trim() || label.title,
          address: result.formatted_address,
          lat: result.geometry.location.lat(),
          lng: result.geometry.location.lng(),
          placeId: result.place_id,
          originalLat: null,
          originalLng: null,
          walkMeters: 0,
          isAccessiblePickup: false,
        });
      },
    );
  });
}

async function geocodeText(text: string): Promise<PickerResult | null> {
  await loadRapaGoGoogleMaps();

  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve) => {
    geocoder.geocode(
      {
        address: `${text}, Hanga Roa, Rapa Nui, Chile`,
        region: "CL",
        componentRestrictions: {
          country: "CL",
        },
      },
      (results, status) => {
        if (status !== google.maps.GeocoderStatus.OK || !results?.[0]) {
          resolve(null);
          return;
        }

        const result = results[0];

        void reverseGeocode({
          lat: result.geometry.location.lat(),
          lng: result.geometry.location.lng(),
          placeId: result.place_id,
        }).then((snapped) => {
          resolve({
            ...snapped,
            text: snapped.isAccessiblePickup
              ? snapped.text
              : text.trim() || snapped.text,
          });
        });
      },
    );
  });
}

async function getGooglePredictions(input: string): Promise<GoogleSuggestion[]> {
  if (input.trim().length < 3) return [];

  await loadRapaGoGoogleMaps();

  const service = new google.maps.places.AutocompleteService();

  return new Promise((resolve) => {
    service.getPlacePredictions(
      {
        input,
        componentRestrictions: {
          country: "cl",
        },
        location: new google.maps.LatLng(RAPA_NUI_CENTER.lat, RAPA_NUI_CENTER.lng),
        radius: 15000,
        types: ["establishment", "geocode"],
      },
      (predictions, status) => {
        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !predictions
        ) {
          resolve([]);
          return;
        }

        resolve(
          predictions.slice(0, 6).map((prediction) => ({
            placeId: prediction.place_id,
            description: prediction.description,
            mainText: prediction.structured_formatting.main_text,
            secondaryText: prediction.structured_formatting.secondary_text,
          })),
        );
      },
    );
  });
}

async function getPlaceDetailsExact(placeId: string): Promise<PickerResult | null> {
  await loadRapaGoGoogleMaps();

  const container = document.createElement("div");
  const service = new google.maps.places.PlacesService(container);

  return new Promise((resolve) => {
    service.getDetails(
      {
        placeId,
        fields: ["name", "formatted_address", "geometry", "place_id"],
      },
      (place, status) => {
        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !place?.geometry?.location
        ) {
          resolve(null);
          return;
        }

        resolve({
          text: place.name ?? place.formatted_address ?? "Destino seleccionado",
          address: place.formatted_address ?? "Rapa Nui, Chile",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          placeId: place.place_id ?? placeId,
          originalLat: null,
          originalLng: null,
          walkMeters: 0,
          isAccessiblePickup: false,
        });
      },
    );
  });
}

async function getPlaceDetails(placeId: string): Promise<PickerResult | null> {
  await loadRapaGoGoogleMaps();

  const container = document.createElement("div");
  const service = new google.maps.places.PlacesService(container);

  return new Promise((resolve) => {
    service.getDetails(
      {
        placeId,
        fields: ["name", "formatted_address", "geometry", "place_id"],
      },
      (place, status) => {
        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !place?.geometry?.location
        ) {
          resolve(null);
          return;
        }

        void reverseGeocode({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          placeId: place.place_id ?? placeId,
        }).then((snapped) => {
          resolve({
            ...snapped,
            text: snapped.isAccessiblePickup
              ? snapped.text
              : place.name ?? place.formatted_address ?? snapped.text,
          });
        });
      },
    );
  });
}

function SuggestionList({
  suggestions,
  onPick,
}: {
  suggestions: GoogleSuggestion[];
  onPick: (suggestion: GoogleSuggestion) => void;
}): JSX.Element | null {
  if (suggestions.length === 0) return null;

  return (
    <div style={suggestionBoxStyle()}>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.placeId}
          type="button"
          onClick={() => onPick(suggestion)}
          style={{
            width: "100%",
            border: 0,
            borderBottom: "1px solid rgba(255,255,255,.06)",
            background: "transparent",
            color: "#F6F2EC",
            padding: "10px 12px",
            textAlign: "left",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: ".84rem" }}>
            {suggestion.mainText}
          </div>
          <div
            style={{
              marginTop: "3px",
              color: "rgba(246,242,236,.58)",
              fontSize: ".72rem",
              lineHeight: 1.25,
            }}
          >
            {suggestion.secondaryText}
          </div>
        </button>
      ))}
    </div>
  );
}

function MapPointPicker({
  isOpen,
  title,
  mode,
  initialPoint,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  title: string;
  mode: PickerTarget;
  initialPoint?: Coords | null;
  onCancel: () => void;
  onConfirm: (point: PickerResult) => void;
}): JSX.Element {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const geocodeTimerRef = useRef<number | null>(null);
  const realPointMarkerRef = useRef<google.maps.Marker | null>(null);
  const pickupPointMarkerRef = useRef<google.maps.Marker | null>(null);
  const realPointCircleRef = useRef<google.maps.Circle | null>(null);
  const walkingDotsRef = useRef<google.maps.Polyline | null>(null);
  const walkingDotsShadowRef = useRef<google.maps.Polyline | null>(null);
  const realPointInfoRef = useRef<google.maps.InfoWindow | null>(null);
  const pickupPointInfoRef = useRef<google.maps.InfoWindow | null>(null);

  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<PickerResult | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [pickerSuggestions, setPickerSuggestions] = useState<GoogleSuggestion[]>(
    [],
  );
  const [modalReady, setModalReady] = useState(false);


  function drawAccessiblePickupPreview(point: PickerResult | null): void {
    const map = mapRef.current;

    if (!map || !window.google?.maps) return;

    realPointMarkerRef.current?.setMap(null);
    realPointCircleRef.current?.setMap(null);
    pickupPointMarkerRef.current?.setMap(null);
    walkingDotsRef.current?.setMap(null);
    walkingDotsShadowRef.current?.setMap(null);
    realPointInfoRef.current?.close();
    pickupPointInfoRef.current?.close();

    if (!point) {
      return;
    }

    const realPoint = {
      lat: point.originalLat ?? point.lat,
      lng: point.originalLng ?? point.lng,
    };

    const pickupPoint = {
      lat: point.lat,
      lng: point.lng,
    };

    const shouldShowAccessiblePickup =
      point.originalLat != null &&
      point.originalLng != null &&
      point.walkMeters != null &&
      point.walkMeters > 8;

    realPointCircleRef.current = new google.maps.Circle({
      map,
      center: realPoint,
      radius: 45,
      fillColor: "#2563eb",
      fillOpacity: 0.22,
      strokeColor: "#2563eb",
      strokeOpacity: 0,
      strokeWeight: 0,
      zIndex: 10,
    });

    realPointMarkerRef.current = new google.maps.Marker({
      map,
      position: realPoint,
      title: "Mantén presionado y mueve tu punto azul",
      draggable: true,
      cursor: "grab",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: "#2563eb",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 4,
      },
      zIndex: 30,
    });

    realPointMarkerRef.current.addListener("dragstart", () => {
      map.setOptions({ draggableCursor: "grabbing" });
    });

    realPointMarkerRef.current.addListener("drag", () => {
      const position = realPointMarkerRef.current?.getPosition();
      if (!position) return;

      const movedPoint = {
        lat: position.lat(),
        lng: position.lng(),
      };

      realPointCircleRef.current?.setCenter(movedPoint);

      if (walkingDotsRef.current) {
        walkingDotsRef.current.setPath([
          movedPoint,
          {
            lat: point.lat,
            lng: point.lng,
          },
        ]);
      }

      if (walkingDotsShadowRef.current) {
        walkingDotsShadowRef.current.setPath([
          movedPoint,
          {
            lat: point.lat,
            lng: point.lng,
          },
        ]);
      }
    });

    realPointMarkerRef.current.addListener("dragend", () => {
      const position = realPointMarkerRef.current?.getPosition();
      map.setOptions({ draggableCursor: undefined });

      if (!position) return;

      const movedPoint = {
        lat: position.lat(),
        lng: position.lng(),
      };

      setLoadingAddress(true);

      void reverseGeocode(movedPoint)
        .then((nextPoint) => {
          setSelected(nextPoint);
          drawAccessiblePickupPreview(nextPoint);
        })
        .finally(() => setLoadingAddress(false));
    });

    if (!shouldShowAccessiblePickup) {
      return;
    }

    pickupPointMarkerRef.current = new google.maps.Marker({
      map,
      position: pickupPoint,
      title: "Punto accesible de recogida",
      label: {
        text: "●",
        color: "#ffffff",
        fontSize: "18px",
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 18,
        fillColor: "#22c55e",
        fillOpacity: 1,
        strokeColor: "#0b3d16",
        strokeWeight: 5,
      },
    });

    // Línea punteada tipo Uber: sombra negra + puntos blancos.
    walkingDotsShadowRef.current = new google.maps.Polyline({
      map,
      path: [realPoint, pickupPoint],
      strokeColor: "#111111",
      strokeOpacity: 0,
      strokeWeight: 0,
      zIndex: 20,
      icons: [
        {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#111111",
            fillOpacity: 0.75,
            strokeColor: "#111111",
            strokeOpacity: 0.75,
            scale: 6,
          },
          offset: "0",
          repeat: "18px",
        },
      ],
    });

    walkingDotsRef.current = new google.maps.Polyline({
      map,
      path: [realPoint, pickupPoint],
      strokeColor: "#ffffff",
      strokeOpacity: 0,
      strokeWeight: 0,
      zIndex: 21,
      icons: [
        {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#ffffff",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeOpacity: 1,
            scale: 3.8,
          },
          offset: "0",
          repeat: "18px",
        },
      ],
    });

    // No usamos globos blancos de Google para mantener estilo tipo Uber.

  }


  useEffect(() => {
    if (!isOpen) {
      setModalReady(false);
      realPointMarkerRef.current?.setMap(null);
    realPointCircleRef.current?.setMap(null);
      pickupPointMarkerRef.current?.setMap(null);
      walkingDotsRef.current?.setMap(null);
    walkingDotsShadowRef.current?.setMap(null);
    realPointInfoRef.current?.close();
    pickupPointInfoRef.current?.close();
      mapRef.current = null;
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !modalReady) return;

    setReady(false);
    setSelected(null);
    setSearchText("");
    setPickerSuggestions([]);

    let cancelled = false;

    void loadRapaGoGoogleMaps()
.then(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 250));

        if (cancelled || !mapElementRef.current || !window.google?.maps) return;

        const center = initialPoint ?? RAPA_NUI_CENTER;

        const map = new google.maps.Map(mapElementRef.current, {
          center,
          zoom: 17,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          clickableIcons: true,
          gestureHandling: "greedy",
          disableDefaultUI: true,
          zoomControl: true,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#d7dde8" }] },
            {
              featureType: "road",
              elementType: "geometry",
              stylers: [{ color: "#38465a" }],
            },
            {
              featureType: "road",
              elementType: "geometry.stroke",
              stylers: [{ color: "#1f2937" }],
            },
            {
              featureType: "road",
              elementType: "labels.text.fill",
              stylers: [{ color: "#ffffff" }],
            },
            {
              featureType: "poi",
              elementType: "labels.text.fill",
              stylers: [{ color: "#cbd5e1" }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#0f172a" }],
            },
          ],
        });

        mapRef.current = map;

        window.setTimeout(() => {
          if (cancelled) return;
          google.maps.event.trigger(map, "resize");
          map.setCenter(center);
          map.setZoom(17);
          setReady(true);
        }, 150);

        const first =
          mode === "origin"
            ? await reverseGeocode({
                lat: center.lat,
                lng: center.lng,
                placeId: initialPoint?.placeId ?? null,
              })
            : await reverseGeocodeExact({
                lat: center.lat,
                lng: center.lng,
                placeId: initialPoint?.placeId ?? null,
              });

        if (!cancelled) {
          setSelected(first);
          if (mode === "origin") {
            drawAccessiblePickupPreview(first);
          } else {
            drawAccessiblePickupPreview(null);
          }
        }

        map.addListener("idle", () => {
          if (geocodeTimerRef.current) {
            window.clearTimeout(geocodeTimerRef.current);
          }

          geocodeTimerRef.current = window.setTimeout(() => {
            const currentCenter = map.getCenter();

            if (!currentCenter) return;

            setLoadingAddress(true);

            void (mode === "origin"
              ? reverseGeocode({
                  lat: currentCenter.lat(),
                  lng: currentCenter.lng(),
                })
              : reverseGeocodeExact({
                  lat: currentCenter.lat(),
                  lng: currentCenter.lng(),
                }))
              .then((result) => {
                if (!cancelled) {
                  setSelected(result);
                  if (mode === "origin") {
                    drawAccessiblePickupPreview(result);
                  } else {
                    drawAccessiblePickupPreview(null);
                  }
                }
              })
              .finally(() => {
                if (!cancelled) setLoadingAddress(false);
              });
          }, 450);
        });
      })
      .catch(() => {
        setReady(true);
        setSelected({
          text: "No se pudo cargar el mapa",
          address: "Revisa la API Key de Google Maps y vuelve a intentar.",
          lat: RAPA_NUI_CENTER.lat,
          lng: RAPA_NUI_CENTER.lng,
          placeId: null,
        });
      });

    return () => {
      cancelled = true;

      if (geocodeTimerRef.current) {
        window.clearTimeout(geocodeTimerRef.current);
      }

      mapRef.current = null;
    };
  }, [
    isOpen,
    modalReady,
    initialPoint?.lat,
    initialPoint?.lng,
    initialPoint?.placeId,
  ]);

  useEffect(() => {
    if (!isOpen || searchText.trim().length < 3) {
      setPickerSuggestions([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      void getGooglePredictions(searchText.trim()).then(setPickerSuggestions);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [isOpen, searchText]);

  async function pickSuggestion(suggestion: GoogleSuggestion): Promise<void> {
    const details =
      mode === "origin"
        ? await getPlaceDetails(suggestion.placeId)
        : await getPlaceDetailsExact(suggestion.placeId);

    if (!details || !mapRef.current) return;

    setSelected(details);
    if (mode === "origin") {
      drawAccessiblePickupPreview(details);
    } else {
      drawAccessiblePickupPreview(null);
    }
    setSearchText(details.text);
    setPickerSuggestions([]);

    mapRef.current.setCenter({
      lat: details.lat,
      lng: details.lng,
    });

    mapRef.current.setZoom(18);
  }

  function useCurrentLocation(): void {
    if (!navigator.geolocation || !mapRef.current) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        mapRef.current?.setCenter(point);
        mapRef.current?.setZoom(18);
      },
      () => {},
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      },
    );
  }

  return (
    <IonModal
      isOpen={isOpen}
      onDidPresent={() => setModalReady(true)}
      onDidDismiss={() => {
        setModalReady(false);
        onCancel();
      }}
    >
      <IonPage>
        <IonHeader>
          <IonToolbar color="primary">
            <IonButton fill="clear" slot="start" onClick={onCancel}>
              Volver
            </IonButton>
            <IonTitle>{title}</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent fullscreen>
          <div
            style={{
              height: "100%",
              background: "#111111",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ position: "relative", flex: 1, minHeight: 360 }}>
              <div
                ref={mapElementRef}
                style={{
                  width: "100%",
                  height: "100%",
                  background: "#e8eef4",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  top: 14,
                  left: 14,
                  right: 14,
                  zIndex: 10,
                }}
              >
                <IonItem
                  lines="none"
                  style={
                    {
                      "--background": "#ffffff",
                      "--border-radius": "999px",
                      "--padding-start": "14px",
                      "--inner-padding-end": "10px",
                      boxShadow: "0 10px 28px rgba(0,0,0,.25)",
                    } as CSSProperties
                  }
                >
                  <IonIcon icon={searchOutline} slot="start" color="medium" />
                  <IonInput
                    value={searchText}
                    placeholder="Buscar dirección o lugar"
                    onIonInput={(event) =>
                      setSearchText(String(event.detail.value ?? ""))
                    }
                  />
                </IonItem>

                {pickerSuggestions.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      borderRadius: 16,
                      background: "#ffffff",
                      overflow: "hidden",
                      boxShadow: "0 14px 30px rgba(0,0,0,.25)",
                    }}
                  >
                    {pickerSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.placeId}
                        type="button"
                        onClick={() => void pickSuggestion(suggestion)}
                        style={{
                          width: "100%",
                          border: 0,
                          borderBottom: "1px solid #eee",
                          background: "#ffffff",
                          color: "#111",
                          padding: "12px 14px",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>
                          {suggestion.mainText}
                        </div>
                        <div style={{ fontSize: ".74rem", color: "#666" }}>
                          {suggestion.secondaryText}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {mode === "origin" &&
                selected?.walkMeters != null &&
                selected.walkMeters > 8 && (
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "47%",
                    transform: "translate(-50%, -110%)",
                    zIndex: 35,
                    background: "rgba(17,17,17,.94)",
                    color: "#ffffff",
                    border: "1px solid rgba(34,197,94,.65)",
                    borderRadius: "16px",
                    padding: "6px 12px",
                    fontWeight: 800,
                    fontSize: ".72rem",
                    boxShadow: "0 5px 14px rgba(0,0,0,.35)",
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                  }}
                >
                  Inicio de viaje en {selected.text.replace("Recogida en ", "")}
                </div>
              )}



              <button
                type="button"
                onClick={useCurrentLocation}
                style={{
                  position: "absolute",
                  right: 16,
                  bottom: 22,
                  zIndex: 9,
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  border: 0,
                  background: "#111111",
                  color: "#ffffff",
                  boxShadow: "0 10px 24px rgba(0,0,0,.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 25,
                }}
              >
                <IonIcon icon={locateOutline} />
              </button>

              {modalReady && !ready && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(17,17,17,.25)",
                    zIndex: 20,
                  }}
                >
                  <IonSpinner name="crescent" />
                </div>
              )}
            </div>

            <div
              style={{
                background: "#111111",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                marginTop: -20,
                position: "relative",
                zIndex: 20,
                padding: "22px 18px 20px",
                boxShadow: "0 -14px 30px rgba(0,0,0,.35)",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 4,
                  borderRadius: 999,
                  background: "rgba(246,242,236,.16)",
                  margin: "0 auto 22px",
                }}
              />

              <div
                style={{
                  color: "#F6F2EC",
                  fontWeight: 950,
                  fontSize: "1.15rem",
                  lineHeight: 1.2,
                  marginBottom: 18,
                }}
              >
                {mode === "origin" ? "Punto accesible recomendado" : "Destino seleccionado"}
              </div>

              <div
                style={{
                  background: "#1f1f1f",
                  borderRadius: 16,
                  padding: "14px 16px",
                  marginBottom: 14,
                  border: "1px solid rgba(255,255,255,.08)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: "#22c55e",
                    boxShadow: "0 0 0 5px rgba(34,197,94,.16)",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      color: "#F6F2EC",
                      fontWeight: 900,
                      fontSize: ".9rem",
                      marginBottom: 4,
                    }}
                  >
                    {loadingAddress
                      ? "Buscando calle accesible..."
                      : selected?.walkMeters != null && selected.walkMeters > 8
                        ? selected.text.replace("Recogida en ", "")
                        : selected?.text ?? "Punto seleccionado"}
                  </div>
                  <div
                    style={{
                      color: "rgba(246,242,236,.58)",
                      fontSize: ".82rem",
                      lineHeight: 1.35,
                    }}
                  >
                    {selected?.walkMeters != null && selected.walkMeters > 8
                      ? `A ${selected.walkMeters} m de tu ubicación`
                      : selected?.address ??
                        "Mueve el mapa. Rapa Go ajustará el punto a una calle accesible."}
                  </div>
                </div>
                <div style={{ color: "rgba(246,242,236,.65)", fontSize: 22 }}>✎</div>
              </div>

              {mode === "origin" &&
                selected?.walkMeters != null &&
                selected.walkMeters > 8 && (
                <div
                  style={{
                    background: "#1f1f1f",
                    borderRadius: 16,
                    padding: "14px 16px",
                    marginBottom: 18,
                    border: "1px solid rgba(255,255,255,.08)",
                    display: "grid",
                    gridTemplateColumns: "42px 1fr auto",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 28 }}>🚶</div>
                  <div>
                    <div
                      style={{
                        color: "#F6F2EC",
                        fontWeight: 900,
                        fontSize: ".86rem",
                        marginBottom: 4,
                      }}
                    >
                      Camina hasta la calle
                    </div>
                    <div
                      style={{
                        color: "rgba(246,242,236,.62)",
                        fontSize: ".82rem",
                        lineHeight: 1.35,
                      }}
                    >
                      Es la mejor ubicación para que el conductor te encuentre
                    </div>
                  </div>
                  <div
                    style={{
                      color: "#22c55e",
                      fontWeight: 950,
                      fontSize: ".92rem",
                      textAlign: "right",
                    }}
                  >
                    {selected.walkMeters} m
                    <div
                      style={{
                        color: "rgba(246,242,236,.78)",
                        fontWeight: 600,
                        fontSize: ".78rem",
                        marginTop: 4,
                      }}
                    >
                      {Math.max(1, Math.round(selected.walkMeters / 80))} min
                    </div>
                  </div>
                </div>
              )}

              <IonButton
                expand="block"
                disabled={!selected}
                onClick={() => {
                  if (selected) onConfirm(selected);
                }}
                style={
                  {
                    "--background": "#F6F2EC",
                    "--color": "#111111",
                    "--border-radius": "14px",
                    height: "54px",
                    fontSize: "1rem",
                    fontWeight: 950,
                  } as CSSProperties
                }
              >
                {mode === "origin" ? "Confirmar punto de partida" : "Confirmar destino"}
              </IonButton>
            </div>
          </div>
        </IonContent>
      </IonPage>
    </IonModal>
  );
}


function LegalCompactSection({ token }: { token: string }): JSX.Element {
  const [docs, setDocs] = useState<LegalDocumentData[]>([]);
  const [acceptances, setAcceptances] = useState<UserAcceptanceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      legalService.getActive(),
      legalService.getMyAcceptances(token),
    ])
      .then(([activeDocs, userAcceptances]) => {
        setDocs(activeDocs);
        setAcceptances(userAcceptances);
      })
      .catch(() => {
        setDocs([]);
        setAcceptances([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  function getStatus(
    doc: LegalDocumentData,
  ): "accepted" | "new_version" | "not_accepted" {
    const acceptance = acceptances.find(
      (item) => item.legalDocumentId === doc.id,
    );

    if (!acceptance) return "not_accepted";
    if (acceptance.versionAccepted !== doc.version) return "new_version";

    return "accepted";
  }

  function handleAccept(doc: LegalDocumentData): void {
    void legalService
      .accept(token, doc.id, doc.version)
      .then(() => legalService.getMyAcceptances(token))
      .then(setAcceptances)
      .catch(() => {});
  }

  const pendingDocs = docs.filter((doc) => getStatus(doc) !== "accepted");

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
        <IonSpinner name="dots" />
      </div>
    );
  }

  if (pendingDocs.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "rgba(246,242,236,.72)",
          fontSize: ".78rem",
          margin: "2px 0 16px",
        }}
      >
        <IonIcon icon={shieldCheckmarkOutline} style={{ color: "#2BA84A" }} />
        Documentos legales aceptados
      </div>
    );
  }

  return (
    <IonCard
      style={{
        margin: "0 0 16px",
        borderRadius: "12px",
        background: "#f4f6fb",
      }}
    >
      <IonCardContent style={{ padding: "12px" }}>
        <div style={{ fontWeight: 900, marginBottom: "8px", color: "#111" }}>
          Documentos pendientes
        </div>

        {pendingDocs.map((doc) => {
          const status = getStatus(doc);

          return (
            <IonItem
              key={doc.id}
              lines="none"
              style={
                {
                  "--background": "#ffffff",
                  "--border-radius": "10px",
                  marginBottom: "8px",
                } as CSSProperties
              }
            >
              <IonLabel>
                <h3>{doc.title}</h3>
                <p>v{doc.version}</p>
              </IonLabel>

              <IonBadge
                color={status === "new_version" ? "warning" : "danger"}
                slot="end"
              >
                {status === "new_version" ? "Nueva" : "Pendiente"}
              </IonBadge>

              <IonButton
                size="small"
                fill="clear"
                slot="end"
                onClick={() => handleAccept(doc)}
              >
                Aceptar
              </IonButton>
            </IonItem>
          );
        })}
      </IonCardContent>
    </IonCard>
  );
}

export default function RequestRidePage(): JSX.Element {
  const { session } = useAuth();
  const history = useHistory();

  const [originPoint, setOriginPoint] = useState<ConfirmedPoint | null>(null);
  const [destinationPoint, setDestinationPoint] =
    useState<ConfirmedPoint | null>(null);

  const [originInput, setOriginInput] = useState("");
  const [destInput, setDestInput] = useState("");

  const [originSuggestions, setOriginSuggestions] = useState<GoogleSuggestion[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<GoogleSuggestion[]>([]);
  const [searchingOrigin, setSearchingOrigin] = useState(false);
  const [searchingDest, setSearchingDest] = useState(false);

  const originSearchSeq = useRef(0);
  const destSearchSeq = useRef(0);
  const suppressPickerOpenRef = useRef(false);

  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const [notesInput, setNotesInput] = useState("");
  const [rideMode, setRideMode] = useState<RideMode>("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [locating, setLocating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: CustomEvent<MapPointMovedPayload>) => {
      void applyMovedOriginFromMap(event.detail);
    };

    window.addEventListener("rapago:origin-point-moved", handler);

    return () => {
      window.removeEventListener("rapago:origin-point-moved", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const value = originInput.trim();

    if (value.length < 3 || originPoint?.text === value) {
      setOriginSuggestions([]);
      setSearchingOrigin(false);
      return;
    }

    const seq = ++originSearchSeq.current;
    setSearchingOrigin(true);

    const timeout = window.setTimeout(() => {
      void getGooglePredictions(value)
        .then((results) => {
          if (seq !== originSearchSeq.current) return;
          setOriginSuggestions(results);
        })
        .finally(() => {
          if (seq === originSearchSeq.current) setSearchingOrigin(false);
        });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [originInput, originPoint?.text]);

  useEffect(() => {
    const value = destInput.trim();

    if (value.length < 3 || destinationPoint?.text === value) {
      setDestSuggestions([]);
      setSearchingDest(false);
      return;
    }

    const seq = ++destSearchSeq.current;
    setSearchingDest(true);

    const timeout = window.setTimeout(() => {
      void getGooglePredictions(value)
        .then((results) => {
          if (seq !== destSearchSeq.current) return;
          setDestSuggestions(results);
        })
        .finally(() => {
          if (seq === destSearchSeq.current) setSearchingDest(false);
        });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [destInput, destinationPoint?.text]);

  function applyOrigin(point: PickerResult): void {
    const confirmed = {
      text: point.text,
      address: point.address,
      lat: point.lat,
      lng: point.lng,
      placeId: point.placeId ?? null,
      originalLat: point.originalLat ?? null,
      originalLng: point.originalLng ?? null,
      walkMeters: point.walkMeters,
      isAccessiblePickup: point.isAccessiblePickup,
    };

    setOriginPoint(confirmed);
    setOriginInput(confirmed.text);
    setOriginSuggestions([]);
  }

  async function applyMovedOriginFromMap(payload: MapPointMovedPayload): Promise<void> {
    if (payload.point !== "origin") return;

    setSubmitError(null);

    try {
      const moved = await resolveMovedOriginPoint({
        lat: payload.lat,
        lng: payload.lng,
        text: payload.text,
        address: payload.address,
      });

      applyOrigin(moved);
    } catch {
      const fallbackPoint: PickerResult = {
        text: payload.text || "Punto elegido en el mapa",
        address: payload.address || "Ubicación seleccionada manualmente",
        lat: payload.lat,
        lng: payload.lng,
        placeId: null,
        originalLat: payload.lat,
        originalLng: payload.lng,
        walkMeters: 0,
        isAccessiblePickup: false,
      };

      applyOrigin(fallbackPoint);
    }
  }

  function applyDestination(point: PickerResult): void {
    const confirmed = {
      text: point.text.replace("Recogida en ", ""),
      address: point.address,
      lat: point.lat,
      lng: point.lng,
      placeId: point.placeId ?? null,
      originalLat: null,
      originalLng: null,
      walkMeters: 0,
      isAccessiblePickup: false,
    };

    setDestinationPoint(confirmed);
    setDestInput(confirmed.text);
    setDestSuggestions([]);
  }

  async function pickOrigin(suggestion: GoogleSuggestion): Promise<void> {
    const details = await getPlaceDetails(suggestion.placeId);
    if (!details) return;

    applyOrigin(details);
  }

  async function pickDestination(suggestion: GoogleSuggestion): Promise<void> {
    const details = await getPlaceDetailsExact(suggestion.placeId);
    if (!details) return;

    applyDestination(details);
  }

  function handleUseCurrentLocation(): void {
    if (!navigator.geolocation) {
      setSubmitError("Tu navegador no permite obtener ubicación.");
      return;
    }

    setLocating(true);
    setSubmitError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const gpsPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          placeId: null,
        };

        /*
         * No confirmamos automáticamente.
         * Abrimos el mismo selector tipo Uber centrado en la ubicación real,
         * para que Rapa Go busque la calle accesible y el usuario confirme.
         */
        setOriginPoint({
          text: "Mi ubicación actual",
          address: "Ubicación GPS detectada",
          lat: gpsPoint.lat,
          lng: gpsPoint.lng,
          placeId: null,
          originalLat: gpsPoint.lat,
          originalLng: gpsPoint.lng,
          walkMeters: 0,
          isAccessiblePickup: false,
        });

        setOriginInput("Mi ubicación actual");
        setOriginSuggestions([]);
            setPickerTarget("origin");
        setLocating(false);
      },
      () => {
        setLocating(false);
        setSubmitError(
          "No se pudo obtener tu ubicación. Activa el GPS y vuelve a intentar.",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      },
    );
  }

  async function resolveTypedPoints(): Promise<{
    origin: ConfirmedPoint | null;
    destination: ConfirmedPoint | null;
  }> {
    let resolvedOrigin = originPoint;
    let resolvedDestination = destinationPoint;

    if (!resolvedOrigin && originInput.trim()) {
      const geocoded = await geocodeText(originInput.trim());

      if (geocoded) {
        resolvedOrigin = {
          text: geocoded.text,
          address: geocoded.address,
          lat: geocoded.lat,
          lng: geocoded.lng,
          placeId: geocoded.placeId ?? null,
          originalLat: geocoded.originalLat ?? null,
          originalLng: geocoded.originalLng ?? null,
          walkMeters: geocoded.walkMeters,
          isAccessiblePickup: geocoded.isAccessiblePickup,
        };
        setOriginPoint(resolvedOrigin);
      }
    }

    if (!resolvedDestination && destInput.trim()) {
      const geocoded = await geocodeTextExact(destInput.trim());

      if (geocoded) {
        resolvedDestination = {
          text: geocoded.text,
          address: geocoded.address,
          lat: geocoded.lat,
          lng: geocoded.lng,
          placeId: geocoded.placeId ?? null,
          originalLat: geocoded.originalLat ?? null,
          originalLng: geocoded.originalLng ?? null,
          walkMeters: geocoded.walkMeters,
          isAccessiblePickup: geocoded.isAccessiblePickup,
        };
        setDestinationPoint(resolvedDestination);
      }
    }

    return {
      origin: resolvedOrigin,
      destination: resolvedDestination,
    };
  }

  async function handleRequest(): Promise<void> {
    if (!session?.accessToken) return;

    const resolved = await resolveTypedPoints();

    if (!resolved.origin || !resolved.destination) {
      setSubmitError("Origen y destino son requeridos.");
      return;
    }

    if (rideMode === "scheduled" && !scheduledAt) {
      setSubmitError("Debes seleccionar fecha y hora de recogida.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const notes: string[] = [];

      if (rideMode === "scheduled") {
        notes.push(`Viaje programado para: ${scheduledAt}.`);

        if (flightNumber.trim()) {
          notes.push(`Número de vuelo: ${flightNumber.trim()}.`);
        }
      }

      notes.push(`Dirección origen confirmada: ${resolved.origin.address}.`);
      notes.push(`Dirección destino confirmada: ${resolved.destination.address}.`);

      if (
        resolved.origin.originalLat != null &&
        resolved.origin.originalLng != null &&
        resolved.origin.walkMeters != null &&
        resolved.origin.walkMeters > 8
      ) {
        notes.push(
          `Ubicación real del pasajero: ${resolved.origin.originalLat.toFixed(6)}, ${resolved.origin.originalLng.toFixed(6)}.`,
        );
        notes.push(
          `Punto accesible de recogida ajustado a calle. El pasajero debe caminar aprox. ${resolved.origin.walkMeters} m.`,
        );
      }

      notes.push(
        `Coordenadas recogida accesible: ${resolved.origin.lat.toFixed(6)}, ${resolved.origin.lng.toFixed(6)}.`,
      );
      notes.push(
        `Coordenadas destino accesible: ${resolved.destination.lat.toFixed(6)}, ${resolved.destination.lng.toFixed(6)}.`,
      );

      if (notesInput.trim()) {
        notes.push(notesInput.trim());
      }

      const input: CreateRideInput = {
        originText: resolved.origin.text,
        destinationText: resolved.destination.text,
      };

      if (notes.length > 0) {
        input.notes = notes.join(" ");
      }

      await ridesService.createRideRequest(
        session.accessToken,
        input,
      );

      setOriginPoint(null);
      setDestinationPoint(null);
      setOriginInput("");
      setDestInput("");
      setNotesInput("");
      setScheduledAt("");
      setFlightNumber("");
      setOriginSuggestions([]);
      setDestSuggestions([]);
      setRideMode("now");

      history.push("/passenger/trips");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Error al solicitar el viaje.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const canRequest =
    (!!originPoint || !!originInput.trim()) &&
    (!!destinationPoint || !!destInput.trim()) &&
    (rideMode === "now" || !!scheduledAt) &&
    !submitting;

  const mapOrigin = useMemo(
    () => ({
      text: originPoint?.text ?? originInput.trim() ?? "Origen",
      lat: originPoint?.lat ?? null,
      lng: originPoint?.lng ?? null,
      placeId: originPoint?.placeId ?? null,
      originalLat: originPoint?.originalLat ?? null,
      originalLng: originPoint?.originalLng ?? null,
      walkMeters: originPoint?.walkMeters ?? null,
      isAccessiblePickup: originPoint?.isAccessiblePickup ?? null,
    }),
    [originInput, originPoint],
  );

  const mapDestination = useMemo(
    () => ({
      text: destinationPoint?.text ?? destInput.trim() ?? "Destino",
      lat: destinationPoint?.lat ?? null,
      lng: destinationPoint?.lng ?? null,
      placeId: destinationPoint?.placeId ?? null,
    }),
    [destInput, destinationPoint],
  );

  const pickerInitialPoint =
    pickerTarget === "origin"
      ? originPoint
      : pickerTarget === "destination"
        ? destinationPoint
        : null;
return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Solicitar Viaje</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <div
          style={{
            maxWidth: "430px",
            minHeight: "100%",
            margin: "0 auto",
            background: "#111111",
            paddingBottom: "90px",
          }}
        >
          <MapFallback
            origin={mapOrigin}
            destination={mapDestination}
            height={320}
            showRoute
            originDraggable
            onOriginChange={(payload) => {
              void applyMovedOriginFromMap(payload);
            }}
          />

          <div
            style={{
              padding: "18px 16px 20px",
              borderTop: "1px solid rgba(255,255,255,.04)",
            }}
          >
            <div style={sectionLabelStyle()}>Origen</div>

            <IonItem lines="none" style={inputItemStyle()}>
              <IonIcon icon={locationOutline} slot="start" color="medium" />
              <IonInput
                value={originInput}
                placeholder="¿Dónde te recogemos?"
                onIonFocus={() => {
                  if (suppressPickerOpenRef.current) return;
                  setPickerTarget("origin");
                }}
                onIonInput={(event) => {
                  setOriginInput(String(event.detail.value ?? ""));
                  setOriginPoint(null);
                              }}
                clearInput
              />
              {searchingOrigin && <IonSpinner name="dots" slot="end" />}
            </IonItem>

            <SuggestionList
              suggestions={originSuggestions}
              onPick={(suggestion) => void pickOrigin(suggestion)}
            />

            {originPoint?.walkMeters != null && originPoint.walkMeters > 8 && (
              <div
                style={{
                  margin: "-6px 0 14px",
                  background: "rgba(210,164,58,.12)",
                  border: "1px solid rgba(210,164,58,.35)",
                  color: "#F6F2EC",
                  borderRadius: "12px",
                  padding: "10px 12px",
                  fontSize: ".78rem",
                  lineHeight: 1.35,
                }}
              >
                <strong>Punto accesible recomendado:</strong>{" "}
                el conductor te recoge en {originPoint.text}. Camina aprox.{" "}
                {originPoint.walkMeters} m hasta la calle. En el mapa verás tu punto real
                en azul y la recogida accesible como 🚗.
              </div>
            )}

            <IonButton
              fill="clear"
              size="small"
              onClick={() => {
                if (suppressPickerOpenRef.current) return;
                setPickerTarget("origin");
              }}
              style={
                {
                  margin: "-4px 0 10px",
                  "--color": "#D2A43A",
                  fontWeight: 900,
                  letterSpacing: ".02em",
                } as CSSProperties
              }
            >
              <IonIcon icon={navigateOutline} slot="start" />
              Elegir punto en el mapa
            </IonButton>

            <IonButton
              fill="clear"
              size="small"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              style={
                {
                  margin: "-4px 0 22px",
                  "--color": "#D2A43A",
                  fontWeight: 900,
                  letterSpacing: ".02em",
                } as CSSProperties
              }
            >
              {locating ? (
                <IonSpinner name="dots" />
              ) : (
                <>
                  <IonIcon icon={locateOutline} slot="start" />
                  Usar mi ubicación actual
                </>
              )}
            </IonButton>

            <div style={sectionLabelStyle()}>Destino</div>

            <IonItem lines="none" style={inputItemStyle({ marginBottom: "14px" })}>
              <IonIcon icon={flagOutline} slot="start" color="medium" />
              <IonInput
                value={destInput}
                placeholder="¿A dónde vas?"
                onIonFocus={() => {
                  // El destino se escribe y se selecciona con sugerencias.
                  // No abrimos mapa para destino.
                }}
                onIonInput={(event) => {
                  setDestInput(String(event.detail.value ?? ""));
                  setDestinationPoint(null);
                              }}
                clearInput
              />
              {searchingDest && <IonSpinner name="dots" slot="end" />}
            </IonItem>

            <SuggestionList
              suggestions={destSuggestions}
              onPick={(suggestion) => void pickDestination(suggestion)}
            />

            <div style={sectionLabelStyle()}>Tipo de viaje</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                marginBottom: "18px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setRideMode("now");
                  setSubmitError(null);
                }}
                style={{
                  background: "transparent",
                  color: rideMode === "now" ? "#4fa3d9" : "rgba(246,242,236,.52)",
                  border: "0",
                  borderBottom:
                    rideMode === "now" ? "2px solid #4fa3d9" : "1px solid #333",
                  padding: "12px",
                  fontWeight: 900,
                  letterSpacing: ".03em",
                }}
              >
                AHORA
              </button>

              <button
                type="button"
                onClick={() => {
                  setRideMode("scheduled");
                  setSubmitError(null);
                }}
                style={{
                  background: "transparent",
                  color:
                    rideMode === "scheduled" ? "#4fa3d9" : "rgba(246,242,236,.52)",
                  border: "0",
                  borderBottom:
                    rideMode === "scheduled"
                      ? "2px solid #4fa3d9"
                      : "1px solid #333",
                  padding: "12px",
                  fontWeight: 900,
                  letterSpacing: ".03em",
                }}
              >
                PROGRAMAR
              </button>
            </div>

            {rideMode === "scheduled" && (
              <div
                style={{
                  background: "#f4f6fb",
                  borderRadius: "12px",
                  padding: "14px",
                  marginBottom: "18px",
                }}
              >
                <div
                  style={{
                    color: "#666",
                    fontSize: "0.72rem",
                    fontWeight: 900,
                    marginBottom: "6px",
                    textTransform: "uppercase",
                  }}
                >
                  Fecha y hora de recogida
                </div>

                <IonItem
                  lines="none"
                  style={
                    {
                      "--background": "#ffffff",
                      "--border-radius": "12px",
                      "--padding-start": "14px",
                      "--inner-padding-end": "12px",
                      "--min-height": "48px",
                      marginBottom: "8px",
                    } as CSSProperties
                  }
                >
                  <IonIcon icon={calendarOutline} slot="end" color="medium" />
                  <IonInput
                    type="datetime-local"
                    value={scheduledAt}
                    onIonInput={(event) =>
                      setScheduledAt(String(event.detail.value ?? ""))
                    }
                  />
                </IonItem>

                <IonNote
                  style={{
                    fontSize: "0.72rem",
                    display: "block",
                    marginBottom: "14px",
                  }}
                >
                  Mínimo 30 min desde ahora · Máximo 30 días
                </IonNote>

                <div
                  style={{
                    color: "#666",
                    fontSize: "0.72rem",
                    fontWeight: 900,
                    marginBottom: "6px",
                    textTransform: "uppercase",
                  }}
                >
                  Número de vuelo opcional
                </div>

                <IonItem
                  lines="none"
                  style={
                    {
                      "--background": "#ffffff",
                      "--border-radius": "12px",
                      "--padding-start": "14px",
                      "--inner-padding-end": "12px",
                      "--min-height": "48px",
                      marginBottom: "12px",
                    } as CSSProperties
                  }
                >
                  <IonIcon icon={timeOutline} slot="start" color="medium" />
                  <IonInput
                    value={flightNumber}
                    placeholder="Ej: LA800"
                    onIonInput={(event) =>
                      setFlightNumber(String(event.detail.value ?? ""))
                    }
                  />
                </IonItem>

                <div
                  style={{
                    background: "#ffc928",
                    color: "#111",
                    borderRadius: "8px",
                    padding: "12px",
                    fontSize: "0.8rem",
                    lineHeight: 1.45,
                  }}
                >
                  ⚡ <strong>Reserva con prioridad.</strong> El sistema aplica un
                  recargo por programación prioritaria. El monto se mostrará en la
                  tarifa al confirmar.
                </div>
              </div>
            )}

            <div style={sectionLabelStyle()}>Notas opcional</div>

            <IonItem
              lines="none"
              style={inputItemStyle({ marginBottom: "18px" })}
            >
              <IonTextarea
                value={notesInput}
                placeholder="Ej: Llevar maletas grandes"
                rows={3}
                maxlength={500}
                onIonInput={(event) =>
                  setNotesInput(String(event.detail.value ?? ""))
                }
              />
            </IonItem>

            {session?.accessToken && (
              <LegalCompactSection token={session.accessToken} />
            )}

            {submitError && (
              <IonText color="danger">
                <p style={{ fontWeight: 700, fontSize: ".84rem" }}>
                  {submitError}
                </p>
              </IonText>
            )}

            <IonButton
              expand="block"
              onClick={() => void handleRequest()}
              disabled={!canRequest}
              style={
                {
                  "--background": "#D2A43A",
                  "--background-activated": "#B98B2C",
                  "--color": "#111111",
                  "--border-radius": "12px",
                  height: "48px",
                  fontWeight: 900,
                  letterSpacing: ".03em",
                  boxShadow: "0 10px 25px rgba(210,164,58,.25)",
                } as CSSProperties
              }
            >
              {submitting ? <IonSpinner name="dots" /> : "SOLICITAR VIAJE"}
            </IonButton>
          </div>
        </div>

        <MapPointPicker
          isOpen={pickerTarget === "origin"}
          title="Confirma el punto de partida"
          mode="origin"
          initialPoint={originPoint}
          onCancel={() => setPickerTarget(null)}
          onConfirm={(point) => {
            suppressPickerOpenRef.current = true;

            applyOrigin(point);
            setPickerTarget(null);

            window.setTimeout(() => {
              suppressPickerOpenRef.current = false;
            }, 900);
          }}
        />
      </IonContent>
    </IonPage>
  );
}
