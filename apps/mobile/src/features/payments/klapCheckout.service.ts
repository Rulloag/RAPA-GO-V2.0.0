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
let directChallengeOverlay: HTMLDivElement | null = null;
let directChallengeFrame: HTMLIFrameElement | null = null;
let directChallengeTransactionId: string | null = null;
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

export function closeKlap3dsChallengeOverlay(): void {
  directChallengeOverlay?.remove();
  directChallengeOverlay = null;
  directChallengeFrame = null;
  directChallengeTransactionId = null;
}

function revealExistingCardinalChallenge(): boolean {
  ensureCardinalLayerStyles();

  const modal = document.querySelector<HTMLElement>("#Cardinal-Modal");
  const content = document.querySelector<HTMLElement>("#Cardinal-ModalContent");
  const frame = Array.from(
    document.querySelectorAll<HTMLIFrameElement>("iframe"),
  ).find((candidate) => {
    const identity = `${candidate.id} ${candidate.name} ${candidate.src}`;

    if (/cardinal[-_ ]?collector/i.test(identity)) {
      return false;
    }

    return /merchantacs|\/centinelapi\/v2\/cruise\/stepup|stepup|challenge/i.test(
      identity,
    );
  });

  if (!modal && !content && !frame) {
    return false;
  }

  if (modal) {
    modal.style.setProperty("display", "flex", "important");
    modal.style.setProperty("visibility", "visible", "important");
    modal.style.setProperty("opacity", "1", "important");
    modal.style.setProperty("position", "fixed", "important");
    modal.style.setProperty("inset", "0", "important");
    modal.style.setProperty("width", "100vw", "important");
    modal.style.setProperty("height", "100vh", "important");
    modal.style.setProperty("align-items", "center", "important");
    modal.style.setProperty("justify-content", "center", "important");
    modal.style.setProperty("background", "rgba(0,0,0,.72)", "important");
    modal.style.setProperty("z-index", "2147483647", "important");
  }

  if (content) {
    content.style.setProperty("display", "block", "important");
    content.style.setProperty("visibility", "visible", "important");
    content.style.setProperty("opacity", "1", "important");
    content.style.setProperty("position", "relative", "important");
    content.style.setProperty("width", "min(600px, calc(100vw - 24px))", "important");
    content.style.setProperty("height", "min(680px, calc(100vh - 24px))", "important");
    content.style.setProperty("max-width", "600px", "important");
    content.style.setProperty("max-height", "680px", "important");
    content.style.setProperty("margin", "auto", "important");
    content.style.setProperty("background", "#ffffff", "important");
    content.style.setProperty("border-radius", "18px", "important");
    content.style.setProperty("overflow", "hidden", "important");
    content.style.setProperty("z-index", "2147483647", "important");
  }

  if (frame) {
    frame.style.setProperty("display", "block", "important");
    frame.style.setProperty("visibility", "visible", "important");
    frame.style.setProperty("opacity", "1", "important");
    frame.style.setProperty("position", "relative", "important");
    frame.style.setProperty("width", "100%", "important");
    frame.style.setProperty("height", "100%", "important");
    frame.style.setProperty("min-height", "400px", "important");
    frame.style.setProperty("border", "0", "important");
    frame.style.setProperty("z-index", "2147483647", "important");
  }

  return true;
}

function openDirectKlap3dsChallenge(challenge: {
  acsUrl: string;
  pareq: string;
  transactionId: string;
}): void {
  if (
    directChallengeOverlay &&
    directChallengeTransactionId === challenge.transactionId
  ) {
    return;
  }

  closeKlap3dsChallengeOverlay();

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
    closeKlap3dsChallengeOverlay();
    dispatchKlap3dsEvent(KLAP_3DS_CHALLENGE_ERROR_EVENT, {
      orderId: currentKlapOrderId(),
      message:
        "Cerraste la validación bancaria. Revisa el estado en Mis Viajes y no vuelvas a pagar hasta confirmar el resultado.",
    });
  });

  const description = document.createElement("div");
  description.textContent =
    "Completa la autenticación para que Klap confirme el pago.";
  Object.assign(description.style, {
    marginTop: "4px",
    fontSize: ".76rem",
    lineHeight: "1.35",
    opacity: ".82",
    fontWeight: "700",
  });

  const frameName = `rapago-klap-3ds-${challenge.transactionId.replace(
    /[^a-zA-Z0-9_-]/g,
    "",
  )}`;

  const frame = document.createElement("iframe");
  frame.name = frameName;
  frame.title = "Autenticación bancaria 3D Secure";
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
  form.action = challenge.acsUrl;
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
  directChallengeFrame = frame;
  directChallengeTransactionId = challenge.transactionId;

  form.submit();

  window.setTimeout(() => {
    form.remove();
  }, 1_000);
}

async function waitForVisibleCardinalChallenge(
  timeoutMs = 2_500,
): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (hasVisibleCardinalChallenge()) {
      return true;
    }

    if (revealExistingCardinalChallenge() && hasVisibleCardinalChallenge()) {
      return true;
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 100);
    });
  }

  return false;
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
    closeKlap3dsChallengeOverlay();
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

    const cardinalChallengeVisible =
      await waitForVisibleCardinalChallenge();

    if (!cardinalChallengeVisible) {
      openDirectKlap3dsChallenge(challenge);
    }

    return true;
  } catch (error) {
    stopCardinalLayerObserver();
    closeKlap3dsChallengeOverlay();
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
  stopCardinalLayerObserver();
  closeKlap3dsChallengeOverlay();
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
