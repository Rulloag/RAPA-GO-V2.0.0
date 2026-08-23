export type KlapWalletKind = "applePay" | "googlePay";

export type KlapWalletCallbackPayload = Record<string, unknown>;

export type KlapWalletsInitConfig = {
  orderId: string;
  wallets: KlapWalletKind[];
  transparent?: boolean;
  spinner?: {
    show: () => void;
    hide: () => void;
  };
};

declare global {
  interface Window {
    KLAP_FLEX?: {
      initWallets: (config: KlapWalletsInitConfig) => void;
    };
    rapagoKlapApplePaySuccess?: (data: KlapWalletCallbackPayload) => void;
    rapagoKlapApplePayError?: (data: KlapWalletCallbackPayload) => void;
  }
}

export const KLAP_APPLE_PAY_CONTAINER_ID = "klap-apple-pay";
export const KLAP_GOOGLE_PAY_CONTAINER_ID = "klap-google-pay";
export const KLAP_APPLE_PAY_SUCCESS_FN = "rapagoKlapApplePaySuccess";
export const KLAP_APPLE_PAY_ERROR_FN = "rapagoKlapApplePayError";

const SCRIPT_ATTR = "data-rapago-klap-flex";

let scriptLoadPromise: Promise<void> | null = null;
let lastInitializedOrderId: string | null = null;

export function isKlapElementsEnabled(): boolean {
  return String(import.meta.env.VITE_KLAP_ELEMENTS_ENABLED ?? "")
    .trim()
    .toLowerCase() === "true";
}

export function getKlapCheckoutFlexScriptUrl(): string {
  const configured = String(
    import.meta.env.VITE_KLAP_CHECKOUT_FLEX_SCRIPT_URL ?? "",
  ).trim();

  if (configured) return configured;

  return import.meta.env.PROD
    ? "https://klap.cl/pagos/checkout-flex/v1/main.min.js"
    : "https://sandbox.mcdesaqa.cl/pagos/checkout-flex/v1/main.min.js";
}

export function loadKlapCheckoutFlexScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Klap Elements solo está disponible en el navegador."),
    );
  }

  if (window.KLAP_FLEX?.initWallets) {
    return Promise.resolve();
  }

  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[${SCRIPT_ATTR}]`);
    if (existing && window.KLAP_FLEX?.initWallets) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = getKlapCheckoutFlexScriptUrl();
    script.type = "text/javascript";
    script.async = true;
    script.setAttribute(SCRIPT_ATTR, "true");
    script.onload = () => {
      if (window.KLAP_FLEX?.initWallets) {
        resolve();
        return;
      }

      reject(
        new Error(
          "Klap Elements se cargó, pero KLAP_FLEX.initWallets no está disponible.",
        ),
      );
    };
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(
        new Error(
          "No se pudo cargar el script de Klap Elements. Revisa tu conexión.",
        ),
      );
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export function clearKlapWalletContainers(): void {
  for (const id of [
    KLAP_APPLE_PAY_CONTAINER_ID,
    KLAP_GOOGLE_PAY_CONTAINER_ID,
  ]) {
    const node = document.getElementById(id);
    if (node) node.replaceChildren();
  }
}

export function initKlapWalletElements(config: KlapWalletsInitConfig): void {
  if (!window.KLAP_FLEX?.initWallets) {
    throw new Error("Klap Elements no está inicializado.");
  }

  if (lastInitializedOrderId === config.orderId) return;

  clearKlapWalletContainers();
  lastInitializedOrderId = config.orderId;

  window.KLAP_FLEX.initWallets({
    orderId: config.orderId,
    wallets: config.wallets,
    transparent: config.transparent ?? true,
    ...(config.spinner ? { spinner: config.spinner } : {}),
  });
}

export function bindApplePayTransparentCallbacks(handlers: {
  onSuccess: (data: KlapWalletCallbackPayload) => void;
  onError: (data: KlapWalletCallbackPayload) => void;
}): () => void {
  window.rapagoKlapApplePaySuccess = handlers.onSuccess;
  window.rapagoKlapApplePayError = handlers.onError;

  return () => {
    delete window.rapagoKlapApplePaySuccess;
    delete window.rapagoKlapApplePayError;
  };
}
