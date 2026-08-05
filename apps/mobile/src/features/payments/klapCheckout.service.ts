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
  checkoutStartedAt?: string | null;
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

type CardinalBrowserSdk = {
  continue?: (
    action: "cca",
    challenge: {
      AcsUrl: string;
      Payload: string;
    },
    order: {
      OrderDetails: {
        TransactionId: string;
      };
    },
  ) => unknown;
  on?: (
    eventName: "payments.setupComplete" | "payments.validated",
    callback: (data?: unknown, jwt?: string) => void,
  ) => unknown;
};

declare global {
  interface Window {
    KLAP?: KlapBrowserSdk;
    Cardinal?: CardinalBrowserSdk;
  }
}

export const KLAP_3DS_CHALLENGE_STARTED_EVENT =
  "rapago:klap:3ds-challenge-started";
export const KLAP_3DS_VALIDATED_EVENT = "rapago:klap:3ds-validated";
export const KLAP_3DS_CHALLENGE_ERROR_EVENT =
  "rapago:klap:3ds-challenge-error";

type KlapChallengeResponse = {
  status?: unknown;
  data?: {
    acsUrl?: unknown;
    pareq?: unknown;
    authenticationTransactionId?: unknown;
    consumerAuthInfo?: {
      paresStatus?: unknown;
    } | null;
  } | null;
};

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

export function markPendingKlapPaymentStarted(
  record: PendingKlapPaymentRecord,
): PendingKlapPaymentRecord {
  const updated: PendingKlapPaymentRecord = {
    ...record,
    checkoutStartedAt: record.checkoutStartedAt ?? new Date().toISOString(),
  };
  savePendingKlapPayment(updated);
  return updated;
}

export async function cancelPendingKlapRide(
  accessToken: string,
  record: PendingKlapPaymentRecord,
): Promise<void> {
  const rideRequestId = String(record.rideRequestId ?? "").trim();

  if (!rideRequestId) {
    throw new Error("No encontramos la solicitud pendiente que deseas cancelar.");
  }

  const result = await apiClient.post(
    `/rides/${encodeURIComponent(rideRequestId)}/cancel`,
    { reason: "Pago Klap cancelado por el pasajero antes de completarse." },
    { token: accessToken },
  );

  if (result.ok === false) {
    throw new Error(
      result.message ??
        "No pudimos cancelar la solicitud. Revisa el estado del pago antes de volver a intentarlo.",
    );
  }

  clearPendingKlapPayment();
  resetKlapCheckoutForNextOrder();
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

const handledKlapChallengeTransactions = new Set<string>();
let klapReceiptChallengeBridgeInstalled = false;
let cardinalSetupObserverInstalled = false;
let cardinalSetupCompleted = false;
let cardinalSetupPromise: Promise<void> | null = null;
let cardinalSetupResolve: (() => void) | null = null;
let cardinalValidationObserverInstalled = false;
let cardinalLayerObserver: MutationObserver | null = null;
const klapXhrRequestUrls = new WeakMap<XMLHttpRequest, string>();

function currentKlapOrderId(): string | null {
  return klapInitializationState.orderId;
}

function dispatchKlap3dsEvent(
  eventName: string,
  detail: Record<string, unknown>,
): void {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function parseKlapChallengeResponse(
  payload: unknown,
): {
  acsUrl: string;
  pareq: string;
  transactionId: string;
} | null {
  if (!payload || typeof payload !== "object") return null;

  const response = payload as KlapChallengeResponse;
  if (String(response.status ?? "").trim().toUpperCase() !== "SEND_TO_CHALLENGE") {
    return null;
  }

  const acsUrl = String(response.data?.acsUrl ?? "").trim();
  const pareq = String(response.data?.pareq ?? "").trim();
  const transactionId = String(
    response.data?.authenticationTransactionId ?? "",
  ).trim();

  if (!acsUrl || !pareq || !transactionId) {
    throw new Error(
      "Klap solicitó autenticación 3DS, pero entregó datos incompletos.",
    );
  }

  let parsedAcsUrl: URL;
  try {
    parsedAcsUrl = new URL(acsUrl);
  } catch {
    throw new Error("Klap entregó una URL 3DS inválida.");
  }

  if (parsedAcsUrl.protocol !== "https:") {
    throw new Error("La autenticación 3DS no utiliza una conexión segura.");
  }

  return { acsUrl: parsedAcsUrl.toString(), pareq, transactionId };
}

function isAllowedKlapReceiptUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl, window.location.href);
    return (
      url.protocol === "https:" &&
      ALLOWED_KLAP_SCRIPT_HOSTS.has(url.hostname.toLowerCase()) &&
      /\/cards\/receipt(?:\/|$)/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function ensureCardinalLayerStyles(): void {
  if (document.getElementById("rapago-cardinal-layer-styles")) return;

  const style = document.createElement("style");
  style.id = "rapago-cardinal-layer-styles";
  style.textContent = `
    #Cardinal-Modal,
    #Cardinal-ModalContent,
    #Cardinal-Modal iframe,
    [id*="Cardinal-CCA"],
    [class*="cardinal-modal"] {
      z-index: 2147483647 !important;
    }

    #Cardinal-Modal {
      position: fixed !important;
    }
  `;
  document.head.appendChild(style);
}

function promoteCardinalChallengeLayer(): void {
  ensureCardinalLayerStyles();

  const candidates = document.querySelectorAll<HTMLElement>(
    '#Cardinal-Modal, #Cardinal-ModalContent, [id*="Cardinal-CCA"], [class*="cardinal-modal"]',
  );

  candidates.forEach((element) => {
    element.style.setProperty("z-index", "2147483647", "important");
  });
}

function installCardinalLayerObserver(): void {
  if (cardinalLayerObserver || !document.body) return;

  cardinalLayerObserver = new MutationObserver(() => {
    promoteCardinalChallengeLayer();
  });

  cardinalLayerObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"],
  });

  promoteCardinalChallengeLayer();
}

