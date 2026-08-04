import type { ApiResponse, RequestOptions } from "./apiTypes.js";
import { getApiBaseUrl } from "./apiBaseUrl.js";
import {
  DEFAULT_TIMEOUT_MS,
  networkError,
  timeoutError,
  invalidResponseError,
  parseErrorBody,
} from "./apiErrors.js";

const inFlightGetRequests = new Map<string, Promise<ApiResponse<unknown>>>();
const getRateLimitCooldowns = new Map<
  string,
  { until: number; response: ApiResponse<unknown> }
>();
const globalGetRateLimitCooldowns = new Map<
  string,
  { until: number; response: ApiResponse<unknown> }
>();

function getRequestIdentity(path: string, options: RequestOptions = {}): string {
  return `${options.token ?? "anonymous"}::${path}`;
}

function getRateLimitScope(options: RequestOptions = {}): string {
  return options.token ?? "anonymous";
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const { token, headers: extraHeaders = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    ...extraHeaders,
  };

  if (body !== undefined && !("Content-Type" in headers)) {
    headers["Content-Type"] = "application/json";
  }

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

  if (response.ok === false) {
    const errorResponse = parseErrorBody(parsed, response.status);

    const mustForceLogout =
      Boolean(token) &&
      errorResponse.ok === false &&
      (
        response.status === 401 ||
        [
          "AUTH_SESSION_REVOKED",
          "AUTH_TOKEN_EXPIRED",
          "AUTH_ACCOUNT_DELETED",
          "AUTH_ACCOUNT_SUSPENDED",
          "UNAUTHORIZED",
        ].includes(errorResponse.code)
      );

    if (mustForceLogout) {
      window.dispatchEvent(
        new CustomEvent("auth:force-logout", {
          detail: { code: errorResponse.code },
        }),
      );
    }

    return errorResponse;
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

  if (result.ok === false && RETRYABLE_CODES.has(result.code) && retries > 0) {
    const delayMs = (3 - retries) * 1000;
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));

    return requestWithRetry<T>(method, path, body, options, retries - 1);
  }

  return result;
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    const key = getRequestIdentity(path, options);
    const scope = getRateLimitScope(options);
    const now = Date.now();
    const globalCooldown = globalGetRateLimitCooldowns.get(scope);

    if (globalCooldown && globalCooldown.until > now) {
      return Promise.resolve(globalCooldown.response as ApiResponse<T>);
    }

    if (globalCooldown) globalGetRateLimitCooldowns.delete(scope);

    const cooldown = getRateLimitCooldowns.get(key);

    if (cooldown && cooldown.until > now) {
      return Promise.resolve(cooldown.response as ApiResponse<T>);
    }

    if (cooldown) getRateLimitCooldowns.delete(key);

    const existing = inFlightGetRequests.get(key);
    if (existing) return existing as Promise<ApiResponse<T>>;

    const pending = requestWithRetry<T>("GET", path, undefined, options, 2);
    const tracked = pending.then((result) => {
      if (result.ok === false && result.statusCode === 429) {
        const until = Date.now() + 65_000;
        const cachedResponse = result as ApiResponse<unknown>;

        getRateLimitCooldowns.set(key, { until, response: cachedResponse });
        globalGetRateLimitCooldowns.set(scope, {
          until,
          response: cachedResponse,
        });

        window.dispatchEvent(
          new CustomEvent("api:rate-limited", { detail: { until } }),
        );
      } else {
        getRateLimitCooldowns.delete(key);
      }

      return result;
    }).finally(() => {
      if (inFlightGetRequests.get(key) === tracked) {
        inFlightGetRequests.delete(key);
      }
    });

    inFlightGetRequests.set(key, tracked as Promise<ApiResponse<unknown>>);
    return tracked;
  },

  post<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
    retries = 0,
  ): Promise<ApiResponse<T>> {
    return requestWithRetry<T>("POST", path, body, options, retries);
  },

  patch<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return requestWithRetry<T>("PATCH", path, body, options, 0);
  },

  put<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return requestWithRetry<T>("PUT", path, body, options, 0);
  },

  delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return requestWithRetry<T>("DELETE", path, undefined, options, 0);
  },
};