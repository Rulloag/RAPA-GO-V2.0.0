import { Capacitor } from "@capacitor/core";
import { Geolocation, type PermissionStatus } from "@capacitor/geolocation";
import { NativeBackgroundLocation } from "./nativeBackgroundLocation.plugin.js";
import type { RapaGoPermissionSnapshot } from "./location.types.js";

function normalizePermission(
  value: PermissionStatus["location"] | undefined,
): RapaGoPermissionSnapshot["foreground"] {
  if (value === "granted" || value === "denied" || value === "prompt-with-rationale") {
    return value;
  }
  return "prompt";
}

function platform(): RapaGoPermissionSnapshot["platform"] {
  const value = Capacitor.getPlatform();
  if (value === "android" || value === "ios") return value;
  return "web";
}

async function webServiceEnabled(): Promise<boolean | null> {
  if (typeof navigator === "undefined") return null;
  return Boolean(navigator.geolocation);
}

export const locationPermissionService = {
  async check(): Promise<RapaGoPermissionSnapshot> {
    const currentPlatform = platform();
    let geo: PermissionStatus;

    try {
      geo = await Geolocation.checkPermissions();
    } catch {
      geo = { location: "prompt", coarseLocation: "prompt" };
    }

    if (!Capacitor.isNativePlatform()) {
      return {
        platform: currentPlatform,
        foreground: normalizePermission(geo.location),
        coarse: normalizePermission(geo.coarseLocation),
        background: "not-applicable",
        notifications: "not-applicable",
        locationServicesEnabled: await webServiceEnabled(),
      };
    }

    try {
      const native = await NativeBackgroundLocation.getPermissionState();
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
        await Geolocation.requestPermissions({ permissions: ["location"] });
      }
    } else {
      await Geolocation.requestPermissions({ permissions: ["location"] });
    }

    return this.check();
  },

  async requestBackground(): Promise<RapaGoPermissionSnapshot> {
    if (!Capacitor.isNativePlatform()) return this.check();
    await NativeBackgroundLocation.requestBackgroundPermission();
    return this.check();
  },

  async requestNotifications(): Promise<RapaGoPermissionSnapshot> {
    if (!Capacitor.isNativePlatform()) return this.check();
    await NativeBackgroundLocation.requestNotificationPermission();
    return this.check();
  },

  async openSettings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    await NativeBackgroundLocation.openAppSettings();
  },
};
