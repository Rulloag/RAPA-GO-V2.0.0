import type { ApiResponse, RequestOptions } from "./apiTypes.js";
import {
  DEFAULT_TIMEOUT_MS,
  networkError,
  timeoutError,
  invalidResponseError,
  parseErrorBody,
} from "./apiErrors.js";

const BASE_URL = (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "";

/**
 * Centralized HTTP client for RAPA GO mobile.
 *
 * Rules:
 *  - All backend requests go through this client.
 *  - Never import fetch directly in service files — use apiClient.
 *  - Authorization tokens come from memory only (AuthProvider state).
 *  - No Supabase, Firebase, or external provider dependencies.
 *  - No localStorage, sessionStorage, or Capacitor Preferences for tokens.
 */

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const { token, headers: extraHeaders = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const url = `${BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timerId = setTimeout(() => { controller.abort(); }, timeoutMs);

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

  // Handle empty body responses (204 No Content, 205 Reset Content)
  if (response.status === 204 || response.status === 205) {
    return { ok: true, data: undefined as T, statusCode: response.status };
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return invalidResponseError(`Non-JSON body for ${method} ${path} (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    return parseErrorBody(parsed, response.status);
  }

  return { ok: true, data: parsed as T, statusCode: response.status };
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return request<T>("GET", path, undefined, options);
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return request<T>("POST", path, body, options);
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return request<T>("PATCH", path, body, options);
  },

  delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return request<T>("DELETE", path, undefined, options);
  },
};
