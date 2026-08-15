import { apiClient } from "../../services/api/index.js";
import {
  walletService,
  type PaymentStatusData,
} from "../wallet/wallet.service.js";

export const RAPAGO_PENDING_CARD_PAYMENT_KEY =
  "rapago_pending_card_payment_v1";

const ALLOWED_KLAP_CHECKOUT_HOSTS = new Set([
  "pagos.pasarela.multicaja.cl",
  "www.klap.cl",
  ...(import.meta.env.DEV
    ? ["pagos-pasarela-sandbox.mcdesaqa.cl", "sandbox.mcdesaqa.cl"]
    : []),
]);

export type PendingKlapPaymentRecord = {
  rideRequestId: string;
  paymentId: string;
  orderId: string;
  redirectUrl?: string | null;
  amountClp?: number | null;
  provider: "klap";
  createdAt: string;
  checkoutStartedAt?: string | null;
  originText?: string | null;
  destinationText?: string | null;
  scheduledRideMirror?: Record<string, unknown> | null;
  returnPickupRideMirror?: Record<string, unknown> | null;
};

export type KlapHostedOrder = {
  paymentId: string;
  provider: "klap";
  checkoutType: "redirect";
  publicCheckoutData: {
    orderId: string;
    redirectUrl: string;
    initialStatus: string | null;
  };
};

/** Alias temporal para no romper imports antiguos durante el despliegue V108. */
export type KlapEmbeddedOrder = KlapHostedOrder;

type Envelope<T> = {
  ok: true;
  data: T;
  statusCode: number;
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

export function validateKlapRedirectUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Klap devolviÃ³ un enlace de pago invÃ¡lido.");
  }

  if (
    url.protocol !== "https:" ||
    !ALLOWED_KLAP_CHECKOUT_HOSTS.has(url.hostname.toLowerCase())
  ) {
    throw new Error(
      "El enlace de pago no pertenece a un dominio oficial permitido de Klap.",
    );
  }

  return url.toString();
}

export async function createKlapHostedOrder(
  accessToken: string,
  rideRequestId: string,
): Promise<KlapHostedOrder> {
  const result = await apiClient.post<Envelope<KlapHostedOrder>>(
    "/payments/klap/orders",
    { rideRequestId },
    { token: accessToken },
  );

  const order = unwrap<KlapHostedOrder>(
    result,
    "No se pudo iniciar el pago seguro con Klap.",
  );

  const paymentId = String(order.paymentId ?? "").trim();
  const orderId = String(order.publicCheckoutData?.orderId ?? "").trim();
  const redirectUrl = validateKlapRedirectUrl(
    String(order.publicCheckoutData?.redirectUrl ?? "").trim(),
  );

  if (
    order.provider !== "klap" ||
    order.checkoutType !== "redirect" ||
    !paymentId ||
    !orderId
  ) {
    throw new Error("Klap devolviÃ³ una orden de pago incompleta.");
  }

  return {
    ...order,
    paymentId,
    publicCheckoutData: {
      ...order.publicCheckoutData,
      orderId,
      redirectUrl,
      initialStatus:
        String(order.publicCheckoutData.initialStatus ?? "").trim() || null,
    },
  };
}

/** Compatibilidad temporal con el nombre V107. */
export const createKlapEmbeddedOrder = createKlapHostedOrder;

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
      "No se pudo guardar el pago pendiente. Libera espacio del navegador e intÃ©ntalo nuevamente.",
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
    const rawRedirectUrl = String(parsed.redirectUrl ?? "").trim();

    if (!rideRequestId || !paymentId || !orderId) return null;

    let redirectUrl: string | null = null;
    if (rawRedirectUrl) {
      try {
        redirectUrl = validateKlapRedirectUrl(rawRedirectUrl);
      } catch {
        redirectUrl = null;
      }
    }

    return {
      ...parsed,
      rideRequestId,
      paymentId,
      orderId,
      redirectUrl,
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
    // El backend sigue siendo la autoridad.
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
}

export function resetKlapCheckoutForNextOrder(): void {
  // El checkout V108 es alojado por Klap. No existe SDK ni sesiÃ³n Cardinal local.
}

