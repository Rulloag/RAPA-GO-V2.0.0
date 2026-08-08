export { RouteController, createRouteController } from "./routeController.js";
export type {
  RouteControllerOptions,
  RouteSnapshot,
  RouteStatus,
  RouteTarget,
} from "./routeController.js";

export {
  clearRouteCache,
  getCachedRoute,
  hydrateRouteCache,
  resetRouteCacheForTests,
  saveRoute,
} from "./routeCache.js";

export {
  activeStep,
  bearingDegrees,
  buildRouteGeometry,
  distanceMeters,
  formatNavigationDuration,
  formatNavigationMeters,
  localEtaSeconds,
  snapToRoute,
} from "./routeProgress.js";
export type { RouteGeometry, RouteSnap } from "./routeProgress.js";

export {
  MIN_REROUTE_INTERVAL_MS,
  OFF_ROUTE_CONSECUTIVE_FIXES,
  OFF_ROUTE_METERS,
  TRAFFIC_REFRESH_INTERVAL_MS,
  createRerouteState,
  evaluateReroute,
  shouldRefreshCachedRoute,
} from "./reroutePolicy.js";
export type { RerouteAction, RerouteState } from "./reroutePolicy.js";

export {
  buildRouteKey,
  classifyRouteFailure,
  cleanInstruction,
  decodePath,
  encodePath,
  extractStreet,
  isValidStoredRoute,
  toNavigationRoute,
  toPlainPoint,
} from "./routeSerialization.js";
export type { RouteContext } from "./routeSerialization.js";

export { NAVIGATION_ROUTE_SCHEMA_VERSION } from "./navigationRoute.types.js";
export type {
  HydratedRoute,
  NavStep,
  NavigationRoute,
  RouteFailure,
  RouteFailureKind,
  RoutePhase,
  RouteSource,
} from "./navigationRoute.types.js";
