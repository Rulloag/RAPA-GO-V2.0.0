/**
 * Timeout envuelto para llamadas HTTP salientes a proveedores externos
 * (Mercado Pago, ProntoPaga, Apple). Sin esto, una lentitud del proveedor
 * se traduce 1:1 en latencia colgada para el usuario final — no había
 * ningún AbortSignal/timeout en ninguna integración antes de esto.
 */

export class ProviderTimeoutError extends Error {
  readonly provider: string;
  readonly timeoutMs: number;

  constructor(provider: string, timeoutMs: number) {
    super(`${provider} request timed out after ${timeoutMs}ms`);
    this.name = "ProviderTimeoutError";
    this.provider = provider;
    this.timeoutMs = timeoutMs;
  }
}

export class ProviderNetworkError extends Error {
  readonly provider: string;

  constructor(provider: string, cause: unknown) {
    super(`${provider} request failed due to a network error`, { cause });
    this.name = "ProviderNetworkError";
    this.provider = provider;
  }
}

/**
 * Lee un timeout en ms desde una variable de entorno, con fallback seguro
 * si no está definida o el valor no es un número positivo.
 */
export function resolveTimeoutMs(envVarName: string, fallbackMs: number): number {
  const raw = process.env[envVarName];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

/**
 * fetch() con AbortSignal.timeout aplicado, clasificando el fallo como
 * timeout de proveedor vs. error de red genérico. No inspecciona ni
 * modifica el cuerpo de la respuesta — eso sigue siendo responsabilidad
 * de cada llamador.
 */
export async function fetchWithTimeout(
  provider: string,
  input: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  try {
    return await fetchImpl(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ProviderTimeoutError(provider, timeoutMs);
    }
    throw new ProviderNetworkError(provider, error);
  }
}
