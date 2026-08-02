import { apiClient } from "../../services/api/index.js";
import {
  walletService,
  type PaymentStatusData,
} from "../wallet/wallet.service.js";

export const RAPAGO_PENDING_CARD_PAYMENT_KEY =
  "rapago_pending_card_payment_v1";

export const KLAP_SANDBOX_SCRIPT_URL =
  "https://pagos-pasarela-sandbox.mcdesaqa.cl/checkout-frictionless/v1/main.min.js";

export const KLAP_SANDBOX_CARDINAL_URL =
  "https://songbirdstag.cardinalcommerce.com/cardinalcruise/v1/songbird.js";

const ALLOWED_KLAP_SCRIPT_HOSTS = new Set([
  "pagos-pasarela-sandbox.mcdesaqa.cl",
  "pagos.pasarela.multicaja.cl",
]);

const ALLOWED_CARDINAL_SCRIPT_HOSTS = new Set([
  "songbirdstag.cardinalcommerce.com",
  "songbird.cardinalcommerce.com",
]);

export type PendingKlapPaymentRecord = {
  rideRequestId: string;
  paymentId: string;
  orderId: string;
  amountClp?: number | null;
  provider: "klap";
  createdAt: string;
  originText?: string | null;
  destinationText?: string | null;
  scheduledRideMirror?: Record<string, unknown> | null;
  returnPickupRideMirror?: Record<string, unknown> | null;
};

export type KlapEmbeddedOrder = {
  paymentId: string;
  provider: "klap";
  checkoutType: "embedded";
  publicCheckoutData: {
    orderId: string;
  };
};

type Envelope<T> = {
  ok: true;
  data: T;
  statusCode: number;
};

type KlapBrowserSdk = {
  init: (options?: {
    method?: "tarjetas";
    debug?: boolean | string;
    successUrl?: string;
    errorUrl?: string;
  }) => unknown;
  payOrder?: () => unknown;
};

declare global {
  interface Window {
    KLAP?: KlapBrowserSdk;
    Cardinal?: unknown;
  }
}

function unwrap<T>(
  result: {
    ok: boolean;
    data?: unknown;
    message?: string;
  },
  fallbackMessage: string,
): T {
  if (!result.ok) {
    throw new Error(result.message ?? fallbackMessage);
  }

  const envelope = result.data as Envelope<T> | undefined;
  if (!envelope || envelope.ok !== true) {
    throw new Error(fallbackMessage);
  }

  return envelope.data;
}

export async function createKlapEmbeddedOrder(
  accessToken: string,
  rideRequestId: string,
): Promise<KlapEmbeddedOrder> {
  const result = await apiClient.post<Envelope<KlapEmbeddedOrder>>(
    "/payments/klap/orders",
    { rideRequestId },
    { token: accessToken },
  );

  const order = unwrap<KlapEmbeddedOrder>(
    result,
    "No se pudo iniciar el pago seguro con Klap.",
  );

  if (
    order.provider !== "klap" ||
    order.checkoutType !== "embedded" ||
    !String(order.paymentId ?? "").trim() ||
    !String(order.publicCheckoutData?.orderId ?? "").trim()
  ) {
    throw new Error("Klap devolvió una orden de pago incompleta.");
  }

  return order;
}

export function savePendingKlapPayment(
  record: PendingKlapPaymentRecord,
): void {
  try {
    localStorage.setItem(
      RAPAGO_PENDING_CARD_PAYMENT_KEY,
      JSON.stringify(record),
    );
  } catch {
    throw new Error(
      "No se pudo guardar el pago pendiente. Libera espacio del navegador e inténtalo nuevamente.",
    );
  }
}

