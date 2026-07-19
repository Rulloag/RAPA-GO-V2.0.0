import fp from "fastify-plugin";
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";

const PRODUCTION_WEB_ORIGINS = [
  "https://rapago.cl",
  "https://www.rapago.cl",
  "https://orange-chicken-512082.hostingersite.com",
];

// Capacitor/Ionic WebView origins are exact values, not arbitrary LAN hosts.
const NATIVE_APP_ORIGINS = [
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
];

const DEVELOPMENT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:8100",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:8100",
];

function readAllowedOrigins(): Set<string> {
  const configured = (process.env["CORS_ORIGIN"] ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isProduction = process.env["NODE_ENV"] === "production";

  return new Set([
    ...PRODUCTION_WEB_ORIGINS,
    ...NATIVE_APP_ORIGINS,
    ...(isProduction ? [] : DEVELOPMENT_ORIGINS),
    ...configured,
  ]);
}

function normalizeOrigin(origin: unknown): string | null {
  if (typeof origin !== "string" || !origin.trim()) return null;

  try {
    const parsed = new URL(origin.trim());
    return parsed.origin;
  } catch {
    return null;
  }
}

function getAllowedOrigin(origin: unknown): string | null {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return null;

  return readAllowedOrigins().has(normalized) ? normalized : null;
}

function applyCorsHeaders(
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const allowedOrigin = getAllowedOrigin(request.headers.origin);
  if (!allowedOrigin) return;

  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Origin", allowedOrigin);
  reply.header("Access-Control-Allow-Credentials", "true");
  reply.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  reply.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept, Origin, X-Requested-With",
  );
  reply.header("Access-Control-Max-Age", "600");
}

async function corsPluginImpl(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply);

    if (request.method !== "OPTIONS") return undefined;

    const origin = request.headers.origin;
    const allowedOrigin = getAllowedOrigin(origin);

    if (!origin || allowedOrigin) {
      return reply.code(204).send();
    }

    return reply.code(403).send({
      ok: false,
      code: "CORS_ORIGIN_BLOCKED",
      message: "Origin not allowed.",
    });
  });

  app.addHook("onSend", async (request, reply, payload) => {
    applyCorsHeaders(request, reply);
    return payload;
  });

  app.addHook("onError", async (request, reply) => {
    applyCorsHeaders(request, reply);
  });

  app.options("/*", async (request, reply) => {
    applyCorsHeaders(request, reply);
    return reply.code(204).send();
  });
}

export const corsPlugin = fp(corsPluginImpl, {
  name: "rapago-cors-plugin",
});
