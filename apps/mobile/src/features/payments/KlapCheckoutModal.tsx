import {
  IonButton,
  IonContent,
  IonHeader,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  clearPendingKlapPayment,
  getKlapPaymentStatusMessage,
  isKlapPaymentApproved,
  isKlapPaymentAuthorized,
  isKlapPaymentRejected,
  markPendingKlapPaymentStarted,
  openKlapHostedCheckout,
  reconcileKlapPayment,
  resetKlapCheckoutForNextOrder,
  waitForKlapPaymentResolution,
  type PendingKlapPaymentRecord,
} from "./klapCheckout.service.js";

type RejectionState = {
  message: string;
  retryAllowed: boolean;
};

type Props = {
  payment: PendingKlapPaymentRecord | null;
  accessToken: string | null | undefined;
  onApproved: (payment: PendingKlapPaymentRecord) => void;
  onRejected: (
    payment: PendingKlapPaymentRecord,
    message: string,
  ) => void;
  onRetryRequest: (
    payment: PendingKlapPaymentRecord,
  ) => Promise<PendingKlapPaymentRecord>;
  onClose: (payment: PendingKlapPaymentRecord) => void;
  onCancelRequest: (payment: PendingKlapPaymentRecord) => Promise<void>;
};

function rejectionMessage(
  declineReason: string | null,
): string {
  return (
    declineReason ||
    "Klap informó que el pago fue rechazado, cancelado o expiró. No se realizó el cobro."
  );
}

