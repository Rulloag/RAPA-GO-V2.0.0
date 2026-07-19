import type { FastifyInstance } from "fastify";
import { authController } from "./auth.controller.js";

/**
 * Auth routes — registered under /api/auth prefix in server.ts.
 *
 * Endpoints:
 *   POST /api/auth/login     — exchange credentials for session
 *   POST /api/auth/register  — create a new user account
 *   POST /api/auth/logout    — invalidate current session
 *   GET  /api/auth/me        — return current authenticated user
 *   POST /api/auth/refresh   — rotate an access/refresh token pair
 *   POST /api/auth/apple     — exchange a verified Apple identity for a session
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post("/login", authController.login);
  fastify.post("/register", authController.register);
  fastify.post("/logout", authController.logout);
  fastify.get("/me", authController.me);
  fastify.post("/refresh", authController.refresh);
  fastify.post("/apple", authController.apple);
}
