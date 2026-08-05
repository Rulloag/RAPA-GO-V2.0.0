import { apiClient } from "../../services/api/index.js";
import {
  walletService,
  type PaymentStatusData,
} from "../wallet/wallet.service.js";

export const RAPAGO_PENDING_CARD_PAYMENT_KEY =
  "rapago_pending_card_payment_v1";

export const RAPAGO_KLAP_3DS_STATE_EVENT =
  "rapago:klap-3ds-state";

export const RAPAGO_KLAP_RECEIPT_STARTED_EVENT =
  "rapago:klap-receipt-started";

export const KLAP_SANDBOX_SCRIPT_URL =
  "https://pagos-pasarela-sandbox.mcdesaqa.cl/checkout-frictionless/v1/main.min.js";

export const KLAP_SANDBOX_CARDINAL_URL =
  "https://songbirdstag.cardinalcommerce.com/cardinalcruise/v1/songbird.js";

export const KLAP_PRODUCTION_CARDINAL_URL =
  "https://songbird.cardinalcommerce.com/edge/v1/songbird.js";

const ALLOWED_KLAP_SCRIPT_HOSTS = new Set([
  "pagos-pasarela-sandbox.mcdesaqa.cl",
  "pagos.pasarela.multicaja.cl",
]);

const ALLOWED_KLAP_RECEIPT_HOSTS = new Set([
  ...ALLOWED_KLAP_SCRIPT_HOSTS,
  "api-pasarela-sandbox.mcdesaqa.cl",
  "api-pasarela.multicaja.cl",
  "api.pasarela.multicaja.cl",
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

type KlapChallengeResponse = {
  status?: unknown;
  data?: {
    acsUrl?: unknown;
    pareq?: unknown;
    authenticationTransactionId?: unknown;
    consumerAuthInfo?: {
      acsUrl?: unknown;
      pareq?: unknown;
      authenticationTransactionId?: unknown;
      paresStatus?: unknown;
    } | null;
  } | null;
};

type ParsedKlapChallenge = {
  acsUrl: string;
  pareq: string;
  transactionId: string;
};

export type RapagoKlap3dsState =
  | "challenge-received"
  | "waiting-cardinal"
  | "opening-challenge"
  | "challenge-opened"
  | "challenge-validated"
  | "challenge-error";

export type RapagoKlap3dsStateDetail = {
  state: RapagoKlap3dsState;
  message: string;
};

function dispatchKlap3dsState(
  detail: RapagoKlap3dsStateDetail,
): void {
  window.dispatchEvent(
    new CustomEvent<RapagoKlap3dsStateDetail>(
      RAPAGO_KLAP_3DS_STATE_EVENT,
      { detail },
    ),
  );
}

let lastKlapReceiptStartedAt = 0;

function dispatchKlapReceiptStarted(): void {
  const now = Date.now();

  // El SDK puede pasar por fetch y XMLHttpRequest en una misma preparación.
  // Evita iniciar dos verificadores por la misma solicitud sin transportar
  // URL, tarjeta, CVV ni contenido cifrado dentro del evento.
  if (now - lastKlapReceiptStartedAt < 750) return;

  lastKlapReceiptStartedAt = now;
  window.dispatchEvent(new Event(RAPAGO_KLAP_RECEIPT_STARTED_EVENT));
}

function safeKlap3dsErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message.trim() : "";

  if (
    message &&
    !/pareq|payload|creq|jwe|jwt|cvv|card|token/i.test(message)
  ) {
    return message;
  }

  return "No se pudo abrir la validación segura del banco. No vuelvas a pagar; revisaremos el estado real con Klap.";
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

function configuredCardinalScriptUrl(): string {
  const configured = String(
    import.meta.env.VITE_KLAP_CARDINAL_SCRIPT_URL ?? "",
  ).trim();

  if (configured) return configured;

  const klapScriptUrl = new URL(
    validateKlapScriptUrl(configuredKlapScriptUrl()),
  );

  return klapScriptUrl.hostname.toLowerCase().includes("sandbox")
    ? KLAP_SANDBOX_CARDINAL_URL
    : KLAP_PRODUCTION_CARDINAL_URL;
}

function validateCardinalScriptUrl(rawUrl: string): string {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("La URL de seguridad 3DS de Klap no es válida.");
  }

  if (
    url.protocol !== "https:" ||
    !ALLOWED_CARDINAL_SCRIPT_HOSTS.has(url.hostname.toLowerCase())
  ) {
    throw new Error(
      "La URL de seguridad 3DS no pertenece a un host oficial permitido.",
    );
  }

  return url.toString();
}

function cardinalAvailable(): boolean {
  return (
    typeof window.Cardinal === "object" ||
    typeof window.Cardinal === "function"
  );
}

async function waitForCardinalGlobal(
  timeoutMs = 20_000,
): Promise<void> {
  const startedAt = Date.now();

  while (!cardinalAvailable()) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(
        "Klap no pudo preparar la seguridad 3DS porque Cardinal no quedó disponible.",
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
    configuredCardinalScriptUrl(),
  );

  const existing =
    document.querySelector<HTMLScriptElement>(
      'script[data-rapago-klap-cardinal="true"]',
    ) ??
    Array.from(document.scripts).find((candidate) => {
      try {
        return ALLOWED_CARDINAL_SCRIPT_HOSTS.has(
          new URL(candidate.src).hostname.toLowerCase(),
        );
      } catch {
        return false;
      }
    });

  if (!existing) {
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.dataset.rapagoKlapCardinal = "true";

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(
          new Error(
            "La seguridad 3DS de Klap demoró demasiado en cargar.",
          ),
        );
      }, 20_000);

      const finish = (): void => {
        window.clearTimeout(timeout);
        script.dataset.rapagoKlapCardinalLoaded = "true";
        resolve();
      };

      const fail = (): void => {
        window.clearTimeout(timeout);
        reject(
          new Error(
            "No se pudo cargar la seguridad 3DS requerida por Klap.",
          ),
        );
      };

      script.addEventListener("load", finish, { once: true });
      script.addEventListener("error", fail, { once: true });
      document.head.appendChild(script);
    });
  }

  await waitForCardinalGlobal();
}

