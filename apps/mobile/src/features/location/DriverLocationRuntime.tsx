import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonText,
} from "@ionic/react";
import {
  locationOutline,
  settingsOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/index.js";
import { ridesService, type DriverRideData } from "../rides/rides.service.js";
import { locationPermissionService } from "./locationPermission.service.js";
import { rideTrackingCoordinator } from "./rideTrackingCoordinator.js";
import type { RapaGoPermissionSnapshot } from "./location.types.js";

/**
 * Detecta el viaje activo y los permisos, y se lo DECLARA al coordinador.
 *
 * Este componente ya no toca el GPS ni el servicio nativo: solo describe qué
 * debería estar pasando. El ciclo de vida real vive en
 * `rideTrackingCoordinator`, un módulo sin `unmount`, para que cambiar de
 * pestaña no pueda volver a matar el seguimiento en segundo plano.
 *
 * Lo único que sigue renderizando es la tarjeta que pide los permisos.
 */

const ACTIVE_STATUSES = new Set([
  "accepted",
  "driver_en_route",
  "driver_arrived",
  "in_progress",
]);

function activeRideOf(rides: DriverRideData[]): DriverRideData | null {
  return (
    rides
      .filter((ride) => ACTIVE_STATUSES.has(String(ride.status)))
      .sort((a, b) => {
        const bTime = new Date(
          b.startedAt ?? b.acceptedAt ?? b.createdAt,
        ).getTime();
        const aTime = new Date(
          a.startedAt ?? a.acceptedAt ?? a.createdAt,
        ).getTime();
        return bTime - aTime;
      })[0] ?? null
  );
}

function foregroundGranted(snapshot: RapaGoPermissionSnapshot | null): boolean {
  return snapshot?.foreground === "granted" || snapshot?.coarse === "granted";
}

export function DriverLocationRuntime(): JSX.Element | null {
  const { session } = useAuth();
  const [permissions, setPermissions] =
    useState<RapaGoPermissionSnapshot | null>(null);
  const [activeRide, setActiveRide] = useState<DriverRideData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const permissionAppListenerRef = useRef<PluginListenerHandle | null>(null);

  const accessToken = session?.accessToken ?? null;
  const userRole = String(session?.user?.role ?? "");
  const isDriver = userRole === "driver";

  const refreshPermissions = useCallback(async () => {
    try {
      const next = await locationPermissionService.check();
      setPermissions(next);
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

  /**
   * Declara el estado deseado. El coordinador decide solo si publica el
   * servicio nativo o la capa JS, y se auto-repara si algo mató el nativo por
   * fuera. Aquí no se arranca ni se para nada directamente.
   */
  useEffect(() => {
    if (!isDriver || !accessToken || !activeRide) {
      rideTrackingCoordinator.setDesired(null);
      return;
    }

    rideTrackingCoordinator.setDesired({
      rideId: activeRide.id,
      accessToken,
      permissions,
      ride: activeRide as unknown as Record<string, unknown>,
    });
  }, [accessToken, activeRide, isDriver, permissions]);

  /**
   * Parar al desmontar es correcto AQUÍ y solo aquí: este componente vive en
   * `DriverLayout`, que únicamente se desmonta al cerrar sesión o dejar de ser
   * conductor. No se desmonta al cambiar de pestaña — que era justo lo que
   * rompía el seguimiento antes.
   */
  useEffect(() => {
    return () => {
      rideTrackingCoordinator.setDesired(null);
    };
  }, []);

  useEffect(() => {
    return rideTrackingCoordinator.subscribe((status) => {
      setMessage(status.message);

      if (status.message && /permission|denied|not allowed|autoriz/i.test(status.message)) {
        locationPermissionService.clearRememberedWebGrant();
        void refreshPermissions();
      }
    });
  }, [refreshPermissions]);

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
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo solicitar el permiso.",
      );
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
        setMessage(
          "En Ajustes selecciona Ubicación > Permitir siempre y vuelve a RAPA GO.",
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo solicitar el permiso.",
      );
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
              <p
                style={{
                  margin: "4px 0 10px",
                  fontSize: ".8rem",
                  lineHeight: 1.35,
                }}
              >
                {needsForeground
                  ? "Aceptaste un viaje. Activa el GPS para abrir la ruta, ubicar al pasajero y compartir tu avance mientras el servicio esté activo."
                  : needsBackground
                    ? "Durante un viaje activo, la ubicación debe continuar aunque cambies de aplicación o bloquees la pantalla. Se detiene al cerrar el viaje."
                    : message}
              </p>
            </IonText>
            {message && cardTitle && (
              <div
                style={{
                  fontSize: ".76rem",
                  fontWeight: 850,
                  color: "#9f1d1d",
                  marginBottom: 8,
                }}
              >
                {message}
              </div>
            )}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "flex-start",
              }}
            >
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
