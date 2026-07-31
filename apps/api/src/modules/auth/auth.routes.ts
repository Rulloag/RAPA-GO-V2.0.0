import type { FastifyInstance } from "fastify";
import { authController } from "./auth.controller.js";

const LOGIN_RATE_LIMIT = {
  config: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
} as const;

const REGISTER_RATE_LIMIT = {
  bodyLimit: 3 * 1024 * 1024,
  config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
} as const;

const FACEBOOK_RATE_LIMIT = {
  config: { rateLimit: { max: 15, timeWindow: "15 minutes" } },
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

  fastify.post(
    "/facebook/resident-precheck",
    {
      bodyLimit: 3 * 1024 * 1024,
      config: {
        rateLimit: { max: 5, timeWindow: "15 minutes" },
      },
    },
    authController.facebookResidentPrecheck,
  );

  fastify.post(
    "/facebook/resident-status",
    FACEBOOK_RATE_LIMIT,
    authController.facebookResidentStatus,
  );

  fastify.get(
    "/facebook",
    FACEBOOK_RATE_LIMIT,
    authController.facebookLogin,
  );
  fastify.post(
    "/facebook/link/start",
    FACEBOOK_RATE_LIMIT,
    authController.facebookLinkStart,
  );
  fastify.get(
    "/facebook/callback",
    FACEBOOK_RATE_LIMIT,
    authController.facebookCallback,
  );
  fastify.post(
    "/facebook/link-existing",
    FACEBOOK_RATE_LIMIT,
    authController.facebookLinkExisting,
  );
  fastify.post(
    "/facebook/setup",
    FACEBOOK_RATE_LIMIT,
    authController.facebookSetup,
  );
  fastify.post(
    "/facebook/exchange",
    FACEBOOK_RATE_LIMIT,
    authController.facebookExchange,
  );
}
