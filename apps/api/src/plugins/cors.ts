import type { FastifyCorsOptions } from "@fastify/cors";

/**
 * Orígenes autorizados oficialmente por RAPA GO (producción / compartidos).
 *
 * CORS_ORIGIN y FRONTEND_URL pueden añadir más direcciones
 * separadas por comas sin eliminar estos valores predeterminados.
 *
 * Nota: https://staging.rapago.cl NO está aquí a propósito.
 * Solo se añade automáticamente cuando APP_ENV=staging (backend staging aislado).
 * No modificar env de producción para “habilitar” staging FE → prod API.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  "https://api.rapago.cl",
  "https://app.rapago.cl",
  "https://rapago.cl",
  "https://www.rapago.cl",

  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:8100",
  "http://127.0.0.1:8100",

  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
] as const;

/** Solo cuando APP_ENV=staging en el Node app de backend-staging. */
const STAGING_DEFAULT_ORIGINS = ["https://staging.rapago.cl"] as const;

function normalizeOrigin(value: string): string | null {
  const cleanValue = value.trim();

  if (!cleanValue) {
    return null;
  }

  try {
    return new URL(cleanValue).origin;
  } catch {
    return null;
  }
}

function readConfiguredOrigins(): string[] {
  const configuredValues = [
    process.env["CORS_ORIGIN"] ?? "",
    process.env["FRONTEND_URL"] ?? "",
  ];

  return configuredValues
    .flatMap((value) => value.split(","))
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => value !== null);
}

function isStagingAppEnv(): boolean {
  const appEnv = (process.env["APP_ENV"] ?? "").trim().toLowerCase();
  return appEnv === "staging";
}

export function getAllowedCorsOrigins(): ReadonlySet<string> {
  const defaultOrigins = DEFAULT_ALLOWED_ORIGINS
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => origin !== null);

  const stagingOrigins = isStagingAppEnv()
    ? STAGING_DEFAULT_ORIGINS
        .map((origin) => normalizeOrigin(origin))
        .filter((origin): origin is string => origin !== null)
    : [];

  return new Set([
    ...defaultOrigins,
    ...stagingOrigins,
    ...readConfiguredOrigins(),
  ]);
}

/**
 * Estas opciones deben registrarse directamente en la instancia
 * principal de Fastify para que el hook CORS alcance todas las
 * rutas del backend, incluidas /api/auth/*.
 */
export function createCorsOptions(): FastifyCorsOptions {
  const allowedOrigins = getAllowedCorsOrigins();

  return {
    origin(origin, callback) {
      // Herramientas CLI, health checks y comunicación servidor-servidor
      // pueden no enviar la cabecera Origin.
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);

      const isAllowed =
        normalizedOrigin !== null &&
        allowedOrigins.has(normalizedOrigin);

      callback(null, isAllowed);
    },

    credentials: true,

    methods: [
      "GET",
      "HEAD",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    // No se fija allowedHeaders manualmente.
    // @fastify/cors reflejará los encabezados solicitados por el frontend.

    exposedHeaders: [
      "Content-Disposition",
      "X-Request-Id",
    ],

    maxAge: 86_400,
    preflight: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    strictPreflight: true,
  };
}