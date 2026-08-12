import { App } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { locationQueue } from "./locationQueue.js";
import { NativeBackgroundLocation } from "./nativeBackgroundLocation.plugin.js";
import { rideLocationService } from "./rideLocation.service.js";
import type {
  RapaGoLocationPoint,
  RapaGoPermissionSnapshot,
} from "./location.types.js";

/**
 * Dueño ÚNICO del seguimiento de ubicación del conductor.
 *
 * Antes había dos: `DriverLocationRuntime` (montado en el layout, sobrevive al
 * cambio de pestaña) y un efecto dentro de la página del conductor. Al navegar
 * a otra pestaña, el de la página se desmontaba y llamaba
 * `stopNativeBackground()` sin condición, matando el servicio nativo; el otro
 * creía que seguía vivo —lo deducía de un `useRef`— y nunca lo reiniciaba. El
 * seguimiento en segundo plano quedaba muerto el resto del viaje.
 *
 * Dos decisiones cierran ese agujero:
 *
 * 1. Esto es un MÓDULO, no un hook. No tiene `unmount`, así que ningún
 *    componente puede pararlo por accidente. Solo `setDesired(null)` para.
 * 2. Se reconcilia el estado DESEADO contra el estado REAL preguntándole al
 *    nativo con `getState()`, nunca contra una variable en memoria. Si algo
 *    mató el servicio por fuera, la siguiente reconciliación lo detecta y lo
 *    vuelve a levantar.
 */

const DRIVER_LOCATION_EVENT = "rapago:driver-native-location";
const LIVE_LOCATION_EVENT = "rapago:driver-live-location-updated";
const LIVE_LOCATION_KEY = "rapago_driver_live_locations_v1";
const CURRENT_LOCATION_KEY = "rapago_current_driver_location";

/** Ritmo mínimo de publicación cuando el publicador es la capa JS. */
const PUBLISH_MIN_INTERVAL_MS = 3500;
const PUBLISH_MIN_DISTANCE_M = 4;
/** Red de seguridad: relee el estado real del nativo aunque nada haya cambiado. */
const RECONCILE_INTERVAL_MS = 15_000;

export interface DesiredTracking {
  rideId: string;
  accessToken: string;
  permissions: RapaGoPermissionSnapshot | null;
  /** Datos del viaje para el puente de compatibilidad local. */
  ride: Record<string, unknown> | null;
}

type Publisher = "native" | "js" | "none";

export interface TrackingStatus {
  rideId: string | null;
  publisher: Publisher;
  message: string | null;
  /** El nativo tiene el token vencido pero sigue capturando y encolando. */
  authPaused: boolean;
}

type StatusListener = (status: TrackingStatus) => void;

let desired: DesiredTracking | null = null;
let publisher: Publisher = "none";
let message: string | null = null;

let stopWatch: (() => Promise<void>) | null = null;
let watchRideId: string | null = null;
let lastSent: { rideId: string; at: number; lat: number; lng: number } | null =
  null;

/**
 * Último token conocido, para poder intentar un drenado final cuando el viaje
 * ya terminó y `desired` es null. Sin esto, los puntos capturados en el último
 * tramo sin señal se quedarían en disco sin nadie que los enviara.
 */
let lastAccessToken: string | null = null;

/**
 * Último token que se le empujó al nativo, para no llamar a
 * `updateAccessToken` en cada reconciliación de 15 s cuando nada cambió.
 * Se limpia al cambiar de viaje: un token "empujado" para un viaje anterior no
 * cuenta para el nuevo, aunque coincida en valor.
 */
let nativePushedToken: string | null = null;
let authPaused = false;

let reconciling = false;
let reconcileQueued = false;
let listenersBound = false;
let appListener: PluginListenerHandle | null = null;
let networkListener: PluginListenerHandle | null = null;
let intervalId: number | null = null;

const statusListeners = new Set<StatusListener>();

function emitStatus(): void {
  const snapshot: TrackingStatus = {
    rideId: desired?.rideId ?? null,
    publisher,
    message,
    authPaused,
  };

  for (const listener of statusListeners) {
    try {
      listener(snapshot);
    } catch {
      // Un suscriptor roto no puede tumbar el seguimiento.
    }
  }
}

function setMessage(next: string | null): void {
  if (message === next) return;
  message = next;
  emitStatus();
}

function foregroundGranted(snapshot: RapaGoPermissionSnapshot | null): boolean {
  return snapshot?.foreground === "granted" || snapshot?.coarse === "granted";
}

