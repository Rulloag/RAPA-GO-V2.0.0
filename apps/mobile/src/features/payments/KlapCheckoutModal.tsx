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
  clearPendingKlapPayment,
  initializeKlapCheckoutOnce,
  KLAP_FAST_STATUS_RETRY_DELAYS_MS,
  RAPAGO_KLAP_3DS_STATE_EVENT,
  isKlapPaymentApproved,
  isKlapPaymentRejected,
  markPendingKlapPaymentStarted,
  resetKlapCheckoutForNextOrder,
  waitForKlapPaymentResolution,
  type PendingKlapPaymentRecord,
  type RapagoKlap3dsStateDetail,
} from "./klapCheckout.service.js";
import { walletService } from "../wallet/wallet.service.js";

type CardBrand = "visa" | "mastercard" | "amex" | "unknown";
export type KlapCardKind = "debit" | "prepaid" | "credit";

type RejectionState = {
  code: string | null;
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

function cardKindLabel(kind: KlapCardKind): string {
  if (kind === "credit") return "Crédito";
  if (kind === "prepaid") return "Prepago";
  return "Débito";
}

function cardKindDescription(kind: KlapCardKind): string {
  if (kind === "credit") {
    return "Compra con cupo de crédito. Puedes elegir las cuotas disponibles.";
  }
  if (kind === "prepaid") {
    return "Usa el saldo cargado en tu tarjeta y paga en una sola vez.";
  }
  return "El monto se descuenta de tu cuenta y se paga en una sola vez.";
}

function confirmedCardTypeLabel(
  value: "credit" | "debit" | "prepaid" | null,
): string | null {
  if (value === "credit") return "crédito";
  if (value === "debit") return "débito";
  if (value === "prepaid") return "prepago";
  return null;
}

function confirmedPaymentLabel(status: {
  cardBrand: string | null;
  cardType: "credit" | "debit" | "prepaid" | null;
}): string {
  const parts = [
    status.cardBrand?.trim().toUpperCase() || null,
    confirmedCardTypeLabel(status.cardType),
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0
    ? `Pago aprobado con ${parts.join(" ")}.`
    : "Pago aprobado por Klap.";
}


function isValidExpiry(value: string): boolean {
  const match = value.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;
  const month = Number(match[1]);
  return month >= 1 && month <= 12;
}

function fallbackDeclineMessage(code: string | null | undefined): string {
  const normalized = String(code ?? "").trim().toUpperCase();

  if (normalized === "AUTHENTICATION_FAILED") {
    return "No pudimos validar la tarjeta con tu banco. No se realizó el cobro.";
  }
  if (normalized === "INSUFFICIENT_FUNDS") {
    return "La tarjeta no dispone de saldo o cupo suficiente. No se realizó el cobro.";
  }
  if (normalized === "INVALID_CVV") {
    return "El banco rechazó el código de seguridad. Revisa el CVV e inténtalo nuevamente.";
  }
  if (normalized === "EXPIRED_CARD") {
    return "La tarjeta está vencida o la fecha ingresada no es válida.";
  }
  if (normalized === "ISSUER_DECLINED") {
    return "Tu banco rechazó la operación. Puedes probar otra tarjeta.";
  }

  return "El pago fue rechazado por Klap o por el banco. No se realizó el cobro.";
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
  const [cardNumber, setCardNumber] = useState("");
  const [cardKind, setCardKind] = useState<KlapCardKind | null>(null);
  const [quotas, setQuotas] = useState("2");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [processing, setProcessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [paymentAttemptStarted, setPaymentAttemptStarted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [rejection, setRejection] = useState<RejectionState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const verifyPaymentRef = useRef<
    ((initialMessage?: string) => Promise<void>) | null
  >(null);
  const verificationRunningRef = useRef<string | null>(null);

  const callbackNames = useMemo(() => {
    const suffix = payment ? safeCallbackSuffix(payment.paymentId) : "none";
    return {
      success: `rapagoKlapSuccess_${suffix}` as const,
      error: `rapagoKlapError_${suffix}` as const,
    };
  }, [payment]);

  const brand = useMemo(() => detectCardBrand(cardNumber), [cardNumber]);
  const klapCardType =
    cardKind === "credit"
      ? "2"
      : cardKind === "debit" || cardKind === "prepaid"
        ? "1"
        : "";
  const effectiveQuotas = cardKind === "credit" ? quotas : "1";
  const busy = processing || cancelling || retrying;
  const formLocked = busy || rejection !== null;

  useEffect(() => {
    setCardNumber("");
    setCardKind(null);
    setQuotas("2");
    setExpiry("");
    setCvv("");
    setProcessing(false);
    setCancelling(false);
    setRetrying(false);
    setPaymentAttemptStarted(false);
    setMessage(null);
    setFieldError(null);
    setRejection(null);
    cancelledRef.current = false;
  }, [payment?.paymentId]);

  useEffect(() => {
    const handleKlap3dsState = (event: Event): void => {
      const detail = (event as CustomEvent<RapagoKlap3dsStateDetail>).detail;
      if (!detail?.message) return;

      setPaymentAttemptStarted(true);
      setProcessing(true);
      setMessage(detail.message);
    };

    window.addEventListener(
      RAPAGO_KLAP_3DS_STATE_EVENT,
      handleKlap3dsState,
    );

    return () => {
      window.removeEventListener(
        RAPAGO_KLAP_3DS_STATE_EVENT,
        handleKlap3dsState,
      );
    };
  }, []);

  useEffect(() => {
    if (!payment || !accessToken) return undefined;

    const callbackWindow = window as unknown as Record<
      string,
      ((payload?: unknown) => void) | undefined
    >;
    let disposed = false;

    const confirmWithBackend = async (initialMessage?: string): Promise<void> => {
      if (verificationRunningRef.current === payment.paymentId) return;
      verificationRunningRef.current = payment.paymentId;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setProcessing(true);
      setPaymentAttemptStarted(true);
      setRejection(null);
      setMessage(
        initialMessage ??
          "Klap recibió la operación. Esperamos la confirmación segura del backend.",
      );

      try {
        const applyTerminalStatus = (
          status: Awaited<
            ReturnType<typeof walletService.getPaymentStatus>
          >,
        ): boolean => {
          if (isKlapPaymentApproved(status.status)) {
            setMessage(confirmedPaymentLabel(status));
            onApproved(payment);
            return true;
          }

          if (isKlapPaymentRejected(status.status)) {
            const declineMessage =
              status.declineReason ||
              fallbackDeclineMessage(status.declineCode);
            const rejectionState: RejectionState = {
              code: status.declineCode ?? null,
              message: declineMessage,
              retryAllowed: status.retryAllowed !== false,
            };

            clearPendingKlapPayment();
            resetKlapCheckoutForNextOrder();
            setRejection(rejectionState);
            setMessage(null);
            onRejected(payment, declineMessage);
            return true;
          }

          return false;
        };

        let progressBand = 0;
        const status = await waitForKlapPaymentResolution(
          accessToken,
          payment.paymentId,
          {
            retryDelaysMs: KLAP_FAST_STATUS_RETRY_DELAYS_MS,
            signal: controller.signal,
            onPendingStatus: (_pendingStatus, context) => {
              if (disposed) return;

              if (context.elapsedMs >= 30_000 && progressBand < 2) {
                progressBand = 2;
                setMessage(
                  "Klap está tardando más de lo normal, pero seguimos verificando automáticamente. No vuelvas a presionar pagar.",
                );
                return;
              }

              if (context.elapsedMs >= 10_000 && progressBand < 1) {
                progressBand = 1;
                setMessage(
                  "Tu banco o Klap sigue procesando el pago. RAPA GO confirmará apenas el backend reciba el resultado.",
                );
              }
            },
          },
        );

        if (disposed || applyTerminalStatus(status)) return;

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
        if (verificationRunningRef.current === payment.paymentId) {
          verificationRunningRef.current = null;
        }
        if (!disposed) setProcessing(false);
      }
    };

    verifyPaymentRef.current = confirmWithBackend;

    callbackWindow[callbackNames.success] = () => {
      void confirmWithBackend();
    };

    callbackWindow[callbackNames.error] = () => {
      void confirmWithBackend(
        "Klap informó un error al validar el formulario o procesar el pago. Verificaremos el resultado real en el backend antes de declarar el pago rechazado.",
      );
    };

    return () => {
      disposed = true;
      abortRef.current?.abort();
      verifyPaymentRef.current = null;
      verificationRunningRef.current = null;
      delete callbackWindow[callbackNames.success];
      delete callbackWindow[callbackNames.error];
    };
  }, [accessToken, callbackNames, onApproved, onRejected, payment]);

  const handleCardNumberChange = (value: string): void => {
    setCardNumber(formatCardNumber(value));
    setFieldError(null);
  };

  const selectCardKind = (kind: KlapCardKind): void => {
    if (busy || rejection) return;
    setCardKind(kind);
    if (kind !== "credit") setQuotas("2");
    setFieldError(null);
  };

  const validateForm = (): string | null => {
    const digits = onlyDigits(cardNumber);
    if (digits.length < 13) return "Revisa el número de tarjeta.";
    if (!cardKind) {
      return "Selecciona Débito, Prepago o Crédito para preparar el checkout de Klap.";
    }
    if (!isValidExpiry(expiry)) {
      return "Ingresa un vencimiento válido en formato MM/AA.";
    }
    if (!/^\d{3,4}$/.test(cvv)) {
      return "El CVV debe tener 3 o 4 números.";
    }
    if (cardKind === "credit" && !/^\d+$/.test(quotas)) {
      return "Selecciona una cantidad de cuotas válida.";
    }
    return null;
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!payment || !accessToken || busy || rejection) return;

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
      const checkoutResult = initializedSdk.payOrder?.();
      setMessage(
        "Procesando con Klap. RAPA GO ya está verificando el resultado con el backend.",
      );

      // Comienza a consultar el backend sin esperar a que la promesa visual del
      // SDK termine. En Sandbox, payOrder puede tardar o responder 504 aunque el
      // webhook confirme correctamente el cobro unos segundos después.
      window.setTimeout(() => {
        void verifyPaymentRef.current?.(
          "Verificando con tu banco. Todavía no se ha confirmado ni rechazado el pago.",
        );
      }, 150);

      void Promise.resolve(checkoutResult).catch(() => {
        if (verificationRunningRef.current !== payment.paymentId) {
          setMessage(
            "Klap demoró en responder al navegador. Seguimos verificando el resultado real con el backend.",
          );
        }
        void verifyPaymentRef.current?.();
      });
    } catch (error) {
      setProcessing(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar el checkout de Klap.",
      );
    }
  };

  const retryPayment = async (): Promise<void> => {
    if (!payment || retrying || processing || !rejection?.retryAllowed) return;

    setRetrying(true);
    setFieldError(null);
    setMessage("Creando una nueva orden segura para probar otra tarjeta...");

    try {
      await onRetryRequest(payment);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No pudimos preparar un nuevo intento de pago.",
      );
      setRetrying(false);
    }
  };

  const cancelRequest = async (): Promise<void> => {
    if (!payment || cancelling || processing || retrying) return;
    if (paymentAttemptStarted && !rejection) return;

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
  const selectedKindLabel = cardKind
    ? cardKindLabel(cardKind)
    : "Tipo pendiente de selección";
  const amountLabel = payment?.amountClp
    ? ` · $${Math.round(payment.amountClp).toLocaleString("es-CL")}`
    : "";
  const payButtonLabel = cardKind
    ? `PAGAR CON ${cardKindLabel(cardKind).toUpperCase()}${amountLabel}`
    : `SELECCIONA EL TIPO DE TARJETA${amountLabel}`;

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
                brand === "visa"
                  ? "linear-gradient(145deg,#14213d 0%,#264b8f 58%,#d5a737 145%)"
                  : brand === "mastercard"
                    ? "linear-gradient(145deg,#24130f 0%,#7a241c 58%,#d5a737 145%)"
                    : brand === "amex"
                      ? "linear-gradient(145deg,#0f3d3e 0%,#126466 58%,#d5a737 145%)"
                      : "linear-gradient(145deg,#26303d 0%,#465465 62%,#c7a452 145%)",
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
                  {selectedKindLabel}
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
              <label style={labelStyle}>
                Número de tarjeta
                <input
                  id="cardNumber"
                  data-klap-card-number
                  type="text"
                  value={cardNumber}
                  onChange={(event) => handleCardNumberChange(event.target.value)}
                  maxLength={23}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="0000 0000 0000 0000"
                  disabled={formLocked}
                  required
                  style={inputStyle}
                />
              </label>

              <div style={{ display: "grid", gap: 9 }}>
                <div style={{ color: "#4b3410", fontSize: ".78rem", fontWeight: 950 }}>
                  Tipo de tarjeta
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 8,
                  }}
                >
                  {(["debit", "prepaid", "credit"] as KlapCardKind[]).map((kind) => {
                    const selected = cardKind === kind;

                    return (
                      <button
                        key={kind}
                        type="button"
                        disabled={formLocked}
                        aria-pressed={selected}
                        onClick={() => selectCardKind(kind)}
                        style={{
                          minHeight: 58,
                          borderRadius: 14,
                          border: selected
                            ? "2px solid #b77b0d"
                            : "1px solid rgba(151,105,27,.32)",
                          background: selected ? "#fff2c5" : "#ffffff",
                          color: "#2f2109",
                          fontWeight: 950,
                        }}
                      >
                        {cardKindLabel(kind)}
                      </button>
                    );
                  })}
                </div>

                <div
                  role="status"
                  style={{
                    borderRadius: 15,
                    padding: "11px 12px",
                    background: "#fff8df",
                    color: "#5f3f00",
                    border: "1px solid rgba(210,164,58,.52)",
                    fontWeight: 850,
                    fontSize: ".74rem",
                    lineHeight: 1.42,
                  }}
                >
                  {cardKind
                    ? `${cardKindDescription(cardKind)} Klap y el banco confirmarán el producto definitivo después del procesamiento.`
                    : "El Checkout Transparente de Klap necesita este dato para preparar el pago. RAPA GO no compara el número con listas de tarjetas."}
                </div>

                <input
                  type="hidden"
                  data-klap-card-type={klapCardType}
                  value={klapCardType}
                  readOnly
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={labelStyle}>
                  Vencimiento
                  <input
                    id="cardExpiryDate"
                    data-klap-expiry-date
                    type="text"
                    value={expiry}
                    onChange={(event) => {
                      setExpiry(formatExpiry(event.target.value));
                      setFieldError(null);
                    }}
                    maxLength={5}
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM/AA"
                    disabled={formLocked}
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
                    onChange={(event) => {
                      setCvv(onlyDigits(event.target.value).slice(0, 4));
                      setFieldError(null);
                    }}
                    maxLength={4}
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="123"
                    disabled={formLocked}
                    required
                    style={inputStyle}
                  />
                  <span style={{ color: "#756039", fontSize: ".66rem", fontWeight: 750 }}>
                    Son los 3 números del reverso; algunas tarjetas usan 4 al frente.
                  </span>
                </label>
              </div>

              {cardKind === "credit" ? (
                <label style={labelStyle}>
                  Cuotas
                  <select
                    data-klap-quotas
                    value={quotas}
                    onChange={(event) => {
                      setQuotas(event.target.value);
                      setFieldError(null);
                    }}
                    disabled={formLocked}
                    required
                    style={inputStyle}
                  >
                    {Array.from({ length: 11 }, (_, index) => index + 2).map(
                      (quota) => (
                        <option key={quota} value={String(quota)}>
                          {quota} cuotas
                        </option>
                      ),
                    )}
                  </select>
                </label>
              ) : (
                <input
                  type="hidden"
                  data-klap-quotas
                  value={effectiveQuotas}
                  readOnly
                />
              )}

              <input id="generateToken" type="checkbox" name="generateToken" data-klap-generate-token checked={false} readOnly hidden />

              {fieldError && (
                <div role="alert" style={{ borderRadius: 14, padding: "11px 12px", background: "#fff1f2", color: "#8b1e2d", border: "1px solid rgba(220,38,38,.30)", fontSize: ".78rem", lineHeight: 1.4, fontWeight: 850 }}>
                  {fieldError}
                </div>
              )}

              {rejection && (
                <div role="alert" style={{ borderRadius: 17, padding: "14px", background: "#fff1f2", color: "#7f1d1d", border: "1px solid rgba(220,38,38,.35)", fontSize: ".8rem", lineHeight: 1.45, fontWeight: 850 }}>
                  <div style={{ fontSize: ".94rem", fontWeight: 950 }}>Pago rechazado</div>
                  <div style={{ marginTop: 5 }}>{rejection.message}</div>
                  <div style={{ marginTop: 7, color: "#991b1b", fontSize: ".72rem" }}>
                    No se realizó el cobro. Puedes probar otra tarjeta o cancelar la solicitud.
                  </div>
                </div>
              )}

              {message && (
                <div role="status" style={{ borderRadius: 14, padding: "11px 12px", background: "#fff8df", color: "#5f3f00", border: "1px solid rgba(210,164,58,.52)", fontSize: ".8rem", lineHeight: 1.42, fontWeight: 800 }}>
                  {message}
                </div>
              )}

              <div style={{ borderRadius: 14, padding: "10px 12px", background: "#eef6ff", color: "#183b63", border: "1px solid #b8d8f5", fontSize: ".72rem", lineHeight: 1.42, fontWeight: 800 }}>
                RAPA GO no guarda el número completo ni el CVV. La selección prepara el Checkout Transparente y el tipo definitivo queda confirmado por Klap o por el banco.
              </div>

              {!rejection && (
                <IonButton
                  type="submit"
                  expand="block"
                  disabled={busy || !cardKind}
                  style={{
                    "--background": "linear-gradient(135deg,#d5a737,#f3d781)",
                    "--color": "#171006",
                    "--border-radius": "16px",
                    minHeight: 52,
                    fontWeight: 950,
                  } as CSSProperties}
                >
                  {processing ? <IonSpinner name="dots" /> : payButtonLabel}
                </IonButton>
              )}

              {rejection?.retryAllowed && (
                <IonButton
                  type="button"
                  expand="block"
                  color="warning"
                  disabled={busy}
                  onClick={() => void retryPayment()}
                  style={{ "--border-radius": "16px", fontWeight: 950 } as CSSProperties}
                >
                  {retrying ? <IonSpinner name="dots" /> : "Probar otra tarjeta"}
                </IonButton>
              )}

              {(!paymentAttemptStarted || rejection) && (
                <IonButton
                  type="button"
                  fill="outline"
                  color="danger"
                  expand="block"
                  disabled={busy}
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
                disabled={busy}
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
