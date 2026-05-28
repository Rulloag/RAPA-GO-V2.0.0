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

// Minimal ambient types — avoids installing @types/google.maps as a hard dependency.
// Only the subset used by this feature is declared here.
declare global {
  interface Window {
    google?: {
      maps?: {
        Map:    new (container: HTMLElement, opts: Record<string, unknown>) => GoogleMapInstance;
        Marker: new (opts: Record<string, unknown>) => unknown;
        LatLng: new (lat: number, lng: number) => unknown;
      };
    };
  }
}

export interface GoogleMapInstance {
  setCenter(latLng: unknown): void;
  setZoom(zoom: number): void;
}
