/**
 * RAPA GO API — Entry point
 *
 * Sole responsibility: build the app and bind it to a port.
 * All configuration, plugins and routes live in app.ts.
 */

import "dotenv/config";
import { buildApp } from "./app.js";

const app = await buildApp();

const port = Number(process.env["PORT"] ?? 3000);
const host = process.env["HOST"] ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// ── Graceful shutdown ──────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "Received shutdown signal, closing server…");
  try {
    await app.close();
    app.log.info("Server closed cleanly.");
    process.exit(0);
  } catch (err) {
    app.log.error(err, "Error during shutdown.");
    process.exit(1);
  }
}

process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
process.on("SIGINT",  () => { void shutdown("SIGINT");  });
