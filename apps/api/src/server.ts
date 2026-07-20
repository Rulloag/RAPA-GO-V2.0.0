/**
 * RAPA GO API — Entry point
 *
 * Construye la aplicación Fastify y escucha el puerto
 * entregado por Hostinger.
 */

import type { FastifyInstance } from "fastify";

let app: FastifyInstance | undefined;
let shuttingDown = false;

/**
 * Obtiene y valida el puerto.
 *
 * Hostinger normalmente entrega PORT automáticamente.
 * Para desarrollo local se utiliza 3000.
 */
function resolvePort(): number {
  const rawPort = String(process.env["PORT"] ?? "3000").trim();
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `La variable PORT no es válida: "${rawPort}". Debe ser un número entre 1 y 65535.`,
    );
  }

  return port;
}

/**
 * Convierte cualquier error en un formato visible
 * dentro de los registros de Hostinger.
 */
function logFatalError(error: unknown): void {
  if (error instanceof Error) {
    console.error("[RAPA GO] ERROR FATAL AL INICIAR EL BACKEND");
    console.error(`[RAPA GO] Tipo: ${error.name}`);
    console.error(`[RAPA GO] Mensaje: ${error.message}`);

    if (error.stack) {
      console.error(error.stack);
    }

    return;
  }

  console.error("[RAPA GO] ERROR FATAL DESCONOCIDO:", error);
}

/**
 * Inicia la API.
 *
 * app.ts se importa dentro del try para capturar también
 * errores producidos durante la carga de módulos, plugins,
 * rutas, base de datos o variables de entorno.
 */
async function start(): Promise<void> {
  try {
    const { buildApp } = await import("./app.js");

    app = await buildApp();

    const port = resolvePort();
    const host = String(
      process.env["HOST"] ?? "0.0.0.0",
    ).trim() || "0.0.0.0";

    await app.listen({
      port,
      host,
    });

    console.log(
      `[RAPA GO] Backend iniciado correctamente en ${host}:${port}`,
    );
  } catch (error) {
    logFatalError(error);

    if (app) {
      try {
        await app.close();
      } catch (closeError) {
        console.error(
          "[RAPA GO] No se pudo cerrar la aplicación después del error:",
          closeError,
        );
      }
    }

    process.exit(1);
  }
}

/**
 * Cierre controlado de la aplicación.
 */
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(`[RAPA GO] Señal ${signal} recibida. Cerrando servidor...`);

  try {
    if (app) {
      await app.close();
    }

    console.log("[RAPA GO] Servidor cerrado correctamente.");
    process.exit(0);
  } catch (error) {
    console.error("[RAPA GO] Error durante el cierre:", error);
    process.exit(1);
  }
}

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("unhandledRejection", (reason) => {
  console.error("[RAPA GO] Promesa rechazada sin controlar:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[RAPA GO] Excepción no controlada:", error);
  void shutdown("uncaughtException");
});

await start();