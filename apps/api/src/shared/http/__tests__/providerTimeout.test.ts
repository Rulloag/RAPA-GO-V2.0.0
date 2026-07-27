import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchWithTimeout,
  resolveTimeoutMs,
  ProviderTimeoutError,
  ProviderNetworkError,
} from "../providerTimeout.js";

describe("resolveTimeoutMs", () => {
  const ENV_VAR = "TEST_PROVIDER_TIMEOUT_MS";

  afterEach(() => {
    delete process.env[ENV_VAR];
  });

  it("returns the fallback when the env var is not set", () => {
    expect(resolveTimeoutMs(ENV_VAR, 8000)).toBe(8000);
  });

  it("returns the fallback when the env var is not a valid number", () => {
    process.env[ENV_VAR] = "not-a-number";
    expect(resolveTimeoutMs(ENV_VAR, 8000)).toBe(8000);
  });

  it("returns the fallback when the env var is zero or negative", () => {
    process.env[ENV_VAR] = "0";
    expect(resolveTimeoutMs(ENV_VAR, 8000)).toBe(8000);
    process.env[ENV_VAR] = "-500";
    expect(resolveTimeoutMs(ENV_VAR, 8000)).toBe(8000);
  });

  it("returns the parsed value when the env var is a valid positive number", () => {
    process.env[ENV_VAR] = "5000";
    expect(resolveTimeoutMs(ENV_VAR, 8000)).toBe(5000);
  });
});

describe("fetchWithTimeout", () => {
  it("resolves normally when the provider responds before the timeout", async () => {
    const fakeResponse = { ok: true, status: 200 } as Response;
    const fetchImpl = vi.fn().mockResolvedValueOnce(fakeResponse);

    const result = await fetchWithTimeout("test-provider", "https://example.com", {}, 5000, fetchImpl);

    expect(result).toBe(fakeResponse);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const passedInit = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(passedInit.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws ProviderTimeoutError when the provider exceeds the timeout", async () => {
    const timeoutError = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    const fetchImpl = vi.fn().mockRejectedValueOnce(timeoutError);

    await expect(
      fetchWithTimeout("test-provider", "https://example.com", {}, 10, fetchImpl),
    ).rejects.toBeInstanceOf(ProviderTimeoutError);
  });

  it("throws ProviderNetworkError on a generic network failure (not a timeout)", async () => {
    const networkError = new TypeError("fetch failed");
    const fetchImpl = vi.fn().mockRejectedValueOnce(networkError);

    await expect(
      fetchWithTimeout("test-provider", "https://example.com", {}, 5000, fetchImpl),
    ).rejects.toBeInstanceOf(ProviderNetworkError);
  });

  it("propagates an HTTP error response as a normal resolved Response, not a thrown error", async () => {
    const errorResponse = { ok: false, status: 500 } as Response;
    const fetchImpl = vi.fn().mockResolvedValueOnce(errorResponse);

    const result = await fetchWithTimeout("test-provider", "https://example.com", {}, 5000, fetchImpl);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });

  it("does not leave unhandled promise rejections when the call fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed"));
    const promise = fetchWithTimeout("test-provider", "https://example.com", {}, 5000, fetchImpl);

    // Attaching a rejection handler here is what proves the promise is
    // handled — an unhandled rejection would surface as a process-level
    // "unhandledRejection" event instead of being caught by this await.
    await expect(promise).rejects.toBeInstanceOf(ProviderNetworkError);
  });
});
