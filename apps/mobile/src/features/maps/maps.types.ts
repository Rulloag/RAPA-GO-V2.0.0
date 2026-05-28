export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapMarkerOptions {
  position: LatLng;
  title?:   string;
}

export interface MapViewOptions {
  center:  LatLng;
  zoom?:   number;
  markers?: MapMarkerOptions[];
}

export type MapLoadStatus = "idle" | "loading" | "loaded" | "error" | "no-key";

// ── Google Maps instance types ───────────────────────────────────────────────
// Minimal ambient declarations — avoids installing @types/google.maps.
// Only the subset used by this feature is declared here.

export interface GoogleMapInstance {
  setCenter(latLng: unknown): void;
  setZoom(zoom: number): void;
}

export interface GoogleMarkerInstance {
  setMap(map: GoogleMapInstance | null): void;
  setPosition(latLng: unknown): void;
}

declare global {
  interface Window {
    google?: {
      maps?: {
        Map:    new (container: HTMLElement, opts: Record<string, unknown>) => GoogleMapInstance;
        Marker: new (opts: Record<string, unknown>) => GoogleMarkerInstance;
        LatLng: new (lat: number, lng: number) => unknown;
      };
    };
  }
}

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
