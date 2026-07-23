export interface PreSearchLocationSnapshot {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  capturedAt: string;
  expiresAt: string;
}

const STORAGE_KEY = "rapago_pre_search_location_v1";
const TTL_MS = 15 * 60 * 1000;

function storage(): Storage | null {
  return typeof window !== "undefined" ? window.sessionStorage : null;
}

function validCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export const preSearchLocationService = {
  remember(position: GeolocationPosition): PreSearchLocationSnapshot {
    const capturedAt = new Date(position.timestamp || Date.now());
    const snapshot: PreSearchLocationSnapshot = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
      capturedAt: capturedAt.toISOString(),
      expiresAt: new Date(capturedAt.getTime() + TTL_MS).toISOString(),
    };
    try { storage()?.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch { /* memoria efímera opcional */ }
    return snapshot;
  },

  read(): PreSearchLocationSnapshot | null {
    try {
      const raw = storage()?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<PreSearchLocationSnapshot>;
      if (
        !validCoordinate(parsed.lat, -90, 90) ||
        !validCoordinate(parsed.lng, -180, 180) ||
        !parsed.expiresAt ||
        Date.parse(parsed.expiresAt) <= Date.now()
      ) {
        storage()?.removeItem(STORAGE_KEY);
        return null;
      }
      return {
        lat: parsed.lat,
        lng: parsed.lng,
        accuracyMeters: typeof parsed.accuracyMeters === "number" ? parsed.accuracyMeters : null,
        capturedAt: String(parsed.capturedAt ?? new Date().toISOString()),
        expiresAt: parsed.expiresAt,
      };
    } catch {
      try { storage()?.removeItem(STORAGE_KEY); } catch { /* no bloquea */ }
      return null;
    }
  },

  clear(): void {
    try { storage()?.removeItem(STORAGE_KEY); } catch { /* no bloquea */ }
  },
};
