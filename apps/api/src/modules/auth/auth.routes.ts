import type { FastifyInstance } from "fastify";
import { authController } from "./auth.controller.js";

/**
 * Auth routes
 * Prefix: /api/auth
 */

export async function authRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  // Auth normal
  fastify.post("/login", authController.login);
  fastify.post("/register", authController.register);
  fastify.post("/logout", authController.logout);
  fastify.get("/me", authController.me);

  // Recuperación automática de contraseña.
  fastify.post(
    "/password/forgot",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
        },
      },
    },
    authController.forgotPassword,
  );

  fastify.post(
    "/password/reset",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "15 minutes",
        },
      },
    },
    authController.resetPassword,
  );

  // Validación previa de Residente Rapa Nui para Facebook.
  // El documento puede pesar hasta 1.5 MB; en base64 el cuerpo JSON es mayor.
  fastify.post(
    "/facebook/resident-precheck",
    {
      bodyLimit: 3 * 1024 * 1024,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
        },
      },
    },
    authController.facebookResidentPrecheck,
  );

  fastify.post(
    "/facebook/resident-status",
    {
      config: {
        rateLimit: {
          max: 15,
          timeWindow: "15 minutes",
        },
      },
    },
    authController.facebookResidentStatus,
  );

  // Facebook Login
  fastify.get("/facebook", authController.facebookLogin);
  fastify.get("/facebook/callback", authController.facebookCallback);
}