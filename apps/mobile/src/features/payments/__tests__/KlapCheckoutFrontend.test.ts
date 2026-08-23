import { describe, expect, it } from "vitest";
import requestRideSource from "../../../pages/passenger/pages/RequestRidePage.tsx?raw";
import tripsSource from "../../../pages/passenger/pages/TripsPage.tsx?raw";
import modalSource from "../KlapCheckoutModal.tsx?raw";
import serviceSource from "../klapCheckout.service.ts?raw";

describe("Klap V109 frontend — checkout alojado directo", () => {
  it("crea la orden hosted y abre redirect_url directamente desde Solicitar viaje", () => {
    expect(requestRideSource).toContain("createKlapHostedOrder");
    expect(requestRideSource).toContain(
      "redirectUrl: order.publicCheckoutData.redirectUrl",
    );
    expect(requestRideSource).toContain("markPendingKlapPaymentStarted");
    expect(requestRideSource).toContain("openKlapHostedCheckout");
    expect(requestRideSource).not.toContain("isKlapElementsEnabled");
  });

  it("abre únicamente el host oficial de Klap por HTTPS y en la misma ventana", () => {
    expect(serviceSource).toContain('"pagos.pasarela.multicaja.cl"');
    expect(serviceSource).toContain("import.meta.env.DEV");
    expect(serviceSource).toContain('url.protocol !== "https:"');
    expect(serviceSource).toContain("openKlapHostedCheckout");
    expect(serviceSource).toContain("window.location.assign(safeUrl)");
  });

  it("no captura tarjeta ni carga el SDK/3DS anterior", () => {
    const combined = `${modalSource}\n${serviceSource}\n${requestRideSource}`;
    expect(combined).not.toMatch(
      /cards\/receipt|checkout-frictionless|KLAP\.payOrder|Cardinal\.continue/,
    );
    expect(combined).not.toMatch(
      /data-klap-card-number|data-klap-card-cvv|cardNumber|securityCode/,
    );
  });

  it("mantiene la marca checkoutStartedAt para bloquear duplicados", () => {
    expect(serviceSource).toContain("checkoutStartedAt");
    expect(serviceSource).toContain("markPendingKlapPaymentStarted");
    expect(tripsSource).toContain("Este intento ya fue enviado a Klap");
  });

  it("Mis Viajes reconcilia automáticamente y puede reabrir redirect_url sin volver al modal", () => {
    expect(serviceSource).toContain("reconcileKlapPayment");
    expect(tripsSource).toContain(
      "await walletService.reconcileKlapPayment(accessToken, paymentId)",
    );
    expect(tripsSource).toContain("openKlapHostedCheckout(redirectUrl)");
    expect(tripsSource).toContain('createKlapHostedOrder(');
    expect(tripsSource).toContain('"fast_search"');
    expect(tripsSource).toContain("Pagar {formatClp(RAPAGO_FAST_SEARCH_FEE_CLP)} con Klap");
    expect(tripsSource).not.toContain("No disponible para Klap");
    expect(requestRideSource).not.toContain("YA VOLVÍ DE KLAP · VERIFICAR PAGO");
  });

  it("mantiene mensajes contra cobro duplicado en Mis Viajes", () => {
    expect(serviceSource).toContain("KLAP_FAST_STATUS_RETRY_DELAYS_MS");
    expect(tripsSource).toContain("No crees otro pago");
  });
});
