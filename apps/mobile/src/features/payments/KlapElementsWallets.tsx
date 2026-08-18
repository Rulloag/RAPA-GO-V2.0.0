import { useEffect, useRef, useState } from "react";
import {
  bindApplePayTransparentCallbacks,
  initKlapWalletElements,
  isKlapElementsEnabled,
  KLAP_APPLE_PAY_CONTAINER_ID,
  KLAP_APPLE_PAY_ERROR_FN,
  KLAP_APPLE_PAY_SUCCESS_FN,
  KLAP_GOOGLE_PAY_CONTAINER_ID,
  loadKlapCheckoutFlexScript,
  type KlapWalletCallbackPayload,
} from "./klapElements.service.js";

type Props = {
  orderId: string;
  disabled?: boolean;
  onReady?: () => void;
  onLoadError?: (message: string) => void;
  onWalletSuccess?: (data: KlapWalletCallbackPayload) => void;
  onWalletError?: (data: KlapWalletCallbackPayload) => void;
  onSpinnerChange?: (visible: boolean) => void;
};

export function KlapElementsWallets({
  orderId,
  disabled = false,
  onReady,
  onLoadError,
  onWalletSuccess,
  onWalletError,
  onSpinnerChange,
}: Props): JSX.Element | null {
  const [loading, setLoading] = useState(false);
  const initializedOrderRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isKlapElementsEnabled() || disabled || !orderId.trim()) return undefined;

    let cancelled = false;

    const releaseCallbacks = bindApplePayTransparentCallbacks({
      onSuccess: (data) => {
        if (!cancelled) onWalletSuccess?.(data);
      },
      onError: (data) => {
        if (!cancelled) onWalletError?.(data);
      },
    });

    const setSpinner = (visible: boolean): void => {
      if (!cancelled) onSpinnerChange?.(visible);
    };

    setLoading(true);

    void loadKlapCheckoutFlexScript()
      .then(() => {
        if (cancelled) return;
        if (initializedOrderRef.current === orderId) return;

        initKlapWalletElements({
          orderId,
          wallets: ["applePay", "googlePay"],
          transparent: true,
          spinner: {
            show: () => setSpinner(true),
            hide: () => setSpinner(false),
          },
        });

        initializedOrderRef.current = orderId;
        onReady?.();
      })
      .catch((error) => {
        if (cancelled) return;
        onLoadError?.(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar Apple Pay ni Google Pay.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      releaseCallbacks();
      if (initializedOrderRef.current === orderId) {
        initializedOrderRef.current = null;
      }
    };
  }, [
    disabled,
    onLoadError,
    onReady,
    onSpinnerChange,
    onWalletError,
    onWalletSuccess,
    orderId,
  ]);

  if (!isKlapElementsEnabled()) return null;

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: ".88rem", color: "#0f172a" }}>
        Pagar con billetera digital
      </div>

      {loading ? (
        <div style={{ fontSize: ".78rem", color: "#64748b", fontWeight: 700 }}>
          Cargando Apple Pay y Google Pay...
        </div>
      ) : null}

      <div
        id={KLAP_APPLE_PAY_CONTAINER_ID}
        className="klap-wallet-container"
        {...{
          "klap-fn-success": KLAP_APPLE_PAY_SUCCESS_FN,
          "klap-fn-error": KLAP_APPLE_PAY_ERROR_FN,
        }}
      />

      <div
        id={KLAP_GOOGLE_PAY_CONTAINER_ID}
        className="klap-wallet-container"
      />

      <p style={{ margin: 0, fontSize: ".72rem", color: "#64748b", lineHeight: 1.45 }}>
        Apple Pay requiere Safari en iPhone o Mac y el certificado de dominio
        publicado en <code>/.well-known/</code>.
      </p>
    </div>
  );
}