export function openKlapHostedCheckout(redirectUrl: string): void {
  const safeUrl = validateKlapRedirectUrl(redirectUrl);

  // NavegaciÃ³n en la misma ventana: evita bloqueadores de pop-up, elimina el
  // riesgo de abrir dos checkouts y permite que return_url/cancel_url regresen
  // al flujo de RAPA GO de forma determinista.
  window.location.assign(safeUrl);
}

export async function reconcileKlapPayment(
  accessToken: string,
  paymentId: string,
): Promise<{ status: string; providerStatus: string }> {
  return walletService.reconcileKlapPayment(accessToken, paymentId);
}

export const KLAP_FAST_STATUS_RETRY_DELAYS_MS = [
  0,
  1_500,
  2_500,
  4_000,
  6_000,
  10_000,
  15_000,
  30_000,
] as const;

// "success" solo ocurre después de que Rapa Go captura el cobro al finalizar
// el viaje — ya no es el desenlace del checkout. "authorized" es el
// desenlace real del checkout con captura diferida: la tarjeta quedó
// autorizada (dinero reservado, no cobrado todavía) y el viaje ya puede
// avanzar. Ambos detienen el sondeo tras el regreso del checkout.
const TERMINAL_APPROVED = new Set(["success"]);
const TERMINAL_AUTHORIZED = new Set(["authorized"]);
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

/** Tarjeta autorizada (captura diferida): el cobro ocurrirá al finalizar el viaje. */
export function isKlapPaymentAuthorized(status: string): boolean {
  return TERMINAL_AUTHORIZED.has(status.trim().toLowerCase());
}

export function isKlapPaymentRejected(status: string): boolean {
  return TERMINAL_REJECTED.has(status.trim().toLowerCase());
}

/**
 * Mensaje de presentación para cada estado financiero de un pago Klap.
 * "success" nunca se muestra para "authorized" — evita dar a entender que
 * ya se cobró cuando solo se autorizó la tarjeta.
 */
export function getKlapPaymentStatusMessage(status: string): string {
  switch (status.trim().toLowerCase()) {
    case "authorized":
      return "Tarjeta autorizada. El cobro se realizará al finalizar el viaje.";
    case "capture_pending":
      return "Estamos procesando el cobro final.";
    case "capture_unknown":
      return "El estado del cobro necesita confirmación. No intentes pagar nuevamente.";
    case "capture_failed":
      return "No se pudo completar el cobro. El equipo de soporte debe revisarlo.";
    case "success":
      return "Pago realizado.";
    default:
      return "La orden sigue pendiente. No crees otro pago; Klap puede confirmar por webhook unos minutos después.";
  }
}

export async function waitForKlapPaymentResolution(
  accessToken: string,
  paymentId: string,
  options: {
    retryDelaysMs?: readonly number[];
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
  const delays =
    options.retryDelaysMs ?? KLAP_FAST_STATUS_RETRY_DELAYS_MS;
  const startedAt = Date.now();
  let lastStatus: PaymentStatusData | null = null;

  const wait = (delayMs: number): Promise<void> =>
    new Promise((resolve, reject) => {
      const onAbort = (): void => {
        window.clearTimeout(timer);
        reject(new DOMException("OperaciÃ³n cancelada.", "AbortError"));
      };

      const timer = window.setTimeout(() => {
        options.signal?.removeEventListener("abort", onAbort);
        resolve();
      }, Math.max(0, delayMs));

      options.signal?.addEventListener("abort", onAbort, { once: true });
    });

  for (let index = 0; index < delays.length; index += 1) {
    if (options.signal?.aborted) {
      throw new DOMException("OperaciÃ³n cancelada.", "AbortError");
    }

    const delay = delays[index] ?? 0;
    if (delay > 0) await wait(delay);

    if (document.visibilityState === "hidden") {
      continue;
    }

    lastStatus = await walletService.getPaymentStatus(
      accessToken,
      paymentId,
    );

    if (
      isKlapPaymentApproved(lastStatus.status) ||
      isKlapPaymentAuthorized(lastStatus.status) ||
      isKlapPaymentRejected(lastStatus.status)
    ) {
      return lastStatus;
    }

    options.onPendingStatus?.(lastStatus, {
      attempt: index + 1,
      elapsedMs: Date.now() - startedAt,
      remainingChecks: delays.length - index - 1,
    });
  }

  if (lastStatus) return lastStatus;

  return walletService.getPaymentStatus(accessToken, paymentId);
}