export function readPendingKlapPayment(): PendingKlapPaymentRecord | null {
  try {
    const raw = localStorage.getItem(RAPAGO_PENDING_CARD_PAYMENT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PendingKlapPaymentRecord>;
    if (parsed.provider !== "klap") return null;

    const rideRequestId = String(parsed.rideRequestId ?? "").trim();
    const paymentId = String(parsed.paymentId ?? "").trim();
    const orderId = String(parsed.orderId ?? "").trim();

    if (!rideRequestId || !paymentId || !orderId) return null;

    return {
      ...parsed,
      rideRequestId,
      paymentId,
      orderId,
      provider: "klap",
      createdAt:
        String(parsed.createdAt ?? "").trim() || new Date().toISOString(),
    } as PendingKlapPaymentRecord;
  } catch {
    return null;
  }
}

export function clearPendingKlapPayment(): void {
  try {
    localStorage.removeItem(RAPAGO_PENDING_CARD_PAYMENT_KEY);
  } catch {
    // El backend sigue siendo la autoridad del pago.
  }
}

function configuredKlapScriptUrl(): string {
  const configured = String(
    import.meta.env.VITE_KLAP_CHECKOUT_SCRIPT_URL ?? "",
  ).trim();

  return configured || KLAP_SANDBOX_SCRIPT_URL;
}

function validateKlapScriptUrl(rawUrl: string): string {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("La URL pública del checkout Klap no es válida.");
  }

  if (
    url.protocol !== "https:" ||
    !ALLOWED_KLAP_SCRIPT_HOSTS.has(url.hostname.toLowerCase())
  ) {
    throw new Error("La URL del checkout Klap no pertenece a un host oficial.");
  }

  return url.toString();
}

function cardinalAvailable(): boolean {
  return (
    typeof window.Cardinal === "object" ||
    typeof window.Cardinal === "function"
  );
}

function validateCardinalScriptUrl(rawUrl: string): string {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("La URL de seguridad 3DS no es válida.");
  }

  if (
    url.protocol !== "https:" ||
    !ALLOWED_CARDINAL_SCRIPT_HOSTS.has(url.hostname.toLowerCase())
  ) {
    throw new Error(
      "La URL de seguridad 3DS no pertenece a un host permitido.",
    );
  }

  return url.toString();
}

async function waitForCardinalGlobal(timeoutMs = 20_000): Promise<void> {
  const startedAt = Date.now();

  while (!cardinalAvailable()) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(
        "Klap no pudo preparar la seguridad 3DS. Cardinal no quedó disponible.",
      );
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 100);
    });
  }
}

export async function preloadKlapCardinal(): Promise<void> {
  if (cardinalAvailable()) return;

  const scriptUrl = validateCardinalScriptUrl(
    KLAP_SANDBOX_CARDINAL_URL,
  );

  const existing =
    document.querySelector<HTMLScriptElement>(
      'script[data-rapago-klap-cardinal="true"]',
    ) ??
    Array.from(document.scripts).find((script) =>
      /songbird(?:stag)?\.cardinalcommerce\.com/i.test(script.src),
    );

  const script = existing ?? document.createElement("script");

  if (!existing) {
    script.src = scriptUrl;
    script.async = true;
    script.dataset.rapagoKlapCardinal = "true";
    document.head.appendChild(script);
  }

  if (!cardinalAvailable()) {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(
          new Error(
            "Songbird cargó demasiado lento y no preparó Cardinal.",
          ),
        );
      }, 20_000);

      const finish = (): void => {
        window.clearTimeout(timeout);
        resolve();
      };

      const fail = (): void => {
        window.clearTimeout(timeout);
        reject(
          new Error(
            "No se pudo cargar la seguridad 3DS de Klap.",
          ),
        );
      };

      if (script.dataset.rapagoKlapCardinalLoaded === "true") {
        finish();
        return;
      }

      script.addEventListener(
        "load",
        () => {
          script.dataset.rapagoKlapCardinalLoaded = "true";
          finish();
        },
        { once: true },
      );
      script.addEventListener("error", fail, { once: true });
    });
  }

  await waitForCardinalGlobal();
}

function klapInitAvailable(): boolean {
  return typeof window.KLAP?.init === "function";
}

async function waitForKlapGlobal(timeoutMs = 5_000): Promise<void> {
  const startedAt = Date.now();

  while (!klapInitAvailable()) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("El script de Klap cargó, pero no publicó KLAP.init().");
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 50);
    });
  }
}

export async function waitForKlapPayOrder(
  timeoutMs = 15_000,
): Promise<KlapBrowserSdk> {
  const startedAt = Date.now();

  while (typeof window.KLAP?.payOrder !== "function") {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(
        "Klap no terminó de preparar el pago. Recarga esta pantalla y prueba una sola vez.",
      );
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 100);
    });
  }

  return window.KLAP;
}

type KlapInitializationStatus =
  | "idle"
  | "initializing"
  | "ready"
  | "failed";

const klapInitializationState: {
  orderId: string | null;
  status: KlapInitializationStatus;
  promise: Promise<KlapBrowserSdk> | null;
} = {
  orderId: null,
  status: "idle",
  promise: null,
};

