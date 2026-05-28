// ── Coordinates & map options ────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapMarkerOptions {
  position: LatLng;
  title?:   string;
}

export interface MapViewOptions {
  center:   LatLng;
  zoom?:    number;
  markers?: MapMarkerOptions[];
}

// A named location with coordinates — used for route origin/destination
export interface MapPoint {
  label:    string;
  position: LatLng;
}

// ── SDK load status ──────────────────────────────────────────────────────────

export type MapLoadStatus = "idle" | "loading" | "loaded" | "error" | "no-key";

// ── Geolocation ──────────────────────────────────────────────────────────────

export type LocationStatus =
  | "idle"
  | "requesting_permission"
  | "loading"
  | "success"
  | "denied"
  | "error";

export interface LocationState {
  status:   LocationStatus;
  location: LatLng | null;
  error:    string | null;
}

// ── Directions / route ───────────────────────────────────────────────────────

export type RouteStatus = "idle" | "loading" | "success" | "error";

export interface RouteSummary {
  distanceText:  string;  // e.g. "3.2 km"
  distanceValue: number;  // meters
  durationText:  string;  // e.g. "8 min"
  durationValue: number;  // seconds
}

export interface RouteState {
  status:  RouteStatus;
  summary: RouteSummary | null;
  error:   string | null;
}

// ── Google Maps instance types (minimal ambient, no @types/google.maps) ──────

export interface GoogleMapInstance {
  setCenter(latLng: unknown): void;
  setZoom(zoom: number): void;
}

export interface GoogleMarkerInstance {
  setMap(map: GoogleMapInstance | null): void;
  setPosition(latLng: unknown): void;
}

export interface GoogleDirectionsResult {
  routes: Array<{
    legs: Array<{
      distance: { text: string; value: number };
      duration: { text: string; value: number };
    }>;
  }>;
}

export interface GoogleDirectionsService {
  route(request: Record<string, unknown>): Promise<GoogleDirectionsResult>;
}

export interface GoogleDirectionsRenderer {
  setMap(map: GoogleMapInstance | null): void;
  setDirections(result: GoogleDirectionsResult): void;
}

declare global {
  interface Window {
    google?: {
      maps?: {
        Map:               new (container: HTMLElement, opts: Record<string, unknown>) => GoogleMapInstance;
        Marker:            new (opts: Record<string, unknown>) => GoogleMarkerInstance;
        LatLng:            new (lat: number, lng: number) => unknown;
        DirectionsService: new () => GoogleDirectionsService;
        DirectionsRenderer: new (opts?: Record<string, unknown>) => GoogleDirectionsRenderer;
        TravelMode: {
          DRIVING:   string;
          WALKING:   string;
          BICYCLING: string;
          TRANSIT:   string;
        };
      };
    };
  }
}
