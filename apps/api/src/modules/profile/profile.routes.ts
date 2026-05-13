import type { FastifyInstance } from "fastify";
import { profileController } from "./profile.controller.js";

/**
 * Profile routes — registered under /api/profile prefix in app.ts.
 *
 * Endpoints:
 *   GET   /api/profile/me  — return authenticated user's profile
 *   PATCH /api/profile/me  — update name / avatarUrl
 */
export async function profileRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/me",   profileController.getProfile);
  fastify.patch("/me", profileController.updateProfile);
}
