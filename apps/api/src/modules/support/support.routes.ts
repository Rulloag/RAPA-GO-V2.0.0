import type { FastifyInstance } from "fastify";
import { supportController } from "./support.controller.js";

const WRITE_LIMIT = {
  config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
} as const;

export async function supportRoutes(app: FastifyInstance): Promise<void> {
  app.post("/cases", WRITE_LIMIT, supportController.create);
  app.get("/cases/me", supportController.listMine);
  app.get("/cases/:id", supportController.getMine);
  app.post("/cases/:id/messages", WRITE_LIMIT, supportController.addMessage);
}

export async function adminSupportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/cases", supportController.listAdmin);
  app.get("/cases/:id", supportController.getAdmin);
  app.patch("/cases/:id", WRITE_LIMIT, supportController.updateAdmin);
}
