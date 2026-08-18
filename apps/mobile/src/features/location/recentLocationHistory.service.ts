/** Ubicaciones recientes del pasajero (origen/destino). No confundir con favoritos. */

export const RECENT_LOCATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const RECENT_LOCATION_MAX_VISIBLE = 5;

const STORAGE_KEY = "rapago_recent_locations_v1";

export type RecentLocationRecord = {
  placeId: string | null;
  name: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  usedAt: string;
  expiresAt: string;
};

function readAll(): RecentLocationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RecentLocationRecord =>
        item != null &&
        typeof item === "object" &&
        typeof (item as RecentLocationRecord).name === "string" &&
        Number.isFinite(Number((item as RecentLocationRecord).lat)) &&
        Number.isFinite(Number((item as RecentLocationRecord).lng)),
    );
  } catch {
    return [];
  }
}

function writeAll(records: RecentLocationRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* Sin almacenamiento no se recuerda; la búsqueda sigue funcionando. */
  }
}

function purgeExpired(records: RecentLocationRecord[]): RecentLocationRecord[] {
  const now = Date.now();
  return records.filter((record) => {
    const expires = Date.parse(record.expiresAt);
    return Number.isFinite(expires) && expires > now;
  });
}

function recordKey(record: Pick<RecentLocationRecord, "placeId" | "name" | "lat" | "lng">): string {
  if (record.placeId) return `id:${record.placeId}`;
  return `coord:${record.lat.toFixed(5)}:${record.lng.toFixed(5)}:${record.name.trim().toLowerCase()}`;
}

export const recentLocationHistoryService = {
  remember(input: {
    placeId?: string | null;
    name: string;
    formattedAddress?: string | null;
    lat: number;
    lng: number;
  }): void {
    const name = String(input.name ?? "").trim();
    if (!name) return;
    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) return;

    const now = Date.now();
    const next: RecentLocationRecord = {
      placeId: input.placeId ?? null,
      name,
      formattedAddress: String(input.formattedAddress ?? name).trim() || name,
      lat: input.lat,
      lng: input.lng,
      usedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + RECENT_LOCATION_TTL_MS).toISOString(),
    };

    const key = recordKey(next);
    const withoutDuplicate = purgeExpired(readAll()).filter(
      (record) => recordKey(record) !== key,
    );

    writeAll([next, ...withoutDuplicate].slice(0, RECENT_LOCATION_MAX_VISIBLE * 4));
  },

  list(limit = RECENT_LOCATION_MAX_VISIBLE): RecentLocationRecord[] {
    return purgeExpired(readAll()).slice(0, limit);
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  },
};
