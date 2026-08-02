import { describe, expect, it } from "vitest";
import requestRideSource from "../../../pages/passenger/pages/RequestRidePage.tsx?raw";
import tripsSource from "../../../pages/passenger/pages/TripsPage.tsx?raw";
import modalSource from "../KlapCheckoutModal.tsx?raw";
import serviceSource from "../klapCheckout.service.ts?raw";

describe("Klap Checkout Transparente frontend", () => {
  it("crea órdenes Klap embedded sin redirigir a Mercado Pago", () => {
    expect(requestRideSource).toContain("createKlapEmbeddedOrder");
    expect(requestRideSource).toContain('paymentRequiredProvider: "klap"');
    expect(requestRideSource).toContain("Tarjeta seleccionada · Klap");
    expect(requestRideSource).not.toContain("createMercadoPagoCheckout");
    expect(requestRideSource).not.toContain("/api/payments/create");
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
    expect(modalSource).toContain("sdk.init()");
    expect(modalSource).toContain("sdk.payOrder()");
  });

  it("no guarda ni lee los datos sensibles de la tarjeta", () => {
    expect(modalSource).not.toContain("setCardNumber");
    expect(modalSource).not.toContain("setCvv");
    expect(modalSource).not.toContain("setExpiry");
    expect(modalSource).not.toContain("localStorage.setItem");
    expect(serviceSource).not.toContain("cardNumber");
    expect(serviceSource).not.toContain("cvv");
  });

  it("espera la confirmación real del backend y permite reanudar", () => {
    expect(serviceSource).toContain("waitForKlapPaymentResolution");
    expect(serviceSource).toContain("walletService.getPaymentStatus");
    expect(tripsSource).toContain("Continuar pago con Klap");
    expect(tripsSource).toContain("Verificando pago con Klap");
    expect(tripsSource).toContain('paymentProvider: provider');
  });

  it("conserva Mercado Pago solo para historial y prioridad antigua", () => {
    expect(tripsSource).toContain('return "Tarjeta / Mercado Pago"');
    expect(tripsSource).toContain('return "Tarjeta / Klap"');
    expect(tripsSource).toContain("No disponible para Klap");
    expect(tripsSource).toContain("no se generará un cobro adicional de Mercado Pago");
  });
});
