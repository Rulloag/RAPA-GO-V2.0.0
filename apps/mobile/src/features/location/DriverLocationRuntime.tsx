import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonText,
} from "@ionic/react";
import { locationOutline, settingsOutline, shieldCheckmarkOutline } from "ionicons/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/index.js";
import { ridesService, type DriverRideData } from "../rides/rides.service.js";
import { locationPermissionService } from "./locationPermission.service.js";
import { rideLocationService } from "./rideLocation.service.js";
import type {
  RapaGoLocationPoint,
  RapaGoPermissionSnapshot,
} from "./location.types.js";

const ACTIVE_STATUSES = new Set([
  "accepted",
  "driver_en_route",
  "driver_arrived",
  "in_progress",
]);

const DRIVER_LOCATION_EVENT = "rapago:driver-native-location";
const LIVE_LOCATION_EVENT = "rapago:driver-live-location-updated";
const LIVE_LOCATION_KEY = "rapago_driver_live_locations_v1";
const CURRENT_LOCATION_KEY = "rapago_current_driver_location";

function activeRideOf(rides: DriverRideData[]): DriverRideData | null {
  return (
    rides
      .filter((ride) => ACTIVE_STATUSES.has(String(ride.status)))
      .sort((a, b) => {
        const bTime = new Date(b.startedAt ?? b.acceptedAt ?? b.createdAt).getTime();
        const aTime = new Date(a.startedAt ?? a.acceptedAt ?? a.createdAt).getTime();
        return bTime - aTime;
      })[0] ?? null
  );
}

function readMap(): Record<string, Record<string, unknown>> {
  try {
    const raw = sessionStorage.getItem(LIVE_LOCATION_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, Record<string, unknown>>)
      : {};
  } catch {
    return {};
  }
}

function userSnapshot(user: unknown): Record<string, unknown> {
  if (!user || typeof user !== "object") return {};
  const record = user as Record<string, unknown>;
  return {
    driverName: record.name ?? record.fullName ?? null,
    driverFullName: record.name ?? record.fullName ?? null,
    driverEmail: record.email ?? null,
    driverPhone: record.phone ?? null,
    driverProfilePhotoUrl: record.profilePhotoUrl ?? null,
    driverVehicleBrand: record.vehicleBrand ?? null,
    driverVehicleModel: record.vehicleModel ?? null,
    driverVehicleColor: record.vehicleColor ?? null,
    driverVehiclePlate: record.vehiclePlate ?? null,
    vehicleBrand: record.vehicleBrand ?? null,
    vehicleModel: record.vehicleModel ?? null,
    vehicleColor: record.vehicleColor ?? null,
    vehiclePlate: record.vehiclePlate ?? null,
  };
}

function publishCompatibilityLocation(
  ride: DriverRideData | null,
  point: RapaGoLocationPoint,
  user: unknown,
): void {
  const payload: Record<string, unknown> = {
    rideId: ride?.id ?? null,
    lat: point.lat,
    lng: point.lng,
    heading: point.headingDegrees,
    speed: point.speedMetersPerSecond,
    accuracy: point.accuracyMeters,
    updatedAt: point.capturedAt,
    source: point.source,
    appState: point.appState,
    status: ride?.status ?? null,
    originText: ride?.originText ?? null,
    destinationText: ride?.destinationText ?? null,
    ...userSnapshot(user),
  };

  try {
    if (ride?.id) {
      const map = readMap();
      map[ride.id] = payload;
      sessionStorage.setItem(LIVE_LOCATION_KEY, JSON.stringify(map));
    }
    sessionStorage.setItem(CURRENT_LOCATION_KEY, JSON.stringify(payload));
  } catch {
    // Compatibilidad local no debe bloquear el GPS real.
  }

  window.dispatchEvent(new CustomEvent(DRIVER_LOCATION_EVENT, { detail: payload }));
  window.dispatchEvent(new CustomEvent(LIVE_LOCATION_EVENT, { detail: payload }));
}

function foregroundGranted(snapshot: RapaGoPermissionSnapshot | null): boolean {
  return snapshot?.foreground === "granted" || snapshot?.coarse === "granted";
}