let klapReceiptChallengeBridgeInstalled = false;
let cardinalSetupObserverInstalled = false;
let cardinalSetupCompleted = false;
let cardinalValidationObserverInstalled = false;
let cardinalLayerObserver: MutationObserver | null = null;
let directChallengeOverlay: HTMLDivElement | null = null;
let directChallengeTransactionId: string | null = null;

const handledKlapChallengeTransactions = new Set<string>();
const klapXhrRequests = new WeakMap<
  XMLHttpRequest,
  { method: string; url: string }
>();

function parseKlapChallengeResponse(
  payload: unknown,
): ParsedKlapChallenge | null {
  if (!payload || typeof payload !== "object") return null;

  const response = payload as KlapChallengeResponse;
  if (
    String(response.status ?? "").trim().toUpperCase() !==
    "SEND_TO_CHALLENGE"
  ) {
    return null;
  }

  const consumerAuthInfo = response.data?.consumerAuthInfo;
  const acsUrl = String(
    response.data?.acsUrl ?? consumerAuthInfo?.acsUrl ?? "",
  ).trim();
  const pareq = String(
    response.data?.pareq ?? consumerAuthInfo?.pareq ?? "",
  ).trim();
  const transactionId = String(
    response.data?.authenticationTransactionId ??
      consumerAuthInfo?.authenticationTransactionId ??
      "",
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

  return {
    acsUrl: parsedAcsUrl.toString(),
    pareq,
    transactionId,
  };
}

function isAllowedKlapReceiptUrl(rawUrl: string): boolean {
  const normalized = String(rawUrl ?? "").trim();
  if (!normalized) return false;

  if (/^\/cards\/receipt(?:\/|$|\?)/i.test(normalized)) {
    return true;
  }

  try {
    const configuredCheckout = new URL(
      validateKlapScriptUrl(configuredKlapScriptUrl()),
    );
    const url = new URL(normalized, configuredCheckout.origin);

    return (
      url.protocol === "https:" &&
      ALLOWED_KLAP_RECEIPT_HOSTS.has(url.hostname.toLowerCase()) &&
      /\/cards\/receipt(?:\/|$)/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function ensureCardinalChallengeLayerStyles(): void {
  if (document.getElementById("rapago-cardinal-challenge-layer")) return;

  const style = document.createElement("style");
  style.id = "rapago-cardinal-challenge-layer";
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
      inset: 0 !important;
    }
  `;
  document.head.appendChild(style);
}

function promoteCardinalChallengeLayer(): void {
  ensureCardinalChallengeLayerStyles();

  document
    .querySelectorAll<HTMLElement>(
      '#Cardinal-Modal, #Cardinal-ModalContent, [id*="Cardinal-CCA"], [class*="cardinal-modal"]',
    )
    .forEach((element) => {
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

function closeDirectKlap3dsSandboxOverlay(): void {
  directChallengeOverlay?.remove();
  directChallengeOverlay = null;
  directChallengeTransactionId = null;
}

function isKlapDirect3dsSandboxFallbackEnabled(): boolean {
  const rawFlag = String(
    import.meta.env.VITE_KLAP_DIRECT_3DS_FALLBACK ?? "true",
  )
    .trim()
    .toLowerCase();

  if (["0", "false", "off", "no"].includes(rawFlag)) {
    return false;
  }

  try {
    const checkoutUrl = new URL(
      validateKlapScriptUrl(configuredKlapScriptUrl()),
    );

    return checkoutUrl.hostname.toLowerCase() ===
      "pagos-pasarela-sandbox.mcdesaqa.cl";
  } catch {
    return false;
  }
}

function hasVisibleCardinalChallenge(): boolean {
  const modal = document.querySelector<HTMLElement>("#Cardinal-Modal");
  if (modal) {
    const style = window.getComputedStyle(modal);
    const rect = modal.getBoundingClientRect();

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

async function waitForVisibleCardinalChallenge(
  timeoutMs = 2_500,
): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    promoteCardinalChallengeLayer();

    if (hasVisibleCardinalChallenge()) {
      return true;
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 100);
    });
  }

  return false;
}

function openDirectKlap3dsSandboxChallenge(
  challenge: ParsedKlapChallenge,
): void {
  if (!isKlapDirect3dsSandboxFallbackEnabled()) return;

  let acsUrl: URL;

  try {
    acsUrl = new URL(challenge.acsUrl);
  } catch {
    throw new Error("Klap entregó una URL de validación inválida.");
  }

  const acsHost = acsUrl.hostname.toLowerCase();
  if (
    acsUrl.protocol !== "https:" ||
    (!acsHost.endsWith(".cardinaltrusted.com") &&
      !acsHost.endsWith(".cardinalcommerce.com"))
  ) {
    throw new Error(
      "El respaldo Sandbox rechazó una URL bancaria no autorizada.",
    );
  }

  if (
    directChallengeOverlay &&
    directChallengeTransactionId === challenge.transactionId
  ) {
    return;
  }

  closeDirectKlap3dsSandboxOverlay();

  const overlay = document.createElement("div");
  overlay.id = "rapago-klap-3ds-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Validación segura del banco");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px",
    background: "rgba(0,0,0,.78)",
  });

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    width: "min(600px, 100%)",
    height: "min(680px, calc(100vh - 24px))",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    overflow: "hidden",
    borderRadius: "20px",
    background: "#ffffff",
    boxShadow: "0 28px 80px rgba(0,0,0,.48)",
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    padding: "14px 16px",
    background: "linear-gradient(135deg,#1d1713,#9b3f20)",
    color: "#ffffff",
    fontFamily: "system-ui, sans-serif",
  });

  const titleRow = document.createElement("div");
  Object.assign(titleRow.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  });

  const title = document.createElement("div");
  title.textContent = "Validación segura del banco";
  Object.assign(title.style, {
    fontSize: "1rem",
    fontWeight: "900",
  });

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "Cerrar";
  closeButton.setAttribute("aria-label", "Cerrar validación bancaria");
  Object.assign(closeButton.style, {
    border: "1px solid rgba(255,255,255,.42)",
    borderRadius: "999px",
    padding: "7px 11px",
    background: "rgba(255,255,255,.12)",
    color: "#ffffff",
    fontSize: ".72rem",
    fontWeight: "900",
    cursor: "pointer",
  });
  closeButton.addEventListener("click", () => {
    closeDirectKlap3dsSandboxOverlay();
    dispatchKlap3dsState({
      state: "challenge-error",
      message:
        "Cerraste la validación Sandbox. Revisa el estado en Mis Viajes y no vuelvas a pagar hasta confirmar el resultado.",
    });
  });

  const description = document.createElement("div");
  description.textContent =
    "Modo Sandbox de prueba: completa el OTP. Esta ventana puede no finalizar el pago real de Klap.";
  Object.assign(description.style, {
    marginTop: "4px",
    fontSize: ".76rem",
    lineHeight: "1.35",
    opacity: ".88",
    fontWeight: "700",
  });

  const frameName = `rapago-klap-3ds-${challenge.transactionId.replace(
    /[^a-zA-Z0-9_-]/g,
    "",
  )}`;

  const frame = document.createElement("iframe");
  frame.name = frameName;
  frame.title = "Autenticación bancaria 3D Secure Sandbox";
  frame.setAttribute("allow", "payment *");
  frame.setAttribute("referrerpolicy", "origin");
  Object.assign(frame.style, {
    width: "100%",
    height: "100%",
    minHeight: "400px",
    border: "0",
    background: "#ffffff",
  });

  const form = document.createElement("form");
  form.method = "POST";
  form.action = acsUrl.toString();
  form.target = frameName;
  form.acceptCharset = "UTF-8";
  form.style.display = "none";

  const creq = document.createElement("input");
  creq.type = "hidden";
  creq.name = "creq";
  creq.value = challenge.pareq;
  form.appendChild(creq);

  titleRow.append(title, closeButton);
  header.append(titleRow, description);
  panel.append(header, frame);
  overlay.append(panel, form);
  document.body.appendChild(overlay);

  directChallengeOverlay = overlay;
  directChallengeTransactionId = challenge.transactionId;
  form.submit();

  window.setTimeout(() => {
    form.remove();
  }, 1_000);
}

function installCardinalSetupObserver(): void {
  if (cardinalSetupObserverInstalled) return;
  if (typeof window.Cardinal?.on !== "function") return;

  window.Cardinal.on("payments.setupComplete", () => {
    cardinalSetupCompleted = true;
  });

  cardinalSetupObserverInstalled = true;
}

async function waitBrieflyForCardinalSetup(
  timeoutMs = 2_500,
): Promise<void> {
  if (cardinalSetupCompleted) return;

  const startedAt = Date.now();

  while (!cardinalSetupCompleted && Date.now() - startedAt < timeoutMs) {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 50);
    });
  }

  // /cards/receipt solo puede responder SEND_TO_CHALLENGE después de que Klap
  // ya creó el JWE y preparó la transacción. Si el evento setupComplete ocurrió
  // antes de que pudiéramos observarlo, continuamos con la misma instancia.
}

function installCardinalValidationObserver(): void {
  if (cardinalValidationObserverInstalled) return;
  if (typeof window.Cardinal?.on !== "function") return;

  window.Cardinal.on("payments.validated", () => {
    stopCardinalLayerObserver();
    closeDirectKlap3dsSandboxOverlay();
    dispatchKlap3dsState({
      state: "challenge-validated",
      message:
        "El banco terminó la validación. Confirmaremos el resultado real con Klap.",
    });
  });

  cardinalValidationObserverInstalled = true;
}

async function continueKlap3dsChallenge(
  payload: unknown,
): Promise<boolean> {
  const challenge = parseKlapChallengeResponse(payload);
  if (!challenge) return false;

  if (handledKlapChallengeTransactions.has(challenge.transactionId)) {
    return true;
  }

  dispatchKlap3dsState({
    state: "challenge-received",
    message: "Klap solicitó la validación segura de tu banco.",
  });

  dispatchKlap3dsState({
    state: "waiting-cardinal",
    message: "Preparando la ventana segura del banco…",
  });

  await preloadKlapCardinal();
  installCardinalSetupObserver();
  installCardinalValidationObserver();
  await waitBrieflyForCardinalSetup(8_000);

  if (typeof window.Cardinal?.continue !== "function") {
    throw new Error(
      "Cardinal cargó, pero no publicó la función para abrir la autenticación 3DS.",
    );
  }

  handledKlapChallengeTransactions.add(challenge.transactionId);
  installCardinalLayerObserver();

  dispatchKlap3dsState({
    state: "opening-challenge",
    message: "Abriendo la validación segura del banco…",
  });

  try {
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
    );

    window.setTimeout(promoteCardinalChallengeLayer, 0);
    window.setTimeout(promoteCardinalChallengeLayer, 250);
    window.setTimeout(promoteCardinalChallengeLayer, 750);
    window.setTimeout(promoteCardinalChallengeLayer, 1_500);

    const cardinalChallengeVisible =
      await waitForVisibleCardinalChallenge(2_500);

    if (cardinalChallengeVisible) {
      dispatchKlap3dsState({
        state: "challenge-opened",
        message:
          "Completa la validación en la ventana de tu banco. No vuelvas a presionar pagar.",
      });
      return true;
    }

    if (isKlapDirect3dsSandboxFallbackEnabled()) {
      openDirectKlap3dsSandboxChallenge(challenge);
      dispatchKlap3dsState({
        state: "challenge-opened",
        message:
          "Se abrió el respaldo 3DS de Sandbox. Ingresa el OTP, pero confirma el resultado final en Mis Viajes.",
      });
      return true;
    }

    throw new Error(
      "Cardinal no mostró la ventana de autenticación bancaria.",
    );
  } catch (error) {
    handledKlapChallengeTransactions.delete(challenge.transactionId);
    stopCardinalLayerObserver();
    closeDirectKlap3dsSandboxOverlay();
    throw error;
  }
}

function installKlapReceiptChallengeBridge(): void {
  if (klapReceiptChallengeBridgeInstalled) return;

  const originalFetch = window.fetch.bind(window);
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  window.fetch = async (...args): Promise<Response> => {
    const input = args[0];
    const requestedUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (isAllowedKlapReceiptUrl(requestedUrl)) {
      dispatchKlapReceiptStarted();
    }

    const response = await originalFetch(...args);
    const requestUrl = response.url || requestedUrl;

    if (response.ok && isAllowedKlapReceiptUrl(requestUrl)) {
      void response
        .clone()
        .json()
        .then((payload: unknown) => continueKlap3dsChallenge(payload))
        .catch((error: unknown) => {
          dispatchKlap3dsState({
            state: "challenge-error",
            message: safeKlap3dsErrorMessage(error),
          });
        });
    }

    return response;
  };

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async = true,
    username?: string | null,
    password?: string | null,
  ): void {
    klapXhrRequests.set(this, {
      method: String(method ?? "GET").toUpperCase(),
      url: String(url),
    });
    originalOpen.call(
      this,
      method,
      url,
      async,
      username ?? null,
      password ?? null,
    );
  } as XMLHttpRequest["open"];

  XMLHttpRequest.prototype.send = function (
    body?: Document | XMLHttpRequestBodyInit | null,
  ): void {
    const startedRequest = klapXhrRequests.get(this);

    if (
      startedRequest?.method === "POST" &&
      isAllowedKlapReceiptUrl(startedRequest.url)
    ) {
      dispatchKlapReceiptStarted();
    }

    this.addEventListener(
      "loadend",
      () => {
        const request = klapXhrRequests.get(this);
        const responseUrl = String(this.responseURL ?? "");
        const requestUrl = String(request?.url ?? "");

        if (request?.method !== "POST") return;
        if (
          !isAllowedKlapReceiptUrl(responseUrl) &&
          !isAllowedKlapReceiptUrl(requestUrl)
        ) {
          return;
        }
        if (this.status < 200 || this.status >= 300) return;

        let payload: unknown;

        try {
          payload =
            this.responseType === "json" && this.response
              ? this.response
              : JSON.parse(String(this.responseText ?? ""));
        } catch {
          return;
        }

        window.setTimeout(() => {
          void continueKlap3dsChallenge(payload).catch(
            (error: unknown) => {
              dispatchKlap3dsState({
                state: "challenge-error",
                message: safeKlap3dsErrorMessage(error),
              });
            },
          );
        }, 250);
      },
      { once: true },
    );

    originalSend.call(this, body ?? null);
  };

  klapReceiptChallengeBridgeInstalled = true;
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
  cardinalSetupCompleted = false;
  handledKlapChallengeTransactions.clear();
  stopCardinalLayerObserver();
  closeDirectKlap3dsSandboxOverlay();
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
      // Songbird/Cardinal es una dependencia del checkout de tarjetas. RAPA GO
      // garantiza que exista antes de KLAP.init(). Klap configura la sesión.
      // Cuando /cards/receipt exige desafío, usamos esa misma sesión para
      // ejecutar Cardinal.continue; no se crea un iframe CReq independiente.
      installKlapReceiptChallengeBridge();
      await preloadKlapCardinal();
      installCardinalSetupObserver();
      installCardinalValidationObserver();

      const sdk = await loadKlapCheckoutSdk();

      await Promise.resolve(
        sdk.init({
          method: "tarjetas",
          debug: false,
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

export const KLAP_FAST_STATUS_RETRY_DELAYS_MS = [
  500,
  750,
  1_000,
  1_000,
  1_000,
  1_250,
  1_500,
  1_750,
  2_000,
  2_500,
  3_000,
  4_000,
  5_000,
  7_500,
  10_000,
  15_000,
  20_000,
  30_000,
  30_000,
  30_000,
] as const;

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
    retryDelaysMs?: readonly number[];
    attempts?: number;
    intervalMs?: number;
    slowIntervalMs?: number;
    fastAttempts?: number;
    signal?: AbortSignal;
    onPendingStatus?: (
      status: PaymentStatusData,
      context: {
        attempt: number;
        elapsedMs: number;
        remainingChecks: number;
      },
    ) => void;
  } = {},
): Promise<PaymentStatusData> {
  const legacyAttempts = Math.max(1, options.attempts ?? 10);
  const legacyIntervalMs = Math.max(500, options.intervalMs ?? 5_000);
  const legacySlowIntervalMs = Math.max(
    legacyIntervalMs,
    options.slowIntervalMs ?? 15_000,
  );
  const legacyFastAttempts = Math.max(1, options.fastAttempts ?? 6);

  const retryDelaysMs =
    options.retryDelaysMs ??
    (options.attempts != null ||
    options.intervalMs != null ||
    options.slowIntervalMs != null ||
    options.fastAttempts != null
      ? Array.from(
          { length: Math.max(0, legacyAttempts - 1) },
          (_, index) =>
            index < legacyFastAttempts
              ? legacyIntervalMs
              : legacySlowIntervalMs,
        )
      : KLAP_FAST_STATUS_RETRY_DELAYS_MS);

  const totalChecks = retryDelaysMs.length + 1;
  const startedAt = Date.now();
  let lastStatus: PaymentStatusData | null = null;
  let lastError: unknown = null;

  const throwIfAborted = (): void => {
    if (options.signal?.aborted) {
      throw new DOMException("Operación cancelada.", "AbortError");
    }
  };

  const waitUntilVisible = async (): Promise<void> => {
    if (document.visibilityState !== "hidden") return;

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
  };

  const waitDelay = async (delayMs: number): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      const onAbort = (): void => {
        window.clearTimeout(timeout);
        reject(new DOMException("Operación cancelada.", "AbortError"));
      };
      const timeout = window.setTimeout(() => {
        options.signal?.removeEventListener("abort", onAbort);
        resolve();
      }, Math.max(0, delayMs));

      options.signal?.addEventListener("abort", onAbort, { once: true });
    });
  };

  for (let attempt = 0; attempt < totalChecks; attempt += 1) {
    throwIfAborted();

    if (attempt > 0) {
      await waitDelay(retryDelaysMs[attempt - 1] ?? 0);
    }

    await waitUntilVisible();
    throwIfAborted();

    try {
      lastStatus = await walletService.getPaymentStatus(
        accessToken,
        paymentId,
      );
      lastError = null;
    } catch (error) {
      lastError = error;

      if (attempt >= totalChecks - 1) {
        throw error;
      }

      continue;
    }

    if (
      isKlapPaymentApproved(lastStatus.status) ||
      isKlapPaymentRejected(lastStatus.status)
    ) {
      return lastStatus;
    }

    options.onPendingStatus?.(lastStatus, {
      attempt: attempt + 1,
      elapsedMs: Date.now() - startedAt,
      remainingChecks: totalChecks - attempt - 1,
    });
  }

  if (lastStatus) {
    return lastStatus;
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("No fue posible consultar el estado del pago Klap.");
}
