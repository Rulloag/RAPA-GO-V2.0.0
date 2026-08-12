import { Preferences } from "@capacitor/preferences";
import { rideLocationService } from "./rideLocation.service.js";
import type { RapaGoLocationPoint } from "./location.types.js";

/**
 * Cola de puntos GPS que no se pudieron enviar.
 *
 * Sin esto, un punto que falla se pierde para siempre: `publish` no reintenta
 * y el servidor nunca se entera. En Rapa Nui la señal se cae constantemente, así
 * que el recorrido del pasajero queda con huecos y una línea recta entre ellos.
 *
 * Persiste en dos niveles, copiando el patrón ya establecido en
 * `navigation/routeCache.ts`: memoria (L1) para el uso normal y
 * `@capacitor/preferences` (L2, SharedPreferences/UserDefaults) para sobrevivir
 * a que el sistema mate la app. `localStorage` queda como respaldo para el
 * navegador de desarrollo y los tests.
 *
 * PRIVACIDAD: esto es historial de ubicación precisa guardado en disco. Se
 * vacía al terminar el viaje, al cerrar sesión y cuando el backend revoca la
 * sesión. La clave NO se añade a `PERSISTENT_UI_KEYS`, para que la limpieza de
 * almacenamiento del cliente se la lleve por delante.
 */

const STORAGE_KEY = "rapago_ride_location_queue_v1";

/**
 * Tope de la cola. 500 puntos a ~4 s por punto son algo más de media hora sin
 * señal; pasado eso se descartan los MÁS ANTIGUOS, porque para el pasajero
 * vale más el tramo reciente que el del principio.
 */
const MAX_QUEUED_POINTS = 500;

/** Debe coincidir con `MAX_LOCATION_BATCH_POINTS` del backend. */
const MAX_POINTS_PER_BATCH = 200;

export interface QueuedLocation {
  rideId: string;
  point: RapaGoLocationPoint;
}

let memory: QueuedLocation[] = [];
let hydrated = false;
let flushing = false;

async function readRaw(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    if (value != null) return value;
  } catch {
    // Plugin no disponible: se usa el respaldo de abajo.
  }

  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

async function writeRaw(value: string): Promise<void> {
  try {
    await Preferences.set({ key: STORAGE_KEY, value });
    return;
  } catch {
    // Plugin no disponible: se usa el respaldo de abajo.
  }

  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Sin almacenamiento persistente la cola sigue viva en memoria.
  }
}

async function removeRaw(): Promise<void> {
  try {
    await Preferences.remove({ key: STORAGE_KEY });
  } catch {
    // Sin plugin no hay nada nativo que borrar.
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada que limpiar.
  }
}

function isValidEntry(value: unknown): value is QueuedLocation {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.rideId !== "string" || entry.rideId.length === 0) {
    return false;
  }

  const point = entry.point as Record<string, unknown> | undefined;
  if (!point || typeof point !== "object") return false;

  return (
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    typeof point.lng === "number" &&
    Number.isFinite(point.lng) &&
    typeof point.capturedAt === "string"
  );
}

async function persist(): Promise<void> {
  if (memory.length === 0) {
    await removeRaw();
    return;
  }

  try {
    await writeRaw(JSON.stringify(memory));
  } catch {
    // Serializar no debería fallar; si falla, la cola sigue en memoria.
  }
}

/** Carga la cola guardada una sola vez por arranque de la app. */
async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;

  const raw = await readRaw();
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;

    // Se descarta lo corrupto en vez de tirar la cola entera: un solo registro
    // mal escrito no debe costar media hora de recorrido.
    memory = parsed.filter(isValidEntry).slice(-MAX_QUEUED_POINTS);
  } catch {
    memory = [];
  }
}

/**
 * Toma el siguiente lote: puntos consecutivos del MISMO viaje desde la cabeza.
 *
 * El endpoint es por viaje, así que un cambio de `rideId` corta el lote. Se
 * ordena por captura porque el backend construye su cursor antispam asumiendo
 * orden temporal.
 */
function nextBatch(): { rideId: string; points: RapaGoLocationPoint[]; count: number } | null {
  const head = memory[0];
  if (!head) return null;

  const points: RapaGoLocationPoint[] = [];
  let count = 0;

  for (const entry of memory) {
    if (entry.rideId !== head.rideId) break;
    if (count >= MAX_POINTS_PER_BATCH) break;
    points.push(entry.point);
    count += 1;
  }

  points.sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));

  return { rideId: head.rideId, points, count };
}

export const locationQueue = {
  /** Guarda un punto que no se pudo entregar. */
  async enqueue(rideId: string, point: RapaGoLocationPoint): Promise<void> {
    await hydrate();

    memory.push({ rideId, point });

    if (memory.length > MAX_QUEUED_POINTS) {
      memory = memory.slice(memory.length - MAX_QUEUED_POINTS);
    }

    await persist();
  },

  /**
   * Intenta entregar la cola por lotes.
   *
   * Devuelve `true` si quedó vacía. Se detiene en cuanto un lote pide
   * conservarse (401, 429, 5xx o red caída): seguir insistiendo con la red
   * caída solo gasta batería. El siguiente intento lo dispara el coordinador
   * al recuperar red o en su reconciliación periódica.
   */
  async flush(accessToken: string): Promise<boolean> {
    await hydrate();

    if (flushing) return memory.length === 0;
    if (memory.length === 0) return true;

    flushing = true;

    try {
      while (memory.length > 0) {
        const batch = nextBatch();
        if (!batch) break;

        const outcome = await rideLocationService.publishBatch(
          accessToken,
          batch.rideId,
          batch.points,
        );

        if (!outcome.drain) return false;

        // Se descartan exactamente los que se enviaron: durante el envío pudo
        // encolarse algún punto nuevo detrás.
        memory = memory.slice(batch.count);
        await persist();
      }

      return memory.length === 0;
    } catch {
      // Un fallo inesperado no puede vaciar la cola: se conserva para el
      // siguiente intento.
      return false;
    } finally {
      flushing = false;
    }
  },

  /** Cuántos puntos esperan entrega. */
  async size(): Promise<number> {
    await hydrate();
    return memory.length;
  },

  /**
   * Borra la cola. Se llama al cerrar el viaje, al cerrar sesión y cuando el
   * backend revoca la sesión: es historial de ubicación, no puede quedarse en
   * disco después de que deje de hacer falta.
   */
  async clear(): Promise<void> {
    hydrated = true;
    memory = [];
    await removeRaw();
  },

  /** Solo para tests. */
  __resetForTests(): void {
    memory = [];
    hydrated = false;
    flushing = false;
  },
};
