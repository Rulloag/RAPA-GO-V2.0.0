import type { ApiResponse, RequestOptions } from "./apiTypes.js";
import {
  DEFAULT_TIMEOUT_MS,
  networkError,
  timeoutError,
  invalidResponseError,
  parseErrorBody,
} from "./apiErrors.js";

const BASE_URL = (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "";

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const { token, headers: extraHeaders = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  let cleanPath = path;
  if (BASE_URL.endsWith("/api") && path.startsWith("/api")) {
    cleanPath = path.substring(4);
  }

  const url = `${BASE_URL}${cleanPath}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);

  const init: RequestInit = {
    method,
    headers,
    signal: controller.signal,
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (err) {
    clearTimeout(timerId);

    if (err instanceof DOMException && err.name === "AbortError") {
      return timeoutError(timeoutMs);
    }

    const msg = err instanceof Error ? err.message : "Unknown network error.";
    return networkError(msg);
  } finally {
    clearTimeout(timerId);
  }

  if (response.status === 401) {
    return {
      ok: false,
      statusCode: 401,
      code: "UNAUTHORIZED",
      message: "No autorizado.",
    } as ApiResponse<T>;
  }

  if (response.status === 204 || response.status === 205) {
    return { ok: true, data: undefined as T, statusCode: response.status };
  }

  let parsed: unknown;

  try {
    parsed = await response.json();
  } catch {
    return invalidResponseError(
      `Non-JSON body for ${method} ${path} (HTTP ${response.status}).`,
    );
  }

  if (!response.ok) {
    return parseErrorBody(parsed, response.status);
  }

  return {
    ok: true,
    data: parsed as T,
    statusCode: response.status,
  };
}

const RETRYABLE_CODES = new Set(["NETWORK_ERROR", "TIMEOUT"]);

async function requestWithRetry<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body: unknown,
  options: RequestOptions = {},
  retries = 2,
): Promise<ApiResponse<T>> {
  const result = await request<T>(method, path, body, options);

  if (!result.ok && RETRYABLE_CODES.has(result.code) && retries > 0) {
    const delayMs = (3 - retries) * 1000;
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));

    return requestWithRetry<T>(method, path, body, options, retries - 1);
  }

  return result;
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return requestWithRetry<T>("GET", path, undefined, options, 2);
  },

  post<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
    retries = 1,
  ): Promise<ApiResponse<T>> {
    return requestWithRetry<T>("POST", path, body, options, retries);
  },

  patch<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return requestWithRetry<T>("PATCH", path, body, options, 1);
  },

  put<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return requestWithRetry<T>("PUT", path, body, options, 1);
  },

  delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return requestWithRetry<T>("DELETE", path, undefined, options, 1);
  },
};