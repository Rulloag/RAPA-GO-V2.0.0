import { Network } from "@capacitor/network";
import type { LatLng } from "../maps/maps.types.js";
import type {
  NavStep,
  NavigationRoute,
  RoutePhase,
} from "./navigationRoute.types.js";
import { getCachedRoute, hydrateRouteCache, saveRoute } from "./routeCache.js";
import {
  buildRouteGeometry,
  activeStep,
  localEtaSeconds,
  snapToRoute,
  type RouteGeometry,
  type RouteSnap,
} from "./routeProgress.js";
import {
  createRerouteState,
  evaluateReroute,
  shouldRefreshCachedRoute,
  type RerouteState,
} from "./reroutePolicy.js";
import {
  buildRouteKey,
  classifyRouteFailure,
  decodePath,
  toNavigationRoute,
} from "./routeSerialization.js";

/**
 * Controlador de navegación tolerante a fallos de red.
 *
 * Es imperativo y no un hook a propósito: el mapa de ambas pantallas ya se
 * maneja con refs y llamadas directas al SDK, así que un hook obligaría a
 * reestructurar componentes de miles de líneas sin ganar nada.
 *
 * La inversión de dependencia que arregla el problema está aquí: lo que se
 * dibuja sale siempre de la ruta local (caché), y la red solo la refresca.
 * Perder la conexión deja de ser un evento visible.
 */

export type RouteStatus = "idle" | "loading" | "ready" | "unavailable";

export interface RouteSnapshot {
  status: RouteStatus;
  route: NavigationRoute | null;
  /** true cuando se está mostrando una ruta guardada sin poder revalidarla. */
  isStale: boolean;
  isOnline: boolean;
  /** Metros que faltan, recalculados localmente en cada fix de GPS. */
  remainingMeters: number | null;
  etaSeconds: number | null;
  step: NavStep | null;
  /** Rumbo del tramo actual, para orientar la cámara sin red. */
  headingDegrees: number | null;
  distanceToRouteMeters: number | null;
  /** Posición proyectada sobre la ruta (map matching). */
  snappedPoint: LatLng | null;
  error: string | null;
}

export interface RouteTarget {
  rideId: string;
  phase: RoutePhase;
  destination: LatLng;
}

export interface RouteControllerOptions {
  getMap: () => google.maps.Map | null;
  /** Color de la línea. Se puede cambiar por fase (recogida vs destino). */
  strokeColor?: string;
  strokeWeight?: number;
  /** Se llama cada vez que cambia algo que la UI deba reflejar. */
  onChange?: (snapshot: RouteSnapshot) => void;
}

const IDLE_SNAPSHOT: RouteSnapshot = {
  status: "idle",
  route: null,
  isStale: false,
  isOnline: true,
  remainingMeters: null,
  etaSeconds: null,
  step: null,
  headingDegrees: null,
  distanceToRouteMeters: null,
  snappedPoint: null,
  error: null,
};

export class RouteController {
  private readonly options: RouteControllerOptions;

  private target: RouteTarget | null = null;
  private origin: LatLng | null = null;

  private route: NavigationRoute | null = null;
  private geometry: RouteGeometry | null = null;
  private lastSnapIndex = 0;

  private polyline: google.maps.Polyline | null = null;
  private service: google.maps.DirectionsService | null = null;

  private rerouteState: RerouteState = createRerouteState();
  private snapshot: RouteSnapshot = IDLE_SNAPSHOT;

  private requestSeq = 0;
  private inFlight = false;
  private isOnline = true;
  private destroyed = false;

  private networkHandle: { remove: () => void } | null = null;

  /**
   * Se resuelve cuando ya se conoce el estado de la red y la caché está en
   * memoria. Antes esto eran dos `void` sueltos, y un `setTarget` que llegara
   * primero veía la caché vacía, borraba la ruta y pedía red creyéndose online
   * por el valor inicial: sin señal, la ruta buena quedaba en disco, invisible.
   */
  private readonly initialized: Promise<void>;

  constructor(options: RouteControllerOptions) {
    this.options = options;
    this.initialized = Promise.all([
      this.initConnectivity(),
      hydrateRouteCache(),
    ]).then(() => undefined);
  }

