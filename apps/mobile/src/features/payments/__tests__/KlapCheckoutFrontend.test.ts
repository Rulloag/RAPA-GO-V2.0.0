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

  it("usa el contrato público oficial del formulario Klap", () => {
    expect(modalSource).toContain('id="checkout-klap"');
    expect(modalSource).toContain("data-klap-order-id");
    expect(modalSource).toContain("data-klap-fn-success");
    expect(modalSource).toContain("data-klap-fn-error");
    expect(modalSource).toContain("data-klap-card-number");
    expect(modalSource).toContain("data-klap-expiry-date");
    expect(modalSource).toContain("data-klap-card-cvv");
    expect(modalSource).toContain("data-klap-card-type");
    expect(modalSource).toContain("data-klap-quotas");
    expect(serviceSource).toContain("sdk.init({");
    expect(serviceSource).toContain('method: "tarjetas"');
    expect(modalSource).toContain("initializedSdk.payOrder?.()");
  });

  it("muestra una tarjeta visual y explica débito, prepago y crédito", () => {
    expect(modalSource).toContain("Vista previa de la tarjeta");
    expect(modalSource).toContain('type CardKind = "debit" | "prepaid" | "credit"');
    expect(modalSource).toContain("¿Qué tipo de tarjeta estás usando?");
    expect(modalSource).toContain("Klap y tu banco confirmarán el tipo definitivo");
    expect(modalSource).toContain("La disponibilidad final depende de tu tarjeta y de Klap");
    expect(modalSource).not.toContain("Array.from({ length: 47 }");
  });

  it("no persiste ni registra número completo o CVV", () => {
    expect(modalSource).not.toContain("localStorage.setItem");
    expect(modalSource).not.toContain("console.log");
    expect(modalSource).not.toContain("console.warn");
    expect(serviceSource).not.toContain('localStorage.setItem("cardNumber"');
    expect(serviceSource).not.toContain('localStorage.setItem("cvv"');
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

});