function stopCardinalLayerObserver(): void {
  cardinalLayerObserver?.disconnect();
  cardinalLayerObserver = null;
}

function hasVisibleCardinalChallenge(): boolean {
  const cardinalModal = document.querySelector<HTMLElement>("#Cardinal-Modal");
  if (cardinalModal) {
    const style = window.getComputedStyle(cardinalModal);
    const rect = cardinalModal.getBoundingClientRect();

    if (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || "1") > 0 &&
      rect.width > 8 &&
      rect.height > 8
    ) {
      return true;
    }
  }

  return Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe")).some(
    (frame) => {
      const identity = `${frame.id} ${frame.name} ${frame.src}`;

      // Cardinal crea primero un iframe técnico oculto para recopilar la huella
      // del dispositivo. Ese collector no es la ventana del desafío bancario.
      if (/cardinal[-_ ]?collector/i.test(identity)) {
        return false;
      }

      if (
        !/cardinal[-_ ]?cca|merchantacs|centinel|three[-_]?ds|3ds|stepup|challenge/i.test(
          identity,
        )
      ) {
        return false;
      }

      const style = window.getComputedStyle(frame);
      const rect = frame.getBoundingClientRect();

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0 &&
        rect.width > 8 &&
        rect.height > 8 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth
      );
    },
  );
}

function markCardinalSetupComplete(): void {
  cardinalSetupCompleted = true;
  cardinalSetupResolve?.();
  cardinalSetupResolve = null;
}

function installCardinalSetupObserver(): void {
  if (cardinalSetupObserverInstalled) return;
  if (typeof window.Cardinal?.on !== "function") return;

  window.Cardinal.on("payments.setupComplete", () => {
    markCardinalSetupComplete();
  });

  cardinalSetupObserverInstalled = true;
}

async function waitForCardinalSetupComplete(
  timeoutMs = 15_000,
): Promise<void> {
  if (cardinalSetupCompleted) return;

  installCardinalSetupObserver();

  if (!cardinalSetupPromise) {
    cardinalSetupPromise = new Promise<void>((resolve) => {
      cardinalSetupResolve = resolve;
    });
  }

  await Promise.race([
    cardinalSetupPromise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        reject(
          new Error(
            "Cardinal no terminó de preparar la autenticación bancaria 3DS.",
          ),
        );
      }, timeoutMs);
    }),
  ]);
}

function installCardinalValidationObserver(): void {
  if (cardinalValidationObserverInstalled) return;
  if (typeof window.Cardinal?.on !== "function") return;

  window.Cardinal.on("payments.validated", () => {
    stopCardinalLayerObserver();
    dispatchKlap3dsEvent(KLAP_3DS_VALIDATED_EVENT, {
      orderId: currentKlapOrderId(),
    });
  });

  cardinalValidationObserverInstalled = true;
}

export async function continueKlap3dsChallenge(
  payload: unknown,
): Promise<boolean> {
  const challenge = parseKlapChallengeResponse(payload);
  if (!challenge) return false;

  if (handledKlapChallengeTransactions.has(challenge.transactionId)) {
    return true;
  }

  await preloadKlapCardinal();
  installCardinalSetupObserver();
  installCardinalValidationObserver();
  await waitForCardinalSetupComplete();

  if (typeof window.Cardinal?.continue !== "function") {
    throw new Error(
      "Cardinal cargó, pero no publicó la función para continuar la autenticación 3DS.",
    );
  }

  installCardinalLayerObserver();
  handledKlapChallengeTransactions.add(challenge.transactionId);
  dispatchKlap3dsEvent(KLAP_3DS_CHALLENGE_STARTED_EVENT, {
    orderId: currentKlapOrderId(),
    transactionId: challenge.transactionId,
  });

  try {
    await Promise.resolve(
      window.Cardinal.continue(
        "cca",
        {
          AcsUrl: challenge.acsUrl,
          Payload: challenge.pareq,
        },
        {
          OrderDetails: {
            TransactionId: challenge.transactionId,
          },
        },
      ),
    );

    window.setTimeout(promoteCardinalChallengeLayer, 0);
    window.setTimeout(promoteCardinalChallengeLayer, 250);
    window.setTimeout(promoteCardinalChallengeLayer, 750);
    window.setTimeout(promoteCardinalChallengeLayer, 1_500);

    return true;
  } catch (error) {
    stopCardinalLayerObserver();
    handledKlapChallengeTransactions.delete(challenge.transactionId);
    throw error;
  }
}