  /**
   * `@capacitor/network` es la fuente de verdad, no `navigator.onLine`: este
   * último reporta "conectado" estando en un Wi-Fi sin salida a internet, que
   * es justo uno de los casos que hay que sobrevivir.
   */
  private async initConnectivity(): Promise<void> {
    try {
      const status = await Network.getStatus();
      this.isOnline = status.connected;

      const handle = await Network.addListener("networkStatusChange", (next) => {
        const cameBack = !this.isOnline && next.connected;
        this.isOnline = next.connected;
        this.emit();

        // Al reconectar se revalida, nunca se redibuja desde cero.
        if (cameBack) void this.revalidate();
      });

      if (this.destroyed) {
        void handle.remove();
        return;
      }

      this.networkHandle = handle;
    } catch {
      // Sin plugin (web/dev) se cae al indicador del navegador.
      this.isOnline = typeof navigator === "undefined" ? true : navigator.onLine !== false;
    }

    this.emit();
  }

  /**
   * Fija el destino activo. Si hay una ruta guardada para esa clave se dibuja
   * de inmediato y de forma síncrona, incluso sin conexión.
   */
  setTarget(target: RouteTarget | null, origin: LatLng | null): void {
    this.origin = origin;

    if (!target) {
      this.target = null;
      this.clearRoute();
      this.update({ status: "idle", error: null });
      return;
    }

    const key = buildRouteKey(target.rideId, target.phase, target.destination);
    const sameTarget = this.route?.key === key;

    this.target = target;

    if (sameTarget) {
      // Mismo destino: no se toca nada de lo dibujado. Esto es lo que evita
      // recalcular al volver la conexión o al remontar la pantalla.
      if (this.route && shouldRefreshCachedRoute(this.route.computedAt, this.isOnline)) {
        void this.requestRoute();
      }
      return;
    }

    const cached = getCachedRoute(key);

    if (cached) {
      this.applyRoute(cached, cached.source === "network" ? "network" : "storage");
      if (shouldRefreshCachedRoute(cached.computedAt, this.isOnline)) void this.requestRoute();
      return;
    }

    // Fallo de caché. Puede ser que todavía no se haya hidratado, así que no
    // se decide nada aquí: se espera a tener disco y red antes de tocar lo
    // que el usuario está viendo.
    void this.resolveNewTarget(key);
  }

  /**
   * Resuelve un destino nuevo una vez que se conocen disco y conectividad.
   *
   * Nunca deja la pantalla en blanco estando sin señal: sin red no hay forma
   * de conseguir la ruta de reemplazo, así que borrar dejaría al conductor sin
   * nada durante todo el tramo. Eso es justo el síntoma que este módulo existe
   * para eliminar, y sobrevivía en el cambio de fase (recogida → destino).
   */
  private async resolveNewTarget(key: string): Promise<void> {
    await this.initialized;

    if (this.destroyed || this.target === null) return;
    // Otro setTarget ganó la carrera mientras esperábamos.
    if (buildRouteKey(this.target.rideId, this.target.phase, this.target.destination) !== key) {
      return;
    }

    const cached = getCachedRoute(key);

    if (cached) {
      this.applyRoute(cached, cached.source === "network" ? "network" : "storage");
      if (shouldRefreshCachedRoute(cached.computedAt, this.isOnline)) void this.requestRoute();
      return;
    }

    if (!this.isOnline) {
      // Se conserva lo dibujado como referencia visual y se avisa. La ruta
      // correcta llegará en cuanto vuelva la señal.
      this.update({
        isStale: true,
        status: this.route ? "ready" : "unavailable",
        error: "Sin conexión: no se pudo calcular la ruta de este tramo.",
      });
      return;
    }

    this.clearRoute();
    this.update({ status: "loading", error: null });
    void this.requestRoute();
  }

  /**
   * Calcula y guarda una ruta sin dibujarla.
   *
   * Permite dejar lista la pierna siguiente mientras todavía hay cobertura
   * (por ejemplo, la ruta al destino mientras se va a buscar al pasajero), que
   * es como los navegadores evitan quedarse sin datos al cambiar de tramo.
   */
  async prefetch(target: RouteTarget, origin: LatLng): Promise<boolean> {
    await this.initialized;

    if (this.destroyed || !this.isOnline) return false;

    const key = buildRouteKey(target.rideId, target.phase, target.destination);
    if (getCachedRoute(key)) return true;

    const service = this.getService();
    if (!service) return false;

    const context = { rideId: target.rideId, phase: target.phase, origin, destination: target.destination };

    return new Promise<boolean>((resolve) => {
      service.route(
        {
          origin,
          destination: target.destination,
          travelMode: google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
          region: "CL",
        },
        (result, status) => {
          if (status !== google.maps.DirectionsStatus.OK || !result) {
            resolve(false);
            return;
          }

          const route = toNavigationRoute(result, context);
          if (route) saveRoute(route);
          resolve(route != null);
        },
      );
    });
  }

