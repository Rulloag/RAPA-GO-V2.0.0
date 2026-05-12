/**
 * RAPA GO API — Entry point
 *
 * Sole responsibility: build the app and bind it to a port.
 * All configuration, plugins and routes live in app.ts.
 */

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
