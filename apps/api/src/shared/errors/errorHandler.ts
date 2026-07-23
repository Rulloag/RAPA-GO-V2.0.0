import type { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { AppError } from "./AppError.js";

const IS_PROD = process.env["NODE_ENV"] === "production";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? value as Record<string, unknown>
    : null;
}

function readErrorMetadata(
  error: unknown,
  key: string,
): string | null {
  const direct = asRecord(error);
  const directValue = direct?.[key];

  if (
    typeof directValue === "string" ||
    typeof directValue === "number"
  ) {
    return String(directValue);
  }

  const cause = asRecord(direct?.["cause"]);
  const causeValue = cause?.[key];

  if (
    typeof causeValue === "string" ||
    typeof causeValue === "number"
  ) {
    return String(causeValue);
  }

  return null;
}

function logUnexpectedError(
  error: FastifyError | Error,
  request: FastifyRequest,
): void {
  const metadataEntries = [
    ["dbCode", readErrorMetadata(error, "code")],
    ["schema", readErrorMetadata(error, "schema_name")],
    ["table", readErrorMetadata(error, "table_name")],
    ["column", readErrorMetadata(error, "column_name")],
    ["constraint", readErrorMetadata(error, "constraint_name")],
    ["routine", readErrorMetadata(error, "routine")],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  console.error("[RAPA GO] ERROR NO CONTROLADO");
  console.error(
    `[RAPA GO] Request: ${request.method} ${request.url}`,
  );
  console.error(`[RAPA GO] Request ID: ${request.id}`);
  console.error(`[RAPA GO] Tipo: ${error.name}`);
  console.error(`[RAPA GO] Mensaje: ${error.message}`);

  for (const [key, value] of metadataEntries) {
    console.error(`[RAPA GO] ${key}: ${value}`);
  }

  if (error.stack) {
    console.error(error.stack);
  }
}

/**
 * Global error handler registered on the Fastify instance in app.ts.
 *
 * Priority:
 *  1. AppError — typed application errors, always trusted.
 *  2. Fastify validation errors — maps to VALIDATION_ERROR 400.
 *  3. Everything else — 500 INTERNAL_SERVER_ERROR, details only in logs.
 */
export function globalErrorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof AppError) {
    const isServerError = error.statusCode >= 500;

    if (isServerError) {
      console.error(`[AppError] ${error.code}: ${error.message}`);
    }

    void reply.status(error.statusCode).send({
      ok: false,
      code: error.code,
      message: isServerError
        ? "An unexpected error occurred."
        : error.message,
      statusCode: error.statusCode,
    });
    return;
  }

  const fastifyError = error as FastifyError;

  if (fastifyError.statusCode === 400 || fastifyError.validation) {
    void reply.status(400).send({
      ok: false,
      code: "VALIDATION_ERROR",
      message:
        fastifyError.message ?? "Request validation failed.",
      statusCode: 400,
    });
    return;
  }

  logUnexpectedError(error, request);

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