export function DriverLocationRuntime(): JSX.Element | null {
  const { session } = useAuth();
  const [permissions, setPermissions] = useState<RapaGoPermissionSnapshot | null>(null);
  const [activeRide, setActiveRide] = useState<DriverRideData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stopWatchRef = useRef<(() => Promise<void>) | null>(null);
  const lastSentRef = useRef<{ rideId: string; at: number; lat: number; lng: number } | null>(null);
  const nativeRideRef = useRef<string | null>(null);
  const permissionAppListenerRef = useRef<PluginListenerHandle | null>(null);

  const accessToken = session?.accessToken ?? null;
  const userRole = String(session?.user?.role ?? "");
  const isDriver = userRole === "driver";

  const refreshPermissions = useCallback(async () => {
    try {
      const next = await locationPermissionService.check();
      setPermissions(next);

      if (foregroundGranted(next)) {
        setMessage(null);
      }
    } catch {
      setPermissions(null);
    }
  }, []);

  useEffect(() => {
    if (!isDriver) return;
    void refreshPermissions();

    let disposed = false;
    const refreshWhenVisible = () => {
      if (!disposed && document.visibilityState !== "hidden") {
        void refreshPermissions();
      }
    };

    const refreshOnPageShow = () => {
      if (!disposed) void refreshPermissions();
    };

    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("pageshow", refreshOnPageShow);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive && !disposed) void refreshPermissions();
    }).then((listener) => {
      if (disposed) listener.remove();
      else permissionAppListenerRef.current = listener;
    });

    return () => {
      disposed = true;
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("pageshow", refreshOnPageShow);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      permissionAppListenerRef.current?.remove();
      permissionAppListenerRef.current = null;
    };
  }, [isDriver, refreshPermissions]);

  useEffect(() => {
    if (!isDriver || !accessToken) {
      setActiveRide(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const rides = await ridesService.listDriverRides(accessToken);
        if (!cancelled) setActiveRide(activeRideOf(rides));
      } catch {
        if (!cancelled) setActiveRide(null);
      }
    };

    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15_000);
    const onRideUpdate = () => void load();
    window.addEventListener("rapago:driver-rides-updated", onRideUpdate);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("rapago:driver-rides-updated", onRideUpdate);
    };
  }, [accessToken, isDriver]);

  useEffect(() => {
    if (!isDriver || !activeRide || !foregroundGranted(permissions)) {
      if (stopWatchRef.current) {
        void stopWatchRef.current();
        stopWatchRef.current = null;
      }
      return;
    }

    let cancelled = false;
    void rideLocationService
      .watch(
        (point) => {
          if (cancelled) return;
          publishCompatibilityLocation(activeRide, point, session?.user);

          if (!activeRide || !accessToken) return;
          const previous = lastSentRef.current;
          const now = Date.now();
          const moved = previous
            ? Math.hypot(point.lat - previous.lat, point.lng - previous.lng) * 111000
            : Number.POSITIVE_INFINITY;
          if (
            previous &&
            previous.rideId === activeRide.id &&
            now - previous.at < 3500 &&
            moved < 4
          ) {
            return;
          }

          lastSentRef.current = {
            rideId: activeRide.id,
            at: now,
            lat: point.lat,
            lng: point.lng,
          };
          void rideLocationService.publish(accessToken, activeRide.id, point).catch(() => {
            // El servicio nativo reintentará cuando la app esté en segundo plano.
          });
        },
        (errorMessage) => {
          setMessage(errorMessage);

          if (/permission|denied|not allowed|autoriz/i.test(errorMessage)) {
            locationPermissionService.clearRememberedWebGrant();
            void refreshPermissions();
          }
        },
      )
      .then((stop) => {
        if (cancelled) {
          void stop();
          return;
        }
        stopWatchRef.current = stop;
        setMessage(null);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "No se pudo iniciar el GPS.");
      });

    return () => {
      cancelled = true;
      if (stopWatchRef.current) {
        void stopWatchRef.current();
        stopWatchRef.current = null;
      }
    };
  }, [accessToken, activeRide?.id, isDriver, permissions?.foreground, permissions?.coarse, refreshPermissions, session?.user]);

  useEffect(() => {
    if (!isDriver || !accessToken || !activeRide) {
      if (nativeRideRef.current) {
        void rideLocationService.stopNativeBackground();
        nativeRideRef.current = null;
      }
      return;
    }

    const canStart =
      permissions?.background === "granted" &&
      permissions.locationServicesEnabled !== false &&
      permissions.notifications !== "denied";

    if (!canStart || nativeRideRef.current === activeRide.id) return;

    void rideLocationService
      .startNativeBackground(accessToken, activeRide.id)
      .then(() => {
        nativeRideRef.current = activeRide.id;
        setMessage(null);
      })
      .catch((error) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudo activar la ubicación en segundo plano.",
        );
      });
  }, [accessToken, activeRide?.id, isDriver, permissions?.background, permissions?.locationServicesEnabled, permissions?.notifications]);

  useEffect(() => {
    return () => {
      if (nativeRideRef.current) void rideLocationService.stopNativeBackground();
    };
  }, []);

  const needsForeground =
    isDriver &&
    Boolean(activeRide) &&
    permissions !== null &&
    !foregroundGranted(permissions);
  const needsBackground =
    isDriver &&
    Boolean(activeRide) &&
    permissions?.platform !== "web" &&
    permissions?.background !== "granted";

  const cardTitle = useMemo(() => {
    if (needsForeground) return "Activa tu ubicación para conducir";
    if (needsBackground) return "Permite ubicación durante el viaje";
    return null;
  }, [needsBackground, needsForeground]);

  if (!isDriver || (!cardTitle && !message)) return null;

  const requestForeground = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await locationPermissionService.requestForeground();
      setPermissions(next);

      if (foregroundGranted(next)) {
        setMessage(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo solicitar el permiso.");
    } finally {
      setBusy(false);
    }
  };

  const requestBackground = async () => {
    setBusy(true);
    setMessage(null);
    try {
      let next = await locationPermissionService.requestNotifications();
      if (next.foreground !== "granted" && next.coarse !== "granted") {
        next = await locationPermissionService.requestForeground();
      }
      next = await locationPermissionService.requestBackground();
      setPermissions(next);
      if (next.background !== "granted") {
        setMessage("En Ajustes selecciona Ubicación > Permitir siempre y vuelve a RAPA GO.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo solicitar el permiso.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonCard
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        top: "calc(env(safe-area-inset-top) + 8px)",
        zIndex: 10050,
        margin: 0,
        borderRadius: 20,
        background: "linear-gradient(135deg,#fff8e1,#f6d98e)",
        color: "#111",
        border: "1px solid rgba(143,63,37,.35)",
        boxShadow: "0 18px 45px rgba(0,0,0,.28)",
      }}
    >
      <IonCardContent style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <IonIcon
            icon={needsBackground ? shieldCheckmarkOutline : locationOutline}
            style={{ fontSize: 28, color: "#8f3f25", flex: "0 0 auto" }}
          />
          <div style={{ flex: 1 }}>
            {cardTitle && <div style={{ fontWeight: 950 }}>{cardTitle}</div>}
            <IonText>
              <p style={{ margin: "4px 0 10px", fontSize: ".8rem", lineHeight: 1.35 }}>
                {needsForeground
                  ? "Aceptaste un viaje. Activa el GPS para abrir la ruta, ubicar al pasajero y compartir tu avance mientras el servicio esté activo."
                  : needsBackground
                    ? "Durante un viaje activo, la ubicación debe continuar aunque cambies de aplicación o bloquees la pantalla. Se detiene al cerrar el viaje."
                    : message}
              </p>
            </IonText>
            {message && cardTitle && (
              <div style={{ fontSize: ".76rem", fontWeight: 850, color: "#9f1d1d", marginBottom: 8 }}>
                {message}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-start" }}>
              {needsForeground && (
                <IonButton
                  size="small"
                  disabled={busy}
                  onClick={() => void requestForeground()}
                  style={{ flex: "1 1 auto", minWidth: 140 }}
                >
                  Activar ubicación
                </IonButton>
              )}
              {needsBackground && (
                <IonButton
                  size="small"
                  disabled={busy}
                  onClick={() => void requestBackground()}
                  style={{ flex: "1 1 auto", minWidth: 140 }}
                >
                  Permitir siempre
                </IonButton>
              )}
              <IonButton
                size="small"
                fill="clear"
                color="dark"
                onClick={() => void locationPermissionService.openSettings()}
                style={{ flex: "1 1 auto", minWidth: 110 }}
              >
                <IonIcon icon={settingsOutline} slot="start" />
                Ajustes
              </IonButton>
            </div>
          </div>
        </div>
      </IonCardContent>
    </IonCard>
  );
}
