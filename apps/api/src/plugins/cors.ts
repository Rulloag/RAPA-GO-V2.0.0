import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

/**
 * Orígenes oficiales de RAPA GO.
 *
 * - api.rapago.cl: frontend web actualmente publicado en Hostinger.
 * - app.rapago.cl: reservado para cuando el subdominio tenga DNS.
 * - localhost: desarrollo local con Vite.
 * - capacitor/ionic: aplicaciones nativas Android/iOS.
 *
 * CORS_ORIGIN y FRONTEND_URL pueden agregar más orígenes sin cambiar código.
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
  const values = [
    process.env["CORS_ORIGIN"] ?? "",
    process.env["FRONTEND_URL"] ?? "",
  ];

  return values
    .flatMap((value) => value.split(","))
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => value !== null);
}

export function getAllowedCorsOrigins(): ReadonlySet<string> {
  const normalizedDefaults = DEFAULT_ALLOWED_ORIGINS
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => origin !== null);

  return new Set([
    ...normalizedDefaults,
    ...readConfiguredOrigins(),
  ]);
}

/**
 * Configuración CORS del backend Fastify.
 *
 * Las solicitudes sin Origin se permiten porque corresponden a servidores,
 * health checks, herramientas CLI o aplicaciones nativas. En navegadores,
 * solo se reflejan cabeceras CORS cuando el Origin está autorizado.
 */
export async function corsPlugin(app: FastifyInstance): Promise<void> {
  const allowedOrigins = getAllowedCorsOrigins();

  await app.register(cors, {
    origin(origin, callback) {
      // curl, health checks y comunicación servidor-a-servidor no siempre
      // incluyen la cabecera Origin.
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);
      callback(
        null,
        normalizedOrigin !== null && allowedOrigins.has(normalizedOrigin),
      );
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposedHeaders: ["Content-Disposition", "X-Request-Id"],
    maxAge: 86_400,
    preflight: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    strictPreflight: true,
  });
}