/**
 * ¿Puede correr el servicio nativo?
 *
 * Deliberadamente NO se exige el permiso de notificaciones. Un foreground
 * service de tipo `location` arranca igual en Android 13+ con
 * POST_NOTIFICATIONS denegado: simplemente no se dibuja la notificación.
 * Exigirlo —como se hacía antes— regalaba el seguimiento en segundo plano a
 * cambio de nada.
 */
function nativeCanRun(permissions: RapaGoPermissionSnapshot | null): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  if (!permissions) return false;
  if (permissions.background !== "granted") return false;
  return permissions.locationServicesEnabled !== false;
}

function readLiveMap(): Record<string, Record<string, unknown>> {
  try {
    const raw = localStorage.getItem(LIVE_LOCATION_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, Record<string, unknown>>)
      : {};
  } catch {
    return {};
  }
}

function readStoredPayload(key: string): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Puente de compatibilidad con el pasajero y el mapa del conductor.
 *
 * FUSIONA sobre lo ya guardado en vez de reemplazarlo, y esa es la parte
 * importante. La página del conductor escribe en estas mismas claves un payload
 * mucho más rico (patente, marca, modelo, foto, tarifa de residente) vía
 * `getDriverVehiclePublicPayload`. Antes no se notaba porque cada uno escribía
 * en un almacén distinto —la página en localStorage y el runtime en
 * sessionStorage—, de modo que la semilla del mapa (que lee localStorage) nunca
 * encontraba nada. Al unificar ambos en localStorage, reemplazar dejaría al
 * pasajero sin identificar el vehículo en cada tick de GPS. Fusionando, los
 * campos de identidad sobreviven y aquí solo se refresca la posición.
 */
function publishCompatibilityLocation(point: RapaGoLocationPoint): void {
  const ride = desired?.ride ?? null;
  const rideId = desired?.rideId ?? null;

  const fresh: Record<string, unknown> = {
    rideId,
    lat: point.lat,
    lng: point.lng,
    heading: point.headingDegrees,
    speed: point.speedMetersPerSecond,
    accuracy: point.accuracyMeters,
    updatedAt: point.capturedAt,
    source: point.source,
    appState: point.appState,
  };

  if (ride) {
    if (ride.status != null) fresh.status = ride.status;
    if (ride.originText != null) fresh.originText = ride.originText;
    if (ride.destinationText != null) {
      fresh.destinationText = ride.destinationText;
    }
  }

  const previousCurrent = readStoredPayload(CURRENT_LOCATION_KEY);
  // Solo se hereda la identidad si el payload guardado es de ESTE viaje; si no,
  // se arrastrarían los datos del vehículo del viaje anterior.
  const inherited =
    rideId && previousCurrent.rideId === rideId ? previousCurrent : {};

  const payload: Record<string, unknown> = { ...inherited, ...fresh };

  try {
    if (rideId) {
      const map = readLiveMap();
      const previousForRide = map[rideId];
      map[rideId] = {
        ...(previousForRide && typeof previousForRide === "object"
          ? previousForRide
          : {}),
        ...fresh,
      };
      localStorage.setItem(LIVE_LOCATION_KEY, JSON.stringify(map));
    }
    localStorage.setItem(CURRENT_LOCATION_KEY, JSON.stringify(payload));
  } catch {
    // El puente local no puede bloquear el GPS real.
  }

  window.dispatchEvent(
    new CustomEvent(DRIVER_LOCATION_EVENT, { detail: payload }),
  );
  window.dispatchEvent(
    new CustomEvent(LIVE_LOCATION_EVENT, { detail: payload }),
  );
}

function shouldPublishFromJs(
  point: RapaGoLocationPoint,
  rideId: string,
): boolean {
  const previous = lastSent;
  if (!previous || previous.rideId !== rideId) return true;

  const movedMeters =
    Math.hypot(point.lat - previous.lat, point.lng - previous.lng) * 111_000;

  return (
    Date.now() - previous.at >= PUBLISH_MIN_INTERVAL_MS ||
    movedMeters >= PUBLISH_MIN_DISTANCE_M
  );
}

function handlePoint(point: RapaGoLocationPoint): void {
  const current = desired;
  if (!current) return;

  publishCompatibilityLocation(point);

  // Cuando publica el nativo, la capa JS solo alimenta el mapa: publicar
  // también duplicaría cada punto y gastaría batería y cuota de red.
  if (publisher !== "js") return;
  if (!shouldPublishFromJs(point, current.rideId)) return;

  lastSent = {
    rideId: current.rideId,
    at: Date.now(),
    lat: point.lat,
    lng: point.lng,
  };

  const rideId = current.rideId;
  const accessToken = current.accessToken;

  void rideLocationService
    .publish(accessToken, rideId, point)
    .catch(() => {
      // Sin señal el punto NO se pierde: se guarda en disco y se reenvía por
      // el endpoint de lote cuando vuelva la red. Es el motivo de existir de
      // la cola — en Rapa Nui este camino se recorre constantemente.
      void locationQueue.enqueue(rideId, point);
    });
}

