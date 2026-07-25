import { Capacitor } from "@capacitor/core";
import { Geolocation, type PermissionStatus } from "@capacitor/geolocation";
import { NativeBackgroundLocation } from "./nativeBackgroundLocation.plugin.js";
import type { RapaGoPermissionSnapshot } from "./location.types.js";

const WEB_FOREGROUND_GRANTED_KEY =
  "rapago_web_location_foreground_granted_v1";

function readRememberedWebGrant(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(WEB_FOREGROUND_GRANTED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberWebGrant(granted: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (granted) {
      window.localStorage.setItem(WEB_FOREGROUND_GRANTED_KEY, "1");
    } else {
      window.localStorage.removeItem(WEB_FOREGROUND_GRANTED_KEY);
    }
  } catch {
    // El almacenamiento puede estar bloqueado en navegación privada.
  }
}

function webSnapshot(
  foreground: RapaGoPermissionSnapshot["foreground"],
): RapaGoPermissionSnapshot {
  return {
    platform: "web",
    foreground,
    coarse: foreground,
    background: "not-applicable",
    notifications: "not-applicable",
    locationServicesEnabled:
      typeof navigator !== "undefined" && Boolean(navigator.geolocation),
  };
}

function normalizePermission(
  value: PermissionStatus["location"] | undefined,
): RapaGoPermissionSnapshot["foreground"] {
  if (
    value === "granted" ||
    value === "denied" ||
    value === "prompt-with-rationale"
  ) {
    return value;
  }

  return "prompt";
}

function platform(): RapaGoPermissionSnapshot["platform"] {
  const value = Capacitor.getPlatform();

  if (value === "android" || value === "ios") {
    return value;
  }

  return "web";
}


async function getWebForegroundPermission(): Promise<
  RapaGoPermissionSnapshot["foreground"]
> {
  if (
    typeof navigator === "undefined" ||
    !navigator.geolocation
  ) {
    rememberWebGrant(false);
    return "denied";
  }

  try {
    if (navigator.permissions?.query) {
      const result = await navigator.permissions.query({
        name: "geolocation" as PermissionName,
      });

      if (result.state === "granted") {
        rememberWebGrant(true);
        return "granted";
      }

      if (result.state === "denied") {
        rememberWebGrant(false);
        return "denied";
      }
    }
  } catch {
    // Safari y Chrome en iPhone pueden no exponer geolocation
    // mediante Permissions API aunque el GPS ya esté autorizado.
  }

  return readRememberedWebGrant() ? "granted" : "prompt";
}

export const locationPermissionService = {
  async check(): Promise<RapaGoPermissionSnapshot> {
    const currentPlatform = platform();

    if (!Capacitor.isNativePlatform()) {
      const foreground = await getWebForegroundPermission();
      return webSnapshot(foreground);
    }

    let geo: PermissionStatus;

    try {
      geo = await Geolocation.checkPermissions();
    } catch {
      geo = {
        location: "prompt",
        coarseLocation: "prompt",
      };
    }

    try {
      const native =
        await NativeBackgroundLocation.getPermissionState();

      return {
        platform: currentPlatform,
        foreground: native.foreground,
        coarse: normalizePermission(geo.coarseLocation),
        background: native.background,
        notifications: native.notifications,
        locationServicesEnabled: native.locationServicesEnabled,
      };
    } catch {
      return {
        platform: currentPlatform,
        foreground: normalizePermission(geo.location),
        coarse: normalizePermission(geo.coarseLocation),
        background: "unknown",
        notifications: "unknown",
        locationServicesEnabled: null,
      };
    }
  },

  async requestForeground(): Promise<RapaGoPermissionSnapshot> {
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeBackgroundLocation.requestForegroundPermission();
      } catch {
        await Geolocation.requestPermissions({
          permissions: ["location"],
        });
      }

      return this.check();
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      throw new Error(
        "Este navegador no permite usar ubicación GPS.",
      );
    }

    await new Promise<void>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          rememberWebGrant(true);
          resolve();
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            rememberWebGrant(false);
          }

          const message =
            error.code === error.PERMISSION_DENIED
              ? "Permiso de ubicación denegado. Permite la ubicación desde la configuración del sitio."
              : error.code === error.POSITION_UNAVAILABLE
                ? "No se pudo detectar tu ubicación. Activa el GPS y vuelve a intentar."
                : error.code === error.TIMEOUT
                  ? "La ubicación tardó demasiado. Revisa el GPS y vuelve a intentar."
                  : "No se pudo activar la ubicación.";

          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        },
      );
    });

    return webSnapshot("granted");
  },

  async requestBackground(): Promise<RapaGoPermissionSnapshot> {
    if (!Capacitor.isNativePlatform()) {
      return this.check();
    }

    await NativeBackgroundLocation.requestBackgroundPermission();
    return this.check();
  },

  async requestNotifications(): Promise<RapaGoPermissionSnapshot> {
    if (!Capacitor.isNativePlatform()) {
      return this.check();
    }

    await NativeBackgroundLocation.requestNotificationPermission();
    return this.check();
  },

  clearRememberedWebGrant(): void {
    if (!Capacitor.isNativePlatform()) {
      rememberWebGrant(false);
    }
  },

  async openSettings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      if (typeof window !== "undefined") {
        window.alert(
          "En navegador: abre la configuración del sitio de api.rapago.cl y permite Ubicación.",
        );
      }

      return;
    }

    await NativeBackgroundLocation.openAppSettings();
  },
};