  /** Actualiza el origen sin disparar recálculo. */
  setOrigin(origin: LatLng | null): void {
    this.origin = origin;
  }

  /**
   * Se llama en cada fix del GPS. Hace todo el trabajo localmente y solo va a
   * la red si la política lo autoriza.
   */
  updatePosition(point: LatLng): void {
    this.origin = point;

    if (!this.geometry || !this.route) {
      // Sin ruta dibujada todavía: se intenta obtenerla si hay con qué.
      if (this.target && this.isOnline && !this.inFlight) void this.requestRoute();
      return;
    }

    const snap = snapToRoute(point, this.geometry, this.lastSnapIndex);
    if (snap) this.lastSnapIndex = snap.index;

    const evaluation = evaluateReroute(this.rerouteState, {
      distanceToRouteMeters: snap?.distanceToRouteMeters ?? null,
      isOnline: this.isOnline,
      hasRoute: true,
      now: Date.now(),
    });

    this.rerouteState = evaluation.state;
    this.applySnap(snap);

    if (evaluation.decision.action !== "none") void this.requestRoute();
  }

  /** Fuerza una petición de ruta, respetando el deduplicado en vuelo. */
  refresh(): void {
    void this.requestRoute();
  }

  /** Revalida tras reconectar: solo pide si la ruta está rancia o falta. */
  private async revalidate(): Promise<void> {
    if (!this.target) return;

    if (!this.route) {
      void this.requestRoute();
      return;
    }

    if (
      this.snapshot.isStale ||
      shouldRefreshCachedRoute(this.route.computedAt, this.isOnline)
    ) {
      void this.requestRoute();
    }
  }

  private getService(): google.maps.DirectionsService | null {
    if (this.service) return this.service;
    if (!window.google?.maps?.DirectionsService) return null;

    this.service = new google.maps.DirectionsService();
    return this.service;
  }

  private async requestRoute(): Promise<void> {
    // Sin esto se podría salir a la red creyéndose online por el valor
    // inicial, estando el teléfono sin cobertura.
    await this.initialized;

    const target = this.target;
    const origin = this.origin;

    if (!target || !origin || this.destroyed) return;

    // Sin conexión no se intenta siquiera: se conserva lo dibujado.
    if (!this.isOnline) {
      this.update({ isStale: this.route != null });
      return;
    }

    if (this.inFlight) return;

    const service = this.getService();
    if (!service) {
      this.update({ isStale: this.route != null });
      return;
    }

    this.inFlight = true;
    const requestId = this.requestSeq + 1;
    this.requestSeq = requestId;

    // En redes móviles inestables el callback de Google a veces no llega
    // nunca. Sin este rescate `inFlight` quedaría trabado y el controlador no
    // volvería a pedir ruta en toda la vida de la pantalla.
    const watchdog = setTimeout(() => {
      if (requestId !== this.requestSeq) return;
      this.inFlight = false;
      this.update({ isStale: this.route != null });
    }, 20_000);

    const context = {
      rideId: target.rideId,
      phase: target.phase,
      origin,
      destination: target.destination,
    };

    service.route(
      {
        origin,
        destination: target.destination,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
        optimizeWaypoints: false,
        region: "CL",
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
      },
      (result, status) => {
        clearTimeout(watchdog);
        if (this.destroyed || requestId !== this.requestSeq) return;

        this.inFlight = false;

        if (status === google.maps.DirectionsStatus.OK && result) {
          const route = toNavigationRoute(result, context);

          if (route) {
            saveRoute(route);
            this.applyRoute(route, "network");
            return;
          }
        }

        const failure = classifyRouteFailure(status);

        // Fallo de transporte: se conserva la última ruta buena. Es la
        // corrección central — antes esta rama borraba la polyline.
        if (failure.kind === "transport") {
          this.update({
            status: this.route ? "ready" : "unavailable",
            isStale: true,
            error: this.route ? null : failure.message,
          });
          return;
        }

        // Fallo semántico sin nada dibujado: la ruta no existe de verdad.
        if (!this.route) {
          this.update({ status: "unavailable", isStale: false, error: failure.message });
          return;
        }

        // Con ruta dibujada se conserva: un ZERO_RESULTS puntual sobre una
        // ruta que ya se calculó bien no justifica dejar al usuario sin nada.
        this.update({ isStale: true });
      },
    );
  }

