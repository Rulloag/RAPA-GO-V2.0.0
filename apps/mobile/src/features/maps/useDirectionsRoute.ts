import { useState, useRef, useCallback } from "react";
import type {
  LatLng,
  RouteState,
  RouteStatus,
  RouteSummary,
  GoogleMapInstance,
  GoogleDirectionsService,
  GoogleDirectionsRenderer,
} from "./maps.types.js";

const IDLE: RouteState = { status: "idle", summary: null, error: null };

function set(status: RouteStatus, summary: RouteSummary | null, error: string | null): RouteState {
  return { status, summary, error };
}

/**
 * Calculates and renders a driving route using Google Maps DirectionsService.
 *
 * Service and renderer are created lazily on the first calculate() call and
 * reused across re-renders. The renderer is attached to the provided map instance.
 *
 * Nothing is sent to the backend. Coordinates stay in React state/refs only.
 *
 * Ready to be wired into RequestRidePage in Phase 4.
 */
export function useDirectionsRoute(): RouteState & {
  calculate: (origin: LatLng, destination: LatLng, map: GoogleMapInstance) => Promise<void>;
  clear:     () => void;
} {
  const [state, setState] = useState<RouteState>(IDLE);

  const serviceRef  = useRef<GoogleDirectionsService | null>(null);
  const rendererRef = useRef<GoogleDirectionsRenderer | null>(null);

  const calculate = useCallback(async (
    origin:      LatLng,
    destination: LatLng,
    map:         GoogleMapInstance,
  ): Promise<void> => {
    const mapsApi = window.google?.maps;
    if (!mapsApi?.DirectionsService || !mapsApi.DirectionsRenderer) {
      setState(set("error", null, "Google Maps SDK no está disponible o las clases de rutas no cargaron."));
      return;
    }

    // Lazy-create service and renderer (once per hook instance)
    if (!serviceRef.current) {
      serviceRef.current = new mapsApi.DirectionsService();
    }
    if (!rendererRef.current) {
      rendererRef.current = new mapsApi.DirectionsRenderer({
        suppressMarkers:  false,
        preserveViewport: false,
        polylineOptions: {
          strokeColor:   "var(--ion-color-primary, #3880ff)",
          strokeWeight:  5,
          strokeOpacity: 0.85,
        },
      });
    }

    // Attach renderer to the current map
    rendererRef.current.setMap(map);
    setState(set("loading", null, null));

    try {
      const result = await serviceRef.current.route({
        origin:      new mapsApi.LatLng!(origin.lat, origin.lng),
        destination: new mapsApi.LatLng!(destination.lat, destination.lng),
        travelMode:  mapsApi.TravelMode!.DRIVING,
      });

      rendererRef.current.setDirections(result);

      const leg = result.routes[0]?.legs[0];
      if (!leg?.distance || !leg.duration) {
        setState(set("error", null, "La ruta no devolvió distancia o duración."));
        return;
      }

      setState(set("success", {
        distanceText:  leg.distance.text,
        distanceValue: leg.distance.value,
        durationText:  leg.duration.text,
        durationValue: leg.duration.value,
      }, null));
    } catch (err) {
      // DirectionsService throws a status string (e.g. "ZERO_RESULTS", "NOT_FOUND")
      // or an Error object on network failure.
      const raw = err instanceof Error ? err.message : String(err);
      const friendly = friendlyDirectionsError(raw);
      setState(set("error", null, friendly));
    }
  }, []);

  const clear = useCallback((): void => {
    rendererRef.current?.setMap(null);
    setState(IDLE);
  }, []);

  return { ...state, calculate, clear };
}

// ── Error messages ───────────────────────────────────────────────────────────

function friendlyDirectionsError(raw: string): string {
  if (/ZERO_RESULTS/i.test(raw))    return "No se encontró una ruta entre los puntos seleccionados.";
  if (/NOT_FOUND/i.test(raw))       return "Uno de los puntos no pudo ser ubicado en el mapa.";
  if (/MAX_WAYPOINTS/i.test(raw))   return "Demasiados puntos intermedios en la ruta.";
  if (/INVALID_REQUEST/i.test(raw)) return "Solicitud de ruta inválida. Verifica origen y destino.";
  if (/OVER_QUERY_LIMIT/i.test(raw)) return "Límite de consultas alcanzado. Intenta más tarde.";
  if (/REQUEST_DENIED/i.test(raw))  return "La API Key no tiene permisos para Directions API.";
  return `No se pudo calcular la ruta. (${raw})`;
}
