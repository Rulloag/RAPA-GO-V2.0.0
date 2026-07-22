import { useState, useRef, useCallback } from "react";
import type {
  MapPoint,
  GoogleMapInstance,
  GoogleDirectionsService,
  GoogleDirectionsRenderer,
} from "./maps.types.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface RouteSegmentResult {
  fromOrder:       number;
  toOrder:         number;
  distanceMeters:  number;
  durationSeconds: number;
  distanceText:    string;
  durationText:    string;
}

export type MultiStopStatus = "idle" | "loading" | "success" | "error";

export interface MultiStopState {
  status:               MultiStopStatus;
  segments:             RouteSegmentResult[];
  totalDistanceMeters:  number;
  totalDurationSeconds: number;
  error:                string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const IDLE: MultiStopState = {
  status:               "idle",
  segments:             [],
  totalDistanceMeters:  0,
  totalDurationSeconds: 0,
  error:                null,
};

const SEGMENT_COLORS = ["#3880ff", "#2dd36f", "#ffc409"] as const;

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useMultiStopRoute(): MultiStopState & {
  calculate: (origin: MapPoint, destinations: MapPoint[], map: GoogleMapInstance) => Promise<void>;
  clear:     () => void;
} {
  const [state, setState] = useState<MultiStopState>(IDLE);

  const serviceRef   = useRef<GoogleDirectionsService | null>(null);
  const renderersRef = useRef<GoogleDirectionsRenderer[]>([]);

  const clearRenderers = () => {
    for (const r of renderersRef.current) r.setMap(null);
    renderersRef.current = [];
  };

  const calculate = useCallback(async (
    origin:       MapPoint,
    destinations: MapPoint[],
    map:          GoogleMapInstance,
  ): Promise<void> => {
    if (destinations.length < 1) {
      setState({ ...IDLE, status: "error", error: "Debes seleccionar al menos un destino." });
      return;
    }
    if (destinations.length > 3) {
      setState({ ...IDLE, status: "error", error: "Máximo 3 destinos permitidos." });
      return;
    }

    const mapsApi = window.google?.maps;
    if (!mapsApi?.DirectionsService || !mapsApi.DirectionsRenderer) {
      setState({ ...IDLE, status: "error", error: "Google Maps SDK no está disponible o las clases de rutas no cargaron." });
      return;
    }

    if (!serviceRef.current) {
      serviceRef.current = new mapsApi.DirectionsService();
    }

    clearRenderers();
    setState({ ...IDLE, status: "loading" });

    const points: MapPoint[] = [origin, ...destinations];
    const segments: RouteSegmentResult[] = [];

    try {
      for (let i = 0; i < points.length - 1; i++) {
        const from = points[i];
        const to   = points[i + 1];
        if (!from || !to) continue;

        const renderer = new mapsApi.DirectionsRenderer({
          suppressMarkers:  false,
          preserveViewport: i > 0,
          polylineOptions: {
            strokeColor:   SEGMENT_COLORS[i] ?? "#3880ff",
            strokeWeight:  5,
            strokeOpacity: 0.85,
          },
        });
        renderer.setMap(map);
        renderersRef.current.push(renderer);

        const result = await serviceRef.current.route({
          origin:      new mapsApi.LatLng!(from.position.lat, from.position.lng),
          destination: new mapsApi.LatLng!(to.position.lat, to.position.lng),
          travelMode:  mapsApi.TravelMode!.DRIVING,
        });

        renderer.setDirections(result);

        const leg = result.routes[0]?.legs[0];
        if (!leg) throw new Error("La ruta no devolvió datos de tramo.");

        segments.push({
          fromOrder:       i,
          toOrder:         i + 1,
          distanceMeters:  leg.distance.value,
          durationSeconds: leg.duration.value,
          distanceText:    leg.distance.text,
          durationText:    leg.duration.text,
        });
      }

      setState({
        status:               "success",
        segments,
        totalDistanceMeters:  segments.reduce((s, seg) => s + seg.distanceMeters, 0),
        totalDurationSeconds: segments.reduce((s, seg) => s + seg.durationSeconds, 0),
        error:                null,
      });
    } catch (err) {
      clearRenderers();
      const raw      = err instanceof Error ? err.message : String(err);
      setState({ ...IDLE, status: "error", error: friendlyDirectionsError(raw) });
    }
  }, []);

  const clear = useCallback((): void => {
    clearRenderers();
    setState(IDLE);
  }, []);

  return { ...state, calculate, clear };
}

// ── Error messages ───────────────────────────────────────────────────────────

function friendlyDirectionsError(raw: string): string {
  if (/ZERO_RESULTS/i.test(raw))     return "No se encontró una ruta entre los puntos seleccionados.";
  if (/NOT_FOUND/i.test(raw))        return "Uno de los puntos no pudo ser ubicado en el mapa.";
  if (/MAX_WAYPOINTS/i.test(raw))    return "Demasiados puntos intermedios en la ruta.";
  if (/INVALID_REQUEST/i.test(raw))  return "Solicitud de ruta inválida. Verifica origen y destino.";
  if (/OVER_QUERY_LIMIT/i.test(raw)) return "Límite de consultas alcanzado. Intenta más tarde.";
  if (/REQUEST_DENIED/i.test(raw))   return "La API Key no tiene permisos para Directions API.";
  return `No se pudo calcular la ruta. (${raw})`;
}
