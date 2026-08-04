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
  isKlapPaymentApproved,
  isKlapPaymentRejected,
  markPendingKlapPaymentStarted,
  resetKlapCheckoutForNextOrder,
  waitForKlapPaymentResolution,
  type PendingKlapPaymentRecord,
} from "./klapCheckout.service.js";
import {
  walletService,
  type KlapSandboxTestProfile,
} from "../wallet/wallet.service.js";

export type KlapCardKind = "debit" | "prepaid" | "credit";
type CardBrand = "visa" | "mastercard" | "amex" | "unknown";
type CardKindSource = "detected" | "manual" | null;

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

/**
 * Tarjetas oficiales del ambiente de pruebas compartidas por Klap para RAPA GO.
 * Se usa coincidencia exacta: nunca se adivina el producto de una tarjeta real
 * usando solo el número, porque Visa/Mastercard no codifican de manera universal
 * si una cuenta es débito, prepago o crédito para todos los emisores.
 */
const KLAP_SANDBOX_CARD_KIND_BY_NUMBER: Readonly<Record<string, KlapCardKind>> = {
  "4985468390202984": "prepaid",
  "4000000000001091": "credit",
  "5200000000001096": "debit",
};

const KLAP_SANDBOX_PROFILE_BY_NUMBER: Readonly<
  Record<string, KlapSandboxTestProfile>
