import type { FastifyInstance } from "fastify";
import { legalController } from "./legal.controller.js";

export async function legalDocumentsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/legal-documents",        legalController.listDocuments);
  fastify.get("/legal-documents/active", legalController.getActive);
  fastify.get("/legal-documents/:id",    legalController.getDocument);
  fastify.post("/legal-documents",       legalController.createDocument);
  fastify.patch("/legal-documents/:id",  legalController.updateDocument);
  fastify.post("/user-acceptances",      legalController.createAcceptance);
  fastify.get("/user-acceptances/me",    legalController.getMyAcceptances);
}

export async function adminLegalRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/user-acceptances", legalController.listAcceptances);
}
