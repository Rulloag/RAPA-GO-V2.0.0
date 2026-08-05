import { describe, expect, it } from "vitest";
import requestRideSource from "../../../pages/passenger/pages/RequestRidePage.tsx?raw";
import tripsSource from "../../../pages/passenger/pages/TripsPage.tsx?raw";
import modalSource from "../KlapCheckoutModal.tsx?raw";
import serviceSource from "../klapCheckout.service.ts?raw";

describe("Klap V108 frontend — checkout alojado", () => {
  it("crea orden hosted y guarda orderId + redirectUrl", () => {
    expect(requestRideSource).toContain("createKlapHostedOrder");
    expect(requestRideSource).toContain(
      "redirectUrl: order.publicCheckoutData.redirectUrl",
    );
    expect(serviceSource).toContain('checkoutType: "redirect"');
    expect(serviceSource).toContain("validateKlapRedirectUrl");
  });

  it("abre únicamente el host oficial de Klap por HTTPS", () => {
    expect(serviceSource).toContain(
      '"pagos-pasarela-sandbox.mcdesaqa.cl"',
    );
    expect(serviceSource).toContain('url.protocol !== "https:"');
    expect(serviceSource).toContain("openKlapHostedCheckout");
    expect(serviceSource).toContain("window.location.assign(safeUrl)");
  });

  it("no captura tarjeta ni carga el SDK/3DS anterior", () => {
    const combined = `${modalSource}\n${serviceSource}`;
    expect(combined).not.toMatch(
      /cards\/receipt|checkout-frictionless|KLAP\.payOrder|Cardinal\.continue/,
    );
    expect(combined).not.toMatch(
      /data-klap-card-number|data-klap-card-cvv|cardNumber|securityCode/,
    );
    expect(modalSource).toContain(
      "El número de tarjeta, vencimiento y CVV se ingresan",
    );
  });

  it("marca el checkout iniciado y bloquea cancelación insegura", () => {
    expect(serviceSource).toContain("checkoutStartedAt");
    expect(serviceSource).toContain("markPendingKlapPaymentStarted");
    expect(modalSource).toContain("checkoutStarted");
    expect(modalSource).toContain("!checkoutStarted && !rejection");
    expect(tripsSource).toContain("Este intento ya fue enviado a Klap");
  });

  it("reconcilia con GET oficial a través del backend al volver", () => {
    expect(serviceSource).toContain("reconcileKlapPayment");
    expect(modalSource).toContain(
      "await reconcileKlapPayment(accessToken, payment.paymentId)",
    );
    expect(tripsSource).toContain(
      "await walletService.reconcileKlapPayment(accessToken, paymentId)",
    );
    expect(modalSource).toContain("YA VOLVÍ DE KLAP · VERIFICAR PAGO");
  });

  it("espera webhook/estado y evita cobros duplicados", () => {
    expect(serviceSource).toContain("KLAP_FAST_STATUS_RETRY_DELAYS_MS");
    expect(modalSource).toContain("No vuelvas a pagar");
    expect(modalSource).toContain("No crees otro pago");
    expect(tripsSource).toContain("No crees otro pago");
  });

  it("permite reabrir el checkout seguro o crear una orden nueva solo tras rechazo", () => {
    expect(modalSource).toContain("VOLVER A ABRIR CHECKOUT KLAP");
    expect(modalSource).toContain("CREAR NUEVA ORDEN");
    expect(modalSource).toContain("rejection?.retryAllowed");
    expect(requestRideSource).toContain("handleRetryKlapPayment");
  });
});