export function KlapCheckoutModal({
  payment,
  accessToken,
  onApproved,
  onRejected,
  onRetryRequest,
  onClose,
  onCancelRequest,
}: Props): JSX.Element {
  const [processing, setProcessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [checkoutOpened, setCheckoutOpened] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rejection, setRejection] = useState<RejectionState | null>(null);
  const verificationRunningRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const busy = processing || cancelling || retrying;
  const checkoutStarted = Boolean(
    checkoutOpened || payment?.checkoutStartedAt,
  );

  useEffect(() => {
    setProcessing(false);
    setCancelling(false);
    setRetrying(false);
    setCheckoutOpened(Boolean(payment?.checkoutStartedAt));
    setMessage(
      payment?.checkoutStartedAt
        ? "El checkout de Klap ya fue abierto. Verifica el resultado antes de volver a pagar."
        : null,
    );
    setRejection(null);
    cancelledRef.current = false;
  }, [payment?.paymentId, payment?.checkoutStartedAt]);

  const verifyWithBackend = useCallback(async (): Promise<void> => {
    if (!payment || !accessToken) return;
    if (verificationRunningRef.current === payment.paymentId) return;

    verificationRunningRef.current = payment.paymentId;
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;
    setProcessing(true);
    setMessage(
      "Consultando el estado oficial de la orden en Klap y esperando el webhook...",
    );

    try {
      // Respaldo oficial: GET /payment-gateway/v1/orders/{order_id}.
      await reconcileKlapPayment(accessToken, payment.paymentId);

      const status = await waitForKlapPaymentResolution(
        accessToken,
        payment.paymentId,
        {
          signal: controller.signal,
          onPendingStatus: (_pendingStatus, context) => {
            if (context.elapsedMs >= 30_000) {
              setMessage(
                "Klap todavía mantiene la orden pendiente. No vuelvas a pagar; puedes revisar nuevamente desde Mis Viajes.",
              );
            }
          },
        },
      );

      if (isKlapPaymentApproved(status.status)) {
        setMessage(getKlapPaymentStatusMessage(status.status));
        onApproved(payment);
        return;
      }

      if (isKlapPaymentAuthorized(status.status)) {
        // Captura diferida: la tarjeta quedó autorizada, no cobrada. El
        // viaje ya puede avanzar — el cobro real ocurre al finalizar el
        // viaje en el backend. Nunca se muestra "pago realizado" aquí.
        setMessage(getKlapPaymentStatusMessage(status.status));
        onApproved(payment);
        return;
      }

      if (isKlapPaymentRejected(status.status)) {
        const reason = rejectionMessage(status.declineReason);
        clearPendingKlapPayment();
        resetKlapCheckoutForNextOrder();
        setRejection({
          message: reason,
          retryAllowed: status.retryAllowed !== false,
        });
        setMessage(null);
        onRejected(payment, reason);
        return;
      }

      setMessage(
        "La orden sigue pendiente. No crees otro pago; Klap puede confirmar por webhook unos minutos después.",
      );
    } catch (error) {
      if (controller.signal.aborted) return;

      setMessage(
        error instanceof Error
          ? error.message
          : "No pudimos confirmar el estado todavía. No vuelvas a pagar.",
      );
    } finally {
      if (verificationRunningRef.current === payment.paymentId) {
        verificationRunningRef.current = null;
      }
      setProcessing(false);
    }
  }, [accessToken, onApproved, onRejected, payment]);

  useEffect(() => {
    if (!payment || !accessToken || !checkoutStarted) return undefined;

    const handleResume = (): void => {
      if (document.visibilityState === "hidden") return;
      void verifyWithBackend();
    };

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("focus", handleResume);

    return () => {
      document.removeEventListener("visibilitychange", handleResume);
      window.removeEventListener("focus", handleResume);
    };
  }, [accessToken, checkoutStarted, payment, verifyWithBackend]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const openCheckout = async (): Promise<void> => {
    if (!payment || !accessToken || busy || rejection) return;

    setMessage("Preparando el checkout oficial de Klap...");

    try {
      let activePayment = payment;
      let redirectUrl = String(payment.redirectUrl ?? "").trim();

      // Recupera redirect_url para una orden V107 guardada sin URL.
      if (!redirectUrl) {
        setRetrying(true);
        activePayment = await onRetryRequest(payment);
        redirectUrl = String(activePayment.redirectUrl ?? "").trim();
        setRetrying(false);
      }

      if (!redirectUrl) {
        throw new Error(
          "Klap no entregó el redirect_url oficial para esta orden.",
        );
      }

      markPendingKlapPaymentStarted(activePayment);
      setCheckoutOpened(true);
      setMessage(
        "Se abrió la página segura de Klap. Completa el pago allí y luego vuelve para verificar.",
      );
      openKlapHostedCheckout(redirectUrl);
    } catch (error) {
      setRetrying(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo abrir el checkout oficial de Klap.",
      );
    }
  };

  const retryPayment = async (): Promise<void> => {
    if (!payment || busy || !rejection?.retryAllowed) return;

    setRetrying(true);
    setMessage("Creando una nueva orden oficial de Klap...");

    try {
      const nextPayment = await onRetryRequest(payment);
      setRejection(null);
      setCheckoutOpened(false);
      setMessage("Nueva orden creada. Abre el checkout para continuar.");

      const redirectUrl = String(nextPayment.redirectUrl ?? "").trim();
      if (redirectUrl) {
        markPendingKlapPaymentStarted(nextPayment);
        setCheckoutOpened(true);
        openKlapHostedCheckout(redirectUrl);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No pudimos preparar un nuevo intento.",
      );
    } finally {
      setRetrying(false);
    }
  };

  const cancelRequest = async (): Promise<void> => {
    if (!payment || busy || checkoutStarted) return;

    const confirmed = window.confirm(
      "¿Cancelar esta solicitud sin pago? Podrás crear otra inmediatamente.",
    );

    if (!confirmed) return;

    setCancelling(true);
    setMessage("Cancelando la solicitud pendiente...");

    try {
      await onCancelRequest(payment);
      cancelledRef.current = true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No pudimos cancelar la solicitud.",
      );
      setCancelling(false);
    }
  };

  const panelStyle: CSSProperties = {
    borderRadius: 18,
    padding: 16,
    border: "1px solid rgba(20, 116, 88, .24)",
    background: "#f3fbf8",
    color: "#123c31",
    lineHeight: 1.5,
  };

  return (
    <IonModal
      isOpen={payment !== null}
      backdropDismiss={!busy}
      canDismiss={!busy}
      onDidDismiss={() => {
        if (payment && !busy && !cancelledRef.current) onClose(payment);
      }}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>Pago seguro con Klap</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div
          style={{
            maxWidth: 560,
            margin: "0 auto",
            display: "grid",
            gap: 16,
          }}
        >
          <div style={panelStyle}>
            <div style={{ fontWeight: 950, fontSize: "1.05rem" }}>
              Checkout oficial alojado por Klap
            </div>
            <div style={{ marginTop: 7, fontSize: ".86rem" }}>
              RAPA GO abrirá el <strong>redirect_url</strong> entregado por la
              API oficial. El número de tarjeta, vencimiento y CVV se ingresan
              únicamente en el dominio de Klap.
            </div>
          </div>

          <div
            style={{
              borderRadius: 18,
              padding: 16,
              background: "#ffffff",
              border: "1px solid rgba(15, 23, 42, .14)",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontSize: ".76rem", color: "#64748b" }}>
              ORDEN KLAP
            </div>
            <div
              style={{
                fontWeight: 900,
                overflowWrap: "anywhere",
                color: "#0f172a",
              }}
            >
              {payment?.orderId ?? "—"}
            </div>
            {payment?.amountClp ? (
              <div style={{ fontWeight: 950, fontSize: "1.25rem" }}>
                ${Math.round(payment.amountClp).toLocaleString("es-CL")}
              </div>
            ) : null}
          </div>

          {rejection ? (
            <div
              role="alert"
              style={{
                borderRadius: 17,
                padding: 14,
                background: "#fff1f2",
                color: "#7f1d1d",
                border: "1px solid rgba(220,38,38,.35)",
                fontWeight: 850,
              }}
            >
              <div style={{ fontSize: ".96rem", fontWeight: 950 }}>
                Pago no aprobado
              </div>
              <div style={{ marginTop: 6 }}>{rejection.message}</div>
            </div>
          ) : null}

          {message ? (
            <div
              role="status"
              style={{
                borderRadius: 15,
                padding: "12px 13px",
                background: "#fff8df",
                color: "#5f3f00",
                border: "1px solid rgba(210,164,58,.52)",
                fontWeight: 800,
                lineHeight: 1.45,
              }}
            >
              {message}
            </div>
          ) : null}

          {!rejection ? (
            <IonButton
              expand="block"
              disabled={busy}
              onClick={() => void openCheckout()}
              style={
                {
                  "--background": "linear-gradient(135deg,#12a878,#0b7b59)",
                  "--color": "#ffffff",
                  "--border-radius": "16px",
                  minHeight: 54,
                  fontWeight: 950,
                } as CSSProperties
              }
            >
              {retrying ? (
                <IonSpinner name="dots" />
              ) : checkoutStarted ? (
                "VOLVER A ABRIR CHECKOUT KLAP"
              ) : (
                "IR AL CHECKOUT SEGURO DE KLAP"
              )}
            </IonButton>
          ) : null}

          {checkoutStarted && !rejection ? (
            <IonButton
              expand="block"
              fill="outline"
              disabled={busy}
              onClick={() => void verifyWithBackend()}
              style={{ "--border-radius": "16px", fontWeight: 950 } as CSSProperties}
            >
              {processing ? (
                <IonSpinner name="dots" />
              ) : (
                "YA VOLVÍ DE KLAP · VERIFICAR PAGO"
              )}
            </IonButton>
          ) : null}

          {rejection?.retryAllowed ? (
            <IonButton
              expand="block"
              color="warning"
              disabled={busy}
              onClick={() => void retryPayment()}
              style={{ "--border-radius": "16px", fontWeight: 950 } as CSSProperties}
            >
              {retrying ? <IonSpinner name="dots" /> : "CREAR NUEVA ORDEN"}
            </IonButton>
          ) : null}

          {!checkoutStarted && !rejection ? (
            <IonButton
              fill="outline"
              color="danger"
              expand="block"
              disabled={busy}
              onClick={() => void cancelRequest()}
            >
              {cancelling ? (
                <IonSpinner name="dots" />
              ) : (
                "Cancelar esta solicitud"
              )}
            </IonButton>
          ) : null}

          <IonButton
            fill="clear"
            color="medium"
            expand="block"
            disabled={busy}
            onClick={() => payment && onClose(payment)}
          >
            Continuar después en Mis Viajes
          </IonButton>
        </div>
      </IonContent>
    </IonModal>
  );
}