function installKlapReceiptChallengeBridge(): void {
  if (klapReceiptChallengeBridgeInstalled) return;

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async = true,
    username?: string | null,
    password?: string | null,
  ): void {
    klapXhrRequestUrls.set(this, String(url));
    originalOpen.call(this, method, url, async, username ?? null, password ?? null);
  } as XMLHttpRequest["open"];

  XMLHttpRequest.prototype.send = function (
    body?: Document | XMLHttpRequestBodyInit | null,
  ): void {
    this.addEventListener(
      "loadend",
      () => {
        const requestUrl = this.responseURL || klapXhrRequestUrls.get(this) || "";
        if (!isAllowedKlapReceiptUrl(requestUrl)) return;
        if (this.status < 200 || this.status >= 300) return;

        let payload: unknown;
        try {
          payload = JSON.parse(String(this.responseText ?? ""));
        } catch {
          return;
        }

        window.setTimeout(() => {
          if (hasVisibleCardinalChallenge()) return;

          void continueKlap3dsChallenge(payload).catch((error: unknown) => {
            dispatchKlap3dsEvent(KLAP_3DS_CHALLENGE_ERROR_EVENT, {
              orderId: currentKlapOrderId(),
              message:
                error instanceof Error
                  ? error.message
                  : "No se pudo abrir la autenticación segura del banco.",
            });
          });
        }, 250);
      },
      { once: true },
    );

    originalSend.call(this, body ?? null);
  };

  klapReceiptChallengeBridgeInstalled = true;
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

export function resetKlapCheckoutForNextOrder(): void {
  klapInitializationState.orderId = null;
  klapInitializationState.status = "idle";
  klapInitializationState.promise = null;
}

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
    // El formulario anterior ya fue cerrado o cancelado. Klap puede volver a
    // inicializarse con el nuevo data-klap-order-id sin obligar a recargar la app.
    resetKlapCheckoutForNextOrder();
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
    // Permite un reintento explícito. No crea una orden nueva: reutiliza la misma
    // orden del backend y vuelve a preparar el SDK en esta pantalla.
    resetKlapCheckoutForNextOrder();
  }

  klapInitializationState.orderId = normalizedOrderId;
  klapInitializationState.status = "initializing";

  const promise = (async (): Promise<KlapBrowserSdk> => {
    try {
      installKlapReceiptChallengeBridge();
      await preloadKlapCardinal();
      installCardinalSetupObserver();
      installCardinalValidationObserver();

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
  "cancelled",
  "canceled",
  "expired",
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
    slowIntervalMs?: number;
    fastAttempts?: number;
    signal?: AbortSignal;
  } = {},
): Promise<PaymentStatusData> {
  const attempts = Math.max(1, options.attempts ?? 10);
  const intervalMs = Math.max(5_000, options.intervalMs ?? 5_000);
  const slowIntervalMs = Math.max(15_000, options.slowIntervalMs ?? 15_000);
  const fastAttempts = Math.max(1, options.fastAttempts ?? 6);
  let lastStatus: PaymentStatusData | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw new DOMException("Operación cancelada.", "AbortError");
    }

    // No genera tráfico oculto mientras el usuario está en otra pestaña.
    if (document.visibilityState === "hidden") {
      await new Promise<void>((resolve, reject) => {
        const onVisible = (): void => {
          if (document.visibilityState !== "hidden") {
            document.removeEventListener("visibilitychange", onVisible);
            options.signal?.removeEventListener("abort", onAbort);
            resolve();
          }
        };
        const onAbort = (): void => {
          document.removeEventListener("visibilitychange", onVisible);
          reject(new DOMException("Operación cancelada.", "AbortError"));
        };
        document.addEventListener("visibilitychange", onVisible);
        options.signal?.addEventListener("abort", onAbort, { once: true });
      });
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
      const delay = attempt < fastAttempts ? intervalMs : slowIntervalMs;
      await new Promise<void>((resolve, reject) => {
        const onAbort = (): void => {
          window.clearTimeout(timeout);
          reject(new DOMException("Operación cancelada.", "AbortError"));
        };
        const timeout = window.setTimeout(() => {
          options.signal?.removeEventListener("abort", onAbort);
          resolve();
        }, delay);

        options.signal?.addEventListener("abort", onAbort, { once: true });
      });
    }
  }

  if (!lastStatus) {
    throw new Error("No fue posible consultar el estado del pago Klap.");
  }

  return lastStatus;
}
