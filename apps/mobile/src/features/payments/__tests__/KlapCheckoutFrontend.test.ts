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
    expect(serviceSource).toContain("sdk.init({");
    expect(serviceSource).toContain('method: "tarjetas"');
    expect(modalSource).toContain("initializedSdk.payOrder?.()");
    expect(modalSource).toContain(
      "data-klap-card-type={cardType}",
    );
    expect(serviceSource).toContain(
      'typeof window.KLAP?.init === "function"',
    );
    expect(serviceSource).not.toContain(
      "window.KLAP?.init && window.KLAP?.payOrder",
    );
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

describe("Klap Checkout formulario oficial", () => {
  it("usa un campo oculto independiente para data-klap-card-type", () => {
    expect(modalSource).toContain('id="klap-card-type-selector"');
    expect(modalSource).toContain('id="klap-card-type"');
    expect(modalSource).toContain("data-klap-card-type={cardType}");
    expect(modalSource).not.toContain(
      "<select\n                  data-klap-card-type",
    );
  });

  it("espera payOrder después de KLAP.init", () => {
    expect(serviceSource).toContain(
      "export async function waitForKlapPayOrder",
    );
    expect(serviceSource).toContain(
      "const initializedSdk = await waitForKlapPayOrder();",
    );
    expect(serviceSource).not.toContain("debug: true");
  });

  it("incluye todos los campos esperados por Klap", () => {
    expect(modalSource).toContain('id="cardNumber"');
    expect(modalSource).toContain('id="cardExpiryDate"');
    expect(modalSource).toContain('id="cardCvv"');
    expect(modalSource).toContain('id="generateToken"');
    expect(modalSource).toContain("data-klap-generate-token");
  });
});



describe("Klap Checkout inicialización única", () => {
  it("inicializa Klap una sola vez por orderId", () => {
    expect(serviceSource).toContain(
      "export async function initializeKlapCheckoutOnce",
    );
    expect(serviceSource).toContain(
      'status: "idle"',
    );
    expect(serviceSource).toContain(
      'status === "failed"',
    );
    expect(modalSource).toMatch(
      /initializeKlapCheckoutOnce\(\s*payment\.orderId,?\s*\)/,
    );
    expect(modalSource).not.toContain(
      "sdk.init({",
    );
  });

  it("obliga a recargar después de un fallo de perfil de seguridad", () => {
    expect(serviceSource).toContain(
      "klapCheckoutRequiresReload",
    );
    expect(modalSource).toContain(
      "Recargar checkout Klap",
    );
    expect(modalSource).toContain(
      "window.location.reload()",
    );
  });
});
