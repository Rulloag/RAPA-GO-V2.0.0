import type { FastifyInstance } from "fastify";
import { documentsController } from "./documents.controller.js";

/**
 * Documents routes — registered under /api/documents prefix in app.ts.
 *
 * Endpoints:
 *   GET  /api/documents/me — list authenticated user's documents
 *   POST /api/documents/me — create a pending document record
 */
export async function documentsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/me",                      documentsController.listDocuments);
  fastify.post("/me",                     documentsController.createDocument);
  fastify.patch("/me/:id/upload-metadata", documentsController.uploadMetadata);
}
