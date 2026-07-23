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

// ── Places Autocomplete ──────────────────────────────────────────────────────

export type PlaceAutocompleteStatus =
  | "idle"
  | "searching"
  | "selected"
  | "no_results"
  | "error";

export interface PlaceAutocompleteResult {
  label:    string;
  position: LatLng;
}

// ── Google Maps SDK instance aliases ─────────────────────────────────────────
//
// The project includes @types/google.maps. Reusing the official SDK types
// avoids incompatible duplicate declarations across maps, places and routes.

export type GoogleMapInstance = google.maps.Map;
export type GoogleMarkerInstance = google.maps.Marker;
export type GoogleDirectionsResult = google.maps.DirectionsResult;
export type GoogleDirectionsService = google.maps.DirectionsService;
export type GoogleDirectionsRenderer = google.maps.DirectionsRenderer;
export type GooglePlace = google.maps.places.PlaceResult;
export type GoogleAutocomplete = google.maps.places.Autocomplete;
