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
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  initializeKlapCheckoutOnce,
  isKlapPaymentApproved,
  isKlapPaymentRejected,
  klapCheckoutRequiresReload,
  waitForKlapPaymentResolution,
  type PendingKlapPaymentRecord,
} from "./klapCheckout.service.js";

type Props = {
  payment: PendingKlapPaymentRecord | null;
  accessToken: string | null | undefined;
  onApproved: (payment: PendingKlapPaymentRecord) => void;
  onRejected: (
    payment: PendingKlapPaymentRecord,
    message: string,
  ) => void;
  onClose: (payment: PendingKlapPaymentRecord) => void;
};

type CardType = "1" | "2";

function safeCallbackSuffix(paymentId: string): string {
  return paymentId.replace(/[^a-zA-Z0-9]/g, "");
}

export function KlapCheckoutModal({
  payment,
  accessToken,
  onApproved,
  onRejected,
  onClose,
}: Props): JSX.Element {
  const [cardType, setCardType] = useState<CardType>("1");
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reloadRequired, setReloadRequired] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const callbackNames = useMemo(() => {
    const suffix = payment ? safeCallbackSuffix(payment.paymentId) : "none";
    return {
      success: `rapagoKlapSuccess_${suffix}` as const,
      error: `rapagoKlapError_${suffix}` as const,
    };
  }, [payment]);

  useEffect(() => {
    setCardType("1");
    setProcessing(false);
    setMessage(null);
    setReloadRequired(false);
  }, [payment?.paymentId]);

  useEffect(() => {
    if (!payment || !accessToken) return undefined;

    const callbackWindow = window as unknown as Record<
      string,
      ((payload?: unknown) => void) | undefined
    >;
    let disposed = false;

    const confirmWithBackend = async (): Promise<void> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setProcessing(true);
      setMessage(
        "Klap recibió la operación. Estamos esperando la confirmación segura del backend.",
      );

      try {
        const status = await waitForKlapPaymentResolution(
          accessToken,
          payment.paymentId,
          {
            attempts: 30,
            intervalMs: 2_000,
            signal: controller.signal,
          },
        );

        if (disposed) return;

        if (isKlapPaymentApproved(status.status)) {
          setMessage("Pago aprobado por Klap.");
          onApproved(payment);
          return;
        }

        if (isKlapPaymentRejected(status.status)) {
          onRejected(
            payment,
            "Klap informó que el pago fue rechazado o cancelado.",
          );
          return;
        }

        setMessage(
          "El pago continúa pendiente. Puedes cerrar esta ventana y revisarlo en Mis Viajes sin volver a pagar.",
        );
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "No pudimos confirmar el pago todavía. No vuelvas a pagar.",
        );
      } finally {
        if (!disposed) setProcessing(false);
      }
    };

    callbackWindow[callbackNames.success] = () => {
      void confirmWithBackend();
    };

    callbackWindow[callbackNames.error] = () => {
      setProcessing(false);
      const mustReload = klapCheckoutRequiresReload(payment.orderId);
      setReloadRequired(mustReload);
      setMessage(
        mustReload
          ? "El perfil de seguridad de Klap falló. Recarga esta pantalla antes de volver a intentar."
          : "Klap rechazó el intento. Revisa los datos y vuelve a pagar sin recargar el SDK.",
      );
    };

    return () => {
      disposed = true;
      abortRef.current?.abort();
      delete callbackWindow[callbackNames.success];
      delete callbackWindow[callbackNames.error];
    };
  }, [accessToken, callbackNames, onApproved, onRejected, payment]);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!payment || !accessToken || processing) return;

    setProcessing(true);
    setMessage("Abriendo el pago seguro de Klap...");

    try {
      const initializedSdk = await initializeKlapCheckoutOnce(
        payment.orderId,
      );

      await Promise.resolve(initializedSdk.payOrder?.());

      setMessage(
        "Procesando con Klap. No cierres esta ventana hasta recibir confirmación.",
      );
    } catch (error) {
      setProcessing(false);
      setReloadRequired(
        klapCheckoutRequiresReload(payment.orderId),
      );
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar el checkout de Klap.",
      );
    }
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    border: "1px solid rgba(151,105,27,.48)",
    padding: "0 13px",
    background: "#ffffff",
    color: "#111827",
    fontSize: "1rem",
    fontWeight: 750,
    outline: "none",
  };

  const labelStyle: CSSProperties = {
    display: "grid",
    gap: 7,
    color: "#4b3410",
    fontSize: ".78rem",
    fontWeight: 900,
  };

  return (
    <IonModal
      isOpen={payment !== null}
      backdropDismiss={!processing}
      canDismiss={!processing}
      onDidDismiss={() => {
        if (payment && !processing) onClose(payment);
      }}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>Pago seguro con Klap</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div
          style={{
            padding: "20px 18px 30px",
            maxWidth: 520,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              borderRadius: 22,
              padding: 16,
              background: "linear-gradient(145deg,#161006,#33230c)",
              color: "#ffffff",
              boxShadow: "0 16px 36px rgba(0,0,0,.22)",
            }}
          >
            <div
              style={{
                color: "#f5c755",
                fontSize: ".72rem",
                fontWeight: 950,
                letterSpacing: ".08em",
              }}
            >
              KLAP CHECKOUT TRANSPARENTE
            </div>
            <div style={{ marginTop: 6, fontSize: "1.15rem", fontWeight: 950 }}>
              Completa los datos de tu tarjeta
            </div>
            <div
              style={{
                marginTop: 5,
                color: "rgba(255,255,255,.78)",
                fontSize: ".78rem",
                lineHeight: 1.45,
              }}
            >
              RAPA GO no guarda el número, vencimiento ni CVV. El pago solo se
              activa cuando el backend recibe la confirmación de Klap.
            </div>
          </div>

          {payment && (
            <form
              id="checkout-klap"
              data-klap-order-id={payment.orderId}
              data-klap-fn-success={callbackNames.success}
              data-klap-fn-error={callbackNames.error}
              onSubmit={(event) => void submit(event)}
              style={{
                marginTop: 16,
                display: "grid",
                gap: 14,
              }}
            >
              <label style={labelStyle}>
                Tipo de tarjeta
                <select
                  id="klap-card-type-selector"
                  value={cardType}
                  onChange={(event) =>
                    setCardType(event.target.value === "2" ? "2" : "1")
                  }
                  disabled={processing}
                  style={inputStyle}
                >
                  <option value="1">Débito o prepago</option>
                  <option value="2">Crédito</option>
                </select>

                <input
                  id="klap-card-type"
                  type="hidden"
                  data-klap-card-type={cardType}
                />
              </label>

              <label style={labelStyle}>
                Número de tarjeta
                <input
                  id="cardNumber"
                  data-klap-card-number
                  type="text"
                  maxLength={19}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="0000 0000 0000 0000"
                  disabled={processing}
                  required
                  style={inputStyle}
                />
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <label style={labelStyle}>
                  Vencimiento
                  <input
                    id="cardExpiryDate"
                    data-klap-expiry-date
                    type="text"
                    maxLength={5}
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM/AA"
                    disabled={processing}
                    required
                    style={inputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  CVV
                  <input
                    id="cardCvv"
                    data-klap-card-cvv
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="123"
                    disabled={processing}
                    required
                    style={inputStyle}
                  />
                </label>
              </div>

              <input
                id="generateToken"
                type="checkbox"
                name="generateToken"
                data-klap-generate-token
                checked={false}
                readOnly
                hidden
              />

              {cardType === "2" && (
                <label style={labelStyle}>
                  Cuotas
                  <select
                    id="quotas"
                    data-klap-quotas
                    defaultValue="2"
                    disabled={processing}
                    style={inputStyle}
                  >
                    {Array.from({ length: 47 }, (_, index) => index + 2).map(
                      (quota) => (
                        <option key={quota} value={String(quota)}>
                          {quota} cuotas
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}

              <div
                style={{
                  borderRadius: 12,
                  padding: "9px 11px",
                  background: "#eef6ff",
                  color: "#183b63",
                  border: "1px solid #b8d8f5",
                  fontSize: ".75rem",
                  lineHeight: 1.4,
                  fontWeight: 800,
                }}
              >
                Para Sandbox, usa una tarjeta acorde al tipo seleccionado.
                Presiona Pagar una sola vez y espera la respuesta de Klap.
              </div>

              {message && (
                <div
                  role="status"
                  style={{
                    borderRadius: 14,
                    padding: "11px 12px",
                    background: "#fff8df",
                    color: "#5f3f00",
                    border: "1px solid rgba(210,164,58,.52)",
                    fontSize: ".8rem",
                    lineHeight: 1.42,
                    fontWeight: 800,
                  }}
                >
                  {message}
                </div>
              )}

              {reloadRequired && (
                <IonButton
                  type="button"
                  expand="block"
                  fill="outline"
                  onClick={() => window.location.reload()}
                  style={{
                    "--border-color": "#9f6b17",
                    "--color": "#5f3f00",
                    fontWeight: 900,
                  }}
                >
                  Recargar checkout Klap
                </IonButton>
              )}

              <IonButton
                type="submit"
                expand="block"
                disabled={processing || reloadRequired}
                style={{
                  "--background": "linear-gradient(135deg,#d5a737,#f3d781)",
                  "--color": "#171006",
                  "--border-radius": "16px",
                  minHeight: 50,
                  fontWeight: 950,
                } as CSSProperties}
              >
                {processing ? <IonSpinner name="dots" /> : "PAGAR CON KLAP"}
              </IonButton>

              <IonButton
                type="button"
                fill="outline"
                color="medium"
                expand="block"
                disabled={processing}
                onClick={() => onClose(payment)}
              >
                Continuar después en Mis Viajes
              </IonButton>
            </form>
          )}
        </div>
      </IonContent>
    </IonModal>
  );
}
