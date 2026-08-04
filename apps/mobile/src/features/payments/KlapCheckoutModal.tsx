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
  markPendingKlapPaymentStarted,
  isKlapPaymentRejected,
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
  onCancelRequest: (payment: PendingKlapPaymentRecord) => Promise<void>;
};

type CardKind = "debit" | "prepaid" | "credit";
type CardBrand = "visa" | "mastercard" | "amex" | "unknown";

function safeCallbackSuffix(paymentId: string): string {
  return paymentId.replace(/[^a-zA-Z0-9]/g, "");
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function formatCardNumber(value: string): string {
  return onlyDigits(value).slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value: string): string {
  const digits = onlyDigits(value).slice(0, 4);
  return digits.length > 2
    ? `${digits.slice(0, 2)}/${digits.slice(2)}`
    : digits;
}

function detectCardBrand(cardNumber: string): CardBrand {
  const digits = onlyDigits(cardNumber);
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2(?:2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) {
    return "mastercard";
  }
  if (/^3[47]/.test(digits)) return "amex";
  return "unknown";
}

function cardBrandLabel(brand: CardBrand): string {
  if (brand === "visa") return "VISA";
  if (brand === "mastercard") return "MASTERCARD";
  if (brand === "amex") return "AMERICAN EXPRESS";
  return "TARJETA";
}

function cardKindLabel(kind: CardKind): string {
  if (kind === "credit") return "Crédito";
  if (kind === "prepaid") return "Prepago";
  return "Débito";
}

function cardKindDescription(kind: CardKind): string {
  if (kind === "credit") {
    return "Compra con cupo de crédito. Puedes elegir cuotas disponibles.";
  }
  if (kind === "prepaid") {
    return "Usa el saldo cargado en tu tarjeta. Se paga en una sola vez.";
  }
  return "El monto se descuenta de tu cuenta. Se paga en una sola vez.";
}

function isValidExpiry(value: string): boolean {
  const match = value.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;
  const month = Number(match[1]);
  return month >= 1 && month <= 12;
}

export function KlapCheckoutModal({
  payment,
  accessToken,
  onApproved,
  onRejected,
  onClose,
  onCancelRequest,
}: Props): JSX.Element {
  const [cardKind, setCardKind] = useState<CardKind>("debit");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [quotas, setQuotas] = useState("2");
  const [processing, setProcessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [paymentAttemptStarted, setPaymentAttemptStarted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const callbackNames = useMemo(() => {
    const suffix = payment ? safeCallbackSuffix(payment.paymentId) : "none";
    return {
      success: `rapagoKlapSuccess_${suffix}` as const,
      error: `rapagoKlapError_${suffix}` as const,
    };
  }, [payment]);

  const brand = useMemo(() => detectCardBrand(cardNumber), [cardNumber]);
  const klapCardType = cardKind === "credit" ? "2" : "1";
  const disabled = processing || cancelling;

  useEffect(() => {
    setCardKind("debit");
    setCardNumber("");
    setExpiry("");
    setCvv("");
    setQuotas("2");
    setProcessing(false);
    setCancelling(false);
    setPaymentAttemptStarted(false);
    setMessage(null);
    setFieldError(null);
    cancelledRef.current = false;
  }, [payment?.paymentId]);

  useEffect(() => {
    if (!payment || !accessToken) return undefined;

    const callbackWindow = window as unknown as Record<
      string,
      ((payload?: unknown) => void) | undefined
    >;
    let disposed = false;

    const confirmWithBackend = async (initialMessage?: string): Promise<void> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setProcessing(true);
      setPaymentAttemptStarted(true);
      setMessage(
        initialMessage ??
          "Klap recibió la operación. Esperamos la confirmación segura del backend.",
      );

      try {
        const status = await waitForKlapPaymentResolution(
          accessToken,
          payment.paymentId,
          {
            attempts: 10,
            intervalMs: 5_000,
            slowIntervalMs: 15_000,
            fastAttempts: 6,
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
            "Klap informó que el pago fue rechazado, cancelado o no pudo autenticarse.",
          );
          return;
        }

        setMessage(
          "Klap todavía no confirma el resultado. Puedes ir a Mis Viajes; no vuelvas a pagar esta solicitud.",
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
      void confirmWithBackend(
        "Klap no completó la autenticación en pantalla. Verificaremos con el backend si el intento fue rechazado o sigue pendiente.",
      );
    };

    return () => {
      disposed = true;
      abortRef.current?.abort();
      delete callbackWindow[callbackNames.success];
      delete callbackWindow[callbackNames.error];
    };
  }, [accessToken, callbackNames, onApproved, onRejected, payment]);

  const validateForm = (): string | null => {
    const digits = onlyDigits(cardNumber);
    if (digits.length < 13) return "Revisa el número de tarjeta.";
    if (!isValidExpiry(expiry)) return "Ingresa un vencimiento válido en formato MM/AA.";
    if (!/^\d{3,4}$/.test(cvv)) return "El CVV debe tener 3 o 4 números.";
    if (cardKind === "credit" && !/^\d+$/.test(quotas)) {
      return "Selecciona una cantidad de cuotas válida.";
    }
    return null;
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!payment || !accessToken || processing || cancelling) return;

    const validationMessage = validateForm();
    if (validationMessage) {
      setFieldError(validationMessage);
      return;
    }

    setFieldError(null);
    setProcessing(true);
    setMessage("Preparando el pago seguro de Klap...");

    try {
      const initializedSdk = await initializeKlapCheckoutOnce(payment.orderId);
      markPendingKlapPaymentStarted(payment);
      setPaymentAttemptStarted(true);
      await Promise.resolve(initializedSdk.payOrder?.());
      setMessage(
        "Procesando con Klap. No cierres esta ventana hasta recibir confirmación.",
      );
    } catch (error) {
      setProcessing(false);
      setPaymentAttemptStarted(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar el checkout de Klap.",
      );
    }
  };

  const cancelRequest = async (): Promise<void> => {
    if (!payment || cancelling || processing || paymentAttemptStarted) return;

    const confirmed = window.confirm(
      "¿Cancelar esta solicitud? Se quitará de tus viajes pendientes y podrás crear otra inmediatamente.",
    );
    if (!confirmed) return;

    setCancelling(true);
    setFieldError(null);
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

  const inputStyle: CSSProperties = {
    width: "100%",
    minHeight: 50,
    borderRadius: 15,
    border: "1px solid rgba(151,105,27,.42)",
    padding: "0 14px",
    background: "#ffffff",
    color: "#111827",
    fontSize: "1rem",
    fontWeight: 800,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: CSSProperties = {
    display: "grid",
    gap: 7,
    color: "#4b3410",
    fontSize: ".78rem",
    fontWeight: 900,
  };

  const visibleCardNumber = cardNumber || "•••• •••• •••• ••••";
  const visibleExpiry = expiry || "MM/AA";

  return (
    <IonModal
      isOpen={payment !== null}
      backdropDismiss={!disabled}
      canDismiss={!disabled}
      onDidDismiss={() => {
        if (payment && !disabled && !cancelledRef.current) onClose(payment);
      }}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>Pago seguro con Klap</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div style={{ padding: "18px 16px 32px", maxWidth: 560, margin: "0 auto" }}>
          <div
            aria-label="Vista previa de la tarjeta"
            style={{
              position: "relative",
              overflow: "hidden",
              minHeight: 205,
              borderRadius: 26,
              padding: 22,
              background:
                cardKind === "credit"
                  ? "linear-gradient(145deg,#111827 0%,#2f2109 52%,#b47b16 140%)"
                  : cardKind === "prepaid"
                    ? "linear-gradient(145deg,#0f3d3e 0%,#126466 56%,#e1b84b 145%)"
                    : "linear-gradient(145deg,#171006 0%,#4a3108 62%,#d5a737 145%)",
              color: "#ffffff",
              boxShadow: "0 18px 42px rgba(0,0,0,.25)",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: 210,
                height: 210,
                right: -70,
                top: -95,
                borderRadius: "50%",
                background: "rgba(255,255,255,.09)",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ color: "#f8d879", fontSize: ".7rem", fontWeight: 950, letterSpacing: ".12em" }}>
                  RAPA GO · KLAP
                </div>
                <div style={{ marginTop: 5, fontSize: ".9rem", fontWeight: 900 }}>
                  {cardKindLabel(cardKind)}
                </div>
              </div>
              <div style={{ fontSize: ".92rem", fontWeight: 950, letterSpacing: ".05em" }}>
                {cardBrandLabel(brand)}
              </div>
            </div>

            <div
              style={{
                width: 45,
                height: 34,
                marginTop: 23,
                borderRadius: 8,
                background: "linear-gradient(135deg,#f8e29a,#b88a28)",
                boxShadow: "inset 0 0 0 1px rgba(79,53,4,.35)",
              }}
            />

            <div style={{ marginTop: 18, fontSize: "1.23rem", fontWeight: 950, letterSpacing: ".095em" }}>
              {visibleCardNumber}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 19 }}>
              <div>
                <div style={{ fontSize: ".58rem", opacity: .66, fontWeight: 850 }}>TITULAR</div>
                <div style={{ marginTop: 3, fontSize: ".75rem", fontWeight: 900 }}>PASAJERO RAPA GO</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: ".58rem", opacity: .66, fontWeight: 850 }}>VENCE</div>
                <div style={{ marginTop: 3, fontSize: ".75rem", fontWeight: 900 }}>{visibleExpiry}</div>
              </div>
            </div>
          </div>

          {payment && (
            <form
              id="checkout-klap"
              data-klap-order-id={payment.orderId}
              data-klap-fn-success={callbackNames.success}
              data-klap-fn-error={callbackNames.error}
              onSubmit={(event) => void submit(event)}
              style={{ marginTop: 17, display: "grid", gap: 14 }}
            >
              <div style={{ display: "grid", gap: 9 }}>
                <div style={{ color: "#4b3410", fontSize: ".78rem", fontWeight: 950 }}>
                  ¿Qué tipo de tarjeta estás usando?
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
                  {(["debit", "prepaid", "credit"] as CardKind[]).map((kind) => {
                    const selected = cardKind === kind;
                    return (
                      <button
                        key={kind}
                        type="button"
                        disabled={disabled}
                        aria-pressed={selected}
                        onClick={() => setCardKind(kind)}
                        style={{
                          minHeight: 58,
                          borderRadius: 14,
                          border: selected ? "2px solid #b77b0d" : "1px solid rgba(151,105,27,.32)",
                          background: selected ? "#fff2c5" : "#ffffff",
                          color: "#2f2109",
                          fontSize: ".76rem",
                          fontWeight: 950,
                          cursor: disabled ? "not-allowed" : "pointer",
                        }}
                      >
                        {cardKindLabel(kind)}
                      </button>
                    );
                  })}
                </div>
                <div style={{ borderRadius: 12, padding: "9px 11px", background: "#fff8df", color: "#5f3f00", fontSize: ".72rem", lineHeight: 1.38, fontWeight: 800 }}>
                  {cardKindDescription(cardKind)} Klap y tu banco confirmarán el tipo definitivo durante el pago.
                </div>
                <input id="klap-card-type" type="hidden" data-klap-card-type={klapCardType} value={klapCardType} readOnly />
              </div>

              <label style={labelStyle}>
                Número de tarjeta
                <input
                  id="cardNumber"
                  data-klap-card-number
                  type="text"
                  value={cardNumber}
                  onChange={(event) => setCardNumber(formatCardNumber(event.target.value))}
                  maxLength={23}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="0000 0000 0000 0000"
                  disabled={disabled}
                  required
                  style={inputStyle}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={labelStyle}>
                  Vencimiento
                  <input
                    id="cardExpiryDate"
                    data-klap-expiry-date
                    type="text"
                    value={expiry}
                    onChange={(event) => setExpiry(formatExpiry(event.target.value))}
                    maxLength={5}
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM/AA"
                    disabled={disabled}
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
                    value={cvv}
                    onChange={(event) => setCvv(onlyDigits(event.target.value).slice(0, 4))}
                    maxLength={4}
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="123"
                    disabled={disabled}
                    required
                    style={inputStyle}
                  />
                  <span style={{ color: "#756039", fontSize: ".66rem", fontWeight: 750 }}>
                    Son los 3 números del reverso; algunas tarjetas usan 4 al frente.
                  </span>
                </label>
              </div>

              <input id="generateToken" type="checkbox" name="generateToken" data-klap-generate-token checked={false} readOnly hidden />

              {cardKind === "credit" && (
                <label style={labelStyle}>
                  Cuotas
                  <select
                    id="quotas"
                    data-klap-quotas
                    value={quotas}
                    onChange={(event) => setQuotas(event.target.value)}
                    disabled={disabled}
                    style={inputStyle}
                  >
                    {Array.from({ length: 11 }, (_, index) => index + 2).map((quota) => (
                      <option key={quota} value={String(quota)}>
                        {quota} cuotas
                      </option>
                    ))}
                  </select>
                  <span style={{ color: "#756039", fontSize: ".66rem", fontWeight: 750 }}>
                    La disponibilidad final depende de tu tarjeta y de Klap.
                  </span>
                </label>
              )}

              {fieldError && (
                <div role="alert" style={{ borderRadius: 14, padding: "11px 12px", background: "#fff1f2", color: "#8b1e2d", border: "1px solid rgba(220,38,38,.30)", fontSize: ".78rem", lineHeight: 1.4, fontWeight: 850 }}>
                  {fieldError}
                </div>
              )}

              {message && (
                <div role="status" style={{ borderRadius: 14, padding: "11px 12px", background: "#fff8df", color: "#5f3f00", border: "1px solid rgba(210,164,58,.52)", fontSize: ".8rem", lineHeight: 1.42, fontWeight: 800 }}>
                  {message}
                </div>
              )}

              <div style={{ borderRadius: 14, padding: "10px 12px", background: "#eef6ff", color: "#183b63", border: "1px solid #b8d8f5", fontSize: ".72rem", lineHeight: 1.42, fontWeight: 800 }}>
                RAPA GO no guarda el número completo ni el CVV. Presiona pagar una sola vez y espera la confirmación del backend.
              </div>

              <IonButton
                type="submit"
                expand="block"
                disabled={disabled}
                style={{
                  "--background": "linear-gradient(135deg,#d5a737,#f3d781)",
                  "--color": "#171006",
                  "--border-radius": "16px",
                  minHeight: 52,
                  fontWeight: 950,
                } as CSSProperties}
              >
                {processing ? <IonSpinner name="dots" /> : `PAGAR CON KLAP${payment.amountClp ? ` · $${Math.round(payment.amountClp).toLocaleString("es-CL")}` : ""}`}
              </IonButton>

              {!paymentAttemptStarted && (
                <IonButton
                  type="button"
                  fill="outline"
                  color="danger"
                  expand="block"
                  disabled={disabled}
                  onClick={() => void cancelRequest()}
                >
                  {cancelling ? <IonSpinner name="dots" /> : "Cancelar esta solicitud"}
                </IonButton>
              )}

              <IonButton
                type="button"
                fill="clear"
                color="medium"
                expand="block"
                disabled={disabled}
                onClick={() => onClose(payment)}
              >
                {paymentAttemptStarted ? "Continuar después en Mis Viajes" : "Volver sin cancelar"}
              </IonButton>
            </form>
          )}
        </div>
      </IonContent>
    </IonModal>
  );
}
