import { useState, useEffect } from "react";
import { env } from "../../config/env.js";
import type { MapLoadStatus } from "./maps.types.js";

const SCRIPT_ID = "rapa-go-google-maps-sdk";

/**
 * Injects the Google Maps JS SDK (loading=async) and waits for the
 * "maps" and "places" libraries to be fully available via importLibrary.
 *
 * With loading=async, script.onload fires when the bootstrap is ready,
 * but window.google.maps.Map / Autocomplete are undefined until importLibrary
 * resolves. This hook waits for both before returning "loaded".
 *
 * Safe to call from multiple components — script injected only once.
 */
export function useGoogleMaps(): MapLoadStatus {
  const [status, setStatus] = useState<MapLoadStatus>("idle");

  useEffect(() => {
    const apiKey = env.googleMapsApiKey;

    if (!apiKey) {
      setStatus("no-key");
      return;
    }

    // Already fully initialized (Map + Autocomplete classes available)
    if (window.google?.maps?.Map && window.google.maps.places?.Autocomplete) {
      setStatus("loaded");
      return;
    }

    let cancelled = false;

    async function loadLibraries(): Promise<void> {
      try {
        setStatus("loading");

        // Inject the bootstrap script if not already present
        if (!document.getElementById(SCRIPT_ID)) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.id    = SCRIPT_ID;
            script.src   = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async`;
            script.async = true;
            script.defer = true;
            script.onload  = () => resolve();
            script.onerror = () => reject(new Error("Google Maps script failed to load"));
            document.head.appendChild(script);
          });
        } else {
          // Another instance already injected — wait until importLibrary appears
          await new Promise<void>((resolve) => {
            const iv = setInterval(() => {
              if (window.google?.maps?.importLibrary) {
                clearInterval(iv);
                resolve();
              }
            }, 100);
          });
        }

        if (cancelled) return;

        const mapsApi = window.google?.maps;
        if (!mapsApi?.importLibrary) {
          throw new Error("importLibrary not available after script load");
        }

        // Load core Maps and Places libraries (populates Map, Autocomplete, etc.)
        await Promise.all([
          mapsApi.importLibrary("maps"),
          mapsApi.importLibrary("places"),
        ]);

        if (cancelled) return;
        setStatus("loaded");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void loadLibraries();

    return () => { cancelled = true; };
  }, []);

  return status;
}