  private applyRoute(route: NavigationRoute, source: NavigationRoute["source"]): void {
    const path = decodePath(route.encodedPath);

    if (path.length < 2) {
      this.update({ status: this.route ? "ready" : "unavailable" });
      return;
    }

    this.route = { ...route, source };
    this.geometry = buildRouteGeometry(path);
    this.lastSnapIndex = 0;
    this.rerouteState = createRerouteState();

    this.draw(path);

    const snap = this.origin ? snapToRoute(this.origin, this.geometry, 0) : null;
    if (snap) this.lastSnapIndex = snap.index;

    this.update({
      status: "ready",
      route: this.route,
      isStale: source !== "network",
      error: null,
      ...this.snapFields(snap),
    });
  }

  private applySnap(snap: RouteSnap | null): void {
    this.update(this.snapFields(snap));
  }

  private snapFields(snap: RouteSnap | null): Partial<RouteSnapshot> {
    if (!snap || !this.route) {
      return {
        remainingMeters: this.route?.distanceMeters ?? null,
        etaSeconds: this.route?.durationSeconds ?? null,
        step: this.route?.steps[0] ?? null,
        headingDegrees: null,
        distanceToRouteMeters: null,
        snappedPoint: null,
      };
    }

    const point = this.origin ?? snap.snapped;

    return {
      remainingMeters: snap.remainingMeters,
      etaSeconds: localEtaSeconds(snap.remainingMeters, this.route),
      step: activeStep(this.route.steps, point),
      headingDegrees: snap.headingDegrees,
      distanceToRouteMeters: snap.distanceToRouteMeters,
      snappedPoint: snap.snapped,
    };
  }

  /** Devuelve la geometría dibujada, para cámara y encuadre. */
  getPath(): LatLng[] {
    return this.geometry?.path ?? [];
  }

  getSnapshot(): RouteSnapshot {
    return this.snapshot;
  }

  /**
   * Dibuja con una `Polyline` explícita en vez de `DirectionsRenderer`.
   *
   * `DirectionsRenderer` exige un `DirectionsResult` vivo y no se puede
   * rehidratar desde disco, así que mientras fuera la fuente de verdad era
   * imposible dibujar sin red. Una Polyline se alimenta de coordenadas planas.
   */
  private draw(path: LatLng[]): void {
    const map = this.options.getMap();
    if (!map || !window.google?.maps?.Polyline) return;

    if (!this.polyline) {
      this.polyline = new google.maps.Polyline({
        clickable: false,
        strokeColor: this.options.strokeColor ?? "#4F46E5",
        strokeOpacity: 1,
        strokeWeight: this.options.strokeWeight ?? 8,
        zIndex: 20,
      });
    }

    this.polyline.setPath(path);
    this.polyline.setMap(map);
  }

  /** Cambia el color sin recalcular (p. ej. al pasar de recogida a destino). */
  setStrokeColor(color: string): void {
    this.options.strokeColor = color;
    this.polyline?.setOptions({ strokeColor: color });
  }

  /** Vuelve a montar la polyline si el mapa se creó después del controlador. */
  attachToMap(): void {
    const path = this.geometry?.path;
    if (path && path.length >= 2) this.draw(path);
  }

  private clearRoute(): void {
    this.route = null;
    this.geometry = null;
    this.lastSnapIndex = 0;
    this.rerouteState = createRerouteState();
    this.polyline?.setMap(null);

    this.update({
      route: null,
      remainingMeters: null,
      etaSeconds: null,
      step: null,
      headingDegrees: null,
      distanceToRouteMeters: null,
      snappedPoint: null,
      isStale: false,
    });
  }

  private update(patch: Partial<RouteSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch, isOnline: this.isOnline };
    this.emit();
  }

  private emit(): void {
    if (this.destroyed) return;
    this.snapshot = { ...this.snapshot, isOnline: this.isOnline };
    this.options.onChange?.(this.snapshot);
  }

  destroy(): void {
    this.destroyed = true;
    this.polyline?.setMap(null);
    this.polyline = null;
    this.service = null;

    try {
      this.networkHandle?.remove();
    } catch {
      // El listener puede haberse soltado ya.
    }

    this.networkHandle = null;
  }
}

export function createRouteController(options: RouteControllerOptions): RouteController {
  return new RouteController(options);
}
