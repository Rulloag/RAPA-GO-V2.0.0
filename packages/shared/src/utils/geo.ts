export const RAPA_NUI_MAP_CENTER = {
  lat: -27.1505,
  lng: -109.4325,
} as const;

/** Caja operativa un poco más amplia que Hanga Roa para no cortar GPS costero. */
export const RAPA_NUI_MAP_BOUNDS = {
  north: -26.98,
  south: -27.3,
  west: -109.52,
  east: -109.12,
} as const;

const NULL_ISLAND_EPSILON = 1e-5;
const MAX_GPS_JUMP_METERS = 20_000;
const MAX_GPS_SPEED_MPS = 80;
const MIN_TRACK_MOVE_METERS = 2;

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type GpsTrackPoint = GeoPoint & {
  capturedAt?: string | null;
  accuracyMeters?: number | null;
};

/**
 * Convierte lat/lng a un punto usable.
 * `Number(null) === 0` (Null Island / Golfo de Guinea): por eso null/undefined
 * se tratan como ausentes y no como (0, 0).
 */
export function parseLatLng(
  lat: unknown,
  lng: unknown,
): GeoPoint | null {
  if (lat == null || lng == null || lat === "" || lng === "") return null;

  const latitude = typeof lat === "number" ? lat : Number(lat);
  const longitude = typeof lng === "number" ? lng : Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  if (
    Math.abs(latitude) < NULL_ISLAND_EPSILON &&
    Math.abs(longitude) < NULL_ISLAND_EPSILON
  ) {
    return null;
  }

  return { lat: latitude, lng: longitude };
}

export function isRapaNuiMapPoint(point: GeoPoint): boolean {
  return (
    point.lat <= RAPA_NUI_MAP_BOUNDS.north &&
    point.lat >= RAPA_NUI_MAP_BOUNDS.south &&
    point.lng >= RAPA_NUI_MAP_BOUNDS.west &&
    point.lng <= RAPA_NUI_MAP_BOUNDS.east
  );
}

export function isValidRideMapPoint(lat: unknown, lng: unknown): boolean {
  const point = parseLatLng(lat, lng);
  return point != null && isRapaNuiMapPoint(point);
}

export function haversineMeters(from: GeoPoint, to: GeoPoint): number {
  const radius = 6_371_000;
  const toRad = (value: number): number => (value * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

export function isImpossibleGpsJump(
  from: GeoPoint,
  to: GeoPoint,
  elapsedMs?: number | null,
): boolean {
  const distance = haversineMeters(from, to);
  if (distance > MAX_GPS_JUMP_METERS) return true;
  if (elapsedMs != null && elapsedMs > 0 && elapsedMs < 120_000) {
    return distance / (elapsedMs / 1000) > MAX_GPS_SPEED_MPS;
  }
  return false;
}

export function filterGpsTrack<T extends GpsTrackPoint>(points: T[]): T[] {
  const filtered: T[] = [];

  for (const point of points) {
    const parsed = parseLatLng(point.lat, point.lng);
    if (!parsed || !isRapaNuiMapPoint(parsed)) continue;

    const accuracy = point.accuracyMeters;
    if (accuracy != null && Number.isFinite(accuracy) && accuracy > 250) {
      continue;
    }

    const last = filtered[filtered.length - 1];
    if (last) {
      const lastPoint = { lat: last.lat, lng: last.lng };
      const distance = haversineMeters(lastPoint, parsed);
      if (distance < MIN_TRACK_MOVE_METERS) continue;

      const elapsedMs =
        last.capturedAt && point.capturedAt
          ? new Date(point.capturedAt).getTime() -
            new Date(last.capturedAt).getTime()
          : null;
      if (isImpossibleGpsJump(lastPoint, parsed, elapsedMs)) continue;
    }

    filtered.push({ ...point, lat: parsed.lat, lng: parsed.lng });
  }

  return filtered;
}

export function trackDistanceMeters(points: GeoPoint[]): number {
  if (points.length < 2) return 0;
  return points.reduce((total, point, index) => {
    const previous = points[index - 1];
    return previous ? total + haversineMeters(previous, point) : total;
  }, 0);
}

export function areMapBoundsSane(points: GeoPoint[]): boolean {
  if (points.length === 0) return false;
  let maxSpan = 0;
  for (let i = 0; i < points.length; i += 1) {
    const first = points[i];
    if (!first) continue;
    for (let j = i + 1; j < points.length; j += 1) {
      const second = points[j];
      if (!second) continue;
      maxSpan = Math.max(maxSpan, haversineMeters(first, second));
      if (maxSpan > MAX_GPS_JUMP_METERS) return false;
    }
  }
  return true;
}
