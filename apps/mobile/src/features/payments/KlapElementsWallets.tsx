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
  const onReadyRef = useRef(onReady);
  const onLoadErrorRef = useRef(onLoadError);
  const onWalletSuccessRef = useRef(onWalletSuccess);
  const onWalletErrorRef = useRef(onWalletError);
  const onSpinnerChangeRef = useRef(onSpinnerChange);

  onReadyRef.current = onReady;
  onLoadErrorRef.current = onLoadError;
  onWalletSuccessRef.current = onWalletSuccess;
  onWalletErrorRef.current = onWalletError;
  onSpinnerChangeRef.current = onSpinnerChange;

  useEffect(() => {
    if (!isKlapElementsEnabled() || disabled || !orderId.trim()) return undefined;

    let cancelled = false;

    const releaseCallbacks = bindApplePayTransparentCallbacks({
      onSuccess: (data) => {
        if (!cancelled) onWalletSuccessRef.current?.(data);
      },
      onError: (data) => {
        if (!cancelled) onWalletErrorRef.current?.(data);
      },
    });

    setLoading(true);

    void loadKlapCheckoutFlexScript()
      .then(() => {
        if (cancelled) return;

        initKlapWalletElements({
          orderId,
          wallets: ["applePay", "googlePay"],
          transparent: true,
          spinner: {
            show: () => onSpinnerChangeRef.current?.(true),
            hide: () => onSpinnerChangeRef.current?.(false),
          },
        });

        onReadyRef.current?.();
      })
      .catch((error) => {
        if (cancelled) return;
        onLoadErrorRef.current?.(
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
    };
  }, [disabled, orderId]);

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
        style={{ overflow: "hidden" }}
      />
    </div>
  );
}
