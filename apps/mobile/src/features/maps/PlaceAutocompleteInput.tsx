import { useEffect, useRef, useState, useCallback } from "react";
import { IonIcon, IonNote, IonSpinner } from "@ionic/react";
import { closeCircleOutline } from "ionicons/icons";
import { useGoogleMaps } from "./useGoogleMaps.js";
import type { GoogleAutocomplete, MapPoint, PlaceAutocompleteStatus } from "./maps.types.js";

// ── Constants ────────────────────────────────────────────────────────────────

// Bias results toward Rapa Nui without hard-restricting worldwide search
const RAPA_NUI_BOUNDS = {
  north: -27.05,
  south: -27.22,
  east:  -109.25,
  west:  -109.50,
} as const;

const STATUS_NOTE: Partial<Record<PlaceAutocompleteStatus, string>> = {
  no_results: "Sin resultados. Prueba con otro término.",
  error:      "No se pudo completar la búsqueda.",
};

// ── Types ────────────────────────────────────────────────────────────────────

interface AutocompleteHandle {
  instance: GoogleAutocomplete;
  listener: { remove(): void };
}

export interface PlaceAutocompleteInputProps {
  label:         string;
  placeholder?:  string;
  /** Controlled display text — set externally (e.g. "Mi ubicación") to override input. */
  displayValue?: string;
  onSelect:      (point: MapPoint) => void;
  onClear?:      () => void;
  disabled?:     boolean;
  /** Ionicons icon name shown as a leading decorator. */
  iconSlot?:     string;
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Wraps Google Maps Places Autocomplete in a styled, reusable input.
 * Biases results toward Rapa Nui without hard-restricting worldwide search.
 *
 * Key behaviors:
 *  - Autocomplete instance created once, reused via ref — safe across re-renders.
 *  - onSelect always fresh via ref — no stale closures.
 *  - displayValue syncs externally set text (e.g. "Mi ubicación") to the native input.
 *  - Listeners are cleaned up on unmount.
 *  - Nothing written to localStorage or sent to the backend.
 */
export function PlaceAutocompleteInput({
  label,
  placeholder  = "Buscar lugar en Rapa Nui…",
  displayValue = "",
  onSelect,
  onClear,
  disabled     = false,
  iconSlot,
}: PlaceAutocompleteInputProps): JSX.Element {
  const sdkStatus = useGoogleMaps();
  const inputRef  = useRef<HTMLInputElement | null>(null);
  const acRef     = useRef<AutocompleteHandle | null>(null);

  // Always-fresh callback — prevents stale closure inside the Autocomplete listener
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  const [status, setStatus] = useState<PlaceAutocompleteStatus>("idle");

  // Sync externally controlled text to the native input (e.g. "Mi ubicación")
  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.value = displayValue;
    setStatus(displayValue ? "selected" : "idle");
  }, [displayValue]);

  // Initialize Autocomplete once SDK is loaded and input element is mounted
  useEffect(() => {
    if (sdkStatus !== "loaded") return;
    if (!inputRef.current)      return;
    if (acRef.current)          return; // guard against double-init

    const mapsApi = window.google?.maps;
    if (!mapsApi?.places)       return;

    const instance = new mapsApi.places.Autocomplete(inputRef.current, {
      bounds:       RAPA_NUI_BOUNDS,
      strictBounds: false,  // prioritize Rapa Nui but don't limit to it
      fields:       ["name", "geometry", "formatted_address"],
    });

    const listener = instance.addListener("place_changed", () => {
      const place = instance.getPlace();

      if (!place.geometry?.location) {
        setStatus("no_results");
        return;
      }

      const point: MapPoint = {
        label:    place.name ?? place.formatted_address ?? "Lugar seleccionado",
        position: {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        },
      };

      onSelectRef.current(point);
      setStatus("selected");
    });

    acRef.current = { instance, listener };
  }, [sdkStatus]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      const handle = acRef.current;
      if (!handle) return;
      try {
        handle.listener.remove();
        window.google?.maps?.event?.clearInstanceListeners(handle.instance);
      } catch {
        // Ignore — SDK may have been unloaded already
      }
    };
  }, []);

  const handleInput = useCallback(() => {
    const val = inputRef.current?.value.trim() ?? "";
    if (!val) { setStatus("idle"); return; }
    if (status !== "selected") setStatus("searching");
  }, [status]);

  const handleClear = useCallback(() => {
    if (inputRef.current) inputRef.current.value = "";
    setStatus("idle");
    onClear?.();
  }, [onClear]);

  const isReady   = sdkStatus === "loaded";
  const showClear = status !== "idle" && !disabled;
  const borderColor = status === "selected"
    ? "var(--ion-color-success)"
    : status === "error" || status === "no_results"
      ? "var(--ion-color-danger)"
      : "var(--ion-color-light-shade)";

  return (
    <div style={{ marginBottom: "4px" }}>

      {/* Label */}
      <div style={{
        fontSize:      "0.72rem",
        fontWeight:    600,
        color:         "var(--ion-color-medium)",
        marginBottom:  "4px",
        paddingLeft:   "4px",
        letterSpacing: "0.03em",
        textTransform: "uppercase",
      }}>
        {label}
      </div>

      {/* Input row */}
      <div style={{
        display:      "flex",
        alignItems:   "center",
        gap:          "6px",
        background:   disabled ? "var(--ion-color-light-shade)" : "var(--ion-card-background, #fff)",
        border:       `1.5px solid ${borderColor}`,
        borderRadius: "10px",
        padding:      "0 10px",
        height:       "44px",
        transition:   "border-color 0.15s",
      }}>
        {iconSlot && (
          <IonIcon
            icon={iconSlot}
            style={{ fontSize: "1rem", color: "var(--ion-color-medium)", flexShrink: 0 }}
          />
        )}

        <input
          ref={inputRef}
          type="text"
          placeholder={isReady ? placeholder : "Cargando…"}
          disabled={disabled || !isReady}
          onInput={handleInput}
          autoComplete="off"
          style={{
            flex:       1,
            border:     "none",
            outline:    "none",
            background: "transparent",
            fontSize:   "0.9rem",
            color:      disabled ? "var(--ion-color-medium)" : "var(--ion-color-dark)",
            minWidth:   0,
            caretColor: "var(--ion-color-primary)",
          }}
        />

        {sdkStatus === "loading" && (
          <IonSpinner name="dots" style={{ width: "16px", height: "16px", flexShrink: 0 }} />
        )}

        {showClear && isReady && (
          <button
            onClick={handleClear}
            aria-label={`Limpiar campo ${label}`}
            style={{
              background: "none",
              border:     "none",
              padding:    "2px",
              cursor:     "pointer",
              display:    "flex",
              alignItems: "center",
              color:      "var(--ion-color-medium)",
              flexShrink: 0,
            }}
          >
            <IonIcon icon={closeCircleOutline} style={{ fontSize: "1.1rem" }} />
          </button>
        )}
      </div>

      {/* Status note */}
      {STATUS_NOTE[status] && (
        <IonNote
          color={status === "error" ? "danger" : "medium"}
          style={{ fontSize: "0.7rem", paddingLeft: "4px", display: "block", marginTop: "3px" }}
        >
          {STATUS_NOTE[status]}
        </IonNote>
      )}
      {sdkStatus === "no-key" && (
        <IonNote
          color="danger"
          style={{ fontSize: "0.7rem", paddingLeft: "4px", display: "block", marginTop: "3px" }}
        >
          VITE_GOOGLE_MAPS_API_KEY no configurada.
        </IonNote>
      )}

    </div>
  );
}
