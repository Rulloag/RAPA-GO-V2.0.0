import { useState, useCallback } from "react";
import { Geolocation } from "@capacitor/geolocation";
import type { LatLng, LocationState, LocationStatus } from "./maps.types.js";

const INITIAL_STATE: LocationState = {
  status:   "idle",
  location: null,
  error:    null,
};

function set(status: LocationStatus, location: LatLng | null, error: string | null): LocationState {
  return { status, location, error };
}

/**
 * Requests the device's current location via @capacitor/geolocation.
 *
 * States:
 *  idle                → not yet requested
 *  requesting_permission → waiting for OS permission dialog
 *  loading             → permission granted, acquiring GPS fix
 *  success             → location available in `location`
 *  denied              → user or OS denied the permission
 *  error               → GPS unavailable, timeout, or unexpected failure
 *
 * Nothing is stored in localStorage or sent to the backend.
 * Coordinates live only in React state for the lifetime of the component.
 */
export function useCurrentLocation(): LocationState & { request: () => Promise<void> } {
  const [state, setState] = useState<LocationState>(INITIAL_STATE);

  const request = useCallback(async (): Promise<void> => {
    setState(set("requesting_permission", null, null));

    // ── Permission check ────────────────────────────────────────────────────
    try {
      let perm = await Geolocation.checkPermissions();

      if (perm.location === "prompt" || perm.location === "prompt-with-rationale") {
        perm = await Geolocation.requestPermissions({ permissions: ["location"] });
      }

      if (perm.location === "denied") {
        setState(set("denied", null, "Permiso de ubicación denegado. Habilítalo en Ajustes del dispositivo."));
        return;
      }
    } catch {
      // On web browsers the Permissions API behaves differently.
      // Proceed anyway — getCurrentPosition will trigger the browser prompt.
    }

    // ── Position acquisition ────────────────────────────────────────────────
    setState(set("loading", null, null));

    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout:            10_000,
      });

      setState(set("success", {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      }, null));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo obtener la ubicación.";
      const isDenied = /denied|permission|not allowed/i.test(msg);
      setState(set(
        isDenied ? "denied" : "error",
        null,
        isDenied
          ? "Permiso de ubicación denegado. Habilítalo en Ajustes del dispositivo."
          : `Error de ubicación: ${msg}`,
      ));
    }
  }, []);

  return { ...state, request };
}
