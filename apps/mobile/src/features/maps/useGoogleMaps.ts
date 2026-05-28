import { useState, useEffect } from "react";
import { env } from "../../config/env.js";
import type { MapLoadStatus } from "./maps.types.js";

const SCRIPT_ID = "rapa-go-google-maps-sdk";

/**
 * Dynamically injects the Google Maps JS SDK once and tracks load status.
 * Safe to call from multiple components — script is injected only once.
 */
export function useGoogleMaps(): MapLoadStatus {
  const [status, setStatus] = useState<MapLoadStatus>("idle");

  useEffect(() => {
    const apiKey = env.googleMapsApiKey;

    // Key absent or empty string (not configured)
    if (!apiKey) {
      setStatus("no-key");
      return;
    }

    // SDK already loaded from a previous mount
    if (window.google?.maps) {
      setStatus("loaded");
      return;
    }

    // Script tag already injected by another instance — wait for it
    if (document.getElementById(SCRIPT_ID)) {
      setStatus("loading");
      const interval = setInterval(() => {
        if (window.google?.maps) {
          setStatus("loaded");
          clearInterval(interval);
        }
      }, 150);
      return () => clearInterval(interval);
    }

    setStatus("loading");

    const script = document.createElement("script");
    script.id    = SCRIPT_ID;
    script.src   = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;

    script.onload  = () => setStatus("loaded");
    script.onerror = () => {
      script.remove();
      setStatus("error");
    };

    document.head.appendChild(script);
  }, []);

  return status;
}
