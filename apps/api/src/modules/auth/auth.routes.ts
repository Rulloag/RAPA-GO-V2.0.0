import type { FastifyInstance } from "fastify";
import { authController } from "./auth.controller.js";

const LOGIN_RATE_LIMIT = {
  config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
} as const;

const REGISTER_RATE_LIMIT = {
  bodyLimit: 3 * 1024 * 1024,
  config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
} as const;

/** Auth routes — prefix /api/auth. */
export async function authRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.post("/login", LOGIN_RATE_LIMIT, authController.login);
  fastify.post(
    "/register",
    REGISTER_RATE_LIMIT,
    authController.register,
  );


  fastify.get(
    "/google/status",
    { config: { rateLimit: { max: 30, timeWindow: "15 minutes" } } },
    authController.googleStatus,
  );

  fastify.post(
    "/google",
    {
      bodyLimit: 3 * 1024 * 1024,
      config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
    },
    authController.googleLogin,
  );

  fastify.post(
    "/apple",
    {
      bodyLimit: 3 * 1024 * 1024,
      config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
    },
    authController.appleLogin,
  );
  fastify.post(
    "/apple/link",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    authController.appleLink,
  );
  /**
   * El límite era 30 / 15 min y se agotaba en poco más de un minuto: las
   * pantallas con sondeo (viajes del pasajero cada 2,5 s) disparan un 401 por
   * ciclo, y cada 401 pedía una renovación. Al agotarse, el backend devolvía
   * 429 y la sesión quedaba viva pero inservible.
   *
   * El límite sigue existiendo —es un endpoint de credenciales— pero se
   * dimensiona para el peor caso legítimo en vez de para el ideal. El arreglo
   * de fondo (que el cliente no reintente en bucle) va en AuthProvider.
   */
  fastify.post(
    "/refresh",
    {
      config: {
        rateLimit: { max: 120, timeWindow: "15 minutes" },
      },
    },
    authController.refresh,
  );
  fastify.post("/logout", authController.logout);
  fastify.get("/me", authController.me);

  fastify.post(
    "/password/forgot",
    {
      config: {
        rateLimit: { max: 5, timeWindow: "15 minutes" },
      },
    },
    authController.forgotPassword,
  );

  fastify.post(
    "/password/reset",
    {
      config: {
        rateLimit: { max: 10, timeWindow: "15 minutes" },
      },
    },
    authController.resetPassword,
  );

  fastify.post(
    "/password/create",
    {
      config: {
        rateLimit: { max: 5, timeWindow: "15 minutes" },
      },
    },
    authController.createPassword,
  );

  // Facebook Login fue retirado de RAPA GO.
  // Los handlers históricos se conservan en código únicamente para
  // compatibilidad/auditoría, pero no se exponen rutas públicas.

}