async function stopJsWatch(): Promise<void> {
  const stop = stopWatch;
  stopWatch = null;
  watchRideId = null;
  if (!stop) return;

  try {
    await stop();
  } catch {
    // Parar un watch que ya murió no es un error.
  }
}

async function startJsWatch(rideId: string): Promise<void> {
  if (stopWatch && watchRideId === rideId) return;
  await stopJsWatch();

  watchRideId = rideId;

  try {
    const stop = await rideLocationService.watch(handlePoint, (errorMessage) => {
      setMessage(errorMessage);
    });

    // `setDesired(null)` pudo entrar mientras se resolvía la promesa.
    if (watchRideId !== rideId) {
      void stop();
      return;
    }

    stopWatch = stop;
    setMessage(null);
  } catch (error) {
    watchRideId = null;
    setMessage(
      error instanceof Error ? error.message : "No se pudo iniciar el GPS.",
    );
  }
}

/** Primer punto inmediato: sin esto el mapa espera al primer tick del watch. */
async function seedInitialPoint(): Promise<void> {
  try {
    const point = await rideLocationService.current();
    if (desired) handlePoint(point);
  } catch {
    // El watch entregará el primer punto en cuanto pueda.
  }
}

async function readNativeState(): Promise<{
  running: boolean;
  rideId: string | null;
  authPaused: boolean;
}> {
  if (!Capacitor.isNativePlatform()) {
    return { running: false, rideId: null, authPaused: false };
  }

  try {
    const state = await NativeBackgroundLocation.getState();
    return {
      running: Boolean(state?.running),
      rideId: state?.rideId ?? null,
      authPaused: Boolean(state?.authPaused),
    };
  } catch {
    return { running: false, rideId: null, authPaused: false };
  }
}

/**
 * Empuja el token vigente al nativo cuando cambió desde el último empujado.
 *
 * `AuthProvider` ya renueva el token por temporizador, al recuperar foco y al
 * volver la red — enganchado aquí, el nativo prácticamente nunca llega a ver
 * un 401 por token vencido. Si de todos modos lo ve, esto es también lo que lo
 * saca de la pausa: `authPaused` se limpia en el nativo en cuanto procesa un
 * token nuevo.
 */
async function pushAccessTokenIfChanged(accessToken: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (nativePushedToken === accessToken) return;

  try {
    await NativeBackgroundLocation.updateAccessToken({ accessToken });
    nativePushedToken = accessToken;
  } catch {
    // Se reintenta en la siguiente reconciliación; no es una condición fatal.
  }
}

async function reconcile(): Promise<void> {
  if (reconciling) {
    reconcileQueued = true;
    return;
  }

  reconciling = true;

  try {
    const current = desired;

    if (!current) {
      await stopJsWatch();
      publisher = "none";
      lastSent = null;
      nativePushedToken = null;
      authPaused = false;
      if (Capacitor.isNativePlatform()) {
        await rideLocationService.stopNativeBackground();
      }

      // Drenado final del viaje que acaba de cerrarse. El backend acepta
      // puntos históricos de viajes ya completados dentro de su ventana, que
      // es justo para lo que se diseñó. Lo que no se pueda entregar ahora se
      // queda en disco y saldrá al recuperar red o al empezar el próximo viaje.
      if (lastAccessToken) {
        const token = lastAccessToken;
        void locationQueue.flush(token);
      }

      emitStatus();
      return;
    }

    lastAccessToken = current.accessToken;

    // Estado REAL del nativo, no lo que creamos recordar.
    const native = await readNativeState();
    let nativeOwnsRide = native.running && native.rideId === current.rideId;
    let nativeAuthPaused = nativeOwnsRide && native.authPaused;

    if (!nativeOwnsRide && nativeCanRun(current.permissions)) {
      try {
        await rideLocationService.startNativeBackground(
          current.accessToken,
          current.rideId,
        );
        nativePushedToken = current.accessToken;
        const confirmed = await readNativeState();
        nativeOwnsRide =
          confirmed.running && confirmed.rideId === current.rideId;
        nativeAuthPaused = nativeOwnsRide && confirmed.authPaused;
      } catch (error) {
        // El foreground JS sigue cubriendo; se reintenta en la siguiente pasada.
        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudo activar la ubicación en segundo plano.",
        );
      }
    } else if (nativeOwnsRide) {
      await pushAccessTokenIfChanged(current.accessToken);
      // El push pudo sacarlo de la pausa: se relee para no mostrar un aviso
      // obsoleto durante los próximos 15 s.
      if (nativeAuthPaused) {
        const confirmed = await readNativeState();
        nativeAuthPaused = confirmed.running && confirmed.authPaused;
      }
    }

    publisher = nativeOwnsRide ? "native" : "js";

    if (
      foregroundGranted(current.permissions) ||
      !Capacitor.isNativePlatform()
    ) {
      const hadWatch = Boolean(stopWatch);
      await startJsWatch(current.rideId);
      if (!hadWatch && stopWatch) void seedInitialPoint();
    } else {
      await stopJsWatch();
    }

    // Se decide DESPUÉS de tocar el watch de JS a propósito: `startJsWatch`
    // limpia el mensaje al arrancar un watch nuevo, y eso pisaría el aviso de
    // "renovando sesión" si ambos ocurrieran en la misma pasada. El estado de
    // `authPaused` es la última palabra sobre el mensaje visible.
    authPaused = nativeAuthPaused;
    if (nativeAuthPaused) {
      // El GPS sigue capturando y encolando: esto NO es un aviso de "se
      // detuvo", es "se está retrasando la entrega mientras llega un token".
      setMessage("Renovando sesión para mantener la ubicación activa…");
    } else if (message === "Renovando sesión para mantener la ubicación activa…") {
      setMessage(null);
    }

    // Cada reconciliación es también una oportunidad de vaciar la cola: se
    // dispara al recuperar red, al volver del segundo plano y cada 15 s, que
    // son exactamente los momentos en que puede haber vuelto la conexión.
    void locationQueue.flush(current.accessToken);

    emitStatus();
  } finally {
    reconciling = false;

    if (reconcileQueued) {
      reconcileQueued = false;
      void reconcile();
    }
  }
}

