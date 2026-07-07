import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:8100",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:8100",
  "http://192.168.100.91:5173",
  "https://orange-chicken-512082.hostingersite.com",
  "https://rapago.cl",
  "https://www.rapago.cl",
  "https://api.rapago.cl",
];

function readAllowedOrigins(): string[] {
  const envOrigins = (process.env["CORS_ORIGIN"] ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...envOrigins]));
}

function isAllowedLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname;
    const port = url.port;

    const isLocalHost =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("172.");

    const isDevPort =
      port === "5173" ||
      port === "5174" ||
      port === "8100" ||
      port === "3000";

    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      isLocalHost &&
      isDevPort
    );
  } catch {
    return false;
  }
}

function getAllowedOrigin(origin: unknown): string | null {
  if (typeof origin !== "string" || !origin.trim()) return null;

  const cleanOrigin = origin.trim();
  const allowedOrigins = readAllowedOrigins();

  if (allowedOrigins.includes(cleanOrigin) || isAllowedLocalOrigin(cleanOrigin)) {
    return cleanOrigin;
  }

  return null;
}

function applyCorsHeaders(request: FastifyRequest, reply: FastifyReply): void {
  const allowedOrigin = getAllowedOrigin(request.headers.origin);

  if (!allowedOrigin) return;

  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Origin", allowedOrigin);
  reply.header("Access-Control-Allow-Credentials", "true");
  reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  reply.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept, Origin, X-Requested-With",
  );
  reply.header("Access-Control-Expose-Headers", "Content-Length");
}

async function corsPluginImpl(app: FastifyInstance): Promise<void> {
  console.log("[CORS] plugin global cargado sin encapsulación");

  app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply);

    if (request.method === "OPTIONS") {
      const origin = request.headers.origin;
      const allowedOrigin = getAllowedOrigin(origin);

      if (!origin || allowedOrigin) {
        return reply.code(204).send();
      }

      return reply.code(403).send({
        ok: false,
        code: "CORS_ORIGIN_BLOCKED",
        message: `Origin not allowed: ${origin}`,
      });
    }

    return undefined;
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