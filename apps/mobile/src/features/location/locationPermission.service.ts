import { Capacitor } from "@capacitor/core";
import { Geolocation, type PermissionStatus } from "@capacitor/geolocation";
import { NativeBackgroundLocation } from "./nativeBackgroundLocation.plugin.js";
import type { RapaGoPermissionSnapshot } from "./location.types.js";

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

async function webServiceEnabled(): Promise<boolean | null> {
  if (typeof navigator === "undefined") {
    return null;
  }

  return Boolean(navigator.geolocation);
}

async function getWebForegroundPermission(): Promise<
  RapaGoPermissionSnapshot["foreground"]
> {
  if (
    typeof navigator === "undefined" ||
    !navigator.geolocation
  ) {
    return "denied";
  }

  try {
    if (navigator.permissions?.query) {
      const result = await navigator.permissions.query({
        name: "geolocation" as PermissionName,
      });

      if (result.state === "granted") {
        return "granted";
      }

      if (result.state === "denied") {
        return "denied";
      }
    }
  } catch {
    // Algunos navegadores no permiten consultar geolocation
    // mediante Permissions API. El permiso se solicita al usar GPS.
  }

  return "prompt";
}

export const locationPermissionService = {
  async check(): Promise<RapaGoPermissionSnapshot> {
    const currentPlatform = platform();

    if (!Capacitor.isNativePlatform()) {
      const foreground = await getWebForegroundPermission();

      return {
        platform: currentPlatform,
        foreground,
        coarse: foreground,
        background: "not-applicable",
        notifications: "not-applicable",
        locationServicesEnabled: await webServiceEnabled(),
      };
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
        () => resolve(),
        (error) => {
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

    return this.check();
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