import type { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { AppError } from "./AppError.js";

const IS_PROD = process.env["NODE_ENV"] === "production";

/**
 * Global error handler registered on the Fastify instance in app.ts.
 *
 * Priority:
 *  1. AppError    — typed application errors, always trusted.
 *  2. Fastify FST_ERR_VALIDATION — maps to VALIDATION_ERROR 400.
 *  3. Everything else — 500 INTERNAL_SERVER_ERROR, stack hidden in prod.
 */
export function globalErrorHandler(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  // 1. Typed AppError
  if (error instanceof AppError) {
    void reply.status(error.statusCode).send({
      ok: false,
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
    });
    return;
  }

  // 2. Fastify schema / Zod validation errors
  const fastifyError = error as FastifyError;
  if (fastifyError.statusCode === 400 || fastifyError.validation) {
    void reply.status(400).send({
      ok: false,
      code: "VALIDATION_ERROR",
      message: fastifyError.message ?? "Request validation failed.",
      statusCode: 400,
    });
    return;
  }

  // 3. Unexpected errors — hide details in production
  const statusCode = fastifyError.statusCode ?? 500;
  const message = IS_PROD
    ? "An unexpected error occurred."
    : (error.message ?? "An unexpected error occurred.");

  void reply.status(statusCode).send({
    ok: false,
    code: "INTERNAL_SERVER_ERROR",
    message,
    statusCode,
  });
}