function bindGlobalListeners(): void {
  if (listenersBound) return;
  listenersBound = true;

  void App.addListener("appStateChange", () => {
    void reconcile();
  })
    .then((listener) => {
      appListener = listener;
    })
    .catch(() => {
      // Sin plugin de App el intervalo sigue cubriendo.
    });

  void Promise.resolve(
    Network.addListener("networkStatusChange", () => {
      void reconcile();
    }),
  )
    .then((listener) => {
      networkListener = listener;
    })
    .catch(() => {
      // Sin plugin de Network el intervalo sigue cubriendo.
    });

  intervalId = window.setInterval(() => {
    if (desired) void reconcile();
  }, RECONCILE_INTERVAL_MS);
}

function unbindGlobalListeners(): void {
  if (!listenersBound) return;
  listenersBound = false;

  void appListener?.remove();
  appListener = null;
  void networkListener?.remove();
  networkListener = null;

  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

function sameDesired(
  a: DesiredTracking | null,
  b: DesiredTracking | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  return (
    a.rideId === b.rideId &&
    a.accessToken === b.accessToken &&
    a.permissions?.foreground === b.permissions?.foreground &&
    a.permissions?.coarse === b.permissions?.coarse &&
    a.permissions?.background === b.permissions?.background &&
    a.permissions?.locationServicesEnabled ===
      b.permissions?.locationServicesEnabled &&
    a.ride?.status === b.ride?.status
  );
}

export const rideTrackingCoordinator = {
  /**
   * Declara el estado deseado. Idempotente: llamarlo con lo mismo no reinicia
   * nada. `null` para y limpia.
   */
  setDesired(next: DesiredTracking | null): void {
    if (sameDesired(desired, next)) return;

    const rideChanged = desired?.rideId !== next?.rideId;
    desired = next;

    if (rideChanged) {
      lastSent = null;
      setMessage(null);
      // Un token "empujado" para el viaje anterior no cuenta para el nuevo: el
      // servicio nativo arranca desde cero y necesita el token de nuevo.
      nativePushedToken = null;
      authPaused = false;
    }

    if (next) bindGlobalListeners();
    else unbindGlobalListeners();

    void reconcile();
  },

  getStatus(): TrackingStatus {
    return { rideId: desired?.rideId ?? null, publisher, message, authPaused };
  },

  subscribe(listener: StatusListener): () => void {
    statusListeners.add(listener);
    listener(rideTrackingCoordinator.getStatus());

    return () => {
      statusListeners.delete(listener);
    };
  },

  /** Solo para tests: devuelve el módulo a su estado inicial. */
  async __resetForTests(): Promise<void> {
    desired = null;
    await stopJsWatch();
    unbindGlobalListeners();
    publisher = "none";
    message = null;
    lastSent = null;
    nativePushedToken = null;
    authPaused = false;
    reconciling = false;
    reconcileQueued = false;
    statusListeners.clear();
  },
};