export async function initializeKlapCheckoutOnce(
  orderId: string,
): Promise<KlapBrowserSdk> {
  const normalizedOrderId = orderId.trim();

  if (!normalizedOrderId) {
    throw new Error("La orden Klap no es válida.");
  }

  if (
    klapInitializationState.orderId &&
    klapInitializationState.orderId !== normalizedOrderId
  ) {
    throw new Error(
      "Hay otra orden Klap cargada. Recarga la pantalla para iniciar el nuevo pago.",
    );
  }

  if (
    klapInitializationState.status === "ready" &&
    typeof window.KLAP?.payOrder === "function"
  ) {
    return window.KLAP;
  }

  if (
    klapInitializationState.status === "initializing" &&
    klapInitializationState.promise
  ) {
    return klapInitializationState.promise;
  }

  if (klapInitializationState.status === "failed") {
    throw new Error(
      "El perfil de seguridad de Klap ya falló en esta pantalla. Recárgala antes de volver a pagar.",
    );
  }

  klapInitializationState.orderId = normalizedOrderId;
  klapInitializationState.status = "initializing";

  const promise = (async (): Promise<KlapBrowserSdk> => {
    try {
      await preloadKlapCardinal();

      const sdk = await loadKlapCheckoutSdk();

      await Promise.resolve(
        sdk.init({
          method: "tarjetas",
        }),
      );

      const initializedSdk = await waitForKlapPayOrder();
      klapInitializationState.status = "ready";
      return initializedSdk;
    } catch (error) {
      klapInitializationState.status = "failed";
      throw error;
    } finally {
      klapInitializationState.promise = null;
    }
  })();

  klapInitializationState.promise = promise;
  return promise;
}

export function klapCheckoutRequiresReload(orderId: string): boolean {
  return (
    klapInitializationState.orderId === orderId.trim() &&
    klapInitializationState.status === "failed"
  );
}

export async function loadKlapCheckoutSdk(): Promise<KlapBrowserSdk> {
  if (klapInitAvailable()) {
    return window.KLAP as KlapBrowserSdk;
  }

  const scriptUrl = validateKlapScriptUrl(configuredKlapScriptUrl());
  const existing = document.querySelector<HTMLScriptElement>(
    'script[data-rapago-klap-checkout="true"]',
  );

  const script = existing ?? document.createElement("script");

  if (!existing) {
    script.src = scriptUrl;
    script.async = true;
    script.dataset.rapagoKlapCheckout = "true";
    document.head.appendChild(script);
  }

  await new Promise<void>((resolve, reject) => {
    if (klapInitAvailable()) {
      resolve();
      return;
    }

    const timeout = window.setTimeout(() => {
      reject(new Error("Klap demoró demasiado en cargar."));
    }, 20_000);

    const onLoad = (): void => {
      window.clearTimeout(timeout);
      resolve();
    };

    const onError = (): void => {
      window.clearTimeout(timeout);
      reject(new Error("No se pudo cargar el checkout seguro de Klap."));
    };

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
  });

  await waitForKlapGlobal();

  return window.KLAP as KlapBrowserSdk;
}

const TERMINAL_APPROVED = new Set(["success"]);
const TERMINAL_REJECTED = new Set([
  "rejected",
  "failed",
  "refunded",
]);

export function isKlapPaymentApproved(status: string): boolean {
  return TERMINAL_APPROVED.has(status.trim().toLowerCase());
}

export function isKlapPaymentRejected(status: string): boolean {
  return TERMINAL_REJECTED.has(status.trim().toLowerCase());
}

export async function waitForKlapPaymentResolution(
  accessToken: string,
  paymentId: string,
  options: {
    attempts?: number;
    intervalMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<PaymentStatusData> {
  const attempts = Math.max(1, options.attempts ?? 30);
  const intervalMs = Math.max(500, options.intervalMs ?? 2_000);
  let lastStatus: PaymentStatusData | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw new DOMException("Operación cancelada.", "AbortError");
    }

    lastStatus = await walletService.getPaymentStatus(
      accessToken,
      paymentId,
    );

    if (
      isKlapPaymentApproved(lastStatus.status) ||
      isKlapPaymentRejected(lastStatus.status)
    ) {
      return lastStatus;
    }

    if (attempt < attempts - 1) {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(resolve, intervalMs);
        const onAbort = (): void => {
          window.clearTimeout(timeout);
          reject(new DOMException("Operación cancelada.", "AbortError"));
        };

        options.signal?.addEventListener("abort", onAbort, { once: true });
      });
    }
  }

  if (!lastStatus) {
    throw new Error("No fue posible consultar el estado del pago Klap.");
  }

  return lastStatus;
}
