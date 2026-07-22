import { Capacitor } from "@capacitor/core";

function normalizeConfiguredValue(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function readConfiguredValue(): string {
  const rawValue = String(
    import.meta.env["VITE_API_URL"] ??
      import.meta.env["VITE_API_BASE_URL"] ??
      "",
  ).trim();

  if (!rawValue) {
    if (Capacitor.isNativePlatform()) {
      throw new Error(
        "Falta VITE_API_BASE_URL para conectar la app móvil con el backend.",
      );
    }

    return "/api";
  }

  if (
    Capacitor.isNativePlatform() &&
    !/^https?:\/\//i.test(rawValue)
  ) {
    throw new Error(
      "Configura VITE_API_BASE_URL con una URL absoluta HTTPS para Android/iOS.",
    );
  }

  const normalized = normalizeConfiguredValue(rawValue);

  if (
    Capacitor.isNativePlatform() &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(normalized)
  ) {
    throw new Error(
      "VITE_API_BASE_URL no puede apuntar a localhost dentro del teléfono.",
    );
  }

  return normalized;
}

/**
 * Base de los endpoints del apiClient, siempre terminada conceptualmente en /api.
 *
 * Ejemplos:
 * - Navegador local: /api
 * - Producción: https://api.rapago.cl/api
 */
export function getApiBaseUrl(): string {
  const configured = readConfiguredValue();

  if (/\/api$/i.test(configured)) {
    return configured;
  }

  return `${configured}/api`;
}

/**
 * Origen del backend sin /api.
 * Se usa únicamente en flujos heredados que construyen rutas /api manualmente.
 */
export function getApiOrigin(): string {
  const baseUrl = getApiBaseUrl();

  if (baseUrl === "/api") {
    return "";
  }

  return baseUrl.replace(/\/api$/i, "");
}

export function buildApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (cleanPath === "/api" || cleanPath.startsWith("/api/")) {
    return `${getApiOrigin()}${cleanPath}`;
  }

  return `${getApiBaseUrl()}${cleanPath}`;
}
