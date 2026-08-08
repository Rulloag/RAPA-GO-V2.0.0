import { Preferences } from "@capacitor/preferences";
import type { NavigationRoute } from "./navigationRoute.types.js";
import { isValidStoredRoute } from "./routeSerialization.js";

/**
 * Caché de rutas en dos niveles.
 *
 * L1 (memoria) no es una optimización, es un requisito: el render es síncrono y
 * no se puede hacer `await` de una lectura de disco dentro de un render sin
 * provocar un parpadeo en el que la ruta desaparece — justo el síntoma que
 * este módulo existe para eliminar.
 *
 * L2 usa `@capacitor/preferences` porque es almacenamiento nativo
 * (SharedPreferences en Android, UserDefaults en iOS): sobrevive al cierre de
 * la app y no lo desaloja el WebView bajo presión de almacenamiento, a
 * diferencia de localStorage o IndexedDB. El working set es de ~4 KB por ruta
 * y como máximo 5 rutas, así que una base de datos sería peso muerto.
 */

const STORAGE_KEY = "rapago_navigation_routes_v1";
const MAX_CACHED_ROUTES = 5;
const WRITE_DEBOUNCE_MS = 400;

const memory = new Map<string, NavigationRoute>();

let hydration: Promise<void> | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Lee de Preferences con vuelta atrás a localStorage.
 *
 * En el navegador de desarrollo y en los tests el plugin nativo no está
 * registrado y lanza; la persistencia es un extra, nunca debe romper el mapa.
 */
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
    // Sin almacenamiento persistente la ruta sigue viva en memoria.
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

/** Rutas más recientes primero, recortadas al tope. */
function currentRoutes(): NavigationRoute[] {
  return Array.from(memory.values())
    .sort((a, b) => b.computedAt - a.computedAt)
    .slice(0, MAX_CACHED_ROUTES);
}

function scheduleFlush(): void {
  if (writeTimer) clearTimeout(writeTimer);

  writeTimer = setTimeout(() => {
    writeTimer = null;
    void writeRaw(JSON.stringify(currentRoutes()));
  }, WRITE_DEBOUNCE_MS);
}

/**
 * Carga el disco en memoria. Idempotente: llamarlo de más no cuesta nada.
 * Debe ejecutarse antes del primer render del mapa para que una app reabierta
 * sin señal ya tenga la ruta disponible de forma síncrona.
 */
export function hydrateRouteCache(): Promise<void> {
  if (hydration) return hydration;

  hydration = (async () => {
    const raw = await readRaw();
    if (!raw) return;

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      for (const entry of parsed) {
        // Descarta entradas de un esquema anterior en vez de romper el render.
        if (isValidStoredRoute(entry) && !memory.has(entry.key)) {
          memory.set(entry.key, { ...entry, source: "storage" });
        }
      }
    } catch {
      // Contenido corrupto: se ignora y se recalculará cuando haya red.
    }
  })();

  return hydration;
}

/** Lectura síncrona desde L1. Devuelve null si aún no se hidrató o no existe. */
export function getCachedRoute(key: string): NavigationRoute | null {
  return memory.get(key) ?? null;
}

/** Guarda en L1 al instante y programa la escritura a disco. */
export function saveRoute(route: NavigationRoute): void {
  memory.set(route.key, route);

  // Mantiene el tope también en memoria, no solo al escribir.
  if (memory.size > MAX_CACHED_ROUTES) {
    const keep = new Set(currentRoutes().map((entry) => entry.key));
    for (const key of memory.keys()) {
      if (!keep.has(key)) memory.delete(key);
    }
  }

  scheduleFlush();
}

/**
 * Borra toda la caché, en memoria y en disco.
 * Se llama al cerrar sesión: las rutas revelan el origen y el destino de los
 * viajes y no deben sobrevivir a un cambio de cuenta en el mismo teléfono.
 */
export async function clearRouteCache(): Promise<void> {
  memory.clear();

  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }

  hydration = null;

  await removeRaw();
}

/** Solo para tests: vacía L1 sin tocar el disco. */
export function resetRouteCacheForTests(): void {
  memory.clear();
  hydration = null;

  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
}