> = {
  "4985468390202984": "visa_prepaid_2984",
  "4000000000001091": "visa_credit_1091",
  "5200000000001096": "mastercard_debit_1096",
  "4456530000001112": "visa_auth_rejected_1112",
  "5200000000001112": "mastercard_auth_rejected_1112",
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

export function detectKlapSandboxCardKind(
  cardNumber: string,
): KlapCardKind | null {
  return KLAP_SANDBOX_CARD_KIND_BY_NUMBER[onlyDigits(cardNumber)] ?? null;
}

export function detectKlapSandboxTestProfile(
  cardNumber: string,
): KlapSandboxTestProfile | null {
  return KLAP_SANDBOX_PROFILE_BY_NUMBER[onlyDigits(cardNumber)] ?? null;
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
  const [cardKind, setCardKind] = useState<KlapCardKind | null>(null);
  const [cardKindSource, setCardKindSource] =
    useState<CardKindSource>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [quotas, setQuotas] = useState("2");
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
  const sandboxProfileRef = useRef<KlapSandboxTestProfile | null>(null);

  const callbackNames = useMemo(() => {
    const suffix = payment ? safeCallbackSuffix(payment.paymentId) : "none";
    return {
      success: `rapagoKlapSuccess_${suffix}` as const,
      error: `rapagoKlapError_${suffix}` as const,
    };
  }, [payment]);

  const brand = useMemo(() => detectCardBrand(cardNumber), [cardNumber]);
  const klapCardType =
    cardKind === "credit" ? "2" : cardKind === "debit" || cardKind === "prepaid" ? "1" : "";
  const effectiveQuotas = cardKind === "credit" ? quotas : "1";
  const busy = processing || cancelling || retrying;
  const formLocked = busy || rejection !== null;

  useEffect(() => {
    setCardKind(null);
    setCardKindSource(null);
    setCardNumber("");
    setExpiry("");
    setCvv("");
    setQuotas("2");
    setProcessing(false);
    setCancelling(false);
    setRetrying(false);
    setPaymentAttemptStarted(false);
    setMessage(null);
    setFieldError(null);
    setRejection(null);
    cancelledRef.current = false;
    sandboxProfileRef.current = null;
  }, [payment?.paymentId]);

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
            setMessage("Pago aprobado por Klap.");
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

        let status = await waitForKlapPaymentResolution(
          accessToken,
          payment.paymentId,
          {
            attempts: 3,
            intervalMs: 5_000,
            slowIntervalMs: 15_000,
            fastAttempts: 3,
            signal: controller.signal,
          },
        );

        if (disposed || applyTerminalStatus(status)) return;

        const sandboxProfile = sandboxProfileRef.current;

        if (sandboxProfile) {
          setMessage(
            "Conciliando la tarjeta oficial de prueba Klap en Sandbox...",
          );

          try {
            status = await walletService.reconcileKlapSandboxPayment(
              accessToken,
              payment.paymentId,
              sandboxProfile,
            );
          } catch {
            // El webhook continúa siendo la vía principal. Si el respaldo
            // Sandbox no está disponible, se mantiene el polling normal.
          }

          if (disposed || applyTerminalStatus(status)) return;
        }

        status = await waitForKlapPaymentResolution(
          accessToken,
          payment.paymentId,
          {
            attempts: 10,
            intervalMs: 5_000,
            slowIntervalMs: 15_000,
            fastAttempts: 5,
            signal: controller.signal,
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
        "La autenticación del banco cerró o informó un problema. Verificaremos el resultado real en el backend antes de declarar el pago rechazado.",
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
    const formatted = formatCardNumber(value);
    const detected = detectKlapSandboxCardKind(formatted);
    sandboxProfileRef.current = detectKlapSandboxTestProfile(formatted);

    setCardNumber(formatted);
    setFieldError(null);

    if (detected) {
      setCardKind(detected);
      setCardKindSource("detected");
      if (detected !== "credit") setQuotas("2");
      return;
    }

    if (cardKindSource === "detected") {
      setCardKind(null);
      setCardKindSource(null);
    }
  };

  const selectCardKind = (kind: KlapCardKind): void => {
    if (busy || rejection) return;
    setCardKind(kind);
    setCardKindSource("manual");
    setFieldError(null);
  };

  const validateForm = (): string | null => {
    const digits = onlyDigits(cardNumber);
    if (digits.length < 13) return "Revisa el número de tarjeta.";
    if (!cardKind) {
      return "Selecciona si tu tarjeta es débito, prepago o crédito.";
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
      await Promise.resolve(initializedSdk.payOrder?.());
      setMessage(
        "Procesando con Klap. No cierres esta ventana hasta recibir confirmación.",
      );

      // Respaldo: algunos navegadores o el desafío 3DS pueden no ejecutar el
      // callback visual aunque el webhook sí llegue. La confirmación siempre se
      // consulta al backend, nunca se decide por el callback del navegador.
      window.setTimeout(() => {
        void verifyPaymentRef.current?.(
          "Verificando con tu banco. Todavía no se ha confirmado ni rechazado el pago.",
        );
      }, 2_500);
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
  const selectedKindLabel = cardKind ? cardKindLabel(cardKind) : "Tipo por confirmar";
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
                cardKind === "credit"
                  ? "linear-gradient(145deg,#111827 0%,#2f2109 52%,#b47b16 140%)"
                  : cardKind === "prepaid"
                    ? "linear-gradient(145deg,#0f3d3e 0%,#126466 56%,#e1b84b 145%)"
                    : cardKind === "debit"
                      ? "linear-gradient(145deg,#171006 0%,#4a3108 62%,#d5a737 145%)"
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

                {cardKindSource === "detected" && cardKind ? (
                  <div
                    role="status"
                    style={{
                      borderRadius: 15,
                      padding: "12px 13px",
                      background: "#ecfdf5",
                      color: "#065f46",
                      border: "1px solid rgba(16,185,129,.35)",
                      fontWeight: 900,
                      fontSize: ".8rem",
                    }}
                  >
                    ✓ Detectada automáticamente: {cardKindLabel(cardKind)}
                  </div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
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
                              border: selected ? "2px solid #b77b0d" : "1px solid rgba(151,105,27,.32)",
                              background: selected ? "#fff2c5" : "#ffffff",
                              color: "#2f2109",
                              fontSize: ".76rem",
                              fontWeight: 950,
                              cursor: formLocked ? "not-allowed" : "pointer",
                            }}
                          >
                            {cardKindLabel(kind)}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ borderRadius: 12, padding: "9px 11px", background: "#fff8df", color: "#5f3f00", fontSize: ".72rem", lineHeight: 1.38, fontWeight: 800 }}>
                      {cardKind
                        ? `${cardKindDescription(cardKind)} Klap y tu banco confirmarán el tipo definitivo.`
                        : onlyDigits(cardNumber).length >= 6
                          ? "No es seguro deducir débito, prepago o crédito solo con el número de una tarjeta real. Selecciona el tipo indicado por tu banco."
                          : "Escribe la tarjeta. Las tarjetas oficiales de prueba Klap se detectan automáticamente."}
                    </div>
                  </>
                )}

                <input
                  id="klap-card-type"
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

              <input id="generateToken" type="checkbox" name="generateToken" data-klap-generate-token checked={false} readOnly hidden />

              {cardKind === "credit" ? (
                <label style={labelStyle}>
                  Cuotas
                  <select
                    id="quotas"
                    data-klap-quotas
                    value={quotas}
                    onChange={(event) => setQuotas(event.target.value)}
                    disabled={formLocked}
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
              ) : (
                <input
                  id="quotas"
                  type="hidden"
                  data-klap-quotas
                  value={effectiveQuotas}
                  readOnly
                />
              )}

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
                RAPA GO no guarda el número completo ni el CVV. Presiona pagar una sola vez y espera la confirmación del backend.
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
