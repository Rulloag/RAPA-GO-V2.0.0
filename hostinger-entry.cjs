"use strict";

/**
 * Archivo de entrada exclusivo para Hostinger.
 * Inicia el backend compilado del monorepo RAPA GO.
 */

console.log("[HOSTINGER] Ejecutando hostinger-entry.cjs");
console.log("[HOSTINGER] NODE_ENV:", process.env.NODE_ENV ?? "no definido");
console.log("[HOSTINGER] HOST:", process.env.HOST ?? "no definido");
console.log("[HOSTINGER] PORT:", process.env.PORT ?? "no definido");

async function start() {
  try {
    console.log("[HOSTINGER] Importando apps/api/dist/server.js...");

    await import("./apps/api/dist/server.js");

    console.log("[HOSTINGER] Backend importado correctamente.");
  } catch (error) {
    console.error("[HOSTINGER] ERROR AL IMPORTAR EL BACKEND:");
    console.error(error);
    process.exit(1);
  }
}

void start();