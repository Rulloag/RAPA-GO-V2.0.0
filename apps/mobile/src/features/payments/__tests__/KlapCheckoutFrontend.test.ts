import { describe, expect, it } from "vitest";
import requestRideSource from "../../../pages/passenger/pages/RequestRidePage.tsx?raw";
import tripsSource from "../../../pages/passenger/pages/TripsPage.tsx?raw";
import ridesFrontendSource from "../../rides/rides.service.ts?raw";
import modalSource from "../KlapCheckoutModal.tsx?raw";
import serviceSource from "../klapCheckout.service.ts?raw";

describe("Klap Checkout Transparente frontend", () => {
  it("crea órdenes Klap embedded y persiste el proveedor real del viaje", () => {
    expect(requestRideSource).toContain("createKlapEmbeddedOrder");
    expect(requestRideSource).toContain('paymentRequiredProvider: "klap"');
    expect(requestRideSource).toContain('activePaymentMethod === "card" ? "klap" : null');
    expect(ridesFrontendSource).toContain('"klap" | "mercadopago"');
    expect(requestRideSource).not.toContain("createMercadoPagoCheckout");
    expect(requestRideSource).not.toContain("window.location.href = payment.urlPay");
  });

  it("usa el contrato requerido por Checkout Transparente", () => {
    expect(modalSource).toContain('id="checkout-klap"');
    expect(modalSource).toContain("data-klap-order-id");
    expect(modalSource).toContain("data-klap-fn-success");
    expect(modalSource).toContain("data-klap-fn-error");
    expect(modalSource).toContain("data-klap-card-number");
    expect(modalSource).toContain("data-klap-expiry-date");
    expect(modalSource).toContain("data-klap-card-cvv");
    expect(modalSource).toContain("data-klap-card-type={klapCardType}");
    expect(modalSource).toContain("data-klap-quotas");
    expect(serviceSource).toContain("sdk.init({");
    expect(serviceSource).toContain('method: "tarjetas"');
    expect(modalSource).toContain("initializedSdk.payOrder?.()");
    expect(modalSource).toContain(
      "Klap informó un error al validar el formulario o procesar el pago",
    );
    expect(modalSource).not.toContain(
      "La autenticación del banco cerró o informó un problema",
    );
  });

  it("prepara el SDK sin escribir tarjetas de prueba en runtime", () => {
    expect(modalSource).toContain("Vista previa de la tarjeta");
    expect(modalSource).toContain("Tipo de tarjeta");
    expect(modalSource).toContain("selectCardKind");
    expect(modalSource).toContain("PAGAR CON");
    expect(modalSource).toContain("disabled={busy || !cardKind}");
    expect(modalSource).toContain(
      "RAPA GO no compara el número con listas de tarjetas",
    );
    expect(modalSource).not.toContain("KLAP_SANDBOX_CARD_KIND_BY_NUMBER");
    expect(modalSource).not.toContain("KLAP_SANDBOX_PROFILE_BY_NUMBER");
    expect(modalSource).not.toContain("reconcileKlapSandboxPayment");
  });

  it("no persiste ni registra número completo o CVV", () => {
    expect(modalSource).not.toContain("localStorage.setItem");
    expect(modalSource).not.toContain("console.log");
    expect(modalSource).not.toContain("console.warn");
    expect(serviceSource).not.toContain('localStorage.setItem("cardNumber"');
    expect(serviceSource).not.toContain('localStorage.setItem("cvv"');
  });

  it("solo muestra el tipo confirmado por el webhook o estado del backend", () => {
    expect(modalSource).toContain("confirmedPaymentLabel(status)");
    expect(modalSource).toContain("status.cardBrand");
    expect(modalSource).toContain("status.cardType");
    expect(modalSource).not.toMatch(/["'`]\d{13,19}["'`]/);
  });

  it("cancela una solicitud no pagada y permite crear otra sin recargar", () => {
    expect(modalSource).toContain("Cancelar esta solicitud");
    expect(modalSource).toContain("onCancelRequest");
    expect(requestRideSource).toContain("cancelPendingKlapRide");
    expect(serviceSource).toContain("resetKlapCheckoutForNextOrder");
    expect(requestRideSource).toContain("klap-request-cancelled-before-payment");
    expect(tripsSource).toContain("Cancelar solicitud");
    expect(serviceSource).not.toContain("Hay otra orden Klap cargada. Recarga");
  });

  it("marca el intento iniciado para no cancelar mientras el cobro se verifica", () => {
    expect(serviceSource).toContain("checkoutStartedAt");
    expect(serviceSource).toContain("markPendingKlapPaymentStarted");
    expect(modalSource).toContain("markPendingKlapPaymentStarted(payment)");
    expect(tripsSource).toContain("Este intento ya fue enviado a Klap");
  });

  it("reduce el polling y se detiene cuando la pestaña está oculta", () => {
    expect(serviceSource).toContain("intervalMs ?? 5_000");
    expect(serviceSource).toContain("slowIntervalMs ?? 15_000");
    expect(serviceSource).toContain('document.visibilityState === "hidden"');
    expect(tripsSource).toContain("attempt < 5 ? 5000 : 15000");
    expect(tripsSource).not.toContain("await wait(2000)");
  });

  it("muestra Klap desde paymentProvider y conserva Mercado Pago histórico", () => {
    expect(tripsSource).toContain('provider === "klap"');
    expect(tripsSource).toContain('return "Tarjeta / Klap"');
    expect(tripsSource).toContain('return "Tarjeta / Mercado Pago"');
    expect(tripsSource).toContain("Pago con tarjeta validado por Klap");
  });

  it("explica rechazos y permite probar otra tarjeta sin recargar", () => {
    expect(modalSource).toContain("Pago rechazado");
    expect(modalSource).toContain("Probar otra tarjeta");
    expect(modalSource).toContain("onRetryRequest");
    expect(modalSource).toContain("status.declineReason");
    expect(requestRideSource).toContain("handleRetryKlapPayment");
    expect(requestRideSource).toContain("resetKlapCheckoutForNextOrder");
    const rejectedHandler =
      requestRideSource.match(
        /const handleKlapRejected = useCallback\(([\s\S]*?)\n\s*const handleRetryKlapPayment/,
      )?.[1] ?? "";

    expect(rejectedHandler).toContain("clearPendingKlapPayment()");
    expect(rejectedHandler).toContain("setSubmitError(message)");
    expect(rejectedHandler).not.toContain("goToTripsAfterRequest");
  });

  it("continúa SEND_TO_CHALLENGE con la misma sesión Cardinal de Klap", () => {
    expect(serviceSource).toContain("KLAP_SANDBOX_CARDINAL_URL");
    expect(serviceSource).toContain("KLAP_PRODUCTION_CARDINAL_URL");
    expect(serviceSource).toContain("preloadKlapCardinal");
    expect(serviceSource).toContain("await preloadKlapCardinal();");
    expect(serviceSource).toContain('data-rapago-klap-cardinal="true"');
    expect(serviceSource).toContain("installKlapReceiptChallengeBridge");
    expect(serviceSource).toContain("ALLOWED_KLAP_RECEIPT_HOSTS");
    expect(serviceSource).toContain("api-pasarela-sandbox.mcdesaqa.cl");
    expect(serviceSource).toContain('/^\\/cards\\/receipt');
    expect(serviceSource).toContain("klapXhrRequests");
    expect(serviceSource).toContain('request?.method !== "POST"');
    expect(serviceSource).toMatch(/response\s*\.\s*clone\(\)\s*\.\s*json\(\)/s);
    expect(serviceSource).toContain("SEND_TO_CHALLENGE");
    expect(serviceSource).toContain("window.Cardinal.continue(");
    expect(serviceSource).toContain('"payments.setupComplete"');
    expect(serviceSource).toContain('"payments.validated"');
    expect(serviceSource).toContain("RAPAGO_KLAP_3DS_STATE_EVENT");
    expect(serviceSource).toContain("safeKlap3dsErrorMessage");
    expect(modalSource).toContain("RapagoKlap3dsStateDetail");
    expect(serviceSource).toContain("sdk.init({");
    expect(modalSource).toContain("initializedSdk.payOrder?.()");
    expect(serviceSource).not.toContain("Cardinal.setup");
    expect(serviceSource).not.toContain("Cardinal.configure");
    expect(serviceSource).toContain("openDirectKlap3dsSandboxChallenge");
    expect(serviceSource).toContain("rapago-klap-3ds-overlay");
    expect(serviceSource).toContain('creq.name = "creq"');
    expect(serviceSource).toContain("VITE_KLAP_DIRECT_3DS_FALLBACK");
    expect(serviceSource).toContain("Modo Sandbox de prueba");
  });

});
