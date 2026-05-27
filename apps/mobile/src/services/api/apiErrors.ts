import type { ApiErrorResponse } from "./apiTypes.js";

const DEFAULT_TIMEOUT_MS = 25_000;

export { DEFAULT_TIMEOUT_MS };

export function networkError(message = "Network request failed."): ApiErrorResponse {
  return { ok: false, code: "NETWORK_ERROR", message, statusCode: 0 };
}

export function timeoutError(timeoutMs: number): ApiErrorResponse {
  return {
    ok: false,
    code: "TIMEOUT",
    message: `Request timed out after ${timeoutMs}ms.`,
    statusCode: 0,
  };
}

export function invalidResponseError(detail?: string): ApiErrorResponse {
  return {
    ok: false,
    code: "INVALID_RESPONSE",
    message: detail ?? "Server returned an unexpected response format.",
    statusCode: 0,
  };
}

/**
 * Attempt to parse a backend error body.
 * Backend errors follow: { error: { code, message, statusCode } }
 * or the flat auth shape: { ok: false, code, message }
 */
export function authExpiredError(): ApiErrorResponse {
  return {
    ok: false,
    code: "AUTH_EXPIRED",
    message: "Tu sesión expiró. Inicia sesión nuevamente.",
    statusCode: 401,
  };
}

export function parseErrorBody(body: unknown, statusCode: number): ApiErrorResponse {
  if (body !== null && typeof body === "object") {
    const b = body as Record<string, unknown>;

    // Flat envelope: { ok: false, code, message }
    if (typeof b["code"] === "string" && typeof b["message"] === "string") {
      return { ok: false, code: b["code"], message: b["message"], statusCode };
    }

    // Nested envelope: { error: { code, message, statusCode } }
    const err = b["error"];
    if (err !== null && typeof err === "object") {
      const e = err as Record<string, unknown>;
      if (typeof e["code"] === "string" && typeof e["message"] === "string") {
        return {
          ok: false,
          code: e["code"],
          message: e["message"],
          statusCode: typeof e["statusCode"] === "number" ? e["statusCode"] : statusCode,
        };
      }
    }
  }

  return {
    ok: false,
    code: "INTERNAL_SERVER_ERROR",
    message: `Unexpected server error (HTTP ${statusCode}).`,
    statusCode,
  };
}
